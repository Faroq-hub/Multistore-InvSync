/**
 * Advanced Filtering & Mapping Rules
 * Extended rules system for product filtering and field mapping
 */

export interface MappingRules {
  // Price rules
  price_multiplier?: number;
  price_adjustment?: number; // Fixed amount to add/subtract
  
  // Filtering rules
  filters?: {
    tags?: string[]; // Include only products with these tags
    exclude_tags?: string[]; // Exclude products with these tags
    product_type?: string[]; // Include only these product types
    vendor?: string[]; // Include only these vendors
    price_min?: number; // Minimum price filter
    price_max?: number; // Maximum price filter
    inventory_min?: number; // Minimum inventory level
    inventory_max?: number; // Maximum inventory level
  };
  
  // Field mapping rules
  field_mapping?: {
    product_type?: string; // Map to a specific product type
    vendor?: string; // Map to a specific vendor
    tags?: string[]; // Map to specific tags
    metafields?: Record<string, string>; // Custom metafield mappings
  };
  
  // SKU-based filtering
  exclude_skus?: string[]; // SKUs to exclude from sync
  include_only_skus?: string[]; // Only sync these SKUs (if provided)
  
  // Variant rules
  variant_rules?: {
    exclude_variants?: string[]; // Variant SKUs to exclude
    map_options?: Record<string, string>; // Map option names (e.g., "Size" -> "Sizes")
  };
}

/**
 * Apply mapping rules to a catalog item
 */
export function applyMappingRules(item: any, rules: MappingRules | null): any {
  if (!rules) return item;
  
  const result = { ...item };
  
  // Apply price rules
  if (rules.price_multiplier !== undefined && typeof rules.price_multiplier === 'number') {
    const price = Number(result.price);
    if (!isNaN(price)) {
      result.price = (price * rules.price_multiplier).toFixed(2);
    }
  }
  
  if (rules.price_adjustment !== undefined && typeof rules.price_adjustment === 'number') {
    const price = Number(result.price);
    if (!isNaN(price)) {
      result.price = (price + rules.price_adjustment).toFixed(2);
    }
  }
  
  // Apply field mappings
  if (rules.field_mapping) {
    if (rules.field_mapping.product_type) {
      result.product_type = rules.field_mapping.product_type;
    }
    if (rules.field_mapping.vendor) {
      result.vendor = rules.field_mapping.vendor;
    }
    if (rules.field_mapping.tags && Array.isArray(rules.field_mapping.tags)) {
      result.tags = rules.field_mapping.tags;
    }
  }
  
  return result;
}

/**
 * Check if an item passes the filter rules
 */
export function passesFilters(item: any, rules: MappingRules | null): boolean {
  if (!rules || !rules.filters) return true;
  
  const filters = rules.filters;
  
  // SKU-based filtering (highest priority)
  if (rules.include_only_skus && rules.include_only_skus.length > 0) {
    if (!rules.include_only_skus.includes(item.sku)) {
      return false;
    }
  }
  
  if (rules.exclude_skus && rules.exclude_skus.includes(item.sku)) {
    return false;
  }
  
  // Tag filtering
  if (filters.tags && filters.tags.length > 0) {
    const itemTags = item.tags || [];
    const hasRequiredTag = filters.tags.some(tag => 
      itemTags.some((itemTag: string) => itemTag.toLowerCase() === tag.toLowerCase())
    );
    if (!hasRequiredTag) return false;
  }
  
  if (filters.exclude_tags && filters.exclude_tags.length > 0) {
    const itemTags = item.tags || [];
    const hasExcludedTag = filters.exclude_tags.some(tag =>
      itemTags.some((itemTag: string) => itemTag.toLowerCase() === tag.toLowerCase())
    );
    if (hasExcludedTag) return false;
  }
  
  // Product type filtering
  if (filters.product_type && filters.product_type.length > 0) {
    if (!filters.product_type.includes(item.product_type || '')) {
      return false;
    }
  }
  
  // Vendor filtering
  if (filters.vendor && filters.vendor.length > 0) {
    if (!filters.vendor.includes(item.vendor || '')) {
      return false;
    }
  }
  
  // Price filtering
  const price = Number(item.price);
  if (!isNaN(price)) {
    if (filters.price_min !== undefined && price < filters.price_min) {
      return false;
    }
    if (filters.price_max !== undefined && price > filters.price_max) {
      return false;
    }
  }
  
  // Inventory filtering
  const stock = Number(item.stock);
  if (!isNaN(stock)) {
    if (filters.inventory_min !== undefined && stock < filters.inventory_min) {
      return false;
    }
    if (filters.inventory_max !== undefined && stock > filters.inventory_max) {
      return false;
    }
  }
  
  return true;
}

