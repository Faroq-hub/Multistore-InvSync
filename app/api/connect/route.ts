import { NextRequest, NextResponse } from 'next/server';
import { ConnectionInviteRepo, InstallationRepo } from '../../../src/db';

/**
 * GET /api/connect?token=xxx
 * Public API - validate invite token and return invite details for retailer landing page
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 400 });
  }

  const invite = await ConnectionInviteRepo.getByToken(token);
  if (!invite) {
    return NextResponse.json({ error: 'Invalid or expired invite' }, { status: 404 });
  }

  const now = new Date().toISOString();
  if (invite.status !== 'pending') {
    return NextResponse.json({
      error: invite.status === 'accepted' ? 'This invite has already been used' : 'This invite is no longer valid',
      status: invite.status,
    }, { status: 400 });
  }
  if (invite.expires_at < now) {
    return NextResponse.json({ error: 'This invite has expired' }, { status: 400 });
  }

  const installation = await InstallationRepo.getById(invite.installation_id);
  const wholesalerName = installation?.shop_domain?.replace('.myshopify.com', '') || 'Your supplier';

  return NextResponse.json({
    invite_id: invite.id,
    retailer_shop_domain: invite.retailer_shop_domain,
    name: invite.name,
    wholesaler_name: wholesalerName,
    expires_at: invite.expires_at,
  });
}
