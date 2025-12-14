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
    
    // Helper function to escape CSV values
    const escapeCsv = (value: string | null | undefined): string => {
      if (value === null || value === undefined) return '';
      const str = String(value);
      // Escape quotes by doubling them, and wrap in quotes if contains comma, quote, or newline
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };
    
    // Convert to CSV
    const headers = ['Timestamp', 'Level', 'SKU', 'Message'];
    const csvRows = [
      headers.map(escapeCsv).join(','),
      ...logs.map(log => [
        escapeCsv(log.ts),
        escapeCsv(log.level),
        escapeCsv(log.sku),
        escapeCsv(log.message)
      ].join(','))
    ];
    
    const csv = csvRows.join('\n');
    // Sanitize filename - remove special characters
    const sanitizedName = connection.name.replace(/[^a-zA-Z0-9-_]/g, '_');
    const filename = `sync-logs-${sanitizedName}-${new Date().toISOString().split('T')[0]}.csv`;

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

