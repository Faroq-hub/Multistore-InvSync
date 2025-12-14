import { NextRequest, NextResponse } from 'next/server';
import { ConnectionRepo, InstallationRepo, JobRepo } from '../../../../../src/db';
import { requireShopFromSession } from '../../../_utils/authorize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shop = await requireShopFromSession(request);
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '10', 10);

    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const connection = await ConnectionRepo.get(id);
    if (!connection || connection.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const jobs = await JobRepo.listByConnection(id, limit);
    
    // Calculate sync speed for each job
    const jobsWithMetrics = jobs.map(job => {
      const created = new Date(job.created_at).getTime();
      const updated = new Date(job.updated_at).getTime();
      const duration = updated - created; // milliseconds
      const durationMinutes = duration / (1000 * 60);
      
      return {
        id: job.id,
        job_type: job.job_type,
        state: job.state,
        attempts: job.attempts,
        last_error: job.last_error,
        created_at: job.created_at,
        updated_at: job.updated_at,
        duration_seconds: Math.round(duration / 1000),
        duration_minutes: Math.round(durationMinutes * 100) / 100
      };
    });

    return NextResponse.json({ 
      connection_id: id,
      jobs: jobsWithMetrics,
      count: jobsWithMetrics.length
    });
  } catch (error) {
    console.error('Error fetching sync history:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch sync history';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

