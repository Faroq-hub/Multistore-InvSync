import { NextRequest, NextResponse } from 'next/server';
import { ConnectionTemplateRepo, InstallationRepo } from '../../../../../src/db';
import { requireShopFromSession } from '../../../_utils/authorize';
import { deleteTemplate, createConnectionFromTemplate } from '../../../../../src/services/templateService';
import { validateBody } from '../../../../../src/validation/schemas';
import { z } from 'zod';

const UseTemplateSchema = z.object({
  connection_name: z.string().min(1).max(255),
  access_token: z.string().optional(),
  consumer_secret: z.string().optional(),
});

/**
 * GET /api/connections/templates/[id]
 * Get a template by ID
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

    const template = await ConnectionTemplateRepo.get(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json({ template });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error fetching template:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/connections/templates/[id]
 * Delete a template
 */
export async function DELETE(
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

    const template = await ConnectionTemplateRepo.get(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await deleteTemplate(id);
    return NextResponse.json({ message: 'Template deleted' });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error deleting template:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/connections/templates/[id]/use
 * Create a connection from a template
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    const validation = validateBody(UseTemplateSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const template = await ConnectionTemplateRepo.get(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const connectionId = await createConnectionFromTemplate(
      id,
      validation.data.connection_name,
      {
        access_token: validation.data.access_token,
        consumer_secret: validation.data.consumer_secret,
      }
    );

    return NextResponse.json({ connection_id: connectionId }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error using template:', error);
    const message = error instanceof Error ? error.message : 'Failed to create connection from template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

