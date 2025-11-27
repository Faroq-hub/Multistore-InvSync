import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  // Health check endpoint for Railway
  // This ensures the health check passes even when only Next.js is running
  return NextResponse.json({ 
    ok: true, 
    timestamp: new Date().toISOString(),
    service: 'nextjs'
  });
}

