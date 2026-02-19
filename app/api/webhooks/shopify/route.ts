import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'node:crypto';

/**
 * Shopify webhook endpoint - required for App Store compliance.
 * Must be reachable at APP_URL (same as main app) since Railway exposes one port.
 * Handles: products/*, inventory_levels/update, app/uninstalled,
 *          customers/data_request, customers/redact, shop/redact (GDPR)
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const headerHmac = request.headers.get('x-shopify-hmac-sha256');

    // Shopify uses client secret for webhook HMAC - use SHOPIFY_API_SECRET or SHOPIFY_WEBHOOK_SECRET
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET || process.env.SHOPIFY_API_SECRET || '';

    if (!secret) {
      console.error('[webhooks/shopify] Missing SHOPIFY_API_SECRET or SHOPIFY_WEBHOOK_SECRET');
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }

    if (!headerHmac) {
      return NextResponse.json({ error: 'Missing HMAC signature' }, { status: 401 });
    }

    const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64');
    if (digest !== headerHmac) {
      return NextResponse.json({ error: 'Invalid HMAC signature' }, { status: 401 });
    }

    // Parse payload for topic (compliance webhooks need 200 response)
    let topic: string | undefined;
    try {
      const payload = rawBody ? JSON.parse(rawBody) : {};
      topic = payload?.topic || request.headers.get('x-shopify-topic') || undefined;
    } catch {
      // Non-JSON or empty body - still valid, return 200
    }

    // Log compliance webhooks for audit (GDPR)
    if (topic && ['customers/data_request', 'customers/redact', 'shop/redact'].includes(topic)) {
      console.log(`[webhooks/shopify] Compliance webhook received: ${topic}`);
      // TODO: Handle shop/redact - disable installation, remove data
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[webhooks/shopify] Error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
