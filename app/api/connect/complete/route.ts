import { NextRequest, NextResponse } from 'next/server';
import { ConnectionPendingRepo, ConnectionInviteRepo, ConnectionRepo } from '../../../../src/db';
import { decryptSecret } from '../../../../src/utils/secrets';
import { ulid } from 'ulid';

const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || '2024-10';

/**
 * GET /api/connect/complete?pending=xxx
 * Fetch locations from retailer's Shopify store (for location picker)
 */
export async function GET(request: NextRequest) {
  const pendingToken = request.nextUrl.searchParams.get('pending');
  if (!pendingToken) {
    return NextResponse.json({ error: 'Missing pending token' }, { status: 400 });
  }

  await ConnectionPendingRepo.purgeExpired();
  const pending = await ConnectionPendingRepo.getByToken(pendingToken);
  if (!pending) {
    return NextResponse.json({ error: 'Invalid or expired session. Please start over from the invite link.' }, { status: 404 });
  }

  const accessToken = decryptSecret(pending.access_token);
  if (!accessToken) {
    return NextResponse.json({ error: 'Session error. Please start over from the invite link.' }, { status: 500 });
  }

  const url = `https://${pending.dest_shop_domain}/admin/api/${SHOPIFY_API_VERSION}/locations.json?limit=100`;
  const res = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[connect/complete] Shopify locations API error:', res.status, errText);
    return NextResponse.json(
      { error: 'Failed to fetch locations from your store. Please try again.' },
      { status: 502 }
    );
  }

  const data = (await res.json()) as { locations?: Array<{ id: number; name: string; address?: { city?: string; province?: string } }> };
  const locations = data.locations || [];

  return NextResponse.json({
    locations: locations.map((loc) => {
      let address: string | undefined;
      if (loc.address) {
        const parts = [loc.address.city || '', loc.address.province || ''].filter(Boolean);
        address = parts.join(' ').trim() || undefined;
      }
      return {
        id: String(loc.id),
        name: loc.name,
        address,
      };
    }),
    dest_shop_domain: pending.dest_shop_domain,
  });
}

/**
 * POST /api/connect/complete
 * Create connection with selected location
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const pendingToken = body.pending_token;
  const locationId = body.location_id;

  if (!pendingToken || typeof pendingToken !== 'string') {
    return NextResponse.json({ error: 'Missing pending token' }, { status: 400 });
  }
  if (!locationId || typeof locationId !== 'string' || !locationId.trim()) {
    return NextResponse.json({ error: 'Location is required. Please select a location.' }, { status: 400 });
  }

  await ConnectionPendingRepo.purgeExpired();
  const pending = await ConnectionPendingRepo.getByToken(pendingToken);
  if (!pending) {
    return NextResponse.json({ error: 'Invalid or expired session. Please start over from the invite link.' }, { status: 404 });
  }

  const invite = await ConnectionInviteRepo.get(pending.invite_id);
  if (!invite || invite.status !== 'pending' || !invite.installation_id) {
    return NextResponse.json({ error: 'Invite no longer valid.' }, { status: 400 });
  }

  const connId = ulid();
  await ConnectionRepo.insert({
    id: connId,
    installation_id: invite.installation_id,
    type: 'shopify',
    name: invite.name,
    status: 'active',
    dest_shop_domain: pending.dest_shop_domain,
    dest_location_id: locationId.trim(),
    base_url: null,
    consumer_key: null,
    consumer_secret: null,
    access_token: pending.access_token,
    rules_json: null,
    sync_price: 0,
    sync_categories: 0,
    sync_tags: 0,
    sync_collections: 0,
    create_products: 1,
    product_status: 0,
  });

  await ConnectionInviteRepo.markAccepted(pending.invite_id, connId);
  await ConnectionPendingRepo.deleteByToken(pendingToken);

  return NextResponse.json({ success: true, redirect: '/connect/success' });
}
