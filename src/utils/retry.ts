/**
 * Retry utility with exponential backoff
 * Handles transient errors and rate limit responses
 */

export enum ErrorType {
  TRANSIENT = 'transient',  // Retryable (network, rate limit, 5xx)
  PERMANENT = 'permanent',  // Don't retry (auth, invalid data, 4xx except 429)
  BUSINESS = 'business'     // Business logic error (out of stock, etc.)
}

export interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;      // Base delay in milliseconds
  maxDelay?: number;       // Maximum delay in milliseconds
  backoffMultiplier?: number;
  retryableStatuses?: number[]; // HTTP status codes to retry
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  retryableStatuses: [429, 500, 502, 503, 504]
};

/**
 * Categorize error based on HTTP status code and error message
 */
export function categorizeError(status: number | undefined, error: any): ErrorType {
  if (!status) {
    // Network errors are transient
    if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
      return ErrorType.TRANSIENT;
    }
    return ErrorType.PERMANENT;
  }

  // Rate limit - always transient
  if (status === 429) {
    return ErrorType.TRANSIENT;
  }

  // 5xx errors are transient
  if (status >= 500 && status < 600) {
    return ErrorType.TRANSIENT;
  }

  // 4xx errors are usually permanent (except 429)
  if (status >= 400 && status < 500) {
    // 401/403 are auth errors - permanent
    if (status === 401 || status === 403) {
      return ErrorType.PERMANENT;
    }
    // Other 4xx might be transient (e.g., 408 timeout)
    if (status === 408) {
      return ErrorType.TRANSIENT;
    }
    return ErrorType.PERMANENT;
  }

  return ErrorType.TRANSIENT;
}

/**
 * Extract retry delay from 429 response headers
 */
function getRetryAfter(response: { headers?: { get?: (name: string) => string | null } }): number | null {
  if (!response.headers?.get) return null;
  
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = parseInt(retryAfter, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000; // Convert to milliseconds
    }
  }
  return null;
}

/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let lastResponse: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await fn();
      return result;
    } catch (error: any) {
      lastError = error;
      lastResponse = error.response;

      // Don't retry on last attempt
      if (attempt >= opts.maxRetries) {
        throw error;
      }

      // Categorize error
      const status = lastResponse?.status || error.status;
      const errorType = categorizeError(status, error);

      // Don't retry permanent errors
      if (errorType === ErrorType.PERMANENT) {
        throw error;
      }

      // Calculate delay
      let delay: number;
      
      // Check for Retry-After header (429 responses)
      if (status === 429) {
        const retryAfter = getRetryAfter(lastResponse || {});
        if (retryAfter) {
          delay = Math.min(retryAfter, opts.maxDelay);
        } else {
          // Exponential backoff for 429 without Retry-After
          delay = Math.min(
            opts.baseDelay * Math.pow(opts.backoffMultiplier, attempt),
            opts.maxDelay
          );
        }
      } else {
        // Exponential backoff for other transient errors
        delay = Math.min(
          opts.baseDelay * Math.pow(opts.backoffMultiplier, attempt),
          opts.maxDelay
        );
      }

      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * delay; // Up to 30% jitter
      delay = delay + jitter;

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, Math.round(delay)));
    }
  }

  throw lastError;
}

/**
 * Wrapper for fetch with retry logic
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  return retryWithBackoff(async () => {
    const response = await fetch(url, init);
    
    // Throw error for non-ok responses so retry logic can handle them
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      error.response = response;
      throw error;
    }
    
    return response;
  }, retryOptions);
}

