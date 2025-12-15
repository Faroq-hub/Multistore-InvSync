/**
 * Template Service
 * Business logic for managing connection templates
 */

import { ulid } from 'ulid';
import { ConnectionTemplateRepo, ConnectionRepo, type ConnectionRow } from '../db';

export interface TemplateConfig {
  name: string;
  dest_shop_domain?: string | null;
  dest_location_id?: string | null;
  base_url?: string | null;
  consumer_key?: string | null;
  sync_price: boolean;
  sync_categories: boolean;
  sync_tags: boolean;
  sync_collections: boolean;
  create_products: boolean;
  product_status: boolean;
  rules?: Record<string, unknown> | null;
}

export interface CreateTemplateParams {
  installation_id: string;
  name: string;
  type: 'shopify' | 'woocommerce';
  config: TemplateConfig;
}

export interface UpdateTemplateParams {
  name?: string;
  config?: TemplateConfig;
}

/**
 * Create a connection template from an existing connection
 */
export async function createTemplateFromConnection(
  connectionId: string,
  templateName: string
): Promise<string> {
  const connection = await ConnectionRepo.get(connectionId);
  if (!connection) {
    throw new Error('Connection not found');
  }

  const config: TemplateConfig = {
    name: connection.name,
    dest_shop_domain: connection.dest_shop_domain,
    dest_location_id: connection.dest_location_id,
    base_url: connection.base_url,
    consumer_key: connection.consumer_key,
    sync_price: connection.sync_price === 1,
    sync_categories: connection.sync_categories === 1,
    sync_tags: connection.sync_tags === 1,
    sync_collections: connection.sync_collections === 1,
    create_products: connection.create_products === 1,
    product_status: connection.product_status === 1,
    rules: connection.rules_json ? JSON.parse(connection.rules_json) : null,
  };

  const templateId = ulid();
  await ConnectionTemplateRepo.insert({
    id: templateId,
    installation_id: connection.installation_id,
    name: templateName,
    type: connection.type,
    config_json: JSON.stringify(config),
  });

  return templateId;
}

/**
 * Create a template from scratch
 */
export async function createTemplate(params: CreateTemplateParams): Promise<string> {
  const templateId = ulid();
  await ConnectionTemplateRepo.insert({
    id: templateId,
    installation_id: params.installation_id,
    name: params.name,
    type: params.type,
    config_json: JSON.stringify(params.config),
  });

  return templateId;
}

/**
 * Create a connection from a template
 */
export async function createConnectionFromTemplate(
  templateId: string,
  connectionName: string,
  overrides?: Partial<TemplateConfig> & { access_token?: string; consumer_secret?: string }
): Promise<string> {
  const template = await ConnectionTemplateRepo.get(templateId);
  if (!template) {
    throw new Error('Template not found');
  }

  const config: TemplateConfig = {
    ...JSON.parse(template.config_json),
    ...overrides,
    name: connectionName,
  };

  // Import connection service functions
  const { createShopifyConnection, createWooCommerceConnection } = await import('./connectionService');

  if (template.type === 'shopify') {
    if (!config.dest_shop_domain) {
      throw new Error('dest_shop_domain is required for Shopify connections');
    }
    return await createShopifyConnection({
      installation_id: template.installation_id,
      name: config.name,
      dest_shop_domain: config.dest_shop_domain,
      access_token: '', // User must provide access token
      dest_location_id: config.dest_location_id || null,
      sync_price: config.sync_price,
      sync_categories: config.sync_categories,
      sync_tags: config.sync_tags,
      sync_collections: config.sync_collections,
      create_products: config.create_products,
      product_status: config.product_status,
      rules: config.rules,
    });
  } else {
    if (!config.base_url || !config.consumer_key) {
      throw new Error('base_url and consumer_key are required for WooCommerce connections');
    }
    return await createWooCommerceConnection({
      installation_id: template.installation_id,
      name: config.name,
      base_url: config.base_url,
      consumer_key: config.consumer_key,
      consumer_secret: '', // User must provide consumer secret
      sync_price: config.sync_price,
      sync_categories: config.sync_categories,
      sync_tags: config.sync_tags,
      sync_collections: config.sync_collections,
      create_products: config.create_products,
      product_status: config.product_status,
      rules: config.rules,
    });
  }
}

/**
 * Update a template
 */
export async function updateTemplate(
  templateId: string,
  params: UpdateTemplateParams
): Promise<void> {
  const updates: { name?: string; config_json?: string } = {};

  if (params.name !== undefined) {
    updates.name = params.name;
  }

  if (params.config !== undefined) {
    updates.config_json = JSON.stringify(params.config);
  }

  await ConnectionTemplateRepo.update(templateId, updates);
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  await ConnectionTemplateRepo.delete(templateId);
}

/**
 * List all templates for an installation
 */
export async function listTemplates(installation_id: string) {
  return await ConnectionTemplateRepo.list(installation_id);
}

/**
 * Get a template by ID
 */
export async function getTemplate(templateId: string) {
  return await ConnectionTemplateRepo.get(templateId);
}

