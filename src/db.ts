import { createDbAdapter, type DbAdapter } from './db/adapter';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { migratePostgres, isPostgres } from './db/postgres';

// Lazy initialization of database adapter to avoid blocking startup
let db: DbAdapter | null = null;
let migrationRan = false;
let migrationPromise: Promise<void> | null = null;

function getDb(): DbAdapter {
  if (!db) {
    try {
      db = createDbAdapter();
    } catch (err) {
      console.error('[DB] Failed to create database adapter:', err);
      throw err;
    }
  }
  return db;
}

// Ensure migration runs before any database operation
async function ensureMigration(): Promise<void> {
  if (migrationRan) return;
  
  // Prevent concurrent migration runs
  if (migrationPromise) {
    await migrationPromise;
    return;
  }
  
  migrationPromise = (async () => {
    try {
      console.log('[DB] Auto-running migration on first access...');
      await migrate();
      migrationRan = true;
      console.log('[DB] Auto-migration completed');
    } catch (err) {
      console.error('[DB] Auto-migration failed:', err);
      // Don't throw - migration might have partially succeeded or already ran
      migrationRan = true;
    }
  })();
  
  await migrationPromise;
}

// Helper to handle both sync and async exec
async function execMigration(sql: string): Promise<void> {
  const result = getDb().exec(sql);
  if (result instanceof Promise) {
    await result;
  }
}

export async function migrate() {
  // Use PostgreSQL-specific migration if DATABASE_URL is set
  if (isPostgres()) {
    console.log('[DB] Using PostgreSQL migration');
    await migratePostgres();
    return;
  }
  
  // SQLite migration
  console.log('[DB] Using SQLite migration');
  const migrationSql = `
    CREATE TABLE IF NOT EXISTS resellers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active','disabled')),
      api_key_salt TEXT,
      api_key_hash TEXT,
      last4 TEXT,
      version TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_resellers_last4 ON resellers(last4);
    CREATE INDEX IF NOT EXISTS idx_resellers_status ON resellers(status);

    -- Source installation (Shopify store where the app is installed)
    CREATE TABLE IF NOT EXISTS installations (
      id TEXT PRIMARY KEY,
      shop_domain TEXT NOT NULL UNIQUE,
      access_token TEXT,
      scopes TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Destination connections (Shopify or WooCommerce)
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      installation_id TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('shopify','woocommerce')),
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active','paused','disabled')) DEFAULT 'active',
      dest_shop_domain TEXT,                 -- for Shopify destination
      dest_location_id TEXT,                 -- location policy for inventory
      base_url TEXT,                         -- for Woo destination
      consumer_key TEXT,                     -- Woo
      consumer_secret TEXT,                  -- Woo
      access_token TEXT,                     -- Shopify destination token (if using manual token for now)
      rules_json TEXT,                       -- JSON blob for mapping/rules
      sync_price INTEGER NOT NULL DEFAULT 0, -- 1 = sync prices, 0 = don't sync prices
      sync_categories INTEGER NOT NULL DEFAULT 0, -- 1 = sync/create categories, 0 = don't
      create_products INTEGER NOT NULL DEFAULT 1, -- 1 = create products if not exist, 0 = skip
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (installation_id) REFERENCES installations(id)
    );
    CREATE INDEX IF NOT EXISTS idx_connections_installation ON connections(installation_id);
    CREATE INDEX IF NOT EXISTS idx_connections_status ON connections(status);

    -- Jobs for pushing updates to destinations
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      connection_id TEXT NOT NULL,
      job_type TEXT NOT NULL CHECK (job_type IN ('full_sync','delta')),
      state TEXT NOT NULL CHECK (state IN ('queued','running','succeeded','failed','dead')) DEFAULT 'queued',
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (connection_id) REFERENCES connections(id)
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs(state);
    CREATE INDEX IF NOT EXISTS idx_jobs_connection ON jobs(connection_id);

    -- Individual SKU actions within a job
    CREATE TABLE IF NOT EXISTS job_items (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      sku TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('create','update','delete','stock')),
      state TEXT NOT NULL CHECK (state IN ('queued','running','succeeded','failed')) DEFAULT 'queued',
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );
    CREATE INDEX IF NOT EXISTS idx_job_items_job ON job_items(job_id);

    -- Audit logs for push actions and system events
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      ts TEXT NOT NULL,
      level TEXT NOT NULL CHECK (level IN ('info','warn','error')),
      connection_id TEXT,
      job_id TEXT,
      sku TEXT,
      message TEXT NOT NULL,
      meta TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_logs(ts);
    CREATE INDEX IF NOT EXISTS idx_audit_conn ON audit_logs(connection_id);

    -- Shopify OAuth sessions (offline/online)
    CREATE TABLE IF NOT EXISTS shopify_sessions (
      id TEXT PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      session_type TEXT NOT NULL,
      is_online INTEGER NOT NULL,
      data TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shopify_sessions_shop ON shopify_sessions(shop_domain);

    -- Shopify OAuth state cache
    CREATE TABLE IF NOT EXISTS shopify_oauth_states (
      state TEXT PRIMARY KEY,
      shop_domain TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_shopify_oauth_states_expires ON shopify_oauth_states(expires_at);

    -- Shopify webhooks (optional local tracking)
    CREATE TABLE IF NOT EXISTS shopify_webhooks (
      installation_id TEXT NOT NULL,
      topic TEXT NOT NULL,
      webhook_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (installation_id, topic),
      FOREIGN KEY (installation_id) REFERENCES installations(id)
    );
    CREATE INDEX IF NOT EXISTS idx_shopify_webhooks_installation ON shopify_webhooks(installation_id);
  `;
  
  await execMigration(migrationSql);
  
  // Run additional migrations for new columns (safe to run multiple times)
  await runColumnMigrations();
}

