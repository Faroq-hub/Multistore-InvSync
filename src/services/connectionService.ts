/**
 * Connection Service
 * Business logic for managing connections
 * Extracted from API routes for better organization and testability
 */

import { ulid } from 'ulid';
import { ConnectionRepo, InstallationRepo } from '../db';
import type { ConnectionRow } from '../db';
// Import secrets utility dynamically to avoid module load errors if ENCRYPTION_KEY is missing

export interface CreateShopifyConnectionParams {
  installation_id: string;
  name: string;
  dest_shop_domain: string;
  access_token: string;
  dest_location_id?: string | null;
  sync_price: boolean;
  sync_categories: boolean;
  create_products: boolean;
  product_status: boolean;
  rules?: Record<string, unknown> | null;
}

export interface CreateWooCommerceConnectionParams {
  installation_id: string;
  name: string;
  base_url: string;
  consumer_key: string;
  consumer_secret: string;
  sync_price: boolean;
  sync_categories: boolean;
  create_products: boolean;
  product_status: boolean;
  rules?: Record<string, unknown> | null;
}

export interface UpdateConnectionParams {
  name?: string;
  dest_location_id?: string | null;
  access_token?: string;
  sync_price?: boolean;
  sync_categories?: boolean;
  create_products?: boolean;
  product_status?: boolean;
  rules?: Record<string, unknown>;
}

/**
 * Create a Shopify connection
 */
export async function createShopifyConnection(params: CreateShopifyConnectionParams): Promise<string> {
  const connId = ulid();
  
  // Encrypt access token
  const { encryptSecret } = await import('../utils/secrets');
  const encryptedToken = encryptSecret(params.access_token);
  
  await ConnectionRepo.insert({
    id: connId,
    installation_id: params.installation_id,
    type: 'shopify',
    name: params.name,
    status: 'active',
    dest_shop_domain: params.dest_shop_domain,
    dest_location_id: params.dest_location_id || null,
    base_url: null,
    consumer_key: null,
    consumer_secret: null,
    access_token: encryptedToken,
    rules_json: params.rules ? JSON.stringify(params.rules) : null,
    sync_price: params.sync_price ? 1 : 0,
    sync_categories: params.sync_categories ? 1 : 0,
    create_products: params.create_products ? 1 : 0,
    product_status: params.product_status ? 1 : 0,
    last_synced_at: null
  });
  
  return connId;
}

/**
 * Create a WooCommerce connection
 */
export async function createWooCommerceConnection(params: CreateWooCommerceConnectionParams): Promise<string> {
  const connId = ulid();
  
  // Normalize base_url: remove trailing slashes and /wp-json if present
  let baseUrl = params.base_url.replace(/\/+$/, ''); // Remove trailing slashes
  baseUrl = baseUrl.replace(/\/wp-json\/?.*$/, ''); // Remove /wp-json and anything after
  
  // Encrypt consumer secret
  const { encryptSecret } = await import('../utils/secrets');
  const encryptedSecret = encryptSecret(params.consumer_secret);
  
  await ConnectionRepo.insert({
    id: connId,
    installation_id: params.installation_id,
    type: 'woocommerce',
    name: params.name,
    status: 'active',
    dest_shop_domain: null,
    dest_location_id: null,
    base_url: baseUrl,
    consumer_key: params.consumer_key,
    consumer_secret: encryptedSecret,
    access_token: null,
    rules_json: params.rules ? JSON.stringify(params.rules) : null,
    sync_price: params.sync_price ? 1 : 0,
    sync_categories: params.sync_categories ? 1 : 0,
    create_products: params.create_products ? 1 : 0,
    product_status: params.product_status ? 1 : 0,
    last_synced_at: null
  });
  
  return connId;
}

/**
 * Update a connection
 */
