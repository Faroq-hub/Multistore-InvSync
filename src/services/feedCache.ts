import { buildFeed } from './feedBuilder';
import { fetchShopifyCatalog } from '../integrations/shopify';
import { fetchWooCatalog } from '../integrations/woocommerce';
import { CatalogItem, FeedResponse } from '../models/types';
import { config } from '../config';

type FeedSnapshot = {
  feed: FeedResponse;
  items: CatalogItem[];
  discontinuedSkus: string[];
};

let current: FeedSnapshot | null = null;
let refreshing = false;
let previous: FeedSnapshot | null = null;

export async function refreshFeedNow(): Promise<FeedSnapshot> {
  if (refreshing) return current as FeedSnapshot;
  refreshing = true;
  try {
    const [shopify, woo] = await Promise.all([fetchShopifyCatalog(), fetchWooCatalog()]);
    const items = [...shopify, ...woo];
    const feed = buildFeed(items, '1.0');
    const newSkus = new Set(feed.items.map(i => i.sku));
    const oldSkus = new Set((current?.items ?? []).map(i => i.sku));
    const discontinued: string[] = [];
    for (const s of oldSkus) {
      if (!newSkus.has(s)) discontinued.push(s);
    }
    previous = current;
    current = { feed, items: feed.items, discontinuedSkus: discontinued };
    return current;
  } finally {
    refreshing = false;
  }
}

export function getCurrentFeed(): FeedSnapshot | null {
  return current;
}

export function startScheduler(log: (msg: string) => void) {
  const baseMinutes = Math.max(5, config.feed.refreshMinutes || 120);
  const jitterMs = Math.floor(Math.random() * 5 * 60 * 1000); // up to 5 min jitter
  const intervalMs = baseMinutes * 60 * 1000 + jitterMs;

  // Initial warmup
  refreshFeedNow().then(() => log(`Feed refreshed (initial)`)).catch(err => log(`Feed refresh failed (initial): ${err}`));

  setInterval(() => {
    refreshFeedNow().then(() => log(`Feed refreshed`)).catch(err => log(`Feed refresh failed: ${err}`));
  }, intervalMs);
}

export function queryItems(params: {
  page?: number;
  limit?: number;
  category?: string;
  in_stock?: boolean;
  min_price?: number;
  max_price?: number;
  since?: string;
}): { total: number; page: number; limit: number; items: CatalogItem[] } {
  const snapshot = current;
  const all = snapshot?.items ?? [];

  let filtered = all;
  if (params.since) {
    const ts = Date.parse(params.since);
    if (!Number.isNaN(ts)) {
      filtered = filtered.filter(i => i.updatedAt && Date.parse(i.updatedAt) >= ts);
    }
  }
  if (typeof params.category === 'string' && params.category.length > 0) {
    const q = params.category.toLowerCase();
    filtered = filtered.filter(i => (i.category || '').toLowerCase().includes(q));
  }
  if (params.in_stock) {
    filtered = filtered.filter(i => i.stock > 0);
  }
  if (typeof params.min_price === 'number') {
    filtered = filtered.filter(i => Number(i.price) >= params.min_price!);
  }
  if (typeof params.max_price === 'number') {
    filtered = filtered.filter(i => Number(i.price) <= params.max_price!);
  }

  const total = filtered.length;
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 1000);
  const page = Math.max(params.page ?? 1, 1);
  const start = (page - 1) * limit;
  const end = start + limit;
  const items = filtered.slice(start, end);

  return { total, page, limit, items };
}

export function getDiscontinuedSkus(): string[] {
  return current?.discontinuedSkus ?? [];
}

