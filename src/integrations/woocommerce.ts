import { config } from '../config';
import { CatalogItem } from '../models/types';

// Dynamic import for node-fetch (ESM module)
const getFetch = async () => {
  const { default: fetch } = await import('node-fetch');
  return fetch;
};

export async function fetchWooCatalog(): Promise<CatalogItem[]> {
  if (!config.woo.baseUrl || !config.woo.consumerKey || !config.woo.consumerSecret) return [];

  const fetch = await getFetch();
  const authParams = new URLSearchParams({
    consumer_key: config.woo.consumerKey,
    consumer_secret: config.woo.consumerSecret,
    status: 'publish',
    per_page: '100'
  });

  const items: CatalogItem[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const url = `${config.woo.baseUrl.replace(/\/$/, '')}/wp-json/wc/v3/products?${authParams.toString()}&page=${page}`;
    const res = await fetch(url);
    if (!res.ok) break;

    const products = (await res.json()) as any[];
    if (!products.length) {
      hasMore = false;
      break;
    }

    for (const p of products) {
      const productTitle = p.name as string;
      const imageUrl = Array.isArray(p.images) && p.images[0]?.src ? p.images[0].src : undefined;
      const category = Array.isArray(p.categories) && p.categories[0]?.name ? p.categories[0].name : undefined;
      const updatedAt = p.date_modified_gmt || p.date_modified || p.date_created_gmt || undefined;
      const handle = p.slug as string | undefined;

      // If product has variations, fetch them to get variation-level SKUs
      if (Array.isArray(p.variations) && p.variations.length > 0) {
        let vPage = 1;
        let vHasMore = true;
        while (vHasMore) {
          const vUrl = `${config.woo.baseUrl.replace(/\/$/, '')}/wp-json/wc/v3/products/${p.id}/variations?${authParams.toString()}&per_page=100&page=${vPage}`;
          const vRes = await fetch(vUrl);
          if (!vRes.ok) break;
          const vars = (await vRes.json()) as any[];
          if (!vars.length) {
            vHasMore = false;
            break;
          }
          for (const v of vars) {
            const sku = (v.sku || '').trim();
            if (!sku) continue;
            const price = String(v.price ?? v.regular_price ?? p.price ?? p.regular_price ?? '0');
            const stock = typeof v.stock_quantity === 'number' ? v.stock_quantity : (v.stock_status === 'instock' ? 1 : 0);
            const vTitle = v.attributes && v.attributes.length
              ? `${productTitle} - ${v.attributes.map((a: any) => a.option).filter(Boolean).join(' / ')}`
              : productTitle;
            items.push({
              title: vTitle,
              sku,
              price,
              currency: 'USD',
              stock,
              imageUrl,
              category,
              productHandle: handle,
              updatedAt,
              source: 'woocommerce'
            });
          }
          vPage += 1;
        }
        // Skip adding product-level SKU if we processed variations
        continue;
      }

      // Woo can have SKU at product level or per variation. For MVP, if product SKU exists, treat as single variant.
      const sku = (p.sku || '').trim();
      if (sku) {
        const price = String(p.price ?? p.regular_price ?? '0');
        const stock = typeof p.stock_quantity === 'number' ? p.stock_quantity : (p.stock_status === 'instock' ? 1 : 0);

        items.push({
          title: productTitle,
          sku,
          price,
          currency: 'USD',
          stock,
          imageUrl,
          category,
          productHandle: handle,
          updatedAt,
          source: 'woocommerce'
        });
      }
    }

    page += 1;
    // Stop after a few pages for MVP safety; remove this limit later
    if (page > 5) hasMore = false;
  }

  return items;
}