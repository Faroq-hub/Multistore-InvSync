/**
 * Metrics collection for monitoring sync performance
 * Tracks sync duration, success/failure rates, API call counts
 */

interface SyncMetrics {
  connection_id: string;
  job_id: string;
  job_type: string;
  duration_ms: number;
  items_processed: number;
  items_succeeded: number;
  items_failed: number;
  api_calls: number;
  api_errors: number;
  rate_limit_hits: number;
  started_at: string;
  completed_at: string;
}

class MetricsCollector {
  private metrics: Map<string, SyncMetrics> = new Map();
  private apiCallCounts: Map<string, number> = new Map();
  private apiErrorCounts: Map<string, number> = new Map();
  private rateLimitHits: Map<string, number> = new Map();

  /**
   * Start tracking metrics for a job
   */
  startJob(connection_id: string, job_id: string, job_type: string): void {
    this.metrics.set(job_id, {
      connection_id,
      job_id,
      job_type,
      duration_ms: 0,
      items_processed: 0,
      items_succeeded: 0,
      items_failed: 0,
      api_calls: 0,
      api_errors: 0,
      rate_limit_hits: 0,
      started_at: new Date().toISOString(),
      completed_at: ''
    });
  }

  /**
   * Record job completion
   */
  completeJob(job_id: string, items_processed: number, items_succeeded: number, items_failed: number): void {
    const metric = this.metrics.get(job_id);
    if (!metric) return;

    const completed_at = new Date();
    const started_at = new Date(metric.started_at);
    const duration_ms = completed_at.getTime() - started_at.getTime();

    metric.duration_ms = duration_ms;
    metric.items_processed = items_processed;
    metric.items_succeeded = items_succeeded;
    metric.items_failed = items_failed;
    metric.api_calls = this.apiCallCounts.get(job_id) ?? 0;
    metric.api_errors = this.apiErrorCounts.get(job_id) ?? 0;
    metric.rate_limit_hits = this.rateLimitHits.get(job_id) ?? 0;
    metric.completed_at = completed_at.toISOString();
  }

  /**
   * Increment API call count
   */
  incrementApiCall(job_id: string): void {
    const current = this.apiCallCounts.get(job_id) ?? 0;
    this.apiCallCounts.set(job_id, current + 1);
  }

  /**
   * Increment API error count
   */
  incrementApiError(job_id: string): void {
    const current = this.apiErrorCounts.get(job_id) ?? 0;
    this.apiErrorCounts.set(job_id, current + 1);
  }

  /**
   * Increment rate limit hit count
   */
  incrementRateLimitHit(job_id: string): void {
    const current = this.rateLimitHits.get(job_id) ?? 0;
    this.rateLimitHits.set(job_id, current + 1);
  }

  /**
   * Get metrics for a job
   */
  getJobMetrics(job_id: string): SyncMetrics | undefined {
    return this.metrics.get(job_id);
  }

  /**
   * Get metrics for a connection
   */
  getConnectionMetrics(connection_id: string): SyncMetrics[] {
    return Array.from(this.metrics.values()).filter(m => m.connection_id === connection_id);
  }

  /**
   * Get aggregated metrics for a connection
   */
  getAggregatedMetrics(connection_id: string): {
    total_jobs: number;
    total_items_processed: number;
    total_items_succeeded: number;
    total_items_failed: number;
    total_api_calls: number;
    total_api_errors: number;
    total_rate_limit_hits: number;
    avg_duration_ms: number;
    success_rate: number;
  } {
    const connectionMetrics = this.getConnectionMetrics(connection_id);
    
    if (connectionMetrics.length === 0) {
      return {
        total_jobs: 0,
        total_items_processed: 0,
        total_items_succeeded: 0,
        total_items_failed: 0,
        total_api_calls: 0,
        total_api_errors: 0,
        total_rate_limit_hits: 0,
        avg_duration_ms: 0,
        success_rate: 0
      };
    }

    const total = connectionMetrics.reduce((acc, m) => ({
      items_processed: acc.items_processed + m.items_processed,
      items_succeeded: acc.items_succeeded + m.items_succeeded,
      items_failed: acc.items_failed + m.items_failed,
      api_calls: acc.api_calls + m.api_calls,
      api_errors: acc.api_errors + m.api_errors,
      rate_limit_hits: acc.rate_limit_hits + m.rate_limit_hits,
      duration_ms: acc.duration_ms + m.duration_ms
    }), {
      items_processed: 0,
      items_succeeded: 0,
      items_failed: 0,
      api_calls: 0,
      api_errors: 0,
      rate_limit_hits: 0,
      duration_ms: 0
    });

    const total_items = total.items_processed || 1;
    const success_rate = (total.items_succeeded / total_items) * 100;
    const avg_duration_ms = connectionMetrics.length > 0 
      ? total.duration_ms / connectionMetrics.length 
      : 0;

    return {
      total_jobs: connectionMetrics.length,
      total_items_processed: total.items_processed,
      total_items_succeeded: total.items_succeeded,
      total_items_failed: total.items_failed,
      total_api_calls: total.api_calls,
      total_api_errors: total.api_errors,
      total_rate_limit_hits: total.rate_limit_hits,
      avg_duration_ms: Math.round(avg_duration_ms),
      success_rate: Math.round(success_rate * 100) / 100
    };
  }

  /**
   * Clean up old metrics (keep last 1000 jobs)
   */
  cleanup(): void {
    if (this.metrics.size > 1000) {
      const sorted = Array.from(this.metrics.entries())
        .sort((a, b) => 
          new Date(b[1].completed_at || b[1].started_at).getTime() - 
          new Date(a[1].completed_at || a[1].started_at).getTime()
        );
      
      const toKeep = sorted.slice(0, 1000);
      this.metrics.clear();
      toKeep.forEach(([id, metric]) => this.metrics.set(id, metric));
    }
  }
}

// Singleton instance
let metricsCollector: MetricsCollector | null = null;

export function getMetricsCollector(): MetricsCollector {
  if (!metricsCollector) {
    metricsCollector = new MetricsCollector();
    // Cleanup old metrics every 5 minutes
    setInterval(() => {
      metricsCollector?.cleanup();
    }, 5 * 60 * 1000);
  }
  return metricsCollector;
}

