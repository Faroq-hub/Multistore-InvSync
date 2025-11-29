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