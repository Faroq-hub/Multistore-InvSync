import { NextRequest, NextResponse } from 'next/server';
import { ConnectionRepo, InstallationRepo } from '../../../../src/db';
import { requireShopFromSession } from '../../_utils/authorize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shop = await requireShopFromSession(request);

    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const connection = await ConnectionRepo.get(id);
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (connection.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized: Connection does not belong to this shop' }, { status: 403 });
    }

    // Parse rules_json for client
    let rules = null;
    if (connection.rules_json) {
      try {
        rules = JSON.parse(connection.rules_json);
      } catch {
        rules = null;
      }
    }

    // Sanitize connection data (remove sensitive fields for GET)
    const sanitized = {
      id: connection.id,
      name: connection.name,
      type: connection.type,
      status: connection.status,
      dest_shop_domain: connection.dest_shop_domain,
      dest_location_id: connection.dest_location_id,
      base_url: connection.base_url,
      created_at: connection.created_at,
      updated_at: connection.updated_at,
      last_synced_at: connection.last_synced_at,
      rules,
    };

    return NextResponse.json({ connection: sanitized });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error fetching connection:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch connection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const connection = await ConnectionRepo.get(id);
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (connection.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized: Connection does not belong to this shop' }, { status: 403 });
    }

    // Update location_id if provided
    if (body.dest_location_id !== undefined) {
      await ConnectionRepo.updateLocationId(id, body.dest_location_id || null);
      console.log(`[API] Updated location_id for connection ${id}: ${body.dest_location_id || 'null'}`);
    }

    // Update name if provided
    if (body.name !== undefined && typeof body.name === 'string' && body.name.trim()) {
      await ConnectionRepo.updateName(id, body.name.trim());
      console.log(`[API] Updated name for connection ${id}: ${body.name}`);
    }

    // Update rules if provided (e.g., sync_price)
    if (body.rules !== undefined) {
      const existingRules = connection.rules_json ? JSON.parse(connection.rules_json) : {};
      const updatedRules = { ...existingRules, ...body.rules };
      await ConnectionRepo.updateRules(id, JSON.stringify(updatedRules));
      console.log(`[API] Updated rules for connection ${id}:`, updatedRules);
    }

    // Update access_token if provided (for Shopify connections)
    if (body.access_token !== undefined && typeof body.access_token === 'string' && body.access_token.trim()) {
      if (connection.type === 'shopify') {
        await ConnectionRepo.updateAccessToken(id, body.access_token.trim());
        console.log(`[API] Updated access_token for connection ${id}`);
      } else {
        return NextResponse.json({ error: 'access_token can only be updated for Shopify connections' }, { status: 400 });
      }
    }

    const updated = await ConnectionRepo.get(id);
    return NextResponse.json({ 
      message: 'Connection updated successfully',
      connection: updated ? {
        id: updated.id,
        name: updated.name,
        dest_location_id: updated.dest_location_id,
        updated_at: updated.updated_at
      } : null
    });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error updating connection:', error);
    const message = error instanceof Error ? error.message : 'Failed to update connection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shop = await requireShopFromSession(request);

    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const connection = await ConnectionRepo.get(id);
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (connection.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized: Connection does not belong to this shop' }, { status: 403 });
    }

    await ConnectionRepo.delete(id);
    return NextResponse.json({ message: 'Connection deleted successfully' });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error deleting connection:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete connection';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
