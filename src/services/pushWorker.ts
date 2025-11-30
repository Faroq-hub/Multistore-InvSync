import { ConnectionRepo, JobRepo, JobItemRepo, AuditRepo, ConnectionRow } from '../db';

// Generic fetch function type compatible with both native fetch and node-fetch
type FetchFn = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ ok: boolean; status: number; json: () => Promise<any>; text: () => Promise<string>; headers: { get: (name: string) => string | null } }>;

// Use Node.js built-in fetch (available in Node 18+)
// Fallback to dynamic import of node-fetch if needed
const getFetch = async (): Promise<FetchFn> => {
  if (typeof globalThis.fetch !== 'undefined') {
    return globalThis.fetch as unknown as FetchFn;
  }
  const nodeFetch = await import('node-fetch');
  return nodeFetch.default as unknown as FetchFn;
};
import { fetchShopifyCatalog } from '../integrations/shopify';
import { fetchWooCatalog } from '../integrations/woocommerce';
import { CatalogItem } from '../models/types';

async function getSourceItems(filterSkus?: Set<string>): Promise<CatalogItem[]> {
  console.log('[getSourceItems] Fetching from Shopify and WooCommerce...');
  const [shopify, woo] = await Promise.all([fetchShopifyCatalog(), fetchWooCatalog()]);
  console.log(`[getSourceItems] Shopify items: ${shopify.length}, WooCommerce items: ${woo.length}`);
  
  // Treat Shopify as primary; dedupe SKUs
  const map = new Map<string, CatalogItem>();
  for (const it of [...shopify, ...woo]) {
    if (!map.has(it.sku) || (map.get(it.sku)!.source !== 'shopify' && it.source === 'shopify')) {
      map.set(it.sku, it);
    }
  }
  let items = Array.from(map.values());
  console.log(`[getSourceItems] Unique items after dedup: ${items.length}`);
  
  if (filterSkus && filterSkus.size > 0) {
    items = items.filter(i => filterSkus.has(i.sku));
    console.log(`[getSourceItems] Items after filter: ${items.length}`);
  }
  return items;
}

function applyRules(item: CatalogItem, rulesJson: string | null): CatalogItem {
  if (!rulesJson) return item;
  try {
    const rules = JSON.parse(rulesJson);
    const copy = { ...item };
    if (typeof rules.price_multiplier === 'number' && !Number.isNaN(rules.price_multiplier)) {
      const p = Number(copy.price);
      if (!Number.isNaN(p)) copy.price = (p * rules.price_multiplier).toFixed(2);
    }
    return copy;
  } catch {
    return item;
  }
}

// Helper to find product in destination by SKU or barcode
async function findProductInDestination(
  fetch: FetchFn,
  headers: Record<string, string>,
  domain: string,
  apiVersion: string,
  item: CatalogItem
): Promise<{ variant: any; product: any } | null> {
  // First try to find by SKU
  const skuUrl = `https://${domain}/admin/api/${apiVersion}/variants.json?sku=${encodeURIComponent(item.sku)}`;
  const skuRes = await fetch(skuUrl, { headers });
  if (skuRes.ok) {
    const skuData: any = await skuRes.json();
    if (skuData.variants && skuData.variants.length > 0) {
      const v = skuData.variants[0];
      // Fetch the full product
      const prodUrl = `https://${domain}/admin/api/${apiVersion}/products/${v.product_id}.json`;
      const prodRes = await fetch(prodUrl, { headers });
      if (prodRes.ok) {
        const prodData: any = await prodRes.json();
        return { variant: v, product: prodData.product };
      }
      return { variant: v, product: null };
    }
  }

  // If not found by SKU and we have a barcode, try to find by barcode
  if (item.barcode) {
    const barcodeUrl = `https://${domain}/admin/api/${apiVersion}/variants.json?barcode=${encodeURIComponent(item.barcode)}`;
    const barcodeRes = await fetch(barcodeUrl, { headers });
    if (barcodeRes.ok) {
      const barcodeData: any = await barcodeRes.json();
      if (barcodeData.variants && barcodeData.variants.length > 0) {
        const v = barcodeData.variants[0];
        const prodUrl = `https://${domain}/admin/api/${apiVersion}/products/${v.product_id}.json`;
        const prodRes = await fetch(prodUrl, { headers });
        if (prodRes.ok) {
          const prodData: any = await prodRes.json();
          return { variant: v, product: prodData.product };
        }
        return { variant: v, product: null };
      }
    }
  }

  return null;
}

