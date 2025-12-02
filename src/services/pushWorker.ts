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
import { CatalogItem, CollectionInfo } from '../models/types';

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

// Helper to find product in destination by SKU only (strict matching)
async function findProductInDestination(
  fetch: FetchFn,
  headers: Record<string, string>,
  domain: string,
  apiVersion: string,
  item: CatalogItem,
  log?: (m: string) => void
): Promise<{ variant: any; product: any } | null> {
  // Only search by SKU - strict matching to avoid wrong product updates
  const skuUrl = `https://${domain}/admin/api/${apiVersion}/variants.json?sku=${encodeURIComponent(item.sku)}`;
  const skuRes = await fetch(skuUrl, { headers });
  if (skuRes.ok) {
    const skuData: any = await skuRes.json();
    if (skuData.variants && skuData.variants.length > 0) {
      const v = skuData.variants[0];
      // Verify the SKU matches exactly (Shopify search can be fuzzy)
      if (v.sku === item.sku) {
        log?.(`Found matching SKU in destination: ${item.sku}`);
        // Fetch the full product
        const prodUrl = `https://${domain}/admin/api/${apiVersion}/products/${v.product_id}.json`;
        const prodRes = await fetch(prodUrl, { headers });
        if (prodRes.ok) {
          const prodData: any = await prodRes.json();
          return { variant: v, product: prodData.product };
        }
        return { variant: v, product: null };
      } else {
        log?.(`SKU search returned non-exact match: searched "${item.sku}", found "${v.sku}" - skipping`);
      }
    }
  }

  // SKU not found - log this for debugging
  log?.(`No exact SKU match found in destination for: ${item.sku}`);
  return null;
}

// Cache for destination collections (title -> collection data)
const destCollectionCache = new Map<string, { id: string; title: string; handle: string; collection_type: 'smart' | 'custom' }>();

// Helper to find or create a collection in destination with proper type and rules
async function findOrCreateCollection(
  fetch: FetchFn,
  headers: Record<string, string>,
  domain: string,
  apiVersion: string,
  sourceCollection: CollectionInfo,
  log: (m: string) => void
): Promise<{ id: string; title: string; handle: string; collection_type: 'smart' | 'custom' } | null> {
  const cacheKey = sourceCollection.title;
  
  // Check cache first
  if (destCollectionCache.has(cacheKey)) {
    return destCollectionCache.get(cacheKey)!;
  }

  try {
    // First check if smart collection exists with same title
    if (sourceCollection.collection_type === 'smart') {
      const smartSearchUrl = `https://${domain}/admin/api/${apiVersion}/smart_collections.json?title=${encodeURIComponent(sourceCollection.title)}`;
      const smartSearchRes = await fetch(smartSearchUrl, { headers });
      
      if (smartSearchRes.ok) {
        const smartData: any = await smartSearchRes.json();
        const smartCollections = smartData.smart_collections || [];
        const existingSmart = smartCollections.find((c: any) => c.title.toLowerCase() === sourceCollection.title.toLowerCase());
        
        if (existingSmart) {
          const result = { id: String(existingSmart.id), title: existingSmart.title, handle: existingSmart.handle, collection_type: 'smart' as const };
          destCollectionCache.set(cacheKey, result);
          log(`Found existing smart collection: ${sourceCollection.title}`);
          return result;
        }
      }
      
      // Create smart collection with rules
      const createSmartUrl = `https://${domain}/admin/api/${apiVersion}/smart_collections.json`;
      const smartPayload: any = {
        smart_collection: {
          title: sourceCollection.title,
          body_html: sourceCollection.body_html || '',
          published: true,
          disjunctive: sourceCollection.disjunctive || false,
          rules: sourceCollection.rules || []
        }
      };
      
      // Add sort order if specified
      if (sourceCollection.sort_order) {
        smartPayload.smart_collection.sort_order = sourceCollection.sort_order;
      }
      
      const createSmartRes = await fetch(createSmartUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(smartPayload)
      });
      
      if (createSmartRes.ok) {
        const createData: any = await createSmartRes.json();
        const newColl = createData.smart_collection;
        if (newColl) {
          const result = { id: String(newColl.id), title: newColl.title, handle: newColl.handle, collection_type: 'smart' as const };
          destCollectionCache.set(cacheKey, result);
          log(`Created smart collection with ${sourceCollection.rules?.length || 0} rule(s): ${sourceCollection.title}`);
          return result;
        }
      } else {
        const errorText = await createSmartRes.text();
        log(`Failed to create smart collection "${sourceCollection.title}": ${createSmartRes.status} - ${errorText}`);
        // Fall through to try creating as custom collection
      }
    }
    
    // Search for existing custom collection by title
    const searchUrl = `https://${domain}/admin/api/${apiVersion}/custom_collections.json?title=${encodeURIComponent(sourceCollection.title)}`;
    const searchRes = await fetch(searchUrl, { headers });
    
    if (searchRes.ok) {
      const searchData: any = await searchRes.json();
      const collections = searchData.custom_collections || [];
      
      // Find exact match
      const existing = collections.find((c: any) => c.title.toLowerCase() === sourceCollection.title.toLowerCase());
      if (existing) {
        const result = { id: String(existing.id), title: existing.title, handle: existing.handle, collection_type: 'custom' as const };
        destCollectionCache.set(cacheKey, result);
        log(`Found existing custom collection: ${sourceCollection.title}`);
        return result;
      }
    }

    // Collection doesn't exist, create as custom collection
    const createUrl = `https://${domain}/admin/api/${apiVersion}/custom_collections.json`;
    const customPayload: any = {
      custom_collection: {
        title: sourceCollection.title,
        body_html: sourceCollection.body_html || '',
        published: true
      }
    };
    
    // Add sort order if specified
    if (sourceCollection.sort_order) {
      customPayload.custom_collection.sort_order = sourceCollection.sort_order;
    }
    
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(customPayload)
    });

    if (createRes.ok) {
      const createData: any = await createRes.json();
      const newColl = createData.custom_collection;
      if (newColl) {
        const result = { id: String(newColl.id), title: newColl.title, handle: newColl.handle, collection_type: 'custom' as const };
        destCollectionCache.set(cacheKey, result);
        log(`Created custom collection: ${sourceCollection.title}`);
        return result;
      }
    } else {
      const errorText = await createRes.text();
      log(`Failed to create custom collection "${sourceCollection.title}": ${createRes.status} - ${errorText}`);
    }
  } catch (e: any) {
    log(`Error with collection "${sourceCollection.title}": ${e?.message || e}`);
  }

  return null;
}

