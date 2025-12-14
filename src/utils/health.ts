/**
 * Health check utilities
 * Checks database connection, connection pool status, and system health
 */

import { getPostgresPool, isPostgres } from '../db/postgres';
import { ConnectionRepo } from '../db';
import { getShopifyRateLimiter } from './rateLimiter';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: {
    status: 'connected' | 'disconnected' | 'error';
    type: 'postgresql' | 'sqlite';
    pool_size?: number;
    idle_connections?: number;
    waiting_connections?: number;
    error?: string;
  };
  connections: {
    total: number;
    active: number;
    paused: number;
    disabled: number;
  };
  rate_limiter: {
    rest_queue_size: number;
    inventory_queue_size: number;
    rest_available_tokens: number;
    inventory_available_tokens: number;
  };
  uptime_seconds: number;
}

const startTime = Date.now();

export async function getHealthStatus(): Promise<HealthStatus> {
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: {
      status: 'connected',
      type: isPostgres() ? 'postgresql' : 'sqlite'
    },
    connections: {
      total: 0,
      active: 0,
      paused: 0,
      disabled: 0
    },
    rate_limiter: {
      rest_queue_size: 0,
      inventory_queue_size: 0,
      rest_available_tokens: 0,
      inventory_available_tokens: 0
    },
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000)
  };

  // Check database connection
  try {
    if (isPostgres()) {
      const pool = getPostgresPool();
      
      // Test connection
      const client = await pool.connect();
      try {
        await client.query('SELECT 1');
        
        // Get pool stats
        health.database.pool_size = pool.totalCount;
        health.database.idle_connections = pool.idleCount;
        health.database.waiting_connections = pool.waitingCount;
      } finally {
        client.release();
      }
    } else {
      // SQLite - just check if we can access the database
      // SQLite doesn't have connection pooling, so we just verify it's accessible
      // For SQLite, we assume it's working if we got this far
      health.database.pool_size = 1;
    }
  } catch (error: any) {
    health.database.status = 'error';
    health.database.error = error.message;
    health.status = 'unhealthy';
  }

  // Check connections
  try {
    const activeConnections = await ConnectionRepo.listAllActive();
    health.connections.active = activeConnections.length;
    // Note: We can only get active connections easily, so total/paused/disabled are estimates
    // For a full health check, you'd need to query all connections
    health.connections.total = health.connections.active;
    health.connections.paused = 0;
    health.connections.disabled = 0;
  } catch (error: any) {
    // If we can't get connections, mark as degraded
    if (health.status === 'healthy') {
      health.status = 'degraded';
    }
  }

  // Check rate limiter status
  try {
    const rateLimiter = getShopifyRateLimiter();
    // Get status for a default domain (or aggregate if needed)
    const status = rateLimiter.getStatus();
    health.rate_limiter = {
      rest_queue_size: status.restQueue,
      inventory_queue_size: status.inventoryQueue,
      rest_available_tokens: status.restTokens,
      inventory_available_tokens: status.inventoryTokens
    };

    // If queues are very large, mark as degraded
    if (status.restQueue > 1000 || status.inventoryQueue > 1000) {
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
    }
  } catch (error: any) {
    // Rate limiter errors shouldn't affect health
  }

  return health;
}

