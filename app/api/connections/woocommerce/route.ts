import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { ConnectionRepo, InstallationRepo } from '../../../../src/db';
import { requireShopFromSession } from '../../_utils/authorize';
import { CreateWooCommerceConnectionSchema, validateBody } from '../../../../src/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    // Validate input with Zod
    const validation = validateBody(CreateWooCommerceConnectionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name, base_url, consumer_key, consumer_secret, sync_price, sync_categories, create_products, product_status, rules } = validation.data;

    // Normalize base_url: remove trailing slashes and /wp-json if present
    let baseUrl = base_url.replace(/\/+$/, ''); // Remove trailing slashes
    baseUrl = baseUrl.replace(/\/wp-json\/?.*$/, ''); // Remove /wp-json and anything after

    // Test WooCommerce API connection
    try {
      // First, test if WordPress REST API is accessible
      const wpRestTestUrl = `${baseUrl}/wp-json/`;
      const wpRestTestResponse = await fetch(wpRestTestUrl, { method: 'GET' });
      const wpRestTestText = await wpRestTestResponse.text().catch(() => '');
      
      if (!wpRestTestResponse.ok || wpRestTestText.includes('<!DOCTYPE') || wpRestTestText.includes('<html')) {
        return NextResponse.json(
          { 
            error: `WordPress REST API is not accessible at "${baseUrl}/wp-json/". This usually means:\n1. Permalinks need to be flushed: Go to WordPress Admin → Settings → Permalinks → Click "Save Changes"\n2. The WordPress REST API might be disabled by a plugin\n3. The base_url might be incorrect\n\nPlease fix this first, then try again.`,
            code: 'WOO_WP_REST_DISABLED'
          },
          { status: 400 }
        );
      }

      // Now test WooCommerce API endpoint
      const testUrl = `${baseUrl}/wp-json/wc/v3/products?consumer_key=${encodeURIComponent(consumer_key)}&consumer_secret=${encodeURIComponent(consumer_secret)}&per_page=1`;
      const testResponse = await fetch(testUrl, { method: 'GET' });
      
      if (!testResponse.ok) {
        const errorText = await testResponse.text().catch(() => 'Unknown error');
        // Check if it's an HTML response (404 page)
        if (errorText.includes('<!DOCTYPE') || errorText.includes('<html')) {
          return NextResponse.json(
            { 
              error: `WooCommerce API endpoint not found. The URL "${baseUrl}/wp-json/wc/v3" returned an HTML 404 page.\n\nTroubleshooting steps:\n1. Verify WooCommerce is installed and activated\n2. Go to WordPress Admin → Settings → Permalinks → Click "Save Changes" (this flushes permalinks)\n3. Check if any security plugins are blocking the REST API\n4. Verify the consumer key and secret are correct\n5. Ensure the API key has Read/Write permissions`,
              code: 'WOO_API_NOT_FOUND'
            },
            { status: 400 }
          );
        }
        // Check if it's a JSON error response
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.code === 'woocommerce_rest_authentication_error') {
            return NextResponse.json(
              { 
                error: 'WooCommerce API authentication failed. Please check your consumer key and consumer secret.',
                code: 'WOO_AUTH_ERROR'
              },
              { status: 400 }
            );
          }
        } catch {
          // Not JSON, use generic error
        }
        return NextResponse.json(
          { 
            error: `WooCommerce API test failed: ${testResponse.status} ${testResponse.statusText}. Please verify your base_url, consumer_key, and consumer_secret.`,
            code: 'WOO_API_TEST_FAILED'
          },
          { status: 400 }
        );
      }
      
      // Check if response is JSON (WooCommerce API should return JSON)
      const contentType = testResponse.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return NextResponse.json(
          { 
            error: `WooCommerce API returned non-JSON response. The endpoint "${baseUrl}/wp-json/wc/v3" may not be a valid WooCommerce REST API endpoint. Please verify the base_url is correct.`,
            code: 'WOO_API_INVALID_RESPONSE'
          },
          { status: 400 }
        );
      }
      
      // Try to parse the response to ensure it's valid WooCommerce API response
      const testData = await testResponse.json();
      if (!Array.isArray(testData) && !testData.products) {
        return NextResponse.json(
          { 
            error: 'WooCommerce API response format is unexpected. Please verify the API endpoint is correct.',
            code: 'WOO_API_INVALID_FORMAT'
          },
          { status: 400 }
        );
      }
    } catch (testError: any) {
      if (testError?.code === 'ENOTFOUND' || testError?.message?.includes('getaddrinfo')) {
        return NextResponse.json(
          { 
            error: `Cannot connect to "${baseUrl}". DNS lookup failed. Please verify the base_url is correct and the server is accessible.`,
            code: 'WOO_DNS_ERROR'
          },
          { status: 400 }
        );
      }
      if (testError?.code === 'ECONNREFUSED') {
        return NextResponse.json(
          { 
            error: `Connection refused to "${baseUrl}". The server may be down or the URL is incorrect.`,
            code: 'WOO_CONNECTION_REFUSED'
          },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { 
          error: `Failed to test WooCommerce API connection: ${testError?.message || 'Unknown error'}. Please verify your base_url, consumer_key, and consumer_secret.`,
          code: 'WOO_CONNECTION_TEST_FAILED'
        },
        { status: 400 }
      );
    }

    const existingInstallation = await InstallationRepo.getByDomain(shop);
    const installationId = existingInstallation?.id ?? await InstallationRepo.upsert(shop);

    // Convert boolean to number (1 = true, 0 = false) - already validated by Zod
    const syncPrice = sync_price ? 1 : 0;
    const syncCategories = sync_categories ? 1 : 0;
    const createProducts = create_products ? 1 : 0;
    const productStatusValue = product_status ? 1 : 0;

    const connId = ulid();
    await ConnectionRepo.insert({
      id: connId,
      installation_id: installationId,
      type: 'woocommerce',
      name,
      status: 'active',
      dest_shop_domain: null,
      dest_location_id: null,
      base_url: baseUrl,
      consumer_key: consumer_key,
      consumer_secret: consumer_secret,
      access_token: null,
      rules_json: rules ? JSON.stringify(rules) : null,
      sync_price: syncPrice,
      sync_categories: syncCategories,
      create_products: createProducts,
      product_status: productStatusValue,
      last_synced_at: null
    });

    return NextResponse.json({ id: connId });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    const message = error instanceof Error ? error.message : 'Failed to create connection';
    console.error('Error creating WooCommerce connection:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

