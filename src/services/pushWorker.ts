import { ConnectionRepo, JobRepo, JobItemRepo, AuditRepo } from '../db';

// Use Node.js built-in fetch (available in Node 18+)
// Fallback to dynamic import of node-fetch if needed
const getFetch = async () => {
  if (typeof globalThis.fetch !== 'undefined') {
    return globalThis.fetch;
  }
  const nodeFetch = await import('node-fetch');
  return nodeFetch.default;
};
import { fetchShopifyCatalog } from '../integrations/shopify';
import { fetchWooCatalog } from '../integrations/woocommerce';
import { CatalogItem } from '../models/types';

async function getSourceItems(filterSkus?: Set<string>): Promise<CatalogItem[]> {
  const [shopify, woo] = await Promise.all([fetchShopifyCatalog(), fetchWooCatalog()]);
  // Treat Shopify as primary; dedupe SKUs
  const map = new Map<string, CatalogItem>();
  for (const it of [...shopify, ...woo]) {
    if (!map.has(it.sku) || (map.get(it.sku)!.source !== 'shopify' && it.source === 'shopify')) {
      map.set(it.sku, it);
    }
  }
  let items = Array.from(map.values());
  if (filterSkus && filterSkus.size > 0) {
    items = items.filter(i => filterSkus.has(i.sku));
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

async function pushToShopify(connId: string, log: (m: string) => void, filterSkus?: Set<string>) {
  const conn = await ConnectionRepo.get(connId);
  if (!conn || !conn.dest_shop_domain || !conn.access_token) throw new Error('Invalid Shopify connection');
  const items = await getSourceItems(filterSkus);

  const fetch = await getFetch();
  const headers = {
    'X-Shopify-Access-Token': conn.access_token,
    'Content-Type': 'application/json'
  };
  const apiVersion = process.env.DEST_API_VERSION || '2024-10';
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  for (const raw of items) {
    const item = applyRules(raw, conn.rules_json);
    try {
      // Find variant by SKU
      const url = `https://${conn.dest_shop_domain}/admin/api/${apiVersion}/variants.json?sku=${encodeURIComponent(item.sku)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`variants?sku status ${res.status}`);
      const data: any = await res.json();
      const v = data.variants && data.variants[0];
      if (!v) {
        const msg = `Shopify dest missing SKU (create not implemented)`;
        log(`${msg}: ${item.sku}`);
        await AuditRepo.write({ level: 'warn', connection_id: conn.id, job_id: undefined, sku: item.sku, message: msg });
        continue;
      }
      // Update price if needed
      const currentPrice = String(v.price ?? '');
      const desiredPrice = String(item.price ?? '');
      if (desiredPrice && desiredPrice !== currentPrice) {
        const upUrl = `https://${conn.dest_shop_domain}/admin/api/${apiVersion}/variants/${v.id}.json`;
        await fetch(upUrl, { method: 'PUT', headers, body: JSON.stringify({ variant: { id: v.id, price: desiredPrice } }) });
        const msg = `Price updated ${currentPrice} -> ${desiredPrice}`;
        log(`${msg} (${item.sku})`);
        await AuditRepo.write({ level: 'info', connection_id: conn.id, sku: item.sku, message: msg });
      }
      // Update inventory if location provided
      if (conn.dest_location_id && v.inventory_item_id != null && item.stock != null) {
        const invUrl = `https://${conn.dest_shop_domain}/admin/api/${apiVersion}/inventory_levels/set.json`;
        await fetch(invUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            location_id: Number(conn.dest_location_id),
            inventory_item_id: Number(v.inventory_item_id),
            available: Number(item.stock)
          })
        });
        const msg = `Stock set -> ${item.stock}`;
        log(`${msg} (${item.sku})`);
        await AuditRepo.write({ level: 'info', connection_id: conn.id, sku: item.sku, message: msg });
      }
      await sleep(250);
    } catch (e: any) {
      const emsg = `Error pushing SKU: ${e?.message || e}`;
      log(`${emsg} (${item.sku})`);
      await AuditRepo.write({ level: 'error', connection_id: conn.id, sku: item.sku, message: emsg });
    }
  }
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

  for (const raw of items) {
    const item = applyRules(raw, conn.rules_json);
    try {
      // Search product/variation by SKU
      const searchUrl = `${base}/wp-json/wc/v3/products?${auth.toString()}&sku=${encodeURIComponent(item.sku)}`;
      const res = await fetch(searchUrl);
      if (!res.ok) throw new Error(`Woo search status ${res.status}`);
      const products: any = await res.json();
      let found = null;
      if (Array.isArray(products) && products.length > 0) {
        found = products[0];
      }
      if (!found) {
        // Try variations endpoint if product not found
        // Note: Woo doesn't have a direct variations search by SKU in all versions, so this is simplified
        // For full solution: iterate products with variations and check variation SKUs
        // Skipping creation flow for brevity
        log(`Woo dest missing SKU: ${item.sku} (create flow not implemented yet)`);
        continue;
      }
      // Update price and stock at product level if applicable
      const updateBody: any = {};
      if (item.price != null) updateBody.price = String(item.price);
      if (item.stock != null) {
        updateBody.manage_stock = true;
        updateBody.stock_quantity = Number(item.stock);
        updateBody.stock_status = item.stock > 0 ? 'instock' : 'outofstock';
      }
      const upUrl = `${base}/wp-json/wc/v3/products/${found.id}?${auth.toString()}`;
      const ures = await fetch(upUrl, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updateBody) });
      if (!ures.ok) {
        const t = await ures.text();
        throw new Error(`Woo update failed ${ures.status}: ${t}`);
      }
      const msg = `Woo updated`;
      log(`${msg} (${item.sku})`);
      await AuditRepo.write({ level: 'info', connection_id: conn.id, sku: item.sku, message: msg });
      await sleep(250);
    } catch (e: any) {
      const emsg = `Woo error: ${e?.message || e}`;
      log(`${emsg} (${item.sku})`);
      await AuditRepo.write({ level: 'error', connection_id: conn.id, sku: item.sku, message: emsg });
    }
  }
}

export function startPushWorker(log: (m: string) => void) {
  async function loop() {
    try {
      const job = await JobRepo.pickNext();
      if (!job) {
        setTimeout(loop, 1000);
        return;
      }
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
      log(`Worker loop error: ${e}`);
      setTimeout(loop, 2000);
    }
  }
  loop();
}

