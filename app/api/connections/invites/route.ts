import { NextRequest, NextResponse } from 'next/server';
import { ConnectionInviteRepo, InstallationRepo } from '../../../../src/db';
import { requireShopFromSession } from '../../_utils/authorize';
import { ulid } from 'ulid';
import crypto from 'node:crypto';

/**
 * POST /api/connections/invites
 * Create a connection invite (wholesaler invites retailer)
 */
export async function POST(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    const { name, retailer_email, retailer_shop_domain } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (!retailer_shop_domain || typeof retailer_shop_domain !== 'string' || !retailer_shop_domain.trim()) {
      return NextResponse.json({ error: 'Retailer store domain is required' }, { status: 400 });
    }

    // Sanitize shop domain (must be *.myshopify.com)
    let sanitizedDomain = retailer_shop_domain.trim().toLowerCase();
    if (!sanitizedDomain.endsWith('.myshopify.com')) {
      if (sanitizedDomain.includes('.')) {
        return NextResponse.json(
          { error: 'Invalid Shopify domain. Use format: your-store.myshopify.com' },
          { status: 400 }
        );
      }
      sanitizedDomain = `${sanitizedDomain}.myshopify.com`;
    }

    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const inviteId = ulid();
    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await ConnectionInviteRepo.insert({
      id: inviteId,
      installation_id: installation.id,
      token,
      retailer_email: retailer_email && typeof retailer_email === 'string' ? retailer_email.trim() || null : null,
      retailer_shop_domain: sanitizedDomain,
      name: name.trim(),
      status: 'pending',
      connection_id: null,
      expires_at: expiresAt.toISOString(),
    });

    const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3001');
    const inviteUrl = `${appUrl.replace(/\/$/, '')}/connect?token=${token}`;

    return NextResponse.json({
      id: inviteId,
      token,
      invite_url: inviteUrl,
      expires_at: expiresAt.toISOString(),
      retailer_shop_domain: sanitizedDomain,
    });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error creating invite:', error);
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 });
  }
}

/**
 * GET /api/connections/invites
 * List invites for the current installation
 */
export async function GET(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ invites: [] });
    }

    const invites = await ConnectionInviteRepo.list(installation.id);
    const now = new Date().toISOString();

    return NextResponse.json({
      invites: invites.map((inv) => ({
        id: inv.id,
        name: inv.name,
        retailer_email: inv.retailer_email,
        retailer_shop_domain: inv.retailer_shop_domain,
        status: inv.expires_at < now && inv.status === 'pending' ? 'expired' : inv.status,
        connection_id: inv.connection_id,
        expires_at: inv.expires_at,
        created_at: inv.created_at,
        invite_url: `${process.env.APP_URL || request.nextUrl.origin}/connect?token=${inv.token}`,
      })),
    });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error listing invites:', error);
    return NextResponse.json({ error: 'Failed to list invites' }, { status: 500 });
  }
}
