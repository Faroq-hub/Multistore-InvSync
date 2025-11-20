/**
 * Database utility functions for parameter conversion and query execution
 */

import { Pool } from 'pg';
import Database from 'better-sqlite3';
import { getPostgresPool, isPostgres } from './postgres';

/**
 * Convert SQLite parameter syntax (@param) to PostgreSQL ($1, $2, ...)
 */
export function convertParams(sql: string, params: Record<string, any>): { query: string; values: any[] } {
  const paramNames = Object.keys(params);
  const values: any[] = [];
  let query = sql;
  let paramIndex = 1;

  paramNames.forEach(name => {
    const regex = new RegExp(`@${name}\\b`, 'g');
    query = query.replace(regex, `$${paramIndex}`);
    values.push(params[name]);
    paramIndex++;
  });

  return { query, values };
}

/**
 * Execute a query using either PostgreSQL or SQLite
 */
export async function execQuery(
  sql: string,
  params: Record<string, any>,
  sqliteDb?: Database.Database
): Promise<{ rows: any[]; rowCount: number }> {
  if (isPostgres()) {
    const pool = getPostgresPool();
    const { query, values } = convertParams(sql, params);
    const result = await pool.query(query, values);
    return { rows: result.rows, rowCount: result.rowCount || 0 };
  } else {
    if (!sqliteDb) {
      throw new Error('SQLite database not provided');
    }
    const stmt = sqliteDb.prepare(sql);
    const rows = stmt.all(params) as any[];
    return { rows, rowCount: rows.length };
  }
}

/**
 * Execute a query and return a single row
 */
export async function execQueryOne(
  sql: string,
  params: Record<string, any>,
  sqliteDb?: Database.Database
): Promise<any | null> {
  if (isPostgres()) {
    const pool = getPostgresPool();
    const { query, values } = convertParams(sql, params);
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  } else {
    if (!sqliteDb) {
      throw new Error('SQLite database not provided');
    }
    const stmt = sqliteDb.prepare(sql);
    const row = stmt.get(params);
    return row || null;
  }
}

/**
 * Execute a query that doesn't return results (INSERT, UPDATE, DELETE)
 */
export async function execCommand(
  sql: string,
  params: Record<string, any>,
  sqliteDb?: Database.Database
): Promise<{ changes: number }> {
  if (isPostgres()) {
    const pool = getPostgresPool();
    const { query, values } = convertParams(sql, params);
    const result = await pool.query(query, values);
    return { changes: result.rowCount || 0 };
  } else {
    if (!sqliteDb) {
      throw new Error('SQLite database not provided');
    }
    const stmt = sqliteDb.prepare(sql);
    const result = stmt.run(params);
    return { changes: result.changes || 0 };
  }
}

/**
 * Execute a transaction
 */
export async function execTransaction<T>(
  fn: (exec: {
    query: (sql: string, params: Record<string, any>) => Promise<any[]>;
    queryOne: (sql: string, params: Record<string, any>) => Promise<any | null>;
    command: (sql: string, params: Record<string, any>) => Promise<{ changes: number }>;
  }) => Promise<T> | T,
  sqliteDb?: Database.Database
): Promise<T> {
  if (isPostgres()) {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const exec = {
        query: async (sql: string, params: Record<string, any>) => {
          const { query, values } = convertParams(sql, params);
          const result = await client.query(query, values);
          return result.rows;
        },
        queryOne: async (sql: string, params: Record<string, any>) => {
          const { query, values } = convertParams(sql, params);
          const result = await client.query(query, values);
          return result.rows[0] || null;
        },
        command: async (sql: string, params: Record<string, any>) => {
          const { query, values } = convertParams(sql, params);
          const result = await client.query(query, values);
          return { changes: result.rowCount || 0 };
        }
      };

      const result = await fn(exec);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } else {
    if (!sqliteDb) {
      throw new Error('SQLite database not provided');
    }
    // SQLite transactions are synchronous, but we need to support async callbacks
    // So we manually handle BEGIN/COMMIT/ROLLBACK without using SQLite's transaction wrapper
    try {
      sqliteDb.prepare('BEGIN IMMEDIATE').run();
      
      const exec = {
        query: async (sql: string, params: Record<string, any>) => {
          const stmt = sqliteDb!.prepare(sql);
          return stmt.all(params) as any[];
        },
        queryOne: async (sql: string, params: Record<string, any>) => {
          const stmt = sqliteDb!.prepare(sql);
          return stmt.get(params) || null;
        },
        command: async (sql: string, params: Record<string, any>) => {
          const stmt = sqliteDb!.prepare(sql);
          const result = stmt.run(params);
          return { changes: result.changes || 0 };
        }
      };

      try {
        const result = await fn(exec);
        sqliteDb.prepare('COMMIT').run();
        return result;
      } catch (err) {
        sqliteDb.prepare('ROLLBACK').run();
        throw err;
      }
    } catch (err) {
      // If BEGIN failed, try to rollback
      try {
        sqliteDb.prepare('ROLLBACK').run();
      } catch {
        // Ignore rollback errors
      }
      throw err;
    }
  }
}

/**
 * Handle INSERT OR REPLACE / ON CONFLICT for both databases
 */
export function convertUpsert(sql: string): string {
  if (isPostgres()) {
    // PostgreSQL uses ON CONFLICT
    // Convert "INSERT OR REPLACE" to "INSERT ... ON CONFLICT DO UPDATE"
    if (sql.includes('INSERT OR REPLACE')) {
      // Extract table name and values, then convert
      // This is a simplified version - may need adjustment for complex cases
      sql = sql.replace(/INSERT OR REPLACE INTO\s+(\w+)/i, 'INSERT INTO $1');
      // Add ON CONFLICT clause - this requires knowing the primary key
      // For now, we'll handle specific cases
      if (sql.includes('shopify_oauth_states')) {
        sql = sql.replace(/\)\s*$/i, ') ON CONFLICT (state) DO UPDATE SET shop_domain=EXCLUDED.shop_domain, created_at=EXCLUDED.created_at, expires_at=EXCLUDED.expires_at');
      }
    }
  } else {
    // SQLite keeps INSERT OR REPLACE
    // No conversion needed
  }
  return sql;
}

