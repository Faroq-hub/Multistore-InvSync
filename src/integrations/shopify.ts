import { config } from '../config';
import { CatalogItem } from '../models/types';

// Use Node.js built-in fetch (available in Node 18+)
// Fallback to dynamic import of node-fetch if needed
const getFetch = async () => {
  if (typeof globalThis.fetch !== 'undefined') {
    return globalThis.fetch;
  }
  const nodeFetch = await import('node-fetch');
  return nodeFetch.default;
};

type ShopifyProductVariant = {
  id: string;
  title: string;
  sku: string;
  barcode: string | null;
  price: string;
  compare_at_price: string | null;
  inventory_item_id: number;
  inventory_quantity: number;
  weight: number;
  weight_unit: string;
  image_id: number | null;
};

type ShopifyProduct = {
  id: number;
  title: string;
  body_html: string | null;
  vendor: string;
  product_type: string;
  handle: string;
  tags: string;
  status: string;
  images: { id: number; src: string }[];
  variants: ShopifyProductVariant[];
  updated_at: string;
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
    const products = data.products as ShopifyProduct[];

    for (const p of products) {
      const productTitle = p.title;
      const handle = p.handle;
      const category = p.product_type || undefined;
      const updatedAt = p.updated_at;
      const description = p.body_html || undefined;
      const vendor = p.vendor || undefined;
      const tags = p.tags ? p.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : undefined;
      const images = p.images?.map(img => img.src) || [];
      const imageUrl = images[0] || undefined;

      for (const v of p.variants) {
        const sku = (v.sku || '').trim();
        if (!sku) continue;
        
        const price = String(v.price ?? '0');
        const compareAtPrice = v.compare_at_price ? String(v.compare_at_price) : undefined;
        const variantTitle = v.title && v.title !== 'Default Title' ? v.title : undefined;
        const title = variantTitle ? `${productTitle} - ${variantTitle}` : productTitle;
        const stock = typeof v.inventory_quantity === 'number' ? v.inventory_quantity : 0;
        const barcode = v.barcode || undefined;

        items.push({
          title,
          sku,
          barcode,
          price,
          compareAtPrice,
          currency: 'USD',
          stock,
          imageUrl,
          images: images.length > 0 ? images : undefined,
          category,
          productHandle: handle,
          description,
          vendor,
          tags,
          weight: v.weight || undefined,
          weightUnit: v.weight_unit || undefined,
          variantTitle,
          productId: String(p.id),
          variantId: String(v.id),
          inventoryItemId: v.inventory_item_id ? String(v.inventory_item_id) : undefined,
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