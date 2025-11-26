/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // output: 'standalone', // Disabled for local PM2 - use 'next start' instead
  env: {
    SHOPIFY_API_KEY: process.env.SHOPIFY_API_KEY,
    SHOPIFY_API_SECRET: process.env.SHOPIFY_API_SECRET,
    SHOPIFY_SCOPES: process.env.SHOPIFY_SCOPES,
    SHOPIFY_API_VERSION: process.env.SHOPIFY_API_VERSION || '2024-10',
    APP_URL: process.env.APP_URL || 'http://localhost:3001',
  },
  typescript: {
    tsconfigPath: './tsconfig.next.json',
  },
  // Allow cross-origin requests from ngrok during development
  ...(process.env.APP_URL && process.env.APP_URL.includes('ngrok') && {
    allowedDevOrigins: [process.env.APP_URL.replace(/^https?:\/\//, '')],
  }),
};

module.exports = nextConfig;

