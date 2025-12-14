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
  
  try {
    console.log('[DB] Running PostgreSQL migration...');
    
    // First, try to add the new columns (this will silently fail if they already exist)
    const addColumnStatements = [
      `ALTER TABLE connections ADD COLUMN IF NOT EXISTS sync_price INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE connections ADD COLUMN IF NOT EXISTS sync_categories INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE connections ADD COLUMN IF NOT EXISTS create_products INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE connections ADD COLUMN IF NOT EXISTS product_status INTEGER NOT NULL DEFAULT 0`,
    ];

    for (const stmt of addColumnStatements) {
      try {
        await pool.query(stmt);
        console.log('[DB] Executed:', stmt.substring(0, 60) + '...');
      } catch (err: any) {
        // Ignore errors - column might already exist or table might not exist yet
        console.log('[DB] Column migration note:', err.message);
      }
    }

    // Main table creation statements
    const statements = [
      `CREATE TABLE IF NOT EXISTS installations (
        id TEXT PRIMARY KEY,
        shop_domain TEXT NOT NULL UNIQUE,
        access_token TEXT NOT NULL,
        scope TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE IF NOT EXISTS connections (
        id TEXT PRIMARY KEY,
        installation_id TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('shopify','woocommerce')),
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active','paused','disabled')) DEFAULT 'active',
        dest_shop_domain TEXT,
        dest_location_id TEXT,
        base_url TEXT,
        consumer_key TEXT,
        consumer_secret TEXT,
        access_token TEXT,
        rules_json TEXT,
        sync_price INTEGER NOT NULL DEFAULT 0,
        sync_categories INTEGER NOT NULL DEFAULT 0,
        sync_tags INTEGER NOT NULL DEFAULT 0,
        sync_collections INTEGER NOT NULL DEFAULT 0,
        create_products INTEGER NOT NULL DEFAULT 1,
        product_status INTEGER NOT NULL DEFAULT 0,
        last_synced_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS jobs (
        id TEXT PRIMARY KEY,
        connection_id TEXT NOT NULL,
        job_type TEXT NOT NULL CHECK (job_type IN ('full_sync','delta')),
        state TEXT NOT NULL CHECK (state IN ('queued','running','succeeded','failed','dead')) DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS job_items (
        id TEXT PRIMARY KEY,
        job_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('update','create','delete')) DEFAULT 'update',
        state TEXT NOT NULL CHECK (state IN ('queued','running','succeeded','failed')) DEFAULT 'queued',
        error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        installation_id TEXT NOT NULL,
        connection_id TEXT,
        action TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
      )`,
      `CREATE TABLE IF NOT EXISTS shopify_webhooks (
        id TEXT PRIMARY KEY,
        installation_id TEXT NOT NULL,
        topic TEXT NOT NULL,
        webhook_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
      )`,
      `CREATE INDEX IF NOT EXISTS idx_connections_installation ON connections(installation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_connection ON jobs(connection_id)`,
      `CREATE INDEX IF NOT EXISTS idx_job_items_job ON job_items(job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_audit_log_installation ON audit_log(installation_id)`,
      `CREATE INDEX IF NOT EXISTS idx_shopify_webhooks_installation ON shopify_webhooks(installation_id)`,
    ];

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err: any) {
        // Ignore "already exists" errors
        if (!err.message.includes('already exists') && 
            !err.message.includes('duplicate')) {
          console.error('[DB] PostgreSQL migration error:', err.message);
        }
      }
    }

    console.log('[DB] PostgreSQL migration completed');
  } catch (err) {
    console.error('[DB] PostgreSQL migration failed:', err);
    throw err;
  }
}

