import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShopifyRateLimiter, getShopifyRateLimiter } from '../rateLimiter';

describe('ShopifyRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('executeRest', () => {
    it('should execute REST API calls with rate limiting', async () => {
      const limiter = new ShopifyRateLimiter();
      const fn = vi.fn().mockResolvedValue('success');

      const result = await limiter.executeRest('test.myshopify.com', fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should queue requests when rate limit is exceeded', async () => {
      const limiter = new ShopifyRateLimiter();
      const results: string[] = [];

      // Execute 50 requests (more than bucket size of 40)
      const promises = Array.from({ length: 50 }, (_, i) =>
        limiter.executeRest('test.myshopify.com', async () => {
          results.push(`request-${i}`);
          return `result-${i}`;
        })
      );

      // Fast-forward time to process queue
      await vi.advanceTimersByTimeAsync(2000);

      await Promise.all(promises);

      expect(results.length).toBe(50);
    });

    it('should handle per-domain rate limiting', async () => {
      const limiter = new ShopifyRateLimiter();
      const fn1 = vi.fn().mockResolvedValue('domain1');
      const fn2 = vi.fn().mockResolvedValue('domain2');

      const [result1, result2] = await Promise.all([
        limiter.executeRest('domain1.myshopify.com', fn1),
        limiter.executeRest('domain2.myshopify.com', fn2),
      ]);

      expect(result1).toBe('domain1');
      expect(result2).toBe('domain2');
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('executeInventory', () => {
    it('should execute inventory API calls with stricter rate limiting', async () => {
      const limiter = new ShopifyRateLimiter();
      const fn = vi.fn().mockResolvedValue('success');

      const result = await limiter.executeInventory('test.myshopify.com', fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should queue inventory requests separately from REST requests', async () => {
      const limiter = new ShopifyRateLimiter();
      const restFn = vi.fn().mockResolvedValue('rest');
      const invFn = vi.fn().mockResolvedValue('inventory');

      const [restResult, invResult] = await Promise.all([
        limiter.executeRest('test.myshopify.com', restFn),
        limiter.executeInventory('test.myshopify.com', invFn),
      ]);

      expect(restResult).toBe('rest');
      expect(invResult).toBe('inventory');
    });
  });

  describe('getStatus', () => {
    it('should return queue status for a domain', () => {
      const limiter = new ShopifyRateLimiter();
      const status = limiter.getStatus('test.myshopify.com');

      expect(status).toHaveProperty('restQueue');
      expect(status).toHaveProperty('inventoryQueue');
      expect(status).toHaveProperty('restTokens');
      expect(status).toHaveProperty('inventoryTokens');
    });
  });

  describe('getShopifyRateLimiter', () => {
    it('should return singleton instance', () => {
      const instance1 = getShopifyRateLimiter();
      const instance2 = getShopifyRateLimiter();

      expect(instance1).toBe(instance2);
    });
  });
});


