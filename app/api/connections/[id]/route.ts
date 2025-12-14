import { NextRequest, NextResponse } from 'next/server';
import { ConnectionRepo, InstallationRepo } from '../../../../src/db';
import { requireShopFromSession } from '../../_utils/authorize';
import { updateConnection } from '../../../../src/services/connectionService';
import { UpdateConnectionSchema, validateBody } from '../../../../src/validation/schemas';

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
      sync_price: connection.sync_price === 1,
      sync_categories: connection.sync_categories === 1,
      sync_tags: connection.sync_tags === 1,
      sync_collections: connection.sync_collections === 1,
      create_products: connection.create_products === 1,
      product_status: connection.product_status === 1,
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

/**
 * PATCH /api/connections/[id]
 * Update a connection
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    // Validate input with Zod
    const validation = validateBody(UpdateConnectionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

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

    // Update connection using service layer
    await updateConnection(id, validation.data);

    const updated = await ConnectionRepo.get(id);
    return NextResponse.json({ connection: updated });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    const message = error instanceof Error ? error.message : 'Failed to update connection';
    console.error('Error updating connection:', error);
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
