export type CatalogItem = {
    title: string;
    sku: string;
    price: string;
    currency: string;
    stock: number;
    imageUrl?: string;
    category?: string;
    productHandle?: string;
    updatedAt?: string;
    source: 'shopify' | 'woocommerce';
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