import { NextRequest, NextResponse } from 'next/server';
import { ConnectionRepo, InstallationRepo, JobRepo, JobItemRepo } from '../../../../../src/db';
import { requireShopFromSession } from '../../../_utils/authorize';

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
    if (!connection || connection.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    // Get the current running job
    const recentJobs = await JobRepo.listByConnection(id, 1);
    const runningJob = recentJobs.find(j => j.state === 'running');
    
    if (!runningJob) {
      return NextResponse.json({ 
        isRunning: false,
        message: 'No sync in progress'
      });
    }

    // Get progress for the running job
    const progress = await JobItemRepo.getProgress(runningJob.id);
    const percentage = progress.total > 0 
      ? Math.round((progress.completed / progress.total) * 100) 
      : 0;

    // Calculate speed (items per minute)
    const created = new Date(runningJob.created_at).getTime();
    const now = Date.now();
    const elapsedMinutes = (now - created) / (1000 * 60);
    const speed = elapsedMinutes > 0 
      ? Math.round(progress.completed / elapsedMinutes) 
      : 0;

    return NextResponse.json({ 
      isRunning: true,
      job_id: runningJob.id,
      job_type: runningJob.job_type,
      progress: {
        total: progress.total,
        completed: progress.completed,
        failed: progress.failed,
        remaining: progress.total - progress.completed - progress.failed,
        percentage
      },
      speed: {
        items_per_minute: speed,
        estimated_minutes_remaining: speed > 0 && progress.remaining > 0
          ? Math.round((progress.remaining / speed) * 10) / 10
          : null
      },
      started_at: runningJob.created_at
    });
  } catch (error) {
    console.error('Error fetching sync progress:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch sync progress';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

