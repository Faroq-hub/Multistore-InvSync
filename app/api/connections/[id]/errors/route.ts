import { NextRequest, NextResponse } from 'next/server';
import { ConnectionRepo, InstallationRepo, AuditRepo } from '../../../../../src/db';
import { requireShopFromSession } from '../../../_utils/authorize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shop = await requireShopFromSession(request);
    const searchParams = request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get('hours') || '24', 10);

    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const connection = await ConnectionRepo.get(id);
    if (!connection || connection.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const errorSummary = await AuditRepo.getErrorSummary(id, hours);
    
    // Determine health status
    let health: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (errorSummary.total > 0) {
      if (errorSummary.byLevel.error > 10 || errorSummary.total > 50) {
        health = 'critical';
      } else if (errorSummary.byLevel.error > 0 || errorSummary.byLevel.warn > 5) {
        health = 'warning';
      }
    }

    return NextResponse.json({ 
      connection_id: id,
      hours,
      health,
      errors: errorSummary,
      last_synced_at: connection.last_synced_at
    });
  } catch (error) {
    console.error('Error fetching error summary:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch error summary';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

