import { NextRequest, NextResponse } from 'next/server';
import { ConnectionTemplateRepo, InstallationRepo } from '../../../../src/db';
import { requireShopFromSession } from '../../_utils/authorize';
import { listTemplates, createTemplateFromConnection, deleteTemplate } from '../../../../src/services/templateService';
import { validateBody, validateQuery } from '../../../../src/validation/schemas';
import { z } from 'zod';

const CreateTemplateSchema = z.object({
  connection_id: z.string().min(1),
  name: z.string().min(1).max(255),
});

/**
 * GET /api/connections/templates
 * List all templates for the current installation
 */
export async function GET(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const templates = await listTemplates(installation.id);
    return NextResponse.json({ templates });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error listing templates:', error);
    const message = error instanceof Error ? error.message : 'Failed to list templates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/connections/templates
 * Create a template from an existing connection
 */
export async function POST(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    const validation = validateBody(CreateTemplateSchema, body);
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

    const templateId = await createTemplateFromConnection(
      validation.data.connection_id,
      validation.data.name
    );

    const template = await ConnectionTemplateRepo.get(templateId);
    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    console.error('Error creating template:', error);
    const message = error instanceof Error ? error.message : 'Failed to create template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

