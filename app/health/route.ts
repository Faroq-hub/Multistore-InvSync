import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Simple health check for Next.js service
    // For detailed health (database, connections, etc.), use the backend /health endpoint
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'nextjs',
      message: 'Next.js service is running'
    }, { status: 200 });
  } catch (error: any) {
    // If health check fails, return unhealthy status
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'nextjs',
      error: error.message || 'Health check failed'
    }, { status: 503 });
  }
}

