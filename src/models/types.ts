// Collection info with full details including smart collection rules
export type CollectionInfo = {
  id: string;
  title: string;
  handle: string;
  body_html?: string;
  sort_order?: string;
  collection_type: 'smart' | 'custom';
  disjunctive?: boolean; // For smart collections: true = any condition, false = all conditions
  rules?: Array<{
    column: string;
    relation: string;
    condition: string;
  }>;
  image?: {
    src: string;
    alt?: string;
  };
};

export type CatalogItem = {
    title: string;
    sku: string;
    barcode?: string;
    price: string;
    compareAtPrice?: string;
    currency: string;
    stock: number;
    imageUrl?: string;
    images?: string[];
    category?: string;
    productHandle?: string;
    description?: string;
    vendor?: string;
    tags?: string[];
    weight?: number;
    weightUnit?: string;
    variantTitle?: string;
    productId?: string;
    variantId?: string;
    inventoryItemId?: string;
    updatedAt?: string;
    source: 'shopify' | 'woocommerce';
    // Collection data for syncing (with full details including rules)
    collections?: CollectionInfo[];
  };

export type SyncOptions = {
    sync_price: boolean;
    sync_categories: boolean;
    create_products: boolean;
  };
  
  export type FeedResponse = {
    version: string;
    generatedAt: string;
    items: CatalogItem[];
  };
  
  export type Reseller = {
    id: string;
    name: string;
    status: 'active' | 'disabled';
    apiKeyHash?: string;
    version: string;
  };