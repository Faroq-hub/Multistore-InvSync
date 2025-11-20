import '@shopify/shopify-api/adapters/node';
import { ApiVersion, shopifyApi } from '@shopify/shopify-api';

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseHostName(appUrl: string): { hostName: string; hostScheme: 'http' | 'https' } {
  const url = new URL(appUrl);
  if (!url.hostname) {
    throw new Error(`APP_URL must include a hostname (received: ${appUrl})`);
  }
  // Use hostname only (no port) to match Shopify's expected format
  return {
    hostName: url.hostname,
    hostScheme: url.protocol === 'https:' ? 'https' : 'http'
  };
}

const appUrl = requiredEnv('APP_URL');
const { hostName, hostScheme } = parseHostName(appUrl);

function resolveApiVersion(): ApiVersion {
  const envVersion = process.env.SHOPIFY_API_VERSION;
  if (envVersion && (Object.values(ApiVersion) as string[]).includes(envVersion)) {
    return envVersion as ApiVersion;
  }
  return ApiVersion.October24;
}

export const shopify = shopifyApi({
  apiKey: requiredEnv('SHOPIFY_API_KEY'),
  apiSecretKey: requiredEnv('SHOPIFY_API_SECRET'),
  scopes: (process.env.SHOPIFY_SCOPES || '').split(',').map(s => s.trim()).filter(Boolean),
  hostName,
  hostScheme,
  apiVersion: resolveApiVersion(),
  isEmbeddedApp: true
});