// Helper to create a new product in Shopify destination
async function createProductInShopify(
  fetch: FetchFn,
  headers: Record<string, string>,
  domain: string,
  apiVersion: string,
  item: CatalogItem,
  conn: ConnectionRow,
  log: (m: string) => void
): Promise<{ variant: any; product: any } | null> {
  const shouldSyncCategories = conn.sync_categories === 1;
  
  // Build the product payload
  const productPayload: any = {
    product: {
      title: item.title,
      body_html: item.description || '',
      vendor: item.vendor || '',
      product_type: shouldSyncCategories ? (item.category || '') : '',
      tags: item.tags?.join(', ') || '',
      status: 'active',
      variants: [
        {
          sku: item.sku,
          barcode: item.barcode || '',
          price: item.price,
          compare_at_price: item.compareAtPrice || null,
          inventory_management: 'shopify',
          inventory_policy: 'deny',
          weight: item.weight || 0,
          weight_unit: item.weightUnit || 'kg',
        }
      ]
    }
  };

  // Add images if available
  if (item.images && item.images.length > 0) {
    productPayload.product.images = item.images.map(src => ({ src }));
  } else if (item.imageUrl) {
    productPayload.product.images = [{ src: item.imageUrl }];
  }

  const createUrl = `https://${domain}/admin/api/${apiVersion}/products.json`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(productPayload)
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create product: ${createRes.status} - ${errorText}`);
  }

  const createData: any = await createRes.json();
  const newProduct = createData.product;
  const newVariant = newProduct.variants?.[0];

  log(`Created new product: ${item.title} (SKU: ${item.sku})`);
  await AuditRepo.write({
    level: 'info',
    connection_id: conn.id,
    sku: item.sku,
    message: `Created new product: ${item.title}`
  });

  return { variant: newVariant, product: newProduct };
}

async function pushToShopify(connId: string, log: (m: string) => void, filterSkus?: Set<string>) {
  const conn = await ConnectionRepo.get(connId);
  if (!conn || !conn.dest_shop_domain || !conn.access_token) throw new Error('Invalid Shopify connection');
  
  log(`Fetching source items for connection: ${connId}`);
  const items = await getSourceItems(filterSkus);
  log(`Found ${items.length} source items to process`);

  const fetch = await getFetch();
  const headers = {
    'X-Shopify-Access-Token': conn.access_token,
    'Content-Type': 'application/json'
  };
  const apiVersion = process.env.DEST_API_VERSION || '2024-10';
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Get sync options from connection
  const shouldSyncPrice = conn.sync_price === 1;
  const shouldCreateProducts = conn.create_products === 1;

  log(`Sync options - Price: ${shouldSyncPrice}, Create Products: ${shouldCreateProducts}, Categories: ${conn.sync_categories === 1}`);
  log(`Destination: ${conn.dest_shop_domain}, Location ID: ${conn.dest_location_id}`);

  for (const raw of items) {
    const item = applyRules(raw, conn.rules_json);
    try {
      // Find product by SKU or barcode
      let found = await findProductInDestination(fetch, headers, conn.dest_shop_domain, apiVersion, item);

      if (!found) {
        // Product doesn't exist in destination
        if (shouldCreateProducts) {
          // Create the product
          log(`Product not found, creating: ${item.sku}`);
          found = await createProductInShopify(fetch, headers, conn.dest_shop_domain, apiVersion, item, conn, log);
          if (!found) {
            log(`Failed to create product: ${item.sku}`);
            continue;
          }
        } else {
          // Skip - product creation is disabled
          const msg = `Product not found and creation disabled`;
          log(`${msg}: ${item.sku}`);
          await AuditRepo.write({ level: 'warn', connection_id: conn.id, sku: item.sku, message: msg });
          continue;
        }
      }

      const v = found.variant;

      // Update price only if sync_price is enabled
      if (shouldSyncPrice) {
        const currentPrice = String(v.price ?? '');
        const desiredPrice = String(item.price ?? '');
        if (desiredPrice && desiredPrice !== currentPrice) {
          const upUrl = `https://${conn.dest_shop_domain}/admin/api/${apiVersion}/variants/${v.id}.json`;
          const priceRes = await fetch(upUrl, { 
            method: 'PUT', 
            headers, 
            body: JSON.stringify({ variant: { id: v.id, price: desiredPrice } }) 
          });
          if (priceRes.ok) {
            const msg = `Price updated ${currentPrice} -> ${desiredPrice}`;
            log(`${msg} (${item.sku})`);
            await AuditRepo.write({ level: 'info', connection_id: conn.id, sku: item.sku, message: msg });
          }
        }
      }

      // Always update inventory if location provided
      if (conn.dest_location_id && v.inventory_item_id != null && item.stock != null) {
        const invUrl = `https://${conn.dest_shop_domain}/admin/api/${apiVersion}/inventory_levels/set.json`;
        const invRes = await fetch(invUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            location_id: Number(conn.dest_location_id),
            inventory_item_id: Number(v.inventory_item_id),
            available: Number(item.stock)
          })
        });
        if (invRes.ok) {
          const msg = `Stock set -> ${item.stock}`;
          log(`${msg} (${item.sku})`);
          await AuditRepo.write({ level: 'info', connection_id: conn.id, sku: item.sku, message: msg });
        }
      }
      await sleep(250);
    } catch (e: any) {
      const emsg = `Error pushing SKU: ${e?.message || e}`;
      log(`${emsg} (${item.sku})`);
      await AuditRepo.write({ level: 'error', connection_id: conn.id, sku: item.sku, message: emsg });
    }
  }
}

