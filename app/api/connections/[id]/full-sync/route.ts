import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
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

    // Check if connection is paused or disabled
    if (connection.status !== 'active') {
      return NextResponse.json({ 
        error: `Cannot sync: Connection is ${connection.status}. Please resume the connection first.` 
      }, { status: 400 });
    }

    // Log connection details for debugging
    console.log(`[API] Creating sync job for connection: id=${connection.id}, name=${connection.name}, type=${connection.type}, status=${connection.status}`);
    console.log(`[API] Connection details: type=${connection.type}, dest_shop_domain=${connection.dest_shop_domain || 'null'}, base_url=${connection.base_url || 'null'}, location_id=${connection.dest_location_id || 'NOT SET'}`);

    const jobId = ulid();
    await JobRepo.enqueue({ id: jobId, connection_id: connection.id, job_type: 'full_sync' });
    
    const job = await JobRepo.get(jobId);
    console.log(`[API] Enqueued job ${jobId} for connection ${connection.id} (type: ${connection.type})`);
    console.log(`[API] Job state: ${job?.state || 'unknown'}`);

    return NextResponse.json({ 
      jobId, 
      ok: true, 
      message: 'Sync job queued successfully',
      job: job ? {
        id: job.id,
        state: job.state,
        connection_id: job.connection_id,
        job_type: job.job_type,
        created_at: job.created_at
      } : null
    });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error creating sync job:', error);
    const message = error instanceof Error ? error.message : 'Failed to create sync job';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

