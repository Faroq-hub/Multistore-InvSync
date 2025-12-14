/**
 * Shopify API Rate Limiter
 * 
 * Handles Shopify API rate limits:
 * - REST Admin API: 40 requests/second (bucket size: 40, refill: 40/sec)
 * - Inventory API: 2 requests/second (bucket size: 2, refill: 2/sec)
 * 
 * Uses token bucket algorithm with per-domain queues
 */

type RateLimitConfig = {
  bucketSize: number;      // Maximum tokens in bucket
  refillRate: number;      // Tokens per second
  queueMaxSize?: number;   // Maximum queue size (default: 1000)
};

class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  private readonly config: RateLimitConfig;
  private readonly queue: Array<{
    resolve: (value: any) => void;
    reject: (error: any) => void;
    fn: () => Promise<any>;
  }> = [];
  private processing = false;

  constructor(config: RateLimitConfig) {
    this.config = config;
    this.tokens = config.bucketSize;
    this.lastRefill = Date.now();
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000; // seconds
    const tokensToAdd = elapsed * this.config.refillRate;
    this.tokens = Math.min(this.config.bucketSize, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;

    while (this.queue.length > 0) {
      this.refill();

      if (this.tokens >= 1) {
        this.tokens -= 1;
        const item = this.queue.shift()!;
        
        try {
          const result = await item.fn();
          item.resolve(result);
        } catch (error) {
          item.reject(error);
        }
      } else {
        // Wait until we have tokens
        const waitTime = (1 - this.tokens) / this.config.refillRate * 1000;
        await new Promise(resolve => setTimeout(resolve, Math.max(10, waitTime)));
      }
    }

    this.processing = false;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const maxQueueSize = this.config.queueMaxSize || 1000;
      if (this.queue.length >= maxQueueSize) {
        reject(new Error('Rate limiter queue is full'));
        return;
      }

      this.queue.push({ resolve, reject, fn });
      this.processQueue();
    });
  }

  getQueueSize(): number {
    return this.queue.length;
  }

  getAvailableTokens(): number {
    this.refill();
    return this.tokens;
  }
}

/**
 * Shopify API Rate Limiter
 * Manages rate limits per destination domain
 */
export class ShopifyRateLimiter {
  // REST Admin API: 40 req/sec
  private readonly restLimiter: TokenBucket;
  // Inventory API: 2 req/sec  
  private readonly inventoryLimiter: TokenBucket;
  // Per-domain limiters (for multiple destinations)
  private readonly domainLimiters: Map<string, { rest: TokenBucket; inventory: TokenBucket }> = new Map();

  constructor() {
    this.restLimiter = new TokenBucket({
      bucketSize: 40,
      refillRate: 40, // 40 tokens per second
      queueMaxSize: 1000
    });

    this.inventoryLimiter = new TokenBucket({
      bucketSize: 2,
      refillRate: 2, // 2 tokens per second
      queueMaxSize: 1000
    });
  }

  /**
   * Get or create rate limiters for a specific domain
   */
  private getDomainLimiters(domain: string): { rest: TokenBucket; inventory: TokenBucket } {
    if (!this.domainLimiters.has(domain)) {
      this.domainLimiters.set(domain, {
        rest: new TokenBucket({ bucketSize: 40, refillRate: 40, queueMaxSize: 1000 }),
        inventory: new TokenBucket({ bucketSize: 2, refillRate: 2, queueMaxSize: 1000 })
      });
    }
    return this.domainLimiters.get(domain)!;
  }

  /**
   * Execute a REST API request with rate limiting
   */
  async executeRest<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    const limiters = this.getDomainLimiters(domain);
    return limiters.rest.execute(fn);
  }

  /**
   * Execute an Inventory API request with rate limiting
   */
  async executeInventory<T>(domain: string, fn: () => Promise<T>): Promise<T> {
    const limiters = this.getDomainLimiters(domain);
    return limiters.inventory.execute(fn);
  }

  /**
   * Get queue status for monitoring
   */
  getStatus(domain?: string): {
    restQueue: number;
    inventoryQueue: number;
    restTokens: number;
    inventoryTokens: number;
  } {
    if (domain) {
      const limiters = this.getDomainLimiters(domain);
      return {
        restQueue: limiters.rest.getQueueSize(),
        inventoryQueue: limiters.inventory.getQueueSize(),
        restTokens: limiters.rest.getAvailableTokens(),
        inventoryTokens: limiters.inventory.getAvailableTokens()
      };
    }
    return {
      restQueue: this.restLimiter.getQueueSize(),
      inventoryQueue: this.inventoryLimiter.getQueueSize(),
      restTokens: this.restLimiter.getAvailableTokens(),
      inventoryTokens: this.inventoryLimiter.getAvailableTokens()
    };
  }
}

// Singleton instance
let rateLimiterInstance: ShopifyRateLimiter | null = null;

export function getShopifyRateLimiter(): ShopifyRateLimiter {
  if (!rateLimiterInstance) {
    rateLimiterInstance = new ShopifyRateLimiter();
  }
  return rateLimiterInstance;
}