// Helper to create a new product in WooCommerce destination
async function createProductInWoo(
  fetch: FetchFn,
  base: string,
  auth: URLSearchParams,
  item: CatalogItem,
  conn: ConnectionRow,
  log: (m: string) => void
): Promise<any | null> {
  const shouldSyncCategories = conn.sync_categories === 1;
  
  // Build the product payload
  const productPayload: any = {
    name: item.title,
    type: 'simple',
    regular_price: item.price,
    description: item.description || '',
    short_description: '',
    sku: item.sku,
    manage_stock: true,
    stock_quantity: item.stock || 0,
    stock_status: (item.stock || 0) > 0 ? 'instock' : 'outofstock',
    status: 'publish'
  };

  // Add barcode as meta data if available
  if (item.barcode) {
    productPayload.meta_data = [
      { key: '_barcode', value: item.barcode },
      { key: 'barcode', value: item.barcode }
    ];
  }

  // Add images if available
  if (item.images && item.images.length > 0) {
    productPayload.images = item.images.map(src => ({ src }));
  } else if (item.imageUrl) {
    productPayload.images = [{ src: item.imageUrl }];
  }

  // Handle categories if enabled
  if (shouldSyncCategories && item.category) {
    // First, try to find or create the category
    const catSearchUrl = `${base}/wp-json/wc/v3/products/categories?${auth.toString()}&search=${encodeURIComponent(item.category)}`;
    const catRes = await fetch(catSearchUrl);
    let categoryId = null;
    
    if (catRes.ok) {
      const categories: any[] = await catRes.json();
      const existingCat = categories.find(c => c.name.toLowerCase() === item.category!.toLowerCase());
      
      if (existingCat) {
        categoryId = existingCat.id;
      } else {
        // Create the category
        const createCatUrl = `${base}/wp-json/wc/v3/products/categories?${auth.toString()}`;
        const createCatRes = await fetch(createCatUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: item.category })
        });
        if (createCatRes.ok) {
          const newCat: any = await createCatRes.json();
          categoryId = newCat.id;
          log(`Created category: ${item.category}`);
        }
      }
    }
    
    if (categoryId) {
      productPayload.categories = [{ id: categoryId }];
    }
  }

  const createUrl = `${base}/wp-json/wc/v3/products?${auth.toString()}`;
  const createRes = await fetch(createUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productPayload)
  });

  if (!createRes.ok) {
    const errorText = await createRes.text();
    throw new Error(`Failed to create WooCommerce product: ${createRes.status} - ${errorText}`);
  }

  const newProduct: any = await createRes.json();
  
  log(`Created new WooCommerce product: ${item.title} (SKU: ${item.sku})`);
  await AuditRepo.write({
    level: 'info',
    connection_id: conn.id,
    sku: item.sku,
    message: `Created new WooCommerce product: ${item.title}`
  });

  return newProduct;
}

