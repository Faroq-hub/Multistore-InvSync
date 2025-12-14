import { NextRequest, NextResponse } from 'next/server';
import { ulid } from 'ulid';
import { ConnectionRepo, InstallationRepo } from '../../../../src/db';
import { requireShopFromSession } from '../../_utils/authorize';
import { CreateShopifyConnectionSchema, validateBody } from '../../../../src/validation/schemas';

export async function POST(request: NextRequest) {
  try {
    const shop = await requireShopFromSession(request);
    const body = await request.json();

    // Validate input with Zod
    const validation = validateBody(CreateShopifyConnectionSchema, body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { name, dest_shop_domain, access_token, dest_location_id, sync_price, sync_categories, create_products, product_status, rules } = validation.data;

    const existingInstallation = await InstallationRepo.getByDomain(shop);
    if (!existingInstallation) {
      return NextResponse.json(
        { error: `Installation not found for shop ${shop}. Please reinstall the app through Shopify OAuth.` },
        { status: 400 }
      );
    }
    
    // Verify the installation has an access token
    if (!existingInstallation.access_token) {
      return NextResponse.json(
        { 
          error: `Installation missing access token for shop ${shop}. Please reinstall the app through Shopify OAuth to grant permissions.`,
          code: 'MISSING_ACCESS_TOKEN',
          shop: shop
        },
        { status: 400 }
      );
    }
    
    const installationId = existingInstallation.id;

    // Convert boolean to number (1 = true, 0 = false) - already validated by Zod
    const syncPrice = sync_price ? 1 : 0;
    const syncCategories = sync_categories ? 1 : 0;
    const createProducts = create_products ? 1 : 0;
    const productStatusValue = product_status ? 1 : 0;

    const connId = ulid();
    await ConnectionRepo.insert({
      id: connId,
      installation_id: installationId,
      type: 'shopify',
      name,
      status: 'active',
      dest_shop_domain: dest_shop_domain,
      dest_location_id: dest_location_id || null,
      base_url: null,
      consumer_key: null,
      consumer_secret: null,
      access_token: access_token,
      rules_json: rules ? JSON.stringify(rules) : null,
      sync_price: syncPrice,
      sync_categories: syncCategories,
      create_products: createProducts,
      product_status: productStatusValue,
      last_synced_at: null
    });

    return NextResponse.json({ id: connId });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    const message = error instanceof Error ? error.message : 'Failed to create connection';
    console.error('Error creating Shopify connection:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

