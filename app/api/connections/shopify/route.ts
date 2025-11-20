import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { ConnectionRepo, InstallationRepo } from '../../../../src/db';
import { requireShopFromSession } from '../../_utils/authorize';

export async function POST(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    const name = String(body?.name || '').trim();
    const destShopDomain = String(body?.dest_shop_domain || '').trim();
    const accessToken = String(body?.access_token || '').trim();
    const destLocationId = body?.dest_location_id ? String(body.dest_location_id).trim() : null;

    if (!name || !destShopDomain || !accessToken) {
      return NextResponse.json(
        { error: 'name, dest_shop_domain, and access_token are required' },
        { status: 400 }
      );
    }

    const existingInstallation = await InstallationRepo.getByDomain(shop);
    if (!existingInstallation) {
      return NextResponse.json(
        { error: `Installation not found for shop ${shop}. Please reinstall the app through Shopify OAuth.` },
        { status: 400 }
      );
    }
    
    // Verify the installation has an access token
    if (!existingInstallation.access_token) {
      return NextResponse.json(
        { 
          error: `Installation missing access token for shop ${shop}. Please reinstall the app through Shopify OAuth to grant permissions.`,
          code: 'MISSING_ACCESS_TOKEN',
          shop: shop
        },
        { status: 400 }
      );
    }
    
    const installationId = existingInstallation.id;

    // Parse rules from body if provided (e.g., sync_price)
    const rules = (body?.rules && typeof body.rules === 'object') ? body.rules : null;

    const connId = ulid();
    await ConnectionRepo.insert({
      id: connId,
      installation_id: installationId,
      type: 'shopify',
      name,
      status: 'active',
      dest_shop_domain: destShopDomain,
      dest_location_id: destLocationId || null,
      base_url: null,
      consumer_key: null,
      consumer_secret: null,
      access_token: accessToken,
      rules_json: rules ? JSON.stringify(rules) : null,
      last_synced_at: null
    });

    return NextResponse.json({ id: connId });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    const message = error instanceof Error ? error.message : 'Failed to create connection';
    console.error('Error creating Shopify connection:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