async function pushToWoo(connId: string, log: (m: string) => void, filterSkus?: Set<string>) {
  const conn = await ConnectionRepo.get(connId);
  if (!conn || !conn.base_url || !conn.consumer_key || !conn.consumer_secret) throw new Error('Invalid Woo connection');
  const items = await getSourceItems(filterSkus);

  const fetch = await getFetch();
  const auth = new URLSearchParams({
    consumer_key: conn.consumer_key,
    consumer_secret: conn.consumer_secret
  });
  const base = conn.base_url.replace(/\/$/, '');

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  // Get sync options from connection
  const shouldSyncPrice = conn.sync_price === 1;
  const shouldCreateProducts = conn.create_products === 1;

  log(`Sync options - Price: ${shouldSyncPrice}, Create Products: ${shouldCreateProducts}, Categories: ${conn.sync_categories === 1}`);

  for (const raw of items) {
    const item = applyRules(raw, conn.rules_json);
    try {
      // Search product by SKU
      const searchUrl = `${base}/wp-json/wc/v3/products?${auth.toString()}&sku=${encodeURIComponent(item.sku)}`;
      const res = await fetch(searchUrl);
      if (!res.ok) throw new Error(`Woo search status ${res.status}`);
      const products: any = await res.json();
      let found = null;
      if (Array.isArray(products) && products.length > 0) {
        found = products[0];
      }

      // If not found by SKU, try barcode search via meta query (if barcode exists)
      if (!found && item.barcode) {
        // WooCommerce doesn't have native barcode search, but we can try via meta
        // This requires a custom search or plugin - for now we'll skip this
        log(`Product not found by SKU, barcode search not implemented for WooCommerce: ${item.sku}`);
      }

      if (!found) {
        if (shouldCreateProducts) {
          // Create the product
          log(`Product not found, creating: ${item.sku}`);
          found = await createProductInWoo(fetch, base, auth, item, conn, log);
          if (!found) {
            log(`Failed to create product: ${item.sku}`);
            continue;
          }
          // Product just created, no need to update
          await sleep(250);
          continue;
        } else {
          const msg = `Product not found and creation disabled`;
          log(`${msg}: ${item.sku}`);
          await AuditRepo.write({ level: 'warn', connection_id: conn.id, sku: item.sku, message: msg });
          continue;
        }
      }

      // Product exists - update stock and optionally price
      const updateBody: any = {};
      
      // Only update price if sync_price is enabled
      if (shouldSyncPrice && item.price != null) {
        updateBody.regular_price = String(item.price);
      }
      
      // Always update stock
      if (item.stock != null) {
        updateBody.manage_stock = true;
        updateBody.stock_quantity = Number(item.stock);
        updateBody.stock_status = item.stock > 0 ? 'instock' : 'outofstock';
      }

      // Only send update if there's something to update
      if (Object.keys(updateBody).length > 0) {
        const upUrl = `${base}/wp-json/wc/v3/products/${found.id}?${auth.toString()}`;
        const ures = await fetch(upUrl, { 
          method: 'PUT', 
          headers: { 'Content-Type': 'application/json' }, 
          body: JSON.stringify(updateBody) 
        });
        if (!ures.ok) {
          const t = await ures.text();
          throw new Error(`Woo update failed ${ures.status}: ${t}`);
        }
        const msg = shouldSyncPrice ? `Stock: ${item.stock}, Price: ${item.price}` : `Stock: ${item.stock}`;
        log(`Woo updated (${msg}) - ${item.sku}`);
        await AuditRepo.write({ level: 'info', connection_id: conn.id, sku: item.sku, message: `Updated: ${msg}` });
      }
      
      await sleep(250);
    } catch (e: any) {
      const emsg = `Woo error: ${e?.message || e}`;
      log(`${emsg} (${item.sku})`);
      await AuditRepo.write({ level: 'error', connection_id: conn.id, sku: item.sku, message: emsg });
    }
  }
}

export function startPushWorker(log: (m: string) => void) {
  log('[Push Worker] Starting push worker loop...');
  console.log('[Push Worker] Starting push worker loop...');
  
  async function loop() {
    try {
      const job = await JobRepo.pickNext();
      if (!job) {
        setTimeout(loop, 5000); // Poll every 5 seconds
        return;
      }
      console.log(`[Push Worker] Found job: ${job.id}`);
      log(`Processing job ${job.id} (${job.job_type}) for connection ${job.connection_id}`);
      const conn = await ConnectionRepo.get(job.connection_id);
      if (!conn) {
        await JobRepo.fail(job.id, 'Connection not found');
        return setImmediate(loop);
      }
      try {
        // For delta jobs, scope to job_items.SKUs
        const skus = job.job_type === 'delta' ? new Set<string>(await JobItemRepo.listSkus(job.id)) : undefined;
        if (conn.type === 'shopify') {
          await pushToShopify(conn.id, (m) => log(`[shopify:${conn.id}] ${m}`), skus);
        } else {
          await pushToWoo(conn.id, (m) => log(`[woo:${conn.id}] ${m}`), skus);
        }
        await JobRepo.succeed(job.id);
      } catch (err: any) {
        await JobRepo.fail(job.id, err?.message || String(err));
        // Simple backoff before next iteration after a failure
        await new Promise(r => setTimeout(r, 1000));
      }
      setImmediate(loop);
    } catch (e) {
      log(`[Push Worker] Worker loop error: ${e}`);
      console.error(`[Push Worker] Worker loop error:`, e);
      setTimeout(loop, 5000);
    }
  }
  
  // Start the loop immediately
  console.log('[Push Worker] Initiating first loop iteration...');
  loop();
}

