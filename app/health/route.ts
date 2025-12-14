import { NextResponse } from 'next/server';
import { getHealthStatus } from '../../../src/utils/health';

export const runtime = 'nodejs';

export async function GET() {
  try {
    // Get detailed health status
    const health = await getHealthStatus();
    
    // Return appropriate status code based on health
    const statusCode = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
    
    return NextResponse.json({
      ...health,
      service: 'nextjs'
    }, { status: statusCode });
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

