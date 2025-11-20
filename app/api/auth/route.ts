import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { shopify } from '../../../src/shopify/shopify';
import { ShopifyOAuthStateRepo } from '../../../src/db';

export const runtime = 'nodejs';

const CALLBACK_PATH = '/api/auth/callback';
const STATE_COOKIE = 'shopify_app_state';
const HOST_COOKIE = 'shopify_app_host';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const shop = searchParams.get('shop');
  const host = searchParams.get('host');

  if (!shop) {
    return NextResponse.json({ error: 'Missing shop parameter' }, { status: 400 });
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

  const state = crypto.randomBytes(16).toString('hex');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000);

  await ShopifyOAuthStateRepo.purgeExpired(now.toISOString());
  await ShopifyOAuthStateRepo.insert({
    state,
    shop_domain: sanitizedShop,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  });

  const appUrl = process.env.APP_URL || `${shopify.config.hostScheme}://${shopify.config.hostName}`;
  const redirectUri = `${appUrl.replace(/\/$/, '')}${CALLBACK_PATH}`;
  
  const redirectParams = new URLSearchParams({
    client_id: shopify.config.apiKey,
    scope: shopify.config.scopes?.toString() ?? '',
    redirect_uri: redirectUri,
    state
  });

  const redirectUrl = `https://${sanitizedShop}/admin/oauth/authorize?${redirectParams.toString()}`;

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.set({
    name: STATE_COOKIE,
    value: state,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: CALLBACK_PATH,
    maxAge: 60 * 5
  });

  if (host) {
    response.cookies.set({
      name: HOST_COOKIE,
      value: host,
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 10
    });
  }

  return response;
}
