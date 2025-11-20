'use server';

import { NextRequest, NextResponse } from 'next/server';
import { shopify } from '../../../src/shopify/shopify';

const appUrl = process.env.APP_URL || `${shopify.config.hostScheme}://${shopify.config.hostName}`;

function buildReauthResponse(shop?: string) {
  const redirect = new URL('/api/auth', appUrl);
  if (shop) {
    redirect.searchParams.set('shop', shop);
  }

  const response = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  response.headers.set('X-Shopify-API-Request-Failure-Reauthorize', '1');
  response.headers.set('X-Shopify-API-Request-Failure-Reauthorize-Url', redirect.toString());
  return response;
}

export async function requireShopFromSession(request: NextRequest): Promise<string> {
  const headerShop = request.headers.get('x-shop') || undefined;
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throwError('Missing session token', headerShop);
  }

  const token = authHeader.substring('Bearer '.length).trim();
  if (!token) {
    throwError('Invalid session token', headerShop);
  }

  try {
    const payload = await shopify.session.decodeSessionToken(token);

    const candidate =
      safeExtractHost(payload.dest) ||
      safeExtractHost(payload.iss);

    if (!candidate) {
      throwError('Unable to determine shop from token', headerShop);
    }

    const sanitized = shopify.utils.sanitizeShop(candidate, true);
    if (!sanitized) {
      throwError('Invalid shop domain in session token', candidate || headerShop);
    }

    if (payload.exp && payload.exp * 1000 < Date.now()) {
      throwError('Session token expired', sanitized);
    }

    return sanitized;
  } catch (error) {
    if (error instanceof Error && 'response' in error) throw error;
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Log signature errors for debugging
    if (errorMessage.includes('signature verification failed') || errorMessage.includes('signature')) {
      console.error('[Auth] Signature verification failed - verify SHOPIFY_API_SECRET matches Partner Dashboard');
    } else {
      console.error('[Auth] Token validation error:', errorMessage);
    }
    
    throwError('Failed to validate session token', headerShop);
  }
}

function safeExtractHost(urlString: string | null | undefined): string | null {
  if (!urlString) return null;
  try {
    const url = new URL(urlString);
    return url.host.toLowerCase();
  } catch {
    return null;
  }
}

function throwError(message: string, shop?: string): never {
  const error = new Error(message) as Error & { response: NextResponse };
  (error as any).response = buildReauthResponse(shop);
  throw error;
}

