import { config } from '../config';
import { CatalogItem } from '../models/types';

// Dynamic import for node-fetch (ESM module)
const getFetch = async () => {
  const { default: fetch } = await import('node-fetch');
  return fetch;
};

type ShopifyProductVariant = {
  id: string;
  title: string;
  sku: string;
  price: string;
  image?: { src?: string };
  product: { title: string; handle?: string; product_type?: string; updated_at?: string };
  inventoryQuantity?: number;
  imageUrl?: string;
};

function parseLinkHeader(link: string | null): string | null {
  if (!link) return null;
  // Example: <https://shop.myshopify.com/admin/api/2024-10/products.json?page_info=xyz&limit=250>; rel="next"
  const parts = link.split(',');
  for (const p of parts) {
    const m = p.match(/<([^>]+)>;\s*rel="next"/);
    if (m) return m[1];
  }
  return null;
}

export async function fetchShopifyCatalog(): Promise<CatalogItem[]> {
  if (!config.shopify.shopDomain || !config.shopify.adminAccessToken) return [];

  const url = `https://${config.shopify.shopDomain}/admin/api/${config.shopify.apiVersion}/products.json?status=active&limit=250`;
  const items: CatalogItem[] = [];
  let pageUrl: string | null = url;

  const fetch = await getFetch();
  while (pageUrl) {
    const res = await fetch(pageUrl, {
      headers: {
        'X-Shopify-Access-Token': config.shopify.adminAccessToken,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      // Rate limiting and error handling will be improved later
      break;
    }

    const data = (await res.json()) as any;
    const products = data.products as any[];

    for (const p of products) {
      const productTitle = p.title as string;
      const handle = p.handle as string | undefined;
      const category = p.product_type as string | undefined;
      const updatedAt = p.updated_at as string | undefined;
      const imageUrl = p.image?.src as string | undefined;

      for (const v of p.variants as any[]) {
        const sku = (v.sku || '').trim();
        if (!sku) continue;
        const price = String(v.price ?? '0');
        const title = v.title && v.title !== 'Default Title' ? `${productTitle} - ${v.title}` : productTitle;
        const stock = typeof v.inventory_quantity === 'number' ? v.inventory_quantity : 0;

        items.push({
          title,
          sku,
          price,
          currency: 'USD',
          stock,
          imageUrl,
          category,
          productHandle: handle,
          updatedAt,
          source: 'shopify'
        });
      }
    }

    const nextUrl = parseLinkHeader(res.headers.get('link'));
    pageUrl = nextUrl;
  }

  return items;
}