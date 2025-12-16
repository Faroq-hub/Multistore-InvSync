/**
 * Sync Preview Service
 * Shows what will sync before running a sync job
 */

import { ConnectionRepo } from '../db';
import { passesFilters, applyMappingRules } from '../models/mappingRules';

// Import getSourceItems - it's exported from pushWorker
async function getSourceItems(filterSkus?: Set<string>): Promise<CatalogItem[]> {
  // Re-import the actual function from pushWorker
  const { fetchShopifyCatalog } = await import('../integrations/shopify');
  const { fetchWooCatalog } = await import('../integrations/woocommerce');
  
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
import type { CatalogItem } from '../models/types';
import type { MappingRules } from '../models/mappingRules';

export interface SyncPreviewResult {
  total_items: number;
  items_to_sync: number;
  items_to_skip: number;
  items_to_create: number;
  items_to_update: number;
  preview_items: Array<{
    sku: string;
    title: string;
    action: 'create' | 'update' | 'skip';
    reason?: string;
    price?: number;
    stock?: number;
  }>;
  summary: {
    by_action: {
      create: number;
      update: number;
      skip: number;
    };
    by_reason: Record<string, number>;
  };
}

/**
 * Generate a preview of what will sync for a connection
 */
export async function generateSyncPreview(
  connectionId: string,
  limit: number = 50
): Promise<SyncPreviewResult> {
  const connection = await ConnectionRepo.get(connectionId);
  if (!connection) {
    throw new Error('Connection not found');
  }

  // Get source items (may be empty if source shop credentials not configured)
  let allItems: CatalogItem[] = [];
  try {
    allItems = await getSourceItems();
  } catch (error) {
    console.warn('[SyncPreview] Failed to fetch source items:', error);
    // Continue with empty items - preview will show no items to sync
  }
  
  // Apply rules to determine what will sync
  const itemsToSync: CatalogItem[] = [];
  const itemsToSkip: CatalogItem[] = [];
  const previewItems: SyncPreviewResult['preview_items'] = [];
  const reasonCounts: Record<string, number> = {};

  let createCount = 0;
  let updateCount = 0;
  let skipCount = 0;

  for (const item of allItems) {
    const processed = applyRules(item, connection.rules_json);
    
    // Check if item should be skipped
    if ((processed as any)._skip) {
      skipCount++;
      itemsToSkip.push(processed);
      const reason = 'Filtered out by mapping rules';
      reasonCounts[reason] = (reasonCounts[reason] || 0) + 1;
      
      if (previewItems.length < limit) {
        previewItems.push({
          sku: item.sku,
          title: item.title,
          action: 'skip',
          reason,
        });
      }
      continue;
    }

    // For preview, we'll assume items need to be created if they don't exist
    // In a real implementation, we'd check the destination store
    // For now, we'll use a simple heuristic: if create_products is enabled, mark as create
    if (connection.create_products === 1) {
      createCount++;
      itemsToSync.push(processed);
      
      if (previewItems.length < limit) {
        previewItems.push({
          sku: processed.sku,
          title: processed.title,
          action: 'create',
          price: parseFloat(processed.price || '0'),
          stock: processed.stock,
        });
      }
    } else {
      // If create_products is disabled, we'd need to check if product exists
      // For preview, we'll mark as update (assuming it exists)
      updateCount++;
      itemsToSync.push(processed);
      
      if (previewItems.length < limit) {
        previewItems.push({
          sku: processed.sku,
          title: processed.title,
          action: 'update',
          price: parseFloat(processed.price || '0'),
          stock: processed.stock,
        });
      }
    }
  }

  return {
    total_items: allItems.length,
    items_to_sync: itemsToSync.length,
    items_to_skip: itemsToSkip.length,
    items_to_create: createCount,
    items_to_update: updateCount,
    preview_items: previewItems,
    summary: {
      by_action: {
        create: createCount,
        update: updateCount,
        skip: skipCount,
      },
      by_reason: reasonCounts,
    },
  };
}

/**
 * Helper function to apply rules
 */
function applyRules(item: CatalogItem, rulesJson: string | null): CatalogItem {
  if (!rulesJson) return item;
  try {
    const rules: MappingRules = JSON.parse(rulesJson);
    
    if (!passesFilters(item, rules)) {
      return { ...item, _skip: true } as any;
    }
    
    return applyMappingRules(item, rules) as CatalogItem;
  } catch {
    return item;
  }
}

