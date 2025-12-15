import { NextRequest, NextResponse } from 'next/server';
import { InstallationRepo } from '../../../../src/db';
import { requireShopFromSession } from '../_utils/authorize';
import { listTemplates, createTemplate, type CreateTemplateParams } from '../../../../src/services/templateService';
import { CreateTemplateSchema, validateBody } from '../../../../src/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const installation = await InstallationRepo.getByDomain(shop);
    if (!installation) {
      return NextResponse.json({ error: 'Installation not found' }, { status: 404 });
    }

    const templates = await listTemplates(installation.id);
    
    // Parse config_json for client
    const templatesWithConfig = templates.map(t => ({
      id: t.id,
      name: t.name,
      type: t.type,
      config: JSON.parse(t.config_json),
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));

    return NextResponse.json({ templates: templatesWithConfig });
  } catch (error) {
    console.error('Error fetching templates:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch templates';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const templateId = await createTemplate({
      installation_id: installation.id,
      name: validation.data.name,
      type: validation.data.type,
      config: validation.data.config,
    });

    const template = await getTemplate(templateId);
    if (!template) {
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    return NextResponse.json({
      template: {
        id: template.id,
        name: template.name,
        type: template.type,
        config: JSON.parse(template.config_json),
        created_at: template.created_at,
        updated_at: template.updated_at,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    const message = error instanceof Error ? error.message : 'Failed to create template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function getTemplate(templateId: string) {
  const { getTemplate } = await import('../../../../src/services/templateService');
  return await getTemplate(templateId);
}


