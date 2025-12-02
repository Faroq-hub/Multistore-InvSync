import { config } from '../config';
import { CatalogItem } from '../models/types';

// Generic fetch function type compatible with both native fetch and node-fetch
type FetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<{ ok: boolean; json: () => Promise<any>; headers: { get: (name: string) => string | null } }>;

// Use Node.js built-in fetch (available in Node 18+)
// Fallback to dynamic import of node-fetch if needed
const getFetch = async (): Promise<FetchFn> => {
  if (typeof globalThis.fetch !== 'undefined') {
    return globalThis.fetch as unknown as FetchFn;
  }
  const nodeFetch = await import('node-fetch');
  return nodeFetch.default as unknown as FetchFn;
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

import { CollectionInfo } from '../models/types';

// Fetch collections for a product with full details including rules
async function fetchProductCollections(
  fetch: FetchFn,
  domain: string,
  apiVersion: string,
  accessToken: string,
  productId: string
): Promise<CollectionInfo[]> {
  try {
    const url = `https://${domain}/admin/api/${apiVersion}/collects.json?product_id=${productId}`;
    const res = await fetch(url, {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!res.ok) return [];
    
    const data = (await res.json()) as any;
    const collects = data.collects || [];
    
    // Fetch collection details for each collect
    const collections: CollectionInfo[] = [];
    
    for (const collect of collects) {
      // First try to get as smart collection (has rules)
      const smartUrl = `https://${domain}/admin/api/${apiVersion}/smart_collections/${collect.collection_id}.json`;
      const smartRes = await fetch(smartUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      
      if (smartRes.ok) {
        const smartData = (await smartRes.json()) as any;
        const smartColl = smartData.smart_collection;
        if (smartColl) {
          collections.push({
            id: String(smartColl.id),
            title: smartColl.title,
            handle: smartColl.handle,
            body_html: smartColl.body_html || undefined,
            sort_order: smartColl.sort_order || undefined,
            collection_type: 'smart',
            disjunctive: smartColl.disjunctive || false,
            rules: smartColl.rules?.map((r: any) => ({
              column: r.column,
              relation: r.relation,
              condition: r.condition
            })),
            image: smartColl.image ? { src: smartColl.image.src, alt: smartColl.image.alt } : undefined
          });
          continue;
        }
      }
      
      // Try as custom collection
      const customUrl = `https://${domain}/admin/api/${apiVersion}/custom_collections/${collect.collection_id}.json`;
      const customRes = await fetch(customUrl, {
        headers: {
          'X-Shopify-Access-Token': accessToken,
          'Content-Type': 'application/json'
        }
      });
      
      if (customRes.ok) {
        const customData = (await customRes.json()) as any;
        const customColl = customData.custom_collection;
        if (customColl) {
          collections.push({
            id: String(customColl.id),
            title: customColl.title,
            handle: customColl.handle,
            body_html: customColl.body_html || undefined,
            sort_order: customColl.sort_order || undefined,
            collection_type: 'custom',
            image: customColl.image ? { src: customColl.image.src, alt: customColl.image.alt } : undefined
          });
        }
      }
    }
    
    return collections;
  } catch {
    return [];
  }
}

export async function fetchShopifyCatalog(): Promise<CatalogItem[]> {
  if (!config.shopify.shopDomain || !config.shopify.adminAccessToken) return [];

  const url = `https://${config.shopify.shopDomain}/admin/api/${config.shopify.apiVersion}/products.json?status=active&limit=250`;
  const items: CatalogItem[] = [];
  let pageUrl: string | null = url;

  const fetch = await getFetch();
  
  // Cache collections per product to avoid duplicate fetches
  const productCollectionsCache = new Map<string, CollectionInfo[]>();
  
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
      
      // Fetch collections for this product (cached)
      let collections = productCollectionsCache.get(String(p.id));
      if (!collections) {
        collections = await fetchProductCollections(
          fetch,
          config.shopify.shopDomain,
          config.shopify.apiVersion,
          config.shopify.adminAccessToken,
          String(p.id)
        );
        productCollectionsCache.set(String(p.id), collections);
      }

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
          source: 'shopify',
          collections: collections.length > 0 ? collections : undefined
        });
      }
    }

    const nextUrl = parseLinkHeader(res.headers.get('link'));
    pageUrl = nextUrl;
  }

  return items;
}