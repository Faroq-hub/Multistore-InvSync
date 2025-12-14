import { NextRequest, NextResponse } from 'next/server';
import { requireShopFromSession } from '../../_utils/authorize';
import { CreateShopifyConnectionSchema, validateBody } from '../../../../src/validation/schemas';
import { createShopifyConnection, verifyInstallationAccess } from '../../../../src/services/connectionService';

/**
 * POST /api/connections/shopify
 * Create a new Shopify connection
 */
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

    // Verify installation and get installation_id
    const { installation_id } = await verifyInstallationAccess(shop);

    // Create connection using service layer
    const connId = await createShopifyConnection({
      installation_id,
      name,
      dest_shop_domain,
      access_token,
      dest_location_id,
      sync_price,
      sync_categories,
      create_products,
      product_status,
      rules: rules || null
    });

    return NextResponse.json({ id: connId });
  } catch (error) {
    if (error instanceof Error && 'response' in error) {
      return (error as any).response;
    }
    const message = error instanceof Error ? error.message : 'Failed to create connection';
    console.error('Error creating Shopify connection:', error);
    
    // Return appropriate status code based on error message
    const status = message.includes('Installation not found') || message.includes('missing access token') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

