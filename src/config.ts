import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),
  logLevel: process.env.LOG_LEVEL || 'info',
  defaultTestApiKey: process.env.DEFAULT_TEST_API_KEY || '',
  shopify: {
    shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || '',
    apiVersion: process.env.SHOPIFY_API_VERSION || '2024-10',
    adminAccessToken: process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || ''
  },
  woo: {
    baseUrl: process.env.WOO_BASE_URL || '',
    consumerKey: process.env.WOO_CONSUMER_KEY || '',
    consumerSecret: process.env.WOO_CONSUMER_SECRET || ''
  },
  feed: {
    defaultCurrency: process.env.FEED_DEFAULT_CURRENCY || 'USD',
    refreshMinutes: Number(process.env.FEED_REFRESH_MINUTES || 120)
  }
};