import { CatalogItem, FeedResponse } from '../models/types';
import { XMLBuilder } from 'fast-xml-parser';

export function buildFeed(items: CatalogItem[], version = '1.0'): FeedResponse {
  const generatedAt = new Date().toISOString();
  // Deduplicate by SKU, prefer Shopify over Woo when duplicate
  const map = new Map<string, CatalogItem>();
  for (const item of items) {
    if (!item.sku) continue;
    if (!map.has(item.sku)) {
      map.set(item.sku, item);
      continue;
    }
    const existing = map.get(item.sku)!;
    if (existing.source !== 'shopify' && item.source === 'shopify') {
      map.set(item.sku, item);
    }
  }

  return {
    version,
    generatedAt,
    items: Array.from(map.values())
  };
}

export function toXml(feed: FeedResponse): string {
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true,
    suppressEmptyNode: true
  });

  const xmlObj = {
    feed: {
      version: feed.version,
      generated_at: feed.generatedAt,
      items: {
        item: feed.items.map(i => ({
          title: i.title,
          sku: i.sku,
          price: i.price,
          currency: i.currency,
          stock: i.stock,
          image_url: i.imageUrl ?? '',
          category: i.category ?? '',
          product_handle: i.productHandle ?? '',
          updated_at: i.updatedAt ?? '',
          source: i.source
        }))
      }
    }
  };

  return builder.build(xmlObj);
}