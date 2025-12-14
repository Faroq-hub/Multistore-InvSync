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
    const limit = parseInt(searchParams.get('limit') || '10000', 10);

    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const connection = await ConnectionRepo.get(id);
    if (!connection || connection.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    const logs = await AuditRepo.exportLogs(id, limit);
    
    // Convert to CSV
    const headers = ['Timestamp', 'Level', 'SKU', 'Message'];
    const csvRows = [
      headers.join(','),
      ...logs.map(log => [
        log.ts,
        log.level,
        log.sku || '',
        `"${log.message.replace(/"/g, '""')}"` // Escape quotes in CSV
      ].join(','))
    ];
    
    const csv = csvRows.join('\n');
    const filename = `sync-logs-${connection.name}-${new Date().toISOString().split('T')[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error exporting logs:', error);
    const message = error instanceof Error ? error.message : 'Failed to export logs';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

