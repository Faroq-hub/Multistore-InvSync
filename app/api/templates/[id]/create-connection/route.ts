import { NextRequest, NextResponse } from 'next/server';
import { InstallationRepo } from '../../../../../../src/db';
import { requireShopFromSession } from '../../../../_utils/authorize';
import { getTemplate, createConnectionFromTemplate } from '../../../../../../src/services/templateService';
import { CreateConnectionFromTemplateSchema, validateBody } from '../../../../../../src/validation/schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    const validation = validateBody(CreateConnectionFromTemplateSchema, body);
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

    const template = await getTemplate(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create connection from template
    const connectionId = await createConnectionFromTemplate(
      id,
      validation.data.name,
      validation.data.overrides
    );

    return NextResponse.json({ connection_id: connectionId }, { status: 201 });
  } catch (error) {
    console.error('Error creating connection from template:', error);
    const message = error instanceof Error ? error.message : 'Failed to create connection from template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


