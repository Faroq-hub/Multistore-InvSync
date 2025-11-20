/**
 * PostgreSQL-specific database functions
 * Used when DATABASE_URL environment variable is set
 */

import { Pool } from 'pg';

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL not set. Cannot use PostgreSQL.');
  }

  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    pool.on('error', (err) => {
      console.error('Unexpected PostgreSQL pool error:', err);
    });
  }

  return pool;
}

export function isPostgres(): boolean {
  return !!process.env.DATABASE_URL;
}

/**
 * Convert SQLite SQL to PostgreSQL-compatible SQL
 */
export function convertToPostgres(sql: string): string {
  let converted = sql;

  // Convert @param to $1, $2, etc. (handled by parameterized queries)
  // For exec() statements, we need to handle IF NOT EXISTS differently
  converted = converted.replace(/CREATE TABLE IF NOT EXISTS/gi, 'CREATE TABLE IF NOT EXISTS');
  
  // PostgreSQL uses different syntax for some things, but most SQLite SQL works
  // The main differences are handled in the migration SQL file
  
  return converted;
}

/**
 * Run migration SQL for PostgreSQL
 */
export async function migratePostgres(): Promise<void> {
  const pool = getPostgresPool();
  if (!pool) {
    return;
  }

  const fs = await import('fs/promises');
  const path = await import('path');
  
  try {
    const migrationPath = path.join(process.cwd(), 'src/db/postgres-migration.sql');
    const migrationSql = await fs.readFile(migrationPath, 'utf-8');
    
    // Split by semicolon and execute each statement
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (!err.message.includes('already exists') && 
            !err.message.includes('duplicate') &&
            !err.message.includes('relation') &&
            !err.message.includes('does not exist')) {
          console.error('PostgreSQL migration error:', err.message);
          throw err;
        }
      }
    }

    console.log('[DB] PostgreSQL migration completed');
  } catch (err) {
    console.error('[DB] PostgreSQL migration failed:', err);
    throw err;
  }
}

