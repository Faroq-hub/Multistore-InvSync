import { NextRequest, NextResponse } from 'next/server';
import { ConnectionRepo, InstallationRepo, AuditRepo } from '../../../src/db';
import { requireShopFromSession } from '../_utils/authorize';

export async function GET(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ 
        connections: [],
        installation: {
          shop,
          hasAccessToken: false,
          needsReinstall: true
        }
      });
    }

    const connections = (await ConnectionRepo.list(installation.id)).map(async (conn) => {
      const sanitized = sanitizeConnection(conn);
      // Add SKU count for each connection
      const syncedSkus = await AuditRepo.countSyncedSkus(conn.id);
      return {
        ...sanitized,
        syncedSkus
      };
    });
    const connectionsWithSkus = await Promise.all(connections);
    const hasAccessToken = !!installation.access_token;
    
    return NextResponse.json({ 
      connections: connectionsWithSkus,
      installation: {
        shop: installation.shop_domain,
        hasAccessToken,
        needsReinstall: !hasAccessToken
      }
    });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error fetching connections:', error);
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const deletedCount = await ConnectionRepo.deleteAll(installation.id);
    
    return NextResponse.json({ 
      success: true, 
      deleted: deletedCount,
      message: `Deleted ${deletedCount} connection(s)` 
    });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error deleting connections:', error);
    return NextResponse.json({ error: 'Failed to delete connections' }, { status: 500 });
  }
}

function sanitizeConnection(conn: any) {
  let rules = null;
  if (conn.rules_json) {
    try {
      rules = JSON.parse(conn.rules_json);
    } catch {
      rules = null;
    }
  }

  return {
    id: conn.id,
    name: conn.name,
    type: conn.type,
    status: conn.status,
    dest_shop_domain: conn.dest_shop_domain,
    dest_location_id: conn.dest_location_id,
    base_url: conn.base_url,
    created_at: conn.created_at,
    updated_at: conn.updated_at,
    last_synced_at: conn.last_synced_at,
    rules
  };
}
