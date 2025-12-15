import { describe, it, expect } from 'vitest';
import { applyMappingRules, passesFilters } from '../mappingRules';
import type { CatalogItem } from '../types';
import type { MappingRules } from '../mappingRules';

describe('mappingRules', () => {
  const sampleItem: CatalogItem = {
    sku: 'TEST-001',
    title: 'Test Product',
    price: '100',
    currency: 'USD',
    stock: 10,
    source: 'shopify',
    tags: ['tag1', 'tag2'],
    vendor: 'Test Vendor',
    category: 'Test Category',
  } as CatalogItem & { product_type?: string };

  describe('passesFilters', () => {
    it('should pass when no filters are defined', () => {
      const rules: MappingRules = {};
      expect(passesFilters(sampleItem, rules)).toBe(true);
    });

    it('should filter by tags', () => {
      const rules: MappingRules = {
        filters: {
          tags: ['tag1'],
        },
      };
      expect(passesFilters(sampleItem, rules)).toBe(true);

      const rules2: MappingRules = {
        filters: {
          tags: ['tag3'],
        },
      };
      expect(passesFilters(sampleItem, rules2)).toBe(false);
    });

    it('should filter by exclude_tags', () => {
      const rules: MappingRules = {
        filters: {
          exclude_tags: ['tag1'],
        },
      };
      expect(passesFilters(sampleItem, rules)).toBe(false);

      const rules2: MappingRules = {
        filters: {
          exclude_tags: ['tag3'],
        },
      };
      expect(passesFilters(sampleItem, rules2)).toBe(true);
    });

    it('should filter by product_type', () => {
      const rules: MappingRules = {
        filters: {
          product_type: ['Electronics'],
        },
      };
      expect(passesFilters(sampleItem, rules)).toBe(true);

      const rules2: MappingRules = {
        filters: {
          product_type: ['Clothing'],
        },
      };
      expect(passesFilters(sampleItem, rules2)).toBe(false);
    });

    it('should filter by vendor', () => {
      const rules: MappingRules = {
        filters: {
          vendor: ['Test Vendor'],
        },
      };
      expect(passesFilters(sampleItem, rules)).toBe(true);

      const rules2: MappingRules = {
        filters: {
          vendor: ['Other Vendor'],
        },
      };
      expect(passesFilters(sampleItem, rules2)).toBe(false);
    });

    it('should filter by price range', () => {
      const rules: MappingRules = {
        filters: {
          price_min: 50,
          price_max: 150,
        },
      };
      expect(passesFilters(sampleItem, rules)).toBe(true);

      const rules2: MappingRules = {
        filters: {
          price_min: 200,
        },
      };
      expect(passesFilters(sampleItem, rules2)).toBe(false);
    });

    it('should filter by inventory level', () => {
      const rules: MappingRules = {
        filters: {
          inventory_min: 5,
          inventory_max: 15,
        },
      };
      expect(passesFilters(sampleItem, rules)).toBe(true);

      const rules2: MappingRules = {
        filters: {
          inventory_min: 20,
        },
      };
      expect(passesFilters(sampleItem, rules2)).toBe(false);
    });
  });

  describe('applyMappingRules', () => {
    it('should apply price multiplier', () => {
      const rules: MappingRules = {
        price_multiplier: 1.2,
      };
      const result = applyMappingRules(sampleItem, rules);

      expect(result.price).toBe(120);
    });

    it('should apply price adjustment', () => {
      const rules: MappingRules = {
        price_adjustment: -10,
      };
      const result = applyMappingRules(sampleItem, rules);

      expect(parseFloat(result.price)).toBe(90);
    });

    it('should apply both multiplier and adjustment', () => {
      const rules: MappingRules = {
        price_multiplier: 1.2,
        price_adjustment: -10,
      };
      const result = applyMappingRules(sampleItem, rules);

      // (100 * 1.2) - 10 = 110
      expect(parseFloat(result.price)).toBe(110);
    });

    it('should map product_type', () => {
      const rules: MappingRules = {
        field_mapping: {
          product_type: 'Mapped Type',
        },
      };
      const result = applyMappingRules(sampleItem, rules);

      expect(result.product_type).toBe('Mapped Type');
    });

    it('should map vendor', () => {
      const rules: MappingRules = {
        field_mapping: {
          vendor: 'Mapped Vendor',
        },
      };
      const result = applyMappingRules(sampleItem, rules);

      expect(result.vendor).toBe('Mapped Vendor');
    });

    it('should map tags', () => {
      const rules: MappingRules = {
        field_mapping: {
          tags: ['new-tag1', 'new-tag2'],
        },
      };
      const result = applyMappingRules(sampleItem, rules);

      expect(result.tags).toEqual(['new-tag1', 'new-tag2']);
    });

    it('should exclude SKUs in exclude_skus', () => {
      const rules: MappingRules = {
        exclude_skus: ['TEST-001'],
      };
      const result = applyMappingRules(sampleItem, rules);

      expect((result as any)._skip).toBe(true);
    });

    it('should include only SKUs in include_only_skus', () => {
      const rules: MappingRules = {
        include_only_skus: ['TEST-001'],
      };
      const result = applyMappingRules(sampleItem, rules);

      expect((result as any)._skip).toBeUndefined();
    });

    it('should exclude SKUs not in include_only_skus', () => {
      const rules: MappingRules = {
        include_only_skus: ['OTHER-SKU'],
      };
      const result = applyMappingRules(sampleItem, rules);

      expect((result as any)._skip).toBe(true);
    });
  });
});

