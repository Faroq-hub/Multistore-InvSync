import { NextRequest, NextResponse } from 'next/server';
import { ConnectionRepo, InstallationRepo, JobRepo } from '../../../../../src/db';
import { requireShopFromSession } from '../../../_utils/authorize';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const shop = await requireShopFromSession(request);
    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const connection = await ConnectionRepo.get(id);
    if (!connection || connection.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Cancel any queued jobs for this connection
    const cancelledCount = await JobRepo.cancelQueuedJobs(connection.id);
    console.log(`[API] Pausing connection ${id} - cancelled ${cancelledCount} queued job(s)`);

    await ConnectionRepo.updateStatus(connection.id, 'paused');
    return NextResponse.json({ 
      ok: true, 
      status: 'paused',
      cancelledJobs: cancelledCount,
      message: `Connection paused. ${cancelledCount} queued job(s) cancelled.`
    });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error pausing connection:', error);
    return NextResponse.json({ error: 'Failed to pause connection' }, { status: 500 });
  }
}