// Helper to add a product to a collection
async function addProductToCollection(
  fetch: FetchFn,
  headers: Record<string, string>,
  domain: string,
  apiVersion: string,
  productId: string,
  collectionId: string,
  log: (m: string) => void
): Promise<boolean> {
  try {
    const url = `https://${domain}/admin/api/${apiVersion}/collects.json`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        collect: {
          product_id: Number(productId),
          collection_id: Number(collectionId)
        }
      })
    });

    if (res.ok) {
      return true;
    } else {
      const errorText = await res.text();
      // Ignore "already exists" errors
      if (!errorText.includes('already exists')) {
        log(`Failed to add product to collection: ${res.status} - ${errorText}`);
      }
    }
  } catch (e: any) {
    log(`Error adding product to collection: ${e?.message || e}`);
  }
  return false;
}

// Helper to create a new product in Shopify destination with multiple variants
async function createProductInShopify(
  fetch: FetchFn,
  headers: Record<string, string>,
  domain: string,
  apiVersion: string,
  items: CatalogItem[], // Array of variants for the same product
  conn: ConnectionRow,
  log: (m: string) => void
): Promise<{ variants: Map<string, any>; product: any } | null> {
  const shouldSyncCategories = conn.sync_categories === 1;
  const firstItem = items[0];
  
  // Get the base product title (without variant suffix)
  const baseTitle = firstItem.productHandle 
    ? firstItem.title.replace(` - ${firstItem.variantTitle}`, '').trim()
    : firstItem.title;
  
  // Build variants array
  const variants = items.map((item, index) => ({
    sku: item.sku,
    barcode: item.barcode || '',
    price: item.price,
    compare_at_price: item.compareAtPrice || null,
    inventory_management: 'shopify',
    inventory_policy: 'deny',
    weight: item.weight || 0,
    weight_unit: item.weightUnit || 'kg',
    option1: item.variantTitle || 'Default Title',
    position: index + 1,
  }));

  // Determine option name from variant titles
  const hasVariants = items.length > 1 || (items[0].variantTitle && items[0].variantTitle !== 'Default Title');
  
  // Build the product payload
  const productPayload: any = {
    product: {
      title: baseTitle,
      body_html: firstItem.description || '',
      vendor: firstItem.vendor || '',
      product_type: shouldSyncCategories ? (firstItem.category || '') : '',
      tags: firstItem.tags?.join(', ') || '',
      status: 'active',
      variants: variants
    }
  };

  // Add options if there are multiple variants
  if (hasVariants) {
    productPayload.product.options = [{ name: 'Option', values: items.map(i => i.variantTitle || 'Default Title') }];
  }

  // Add images if available (from first item, as they're usually shared)
  if (firstItem.images && firstItem.images.length > 0) {
    productPayload.product.images = firstItem.images.map(src => ({ src }));
  } else if (firstItem.imageUrl) {
    productPayload.product.images = [{ src: firstItem.imageUrl }];
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
  
  // Map SKUs to created variants
  const variantMap = new Map<string, any>();
  for (const v of newProduct.variants || []) {
    variantMap.set(v.sku, v);
  }

  log(`Created new product with ${items.length} variant(s): ${baseTitle}`);
  for (const item of items) {
    await AuditRepo.write({
      level: 'info',
      connection_id: conn.id,
      sku: item.sku,
      message: `Created as variant of: ${baseTitle}`
    });
  }

  // Sync collections if enabled
  const shouldSyncCollections = conn.sync_categories === 1;
  if (shouldSyncCollections && firstItem.collections && firstItem.collections.length > 0) {
    log(`Adding product to ${firstItem.collections.length} collection(s)`);
    for (const sourceCollection of firstItem.collections) {
      // Find or create the collection in destination (with same type and rules)
      const destCollection = await findOrCreateCollection(
        fetch, headers, domain, apiVersion, sourceCollection, log
      );
      if (destCollection) {
        // Only add to custom collections manually - smart collections auto-include products based on rules
        if (destCollection.collection_type === 'custom') {
          await addProductToCollection(
            fetch, headers, domain, apiVersion, String(newProduct.id), destCollection.id, log
          );
        } else {
          log(`Product will be auto-added to smart collection "${destCollection.title}" based on rules`);
        }
      }
    }
  }

  return { variants: variantMap, product: newProduct };
}

// Helper to add a variant to an existing product
async function addVariantToProduct(
  fetch: FetchFn,
  headers: Record<string, string>,
  domain: string,
  apiVersion: string,
  productId: string,
  item: CatalogItem,
  log: (m: string) => void
): Promise<any | null> {
  const variantPayload = {
    variant: {
      sku: item.sku,
      barcode: item.barcode || '',
      price: item.price,
      compare_at_price: item.compareAtPrice || null,
      inventory_management: 'shopify',
      inventory_policy: 'deny',
      weight: item.weight || 0,
      weight_unit: item.weightUnit || 'kg',
      option1: item.variantTitle || 'Default Title',
    }
  };

  const addUrl = `https://${domain}/admin/api/${apiVersion}/products/${productId}/variants.json`;
  const addRes = await fetch(addUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(variantPayload)
  });

  if (!addRes.ok) {
    const errorText = await addRes.text();
    log(`Failed to add variant ${item.sku}: ${addRes.status} - ${errorText}`);
    return null;
  }

  const addData: any = await addRes.json();
  log(`Added variant ${item.sku} to existing product`);
  return addData.variant;
}

