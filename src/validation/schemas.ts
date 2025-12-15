/**
 * Zod schemas for runtime type validation
 * Provides input validation and type safety for API endpoints
 */

import { z } from 'zod';

// Connection schemas
export const CreateShopifyConnectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less').trim(),
  dest_shop_domain: z.string().min(1, 'Shop domain is required').regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*\.myshopify\.com$/, 'Invalid Shopify domain format'),
  access_token: z.string().min(1, 'Access token is required'),
  dest_location_id: z.string().nullable().optional(),
  sync_price: z.boolean().optional().default(false),
  sync_categories: z.boolean().optional().default(false),
  sync_tags: z.boolean().optional().default(false),
  sync_collections: z.boolean().optional().default(false),
  create_products: z.boolean().optional().default(true),
  product_status: z.boolean().optional().default(false),
  rules: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const CreateWooCommerceConnectionSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less').trim(),
  base_url: z.string().min(1, 'Base URL is required').refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    { message: 'base_url must be a valid HTTP or HTTPS URL' }
  ),
  consumer_key: z.string().min(1, 'Consumer key is required'),
  consumer_secret: z.string().min(1, 'Consumer secret is required'),
  sync_price: z.boolean().optional().default(false),
  sync_categories: z.boolean().optional().default(false),
  sync_tags: z.boolean().optional().default(false),
  sync_collections: z.boolean().optional().default(false),
  create_products: z.boolean().optional().default(true),
  product_status: z.boolean().optional().default(false),
  rules: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const UpdateConnectionSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  dest_location_id: z.string().nullable().optional(),
  access_token: z.string().min(1).optional(),
  sync_price: z.boolean().optional(),
  sync_categories: z.boolean().optional(),
  sync_tags: z.boolean().optional(),
  sync_collections: z.boolean().optional(),
  create_products: z.boolean().optional(),
  product_status: z.boolean().optional(),
  rules: z.record(z.string(), z.unknown()).optional(),
}).partial();

// Mapping rules schema
export const MappingRulesSchema = z.object({
  price_multiplier: z.number().positive().optional(),
  price_adjustment: z.number().optional(),
  filters: z.object({
    tags: z.array(z.string()).optional(),
    exclude_tags: z.array(z.string()).optional(),
    product_type: z.array(z.string()).optional(),
    vendor: z.array(z.string()).optional(),
    price_min: z.number().nonnegative().optional(),
    price_max: z.number().nonnegative().optional(),
    inventory_min: z.number().int().nonnegative().optional(),
    inventory_max: z.number().int().nonnegative().optional(),
  }).optional(),
  field_mapping: z.object({
    product_type: z.string().optional(),
    vendor: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metafields: z.record(z.string(), z.string()).optional(),
  }).optional(),
  exclude_skus: z.array(z.string()).optional(),
  include_only_skus: z.array(z.string()).optional(),
  variant_rules: z.object({
    exclude_variants: z.array(z.string()).optional(),
    map_options: z.record(z.string(), z.string()).optional(),
  }).optional(),
}).partial();

// Query parameter schemas - handle string to number conversion
// Helper to parse query string numbers with defaults
function parseQueryNumber(val: string | undefined, defaultValue: number, min?: number, max?: number): number {
  if (!val) return defaultValue;
  const num = parseInt(val, 10);
  if (isNaN(num)) return defaultValue;
  if (min !== undefined && num < min) return min;
  if (max !== undefined && num > max) return max;
  return num;
}

export const PaginationSchema = z.object({
  page: z.string().optional().transform((val) => parseQueryNumber(val, 1, 1)),
  limit: z.string().optional().transform((val) => parseQueryNumber(val, 20, 1, 100)),
});

export const ConnectionHistoryQuerySchema = z.object({
  limit: z.string().optional().transform((val) => parseQueryNumber(val, 10, 1, 100)),
});

export const ErrorSummaryQuerySchema = z.object({
  hours: z.string().optional().transform((val) => parseQueryNumber(val, 24, 1, 168)), // Max 1 week
});

export const ExportLogsQuerySchema = z.object({
  limit: z.string().optional().transform((val) => parseQueryNumber(val, 10000, 1, 50000)),
});

// Template schemas
export const TemplateConfigSchema = z.object({
  name: z.string().min(1).max(255),
  dest_shop_domain: z.string().nullable().optional(),
  dest_location_id: z.string().nullable().optional(),
  base_url: z.string().nullable().optional(),
  consumer_key: z.string().nullable().optional(),
  sync_price: z.boolean(),
  sync_categories: z.boolean(),
  sync_tags: z.boolean(),
  sync_collections: z.boolean(),
  create_products: z.boolean(),
  product_status: z.boolean(),
  rules: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less').trim(),
  type: z.enum(['shopify', 'woocommerce']),
  config: TemplateConfigSchema,
});

export const UpdateTemplateSchema = z.object({
  name: z.string().min(1).max(255).trim().optional(),
  config: TemplateConfigSchema.optional(),
}).partial();

export const CreateConnectionFromTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be 255 characters or less').trim(),
  overrides: TemplateConfigSchema.partial().optional(),
});

// Helper function to validate and parse request body
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.safeParse(data);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errors = result.error.issues.map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: `Validation failed: ${errors}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Validation error' };
  }
}

// Helper function to validate query parameters
export function validateQuery<T>(schema: z.ZodSchema<T>, params: URLSearchParams | Record<string, string | string[] | undefined>): { success: true; data: T } | { success: false; error: string } {
  try {
    // Convert URLSearchParams or object to plain object
    const queryObj: Record<string, string> = {};
    if (params instanceof URLSearchParams) {
      params.forEach((value, key) => {
        queryObj[key] = value;
      });
    } else {
      Object.entries(params).forEach(([key, value]) => {
        if (typeof value === 'string') {
          queryObj[key] = value;
        } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
          queryObj[key] = value[0];
        }
      });
    }
    
    const result = schema.safeParse(queryObj);
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      const errors = result.error.issues.map((e) => {
        const path = e.path.length > 0 ? `${e.path.join('.')}: ` : '';
        return `${path}${e.message}`;
      }).join(', ');
      return { success: false, error: `Query validation failed: ${errors}` };
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Query validation error' };
  }
}

