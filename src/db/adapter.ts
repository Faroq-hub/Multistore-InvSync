/**
 * Database Adapter
 * Supports both SQLite (development) and PostgreSQL (production)
 * Set DATABASE_URL environment variable for PostgreSQL, otherwise uses SQLite
 */

import Database from 'better-sqlite3';
import { Pool, Client } from 'pg';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

export interface DbAdapter {
  exec(sql: string): void | Promise<void>;
  prepare(sql: string): PreparedStatement;
  transaction(fn: () => void | Promise<void>): void | Promise<void>;
  close(): void | Promise<void>;
}

export interface PreparedStatement {
  run(params?: Record<string, any>): { changes: number; lastInsertRowid?: number } | Promise<{ changes: number; lastInsertRowid?: number }>;
  get(params?: Record<string, any>): any | Promise<any>;
  all(params?: Record<string, any>): any[] | Promise<any[]>;
}

class SQLiteAdapter implements DbAdapter {
  private db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(join(process.cwd(), 'data'), { recursive: true });
    this.db = new Database(dbPath);
  }

  exec(sql: string): void {
    this.db.exec(sql);
  }

  prepare(sql: string): PreparedStatement {
    const stmt = this.db.prepare(sql);
    return {
      run: (params?: Record<string, any>) => {
        const result = params ? stmt.run(params) : stmt.run();
        return { changes: result.changes || 0, lastInsertRowid: result.lastInsertRowid as number | undefined };
      },
      get: (params?: Record<string, any>) => {
        return params ? stmt.get(params) : stmt.get();
      },
      all: (params?: Record<string, any>) => {
        return params ? stmt.all(params) : stmt.all();
      }
    };
  }

  async transaction(fn: () => void | Promise<void>): Promise<void> {
    // SQLite transactions are synchronous
    // better-sqlite3 requires a synchronous callback, but we support async for PostgreSQL compatibility
    // Solution: Execute fn() synchronously inside the transaction
    // Since SQLite operations are synchronous, any async/await in fn() are effectively no-ops
    // The transaction completes synchronously, and we handle the promise outside if needed
    let promiseResult: Promise<void> | undefined;
    const transaction = this.db.transaction(() => {
      // Execute fn() - for SQLite, all DB operations complete synchronously
      // If fn() returns a promise, we capture it but don't await (can't in sync context)
      const result = fn();
      if (result instanceof Promise) {
        promiseResult = result;
      }
    });
    transaction();
    // If fn() returned a promise, await it (should resolve immediately for SQLite)
    if (promiseResult) {
      await promiseResult;
    }
  }

  close(): void {
    this.db.close();
  }
}

class PostgreSQLAdapter implements DbAdapter {
  private pool: Pool;
  private client?: Client;

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
  }

  async exec(sql: string): Promise<void> {
    // PostgreSQL doesn't support exec() like SQLite
    // We'll use a client for multi-statement execution
    if (!this.client) {
      this.client = new Client({ connectionString: this.pool.options.connectionString });
      await this.client.connect();
    }
    
    // Split by semicolon and execute each statement
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await this.client.query(stmt);
      } catch (err: any) {
        // Ignore "already exists" errors for CREATE TABLE IF NOT EXISTS
        if (!err.message.includes('already exists') && !err.message.includes('duplicate') && !err.message.includes('relation') && !err.message.includes('does not exist')) {
          console.error('PostgreSQL exec error:', err.message);
        }
      }
    }
  }

  prepare(sql: string): PreparedStatement {
    // Convert SQLite parameter syntax (@param) to PostgreSQL ($1, $2, ...)
    const convertedSql = this.convertParams(sql);
    
    return {
      run: async (params?: Record<string, any>) => {
        const { query, values } = this.buildQuery(convertedSql, params || {});
        const result = await this.pool.query(query, values);
        return { 
          changes: result.rowCount || 0,
          lastInsertRowid: result.rows[0]?.id ? parseInt(result.rows[0].id) : undefined
        };
      },
      get: async (params?: Record<string, any>) => {
        const { query, values } = this.buildQuery(convertedSql, params || {});
        const result = await this.pool.query(query, values);
        return result.rows[0] || null;
      },
      all: async (params?: Record<string, any>) => {
        const { query, values } = this.buildQuery(convertedSql, params || {});
        const result = await this.pool.query(query, values);
        return result.rows;
      }
    };
  }

  async transaction(fn: () => void | Promise<void>): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await fn();
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
    if (this.client) {
      await this.client.end();
    }
  }

  private convertParams(sql: string): string {
    // Convert @param to $1, $2, etc.
    const paramNames: string[] = [];
    const paramRegex = /@(\w+)/g;
    let match;
    let convertedSql = sql;
    
    while ((match = paramRegex.exec(sql)) !== null) {
      const paramName = match[1];
      if (!paramNames.includes(paramName)) {
        paramNames.push(paramName);
      }
    }

    paramNames.forEach((name, index) => {
      const regex = new RegExp(`@${name}\\b`, 'g');
      convertedSql = convertedSql.replace(regex, `$${index + 1}`);
    });

    return convertedSql;
  }

  private buildQuery(sql: string, params: Record<string, any>): { query: string; values: any[] } {
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
}

// Factory function to create the appropriate adapter
export function createDbAdapter(): DbAdapter {
  const databaseUrl = process.env.DATABASE_URL;
  
  if (databaseUrl) {
    console.log('[DB] Using PostgreSQL database');
    return new PostgreSQLAdapter(databaseUrl);
  } else {
    const dbPath = join(process.cwd(), 'data', 'app.db');
    console.log('[DB] Using SQLite database:', dbPath);
    return new SQLiteAdapter(dbPath);
  }
}

