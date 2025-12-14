import { NextRequest, NextResponse } from 'next/server';
import { ConnectionRepo, InstallationRepo } from '../../../../../src/db';
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

    // Check if connection is already active
    if (connection.status === 'active') {
      return NextResponse.json({ 
        ok: true, 
        status: 'active',
        message: 'Connection is already active'
      });
    }

    // Log the resume action
    console.log(`[API] Resuming connection ${id} (${connection.name}) - status changed from ${connection.status} to active`);

    await ConnectionRepo.updateStatus(connection.id, 'active');
    return NextResponse.json({ 
      ok: true, 
      status: 'active',
      message: 'Connection resumed successfully. Sync jobs will now be processed.'
    });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error resuming connection:', error);
    return NextResponse.json({ error: 'Failed to resume connection' }, { status: 500 });
  }
}

