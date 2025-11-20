import { NextRequest, NextResponse } from 'next/server';
import { shopify } from '../../../../src/shopify/shopify';
import { syncShopifyWebhooks } from '../../../../src/shopify/webhooks';
import { InstallationRepo, ShopifyOAuthStateRepo } from '../../../../src/db';

export const runtime = 'nodejs';

const STATE_COOKIE = 'shopify_app_state';
const HOST_COOKIE = 'shopify_app_host';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shop = searchParams.get('shop');
  const state = searchParams.get('state');
  const code = searchParams.get('code');
  const nowIso = new Date().toISOString();

  await ShopifyOAuthStateRepo.purgeExpired(nowIso);

  if (!shop || !state || !code) {
    return NextResponse.json({ error: 'Missing required OAuth parameters' }, { status: 400 });
  }

  const stateCookie = request.cookies.get(STATE_COOKIE)?.value;
  if (!stateCookie || stateCookie !== state) {
    return NextResponse.json({ error: 'Invalid OAuth state' }, { status: 400 });
  }

  const storedState = await ShopifyOAuthStateRepo.consume(state);
  if (!storedState) {
    return NextResponse.json({ error: 'OAuth state expired or not found' }, { status: 400 });
  }

  let sanitizedShop: string | null = null;
  try {
    sanitizedShop = shopify.utils.sanitizeShop(shop, true);
  } catch {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  if (!sanitizedShop) {
    return NextResponse.json({ error: 'Invalid shop domain' }, { status: 400 });
  }

  const query: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value) {
      query[key] = value;
    }
  }

  const validHmac = await shopify.utils.validateHmac(query);
  if (!validHmac) {
    return NextResponse.json({ error: 'Invalid OAuth signature' }, { status: 400 });
  }

  const tokenResponse = await fetch(`https://${sanitizedShop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({
      client_id: shopify.config.apiKey,
      client_secret: shopify.config.apiSecretKey,
      code
    })
  });

  if (!tokenResponse.ok) {
    const errorBody = await tokenResponse.text();
    return NextResponse.json({ error: 'Failed to exchange OAuth code', detail: errorBody }, { status: 502 });
  }

  const tokenPayload = (await tokenResponse.json()) as { access_token: string; scope: string };
  const installationId = await InstallationRepo.upsert(sanitizedShop, tokenPayload.access_token, tokenPayload.scope);
  const installation = await InstallationRepo.getById(installationId);

  if (installation?.access_token) {
    try {
      await syncShopifyWebhooks(installation);
    } catch (err) {
      console.error('Failed to sync Shopify webhooks:', err);
    }
  }

  const host = request.cookies.get(HOST_COOKIE)?.value;
  const appUrl = process.env.APP_URL || `https://${shopify.config.hostName}`;
  const redirectUrl = new URL(appUrl);
  redirectUrl.searchParams.set('shop', sanitizedShop);
  if (host) {
    redirectUrl.searchParams.set('host', host);
  }

  const response = NextResponse.redirect(redirectUrl.toString());
  response.cookies.delete(STATE_COOKIE);
  if (host) {
    response.cookies.set({
      name: HOST_COOKIE,
      value: host,
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60
    });
  }

  return response;
}