async function pushToShopify(connId: string, log: (m: string) => void, filterSkus?: Set<string>) {
  const conn = await ConnectionRepo.get(connId);
  if (!conn || !conn.dest_shop_domain || !conn.access_token) throw new Error('Invalid Shopify connection');
  
  log(`Fetching source items for connection: ${connId}`);
  const allItems = await getSourceItems(filterSkus);
  
  // Filter to only include items with stock > 0
  const items = allItems.filter(item => item.stock > 0);
  const skippedCount = allItems.length - items.length;
  
  log(`Found ${allItems.length} source items, ${items.length} with stock (skipped ${skippedCount} out-of-stock items)`);

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

  // Group items by source productId to handle variants together
  const productGroups = new Map<string, CatalogItem[]>();
  for (const raw of items) {
    const item = applyRules(raw, conn.rules_json);
    const key = item.productId || item.sku; // Use productId if available, otherwise treat as single product
    if (!productGroups.has(key)) {
      productGroups.set(key, []);
    }
    productGroups.get(key)!.push(item);
  }

  log(`Grouped into ${productGroups.size} products`);

  // Track created products during this sync (productId -> destinationProductId)
  const createdProducts = new Map<string, string>();

  for (const [productKey, productItems] of productGroups) {
    try {
      // Check which variants already exist in destination
      const existingVariants: { item: CatalogItem; variant: any; product: any }[] = [];
      const missingVariants: CatalogItem[] = [];

      for (const item of productItems) {
        const found = await findProductInDestination(fetch, headers, conn.dest_shop_domain, apiVersion, item, log);
        if (found) {
          existingVariants.push({ item, variant: found.variant, product: found.product });
        } else {
          missingVariants.push(item);
        }
        await sleep(100); // Small delay between lookups
      }

      // Handle missing variants
      if (missingVariants.length > 0 && shouldCreateProducts) {
        if (existingVariants.length > 0) {
          // Some variants exist - add missing ones to the existing product
          const existingProductId = existingVariants[0].product?.id;
          if (existingProductId) {
            log(`Adding ${missingVariants.length} variant(s) to existing product ${existingProductId}`);
            for (const item of missingVariants) {
              const newVariant = await addVariantToProduct(fetch, headers, conn.dest_shop_domain, apiVersion, existingProductId, item, log);
              if (newVariant) {
                existingVariants.push({ item, variant: newVariant, product: existingVariants[0].product });
              }
              await sleep(250);
            }
          }
        } else {
          // No variants exist - create the product with all variants
          log(`Creating new product with ${missingVariants.length} variant(s)`);
          const created = await createProductInShopify(fetch, headers, conn.dest_shop_domain, apiVersion, missingVariants, conn, log);
          if (created) {
            createdProducts.set(productKey, created.product.id);
            // Add created variants to existingVariants for stock/price updates
            for (const item of missingVariants) {
              const v = created.variants.get(item.sku);
              if (v) {
                existingVariants.push({ item, variant: v, product: created.product });
              }
            }
          }
          await sleep(500); // Longer delay after product creation
        }
      } else if (missingVariants.length > 0) {
        // Log skipped variants
        for (const item of missingVariants) {
          const msg = `Product not found and creation disabled`;
          log(`${msg}: ${item.sku}`);
          await AuditRepo.write({ level: 'warn', connection_id: conn.id, sku: item.sku, message: msg });
        }
      }

      // Update price and stock for all existing/created variants
      for (const { item, variant: v } of existingVariants) {
        try {
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
          await sleep(200);
        } catch (e: any) {
          const emsg = `Error updating variant: ${e?.message || e}`;
          log(`${emsg} (${item.sku})`);
          await AuditRepo.write({ level: 'error', connection_id: conn.id, sku: item.sku, message: emsg });
        }
      }

      // Sync collections for existing products (if sync_categories enabled and product wasn't just created)
      const shouldSyncCollections = conn.sync_categories === 1;
      if (shouldSyncCollections && existingVariants.length > 0 && !createdProducts.has(productKey)) {
        const firstItem = existingVariants[0].item;
        const productId = existingVariants[0].product?.id;
        
        if (productId && firstItem.collections && firstItem.collections.length > 0) {
          log(`Syncing ${firstItem.collections.length} collection(s) for existing product`);
          for (const sourceCollection of firstItem.collections) {
            const destCollection = await findOrCreateCollection(
              fetch, headers, conn.dest_shop_domain, apiVersion, sourceCollection, log
            );
            if (destCollection) {
              // Only add to custom collections manually - smart collections auto-include products based on rules
              if (destCollection.collection_type === 'custom') {
                await addProductToCollection(
                  fetch, headers, conn.dest_shop_domain, apiVersion, String(productId), destCollection.id, log
                );
              } else {
                log(`Product will be auto-added to smart collection "${destCollection.title}" based on rules`);
              }
            }
            await sleep(100);
          }
        }
      }
    } catch (e: any) {
      const emsg = `Error processing product group: ${e?.message || e}`;
      log(`${emsg} (${productKey})`);
      await AuditRepo.write({ level: 'error', connection_id: conn.id, sku: productKey, message: emsg });
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
  log('[Push Worker] Starting push worker loop... v2');
  console.log('[Push Worker] Starting push worker loop... v2');
  
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

