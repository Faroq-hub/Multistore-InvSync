import { NextRequest, NextResponse } from 'next/server';
import { InstallationRepo } from '../../../../../src/db';
import { requireShopFromSession } from '../../../_utils/authorize';
import { getTemplate, updateTemplate, deleteTemplate, createConnectionFromTemplate } from '../../../../../src/services/templateService';
import { UpdateTemplateSchema, validateBody } from '../../../../../src/validation/schemas';

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

    const template = await getTemplate(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
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
    });
  } catch (error) {
    console.error('Error fetching template:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    const validation = validateBody(UpdateTemplateSchema, body);
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

    await updateTemplate(id, validation.data);

    const updated = await getTemplate(id);
    return NextResponse.json({
      template: {
        id: updated!.id,
        name: updated!.name,
        type: updated!.type,
        config: JSON.parse(updated!.config_json),
        created_at: updated!.created_at,
        updated_at: updated!.updated_at,
      },
    });
  } catch (error) {
    console.error('Error updating template:', error);
    const message = error instanceof Error ? error.message : 'Failed to update template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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

    const template = await getTemplate(id);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    if (template.installation_id !== installation.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await deleteTemplate(id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting template:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete template';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


