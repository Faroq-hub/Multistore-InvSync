import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, categorizeError, ErrorType } from '../retry';

describe('retry utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('categorizeError', () => {
    it('should categorize 429 as transient', () => {
      expect(categorizeError(429, {})).toBe(ErrorType.TRANSIENT);
    });

    it('should categorize 5xx as transient', () => {
      expect(categorizeError(500, {})).toBe(ErrorType.TRANSIENT);
      expect(categorizeError(502, {})).toBe(ErrorType.TRANSIENT);
      expect(categorizeError(503, {})).toBe(ErrorType.TRANSIENT);
    });

    it('should categorize 401/403 as permanent', () => {
      expect(categorizeError(401, {})).toBe(ErrorType.PERMANENT);
      expect(categorizeError(403, {})).toBe(ErrorType.PERMANENT);
    });

    it('should categorize other 4xx as permanent', () => {
      expect(categorizeError(400, {})).toBe(ErrorType.PERMANENT);
      expect(categorizeError(404, {})).toBe(ErrorType.PERMANENT);
    });

    it('should categorize 408 as transient', () => {
      expect(categorizeError(408, {})).toBe(ErrorType.TRANSIENT);
    });

    it('should categorize network errors as transient', () => {
      expect(categorizeError(undefined, { message: 'fetch failed' })).toBe(ErrorType.TRANSIENT);
      expect(categorizeError(undefined, { message: 'network error' })).toBe(ErrorType.TRANSIENT);
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry transient errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce({ status: 429, message: 'Rate limited' })
        .mockResolvedValueOnce('success');
      
      const promise = retryWithBackoff(fn, { maxRetries: 3, baseDelay: 100 });
      
      // Fast-forward time to skip delays
      await vi.advanceTimersByTimeAsync(200);
      
      const result = await promise;
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry permanent errors', async () => {
      const fn = vi.fn().mockRejectedValue({ status: 401, message: 'Unauthorized' });
      
      await expect(retryWithBackoff(fn, { maxRetries: 3 })).rejects.toMatchObject({
        status: 401
      });
      
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const fn = vi.fn().mockRejectedValue({ status: 500, message: 'Server error' });
      
      const promise = retryWithBackoff(fn, { maxRetries: 2, baseDelay: 100 });
      
      // Fast-forward time
      await vi.advanceTimersByTimeAsync(500);
      
      await expect(promise).rejects.toMatchObject({
        status: 500
      });
      
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });
});

