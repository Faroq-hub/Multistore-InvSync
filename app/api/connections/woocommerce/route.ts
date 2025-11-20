import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { ConnectionRepo, InstallationRepo } from '../../../../src/db';
import { requireShopFromSession } from '../../_utils/authorize';

export async function POST(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    const name = String(body?.name || '').trim();
    let baseUrl = String(body?.base_url || '').trim();
    const consumerKey = String(body?.consumer_key || '').trim();
    const consumerSecret = String(body?.consumer_secret || '').trim();

    if (!name || !baseUrl || !consumerKey || !consumerSecret) {
      return NextResponse.json(
        { error: 'name, base_url, consumer_key, and consumer_secret are required' },
        { status: 400 }
      );
    }

    // Normalize base_url: remove trailing slashes and /wp-json if present
    baseUrl = baseUrl.replace(/\/+$/, ''); // Remove trailing slashes
    baseUrl = baseUrl.replace(/\/wp-json\/?.*$/, ''); // Remove /wp-json and anything after
    
    // Validate URL format
    try {
      const url = new URL(baseUrl);
      if (!url.protocol || !['http:', 'https:'].includes(url.protocol)) {
        return NextResponse.json(
          { error: 'base_url must be a valid HTTP or HTTPS URL (e.g., https://example.com)' },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: 'base_url must be a valid URL (e.g., https://example.com). Do not include /wp-json in the URL.' },
        { status: 400 }
      );
    }

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
      const testUrl = `${baseUrl}/wp-json/wc/v3/products?consumer_key=${encodeURIComponent(consumerKey)}&consumer_secret=${encodeURIComponent(consumerSecret)}&per_page=1`;
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

    // Parse rules from body if provided (e.g., sync_price)
    const rules = (body?.rules && typeof body.rules === 'object') ? body.rules : null;

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
      consumer_key: consumerKey,
      consumer_secret: consumerSecret,
      access_token: null,
      rules_json: rules ? JSON.stringify(rules) : null,
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