export async function updateConnection(
  connectionId: string,
  params: UpdateConnectionParams
): Promise<void> {
  // Update location_id if provided
  if (params.dest_location_id !== undefined) {
    await ConnectionRepo.updateLocationId(connectionId, params.dest_location_id || null);
  }
  
  // Update name if provided
  if (params.name !== undefined && params.name.trim()) {
    await ConnectionRepo.updateName(connectionId, params.name.trim());
  }
  
  // Update rules if provided
  if (params.rules !== undefined) {
    const connection = await ConnectionRepo.get(connectionId);
    if (connection) {
      const existingRules = connection.rules_json ? JSON.parse(connection.rules_json) : {};
      const updatedRules = { ...existingRules, ...params.rules };
      await ConnectionRepo.updateRules(connectionId, JSON.stringify(updatedRules));
    }
  }
  
  // Update access_token if provided (for Shopify connections)
  if (params.access_token !== undefined) {
    const connection = await ConnectionRepo.get(connectionId);
    if (connection && connection.type === 'shopify') {
      const { encryptSecret } = await import('../utils/secrets');
      const encryptedToken = encryptSecret(params.access_token);
      await ConnectionRepo.updateAccessToken(connectionId, encryptedToken || params.access_token);
    }
  }
  
  // Update sync options if provided
  if (params.sync_price !== undefined || params.sync_categories !== undefined || 
      params.create_products !== undefined || params.product_status !== undefined) {
    const connection = await ConnectionRepo.get(connectionId);
    if (connection) {
      // Update sync options if any are provided
      const options: { sync_price?: number; sync_categories?: number; create_products?: number; product_status?: number } = {};
      if (params.sync_price !== undefined) {
        options.sync_price = params.sync_price ? 1 : 0;
      }
      if (params.sync_categories !== undefined) {
        options.sync_categories = params.sync_categories ? 1 : 0;
      }
      if (params.create_products !== undefined) {
        options.create_products = params.create_products ? 1 : 0;
      }
      if (params.product_status !== undefined) {
        options.product_status = params.product_status ? 1 : 0;
      }
      
      // Only update if at least one option is provided
      if (Object.keys(options).length > 0) {
        await ConnectionRepo.updateSyncOptions(connectionId, options);
      }
    }
  }
}

/**
 * Verify installation has access token
 */
export async function verifyInstallationAccess(shop: string): Promise<{ installation_id: string }> {
  const installation = await InstallationRepo.getByDomain(shop);
  
  if (!installation) {
    throw new Error(`Installation not found for shop ${shop}. Please reinstall the app through Shopify OAuth.`);
  }
  
  if (!installation.access_token) {
    throw new Error(`Installation missing access token for shop ${shop}. Please reinstall the app through Shopify OAuth to grant permissions.`);
  }
  
  return { installation_id: installation.id };
}

/**
 * Test WooCommerce API connection
 */
export async function testWooCommerceConnection(
  baseUrl: string,
  consumerKey: string,
  consumerSecret: string
): Promise<void> {
  // Normalize base_url
  let normalizedUrl = baseUrl.replace(/\/+$/, '');
  normalizedUrl = normalizedUrl.replace(/\/wp-json\/?.*$/, '');
  
  // Test WordPress REST API accessibility
  const wpRestTestUrl = `${normalizedUrl}/wp-json/`;
  const wpRestTestResponse = await fetch(wpRestTestUrl, { method: 'GET' });
  const wpRestTestText = await wpRestTestResponse.text().catch(() => '');
  
  if (!wpRestTestResponse.ok || wpRestTestText.includes('<!DOCTYPE') || wpRestTestText.includes('<html')) {
    throw new Error(`WordPress REST API not accessible at "${normalizedUrl}/wp-json/". Please verify the base_url is correct and WordPress REST API is enabled.`);
  }
  
  // Test WooCommerce API endpoint
  const testUrl = `${normalizedUrl}/wp-json/wc/v3/products?consumer_key=${encodeURIComponent(consumerKey)}&consumer_secret=${encodeURIComponent(consumerSecret)}&per_page=1`;
  const testResponse = await fetch(testUrl, { method: 'GET' });
  
  if (!testResponse.ok) {
    const errorText = await testResponse.text().catch(() => 'Unknown error');
    
    // Check if it's an HTML response (404 page)
    if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
      throw new Error(`WooCommerce API endpoint not found. The URL "${normalizedUrl}/wp-json/wc/v3" returned an HTML 404 page.\n\nTroubleshooting steps:\n1. Verify WooCommerce is installed and activated\n2. Go to WordPress Admin → Settings → Permalinks → Click "Save Changes" (this flushes permalinks)\n3. Check if any security plugins are blocking the REST API\n4. Verify the consumer key and secret are correct\n5. Ensure the API key has Read/Write permissions`);
    }
    
    // Check if it's a JSON error response
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.code === 'woocommerce_rest_authentication_error') {
        throw new Error('WooCommerce API authentication failed. Please check your consumer key and consumer secret.');
      }
    } catch {
      // Not JSON, use generic error
    }
    
    throw new Error(`WooCommerce API test failed: ${testResponse.status} ${testResponse.statusText}. Please verify your base_url, consumer_key, and consumer_secret.`);
  }
  
  // Check if response is JSON
  const contentType = testResponse.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`WooCommerce API returned non-JSON response. The endpoint "${normalizedUrl}/wp-json/wc/v3" may not be a valid WooCommerce REST API endpoint. Please verify the base_url is correct.`);
  }
  
  // Try to parse the response to ensure it's valid WooCommerce API response
  const testData = await testResponse.json() as unknown;
  if (!Array.isArray(testData) && !(testData && typeof testData === 'object' && 'products' in testData)) {
    throw new Error('WooCommerce API response format is unexpected. Please verify the API endpoint is correct.');
  }
}

