import { NextRequest, NextResponse } from 'next/server';
import { ConnectionRepo, InstallationRepo } from '../../../../../src/db';
import { requireShopFromSession } from '../../../_utils/authorize';
import { generateSyncPreview } from '../../../../../src/services/syncPreview';
import { validateQuery } from '../../../../../src/validation/schemas';
import { z } from 'zod';

const PreviewQuerySchema = z.object({
  limit: z.string().optional().transform((val) => (val ? parseInt(val, 10) : 50)),
});

/**
 * GET /api/connections/[id]/preview
 * Get a preview of what will sync for a connection
 */
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
    if (!connection) {
      return NextResponse.json({ error: 'Connection not found' }, { status: 404 });
    }

    if (connection.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const url = new URL(request.url);
    const queryValidation = validateQuery(PreviewQuerySchema, Object.fromEntries(url.searchParams));
    if (!queryValidation.success) {
      return NextResponse.json(
        { error: queryValidation.error },
        { status: 400 }
      );
    }

    const limit = queryValidation.data.limit || 50;
    const preview = await generateSyncPreview(id, limit);

    return NextResponse.json({ preview });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error generating preview:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate preview';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