async function runColumnMigrations() {
  // Add new sync option columns to connections table if they don't exist
  // These are safe to run multiple times - they will fail silently if columns exist
  const columnMigrations = [
    `ALTER TABLE connections ADD COLUMN sync_price INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE connections ADD COLUMN sync_categories INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE connections ADD COLUMN create_products INTEGER NOT NULL DEFAULT 1`,
  ];
  
  for (const sql of columnMigrations) {
    try {
      await execMigration(sql);
      console.log('[DB] Migration applied:', sql.substring(0, 60) + '...');
    } catch (err: any) {
      // Column already exists - this is expected and fine
      if (!err.message?.includes('duplicate column') && !err.message?.includes('already exists')) {
        console.log('[DB] Migration skipped (column may exist):', sql.substring(0, 60) + '...');
      }
    }
  }
}

export type ResellerRow = {
  id: string;
  name: string;
  status: 'active' | 'disabled';
  api_key_salt: string | null;
  api_key_hash: string | null;
  last4: string | null;
  version: string;
  created_at: string;
  updated_at: string;
};

export const ResellerRepo = {
  async insert(reseller: Omit<ResellerRow, 'created_at' | 'updated_at'>) {
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`
      INSERT INTO resellers (id, name, status, api_key_salt, api_key_hash, last4, version, created_at, updated_at)
      VALUES (@id, @name, @status, @api_key_salt, @api_key_hash, @last4, @version, @created_at, @updated_at)
    `);
    const result = stmt.run({ ...reseller, created_at: now, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async updateKey(id: string, api_key_salt: string, api_key_hash: string, last4: string) {
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`
      UPDATE resellers SET api_key_salt=@api_key_salt, api_key_hash=@api_key_hash, last4=@last4, updated_at=@updated_at
      WHERE id=@id
    `);
    const result = stmt.run({ id, api_key_salt, api_key_hash, last4, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async findActiveByLast4(last4: string): Promise<ResellerRow[]> {
    const stmt = getDb().prepare(`SELECT * FROM resellers WHERE status='active' AND last4=@last4`);
    const result = stmt.all({ last4 });
    return (result instanceof Promise ? await result : result) as ResellerRow[];
  },
  async list(): Promise<ResellerRow[]> {
    const stmt = getDb().prepare(`SELECT * FROM resellers ORDER BY created_at DESC`);
    const result = stmt.all();
    return (result instanceof Promise ? await result : result) as ResellerRow[];
  }
};

export type InstallationRow = {
  id: string;
  shop_domain: string;
  access_token: string | null;
  scopes: string | null;
  status: 'active' | 'disabled';
  created_at: string;
  updated_at: string;
};

export type ConnectionRow = {
  id: string;
  installation_id: string;
  type: 'shopify' | 'woocommerce';
  name: string;
  status: 'active' | 'paused' | 'disabled';
  dest_shop_domain: string | null;
  dest_location_id: string | null;
  base_url: string | null;
  consumer_key: string | null;
  consumer_secret: string | null;
  access_token: string | null;
  rules_json: string | null;
  sync_price: number; // 1 = true, 0 = false
  sync_categories: number; // 1 = true, 0 = false
  create_products: number; // 1 = true, 0 = false
  last_synced_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type JobRow = {
  id: string;
  connection_id: string;
  job_type: 'full_sync' | 'delta';
  state: 'queued' | 'running' | 'succeeded' | 'failed' | 'dead';
  attempts: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type JobItemRow = {
  id: string;
  job_id: string;
  sku: string;
  action: 'create' | 'update' | 'delete' | 'stock';
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  error: string | null;
  created_at: string;
  updated_at: string;
};

export const InstallationRepo = {
  async upsert(shop_domain: string, access_token?: string | null, scopes?: string | null) {
    const now = new Date().toISOString();
    const getStmt = getDb().prepare(`SELECT * FROM installations WHERE shop_domain=@shop_domain`);
    const getResult = getStmt.get({ shop_domain });
    const exist = (getResult instanceof Promise ? await getResult : getResult) as InstallationRow | undefined;
    
    if (exist) {
      const updateStmt = getDb().prepare(`UPDATE installations SET access_token=@access_token, scopes=@scopes, updated_at=@updated_at WHERE shop_domain=@shop_domain`);
      const updateResult = updateStmt.run({ shop_domain, access_token: access_token ?? exist.access_token, scopes: scopes ?? exist.scopes, updated_at: now });
      if (updateResult instanceof Promise) {
        await updateResult;
      }
      return exist.id;
    }
    const id = `ins_${Date.now()}`;
    const insertStmt = getDb().prepare(`INSERT INTO installations (id, shop_domain, access_token, scopes, status, created_at, updated_at)
      VALUES (@id, @shop_domain, @access_token, @scopes, 'active', @created_at, @updated_at)`);
    const insertResult = insertStmt.run({ id, shop_domain, access_token: access_token ?? null, scopes: scopes ?? null, created_at: now, updated_at: now });
    if (insertResult instanceof Promise) {
      await insertResult;
    }
    return id;
  },
  async getByDomain(shop_domain: string): Promise<InstallationRow | undefined> {
    const stmt = getDb().prepare(`SELECT * FROM installations WHERE shop_domain=@shop_domain`);
    const result = stmt.get({ shop_domain });
    return (result instanceof Promise ? await result : result) as InstallationRow | undefined;
  },
  async getById(id: string): Promise<InstallationRow | undefined> {
    const stmt = getDb().prepare(`SELECT * FROM installations WHERE id=@id`);
    const result = stmt.get({ id });
    return (result instanceof Promise ? await result : result) as InstallationRow | undefined;
  }
};

export type ShopifyOAuthStateRow = {
  state: string;
  shop_domain: string;
  created_at: string;
  expires_at: string;
};

export const ShopifyOAuthStateRepo = {
  async insert(row: ShopifyOAuthStateRow) {
    // PostgreSQL uses ON CONFLICT, SQLite uses INSERT OR REPLACE
    const isPostgres = !!process.env.DATABASE_URL;
    let sql: string;
    if (isPostgres) {
      sql = `
        INSERT INTO shopify_oauth_states (state, shop_domain, created_at, expires_at)
        VALUES (@state, @shop_domain, @created_at, @expires_at)
        ON CONFLICT (state) DO UPDATE SET
          shop_domain = @shop_domain,
          created_at = @created_at,
          expires_at = @expires_at
      `;
    } else {
      sql = `
        INSERT OR REPLACE INTO shopify_oauth_states (state, shop_domain, created_at, expires_at)
        VALUES (@state, @shop_domain, @created_at, @expires_at)
      `;
    }
    const stmt = getDb().prepare(sql);
    const result = stmt.run(row);
    if (result instanceof Promise) {
      await result;
    }
  },
  async purgeExpired(nowIso: string) {
    const stmt = getDb().prepare(`DELETE FROM shopify_oauth_states WHERE expires_at < @now`);
    const result = stmt.run({ now: nowIso });
    if (result instanceof Promise) {
      await result;
    }
  },
  async consume(state: string): Promise<ShopifyOAuthStateRow | undefined> {
    const getStmt = getDb().prepare(`SELECT * FROM shopify_oauth_states WHERE state=@state`);
    const getResult = getStmt.get({ state });
    const row = (getResult instanceof Promise ? await getResult : getResult) as ShopifyOAuthStateRow | undefined;
    
    if (row) {
      const deleteStmt = getDb().prepare(`DELETE FROM shopify_oauth_states WHERE state=@state`);
      const deleteResult = deleteStmt.run({ state });
      if (deleteResult instanceof Promise) {
        await deleteResult;
      }
    }
    return row;
  }
};

export const ConnectionRepo = {
  async insert(conn: Omit<ConnectionRow, 'created_at' | 'updated_at'>) {
    await ensureMigration(); // Ensure migration runs before insert
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`INSERT INTO connections (id, installation_id, type, name, status, dest_shop_domain, dest_location_id, base_url, consumer_key, consumer_secret, access_token, rules_json, sync_price, sync_categories, create_products, created_at, updated_at)
      VALUES (@id, @installation_id, @type, @name, @status, @dest_shop_domain, @dest_location_id, @base_url, @consumer_key, @consumer_secret, @access_token, @rules_json, @sync_price, @sync_categories, @create_products, @created_at, @updated_at)`);
    const result = stmt.run({ 
      ...conn, 
      sync_price: conn.sync_price ?? 0,
      sync_categories: conn.sync_categories ?? 0,
      create_products: conn.create_products ?? 1,
      created_at: now, 
      updated_at: now 
    });
    if (result instanceof Promise) {
      await result;
    }
  },
  async list(installation_id: string): Promise<ConnectionRow[]> {
    const stmt = getDb().prepare(`SELECT * FROM connections WHERE installation_id=@installation_id ORDER BY created_at DESC`);
    const result = stmt.all({ installation_id });
    return (result instanceof Promise ? await result : result) as ConnectionRow[];
  },
  async get(id: string): Promise<ConnectionRow | undefined> {
    const stmt = getDb().prepare(`SELECT * FROM connections WHERE id=@id`);
    const result = stmt.get({ id });
    return (result instanceof Promise ? await result : result) as ConnectionRow | undefined;
  },
  async updateStatus(id: string, status: ConnectionRow['status']) {
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`UPDATE connections SET status=@status, updated_at=@updated_at WHERE id=@id`);
    const result = stmt.run({ id, status, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async updateLocationId(id: string, dest_location_id: string | null) {
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`UPDATE connections SET dest_location_id=@dest_location_id, updated_at=@updated_at WHERE id=@id`);
    const result = stmt.run({ id, dest_location_id, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async updateName(id: string, name: string) {
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`UPDATE connections SET name=@name, updated_at=@updated_at WHERE id=@id`);
    const result = stmt.run({ id, name, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async updateRules(id: string, rules_json: string | null) {
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`UPDATE connections SET rules_json=@rules_json, updated_at=@updated_at WHERE id=@id`);
    const result = stmt.run({ id, rules_json, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async updateSyncOptions(id: string, options: { sync_price?: number; sync_categories?: number; create_products?: number }) {
    const now = new Date().toISOString();
    const updates: string[] = ['updated_at=@updated_at'];
    const params: any = { id, updated_at: now };
    
    if (options.sync_price !== undefined) {
      updates.push('sync_price=@sync_price');
      params.sync_price = options.sync_price;
    }
    if (options.sync_categories !== undefined) {
      updates.push('sync_categories=@sync_categories');
      params.sync_categories = options.sync_categories;
    }
    if (options.create_products !== undefined) {
      updates.push('create_products=@create_products');
      params.create_products = options.create_products;
    }
    
    const stmt = getDb().prepare(`UPDATE connections SET ${updates.join(', ')} WHERE id=@id`);
    const result = stmt.run(params);
    if (result instanceof Promise) {
      await result;
    }
  },
  async updateLastSyncedAt(id: string) {
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`UPDATE connections SET last_synced_at=@last_synced_at, updated_at=@updated_at WHERE id=@id`);
    const result = stmt.run({ id, last_synced_at: now, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async delete(id: string) {
    const stmt = getDb().prepare(`DELETE FROM connections WHERE id=@id`);
    const result = stmt.run({ id });
    if (result instanceof Promise) {
      await result;
    }
  },
  async deleteAll(installation_id: string) {
    const stmt = getDb().prepare(`DELETE FROM connections WHERE installation_id=@installation_id`);
    const result = stmt.run({ installation_id });
    if (result instanceof Promise) {
      await result;
    }
    // Return the number of deleted rows
    const changes = result instanceof Promise ? (await result).changes : result.changes;
    return changes;
  },
  async listAllActive(): Promise<ConnectionRow[]> {
    const stmt = getDb().prepare(`SELECT * FROM connections WHERE status='active' ORDER BY created_at DESC`);
    const result = stmt.all();
    return (result instanceof Promise ? await result : result) as ConnectionRow[];
  }
};

export const JobRepo = {
  async enqueue(job: Omit<JobRow, 'state' | 'attempts' | 'last_error' | 'created_at' | 'updated_at'>) {
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`INSERT INTO jobs (id, connection_id, job_type, state, attempts, created_at, updated_at)
      VALUES (@id, @connection_id, @job_type, 'queued', 0, @created_at, @updated_at)`);
    const result = stmt.run({ ...job, created_at: now, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async get(id: string): Promise<JobRow | undefined> {
    const stmt = getDb().prepare(`SELECT * FROM jobs WHERE id=@id`);
    const result = stmt.get({ id });
    return (result instanceof Promise ? await result : result) as JobRow | undefined;
  },
  async pickNext(): Promise<JobRow | undefined> {
    const getStmt = getDb().prepare(`SELECT * FROM jobs WHERE state='queued' ORDER BY created_at ASC LIMIT 1`);
    const getResult = getStmt.get();
    const job = (getResult instanceof Promise ? await getResult : getResult) as JobRow | undefined;
    
    if (!job) return undefined;
    
    const now = new Date().toISOString();
    const updateStmt = getDb().prepare(`UPDATE jobs SET state='running', updated_at=@updated_at WHERE id=@id`);
    const updateResult = updateStmt.run({ id: job.id, updated_at: now });
    if (updateResult instanceof Promise) {
      await updateResult;
    }
    return { ...job, state: 'running' };
  },
  async succeed(id: string) {
    const now = new Date().toISOString();
    const stmt = getDb().prepare(`UPDATE jobs SET state='succeeded', updated_at=@updated_at WHERE id=@id`);
    const result = stmt.run({ id, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async fail(id: string, error: string, maxAttempts = 5) {
    const now = new Date().toISOString();
    const getStmt = getDb().prepare(`SELECT attempts FROM jobs WHERE id=@id`);
    const getResult = getStmt.get({ id });
    const row = (getResult instanceof Promise ? await getResult : getResult) as { attempts: number } | undefined;
    const attempts = (row?.attempts ?? 0) + 1;
    
    if (attempts >= maxAttempts) {
      const stmt = getDb().prepare(`UPDATE jobs SET state='dead', last_error=@error, attempts=@attempts, updated_at=@updated_at WHERE id=@id`);
      const result = stmt.run({ id, error, attempts, updated_at: now });
      if (result instanceof Promise) {
        await result;
      }
      return;
    }
    // Mark failed, then requeue by setting state back to queued (simple retry)
    const stmt = getDb().prepare(`UPDATE jobs SET state='queued', last_error=@error, attempts=@attempts, updated_at=@updated_at WHERE id=@id`);
    const result = stmt.run({ id, error, attempts, updated_at: now });
    if (result instanceof Promise) {
      await result;
    }
  },
  async list(limit = 100): Promise<JobRow[]> {
    const stmt = getDb().prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT @limit`);
    const result = stmt.all({ limit });
    return (result instanceof Promise ? await result : result) as JobRow[];
  }
};

export const JobItemRepo = {
  async addMany(job_id: string, skus: string[], action: JobItemRow['action'] = 'update') {
    const now = new Date().toISOString();
    const rows = skus.map((sku, idx) => ({
      id: `ji_${Date.now()}_${idx}_${Math.random().toString(36).slice(2,8)}`,
      job_id,
      sku,
      action,
      created_at: now,
      updated_at: now
    }));
    
    await getDb().transaction(async () => {
      const stmt = getDb().prepare(`INSERT INTO job_items (id, job_id, sku, action, state, created_at, updated_at)
        VALUES (@id, @job_id, @sku, @action, 'queued', @created_at, @updated_at)`);
      for (const r of rows) {
        const result = stmt.run(r);
        if (result instanceof Promise) {
          await result;
        }
      }
    });
  },
  async listSkus(job_id: string): Promise<string[]> {
    const stmt = getDb().prepare(`SELECT sku FROM job_items WHERE job_id=@job_id`);
    const result = stmt.all({ job_id });
    const rows = (result instanceof Promise ? await result : result) as { sku: string }[];
    return rows.map(r => r.sku);
  }
};

export const AuditRepo = {
  async write(entry: { id?: string; ts?: string; level: 'info' | 'warn' | 'error'; connection_id?: string | null; job_id?: string | null; sku?: string | null; message: string; meta?: any }) {
    const id = entry.id || `al_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const ts = entry.ts || new Date().toISOString();
    const meta = entry.meta ? JSON.stringify(entry.meta) : null;
    const stmt = getDb().prepare(`INSERT INTO audit_logs (id, ts, level, connection_id, job_id, sku, message, meta)
      VALUES (@id, @ts, @level, @connection_id, @job_id, @sku, @message, @meta)`);
    const result = stmt.run({ id, ts, level: entry.level, connection_id: entry.connection_id ?? null, job_id: entry.job_id ?? null, sku: entry.sku ?? null, message: entry.message, meta });
    if (result instanceof Promise) {
      await result;
    }
  },
  async recent(limit = 200) {
    const stmt = getDb().prepare(`SELECT * FROM audit_logs ORDER BY ts DESC LIMIT @limit`);
    const result = stmt.all({ limit });
    return (result instanceof Promise ? await result : result);
  },
  async countSyncedSkus(connection_id: string): Promise<number> {
    const stmt = getDb().prepare(
      `SELECT COUNT(DISTINCT sku) as count 
       FROM audit_logs 
       WHERE connection_id=@connection_id AND sku IS NOT NULL`
    );
    const result = stmt.get({ connection_id });
    const row = (result instanceof Promise ? await result : result) as { count?: number } | undefined;
    return row?.count ?? 0;
  }
};
