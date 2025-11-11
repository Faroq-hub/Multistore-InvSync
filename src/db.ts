import Database from 'better-sqlite3';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const dbPath = join(process.cwd(), 'data', 'app.db');
mkdirSync(join(process.cwd(), 'data'), { recursive: true });

export const db = new Database(dbPath);

export function migrate() {
  db.exec(`
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
  `);
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
  insert(reseller: Omit<ResellerRow, 'created_at' | 'updated_at'>) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO resellers (id, name, status, api_key_salt, api_key_hash, last4, version, created_at, updated_at)
      VALUES (@id, @name, @status, @api_key_salt, @api_key_hash, @last4, @version, @created_at, @updated_at)
    `).run({ ...reseller, created_at: now, updated_at: now });
  },
  updateKey(id: string, api_key_salt: string, api_key_hash: string, last4: string) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE resellers SET api_key_salt=@api_key_salt, api_key_hash=@api_key_hash, last4=@last4, updated_at=@updated_at
      WHERE id=@id
    `).run({ id, api_key_salt, api_key_hash, last4, updated_at: now });
  },
  findActiveByLast4(last4: string): ResellerRow[] {
    return db.prepare(`SELECT * FROM resellers WHERE status='active' AND last4=@last4`).all({ last4 }) as ResellerRow[];
  },
  list(): ResellerRow[] {
    return db.prepare(`SELECT * FROM resellers ORDER BY created_at DESC`).all() as ResellerRow[];
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
  upsert(shop_domain: string, access_token?: string | null, scopes?: string | null) {
    const now = new Date().toISOString();
    const exist = db.prepare(`SELECT * FROM installations WHERE shop_domain=@shop_domain`).get({ shop_domain }) as InstallationRow | undefined;
    if (exist) {
      db.prepare(`UPDATE installations SET access_token=@access_token, scopes=@scopes, updated_at=@updated_at WHERE shop_domain=@shop_domain`)
        .run({ shop_domain, access_token: access_token ?? exist.access_token, scopes: scopes ?? exist.scopes, updated_at: now });
      return exist.id;
    }
    const id = `ins_${Date.now()}`;
    db.prepare(`INSERT INTO installations (id, shop_domain, access_token, scopes, status, created_at, updated_at)
      VALUES (@id, @shop_domain, @access_token, @scopes, 'active', @created_at, @updated_at)`)
      .run({ id, shop_domain, access_token: access_token ?? null, scopes: scopes ?? null, created_at: now, updated_at: now });
    return id;
  },
  getByDomain(shop_domain: string): InstallationRow | undefined {
    return db.prepare(`SELECT * FROM installations WHERE shop_domain=@shop_domain`).get({ shop_domain }) as InstallationRow | undefined;
  }
};

export const ConnectionRepo = {
  insert(conn: Omit<ConnectionRow, 'created_at' | 'updated_at'>) {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO connections (id, installation_id, type, name, status, dest_shop_domain, dest_location_id, base_url, consumer_key, consumer_secret, access_token, rules_json, created_at, updated_at)
      VALUES (@id, @installation_id, @type, @name, @status, @dest_shop_domain, @dest_location_id, @base_url, @consumer_key, @consumer_secret, @access_token, @rules_json, @created_at, @updated_at)`)
      .run({ ...conn, created_at: now, updated_at: now });
  },
  list(installation_id: string): ConnectionRow[] {
    return db.prepare(`SELECT * FROM connections WHERE installation_id=@installation_id ORDER BY created_at DESC`)
      .all({ installation_id }) as ConnectionRow[];
  },
  get(id: string): ConnectionRow | undefined {
    return db.prepare(`SELECT * FROM connections WHERE id=@id`).get({ id }) as ConnectionRow | undefined;
  },
  updateStatus(id: string, status: ConnectionRow['status']) {
    const now = new Date().toISOString();
    db.prepare(`UPDATE connections SET status=@status, updated_at=@updated_at WHERE id=@id`).run({ id, status, updated_at: now });
  }
};

export const JobRepo = {
  enqueue(job: Omit<JobRow, 'state' | 'attempts' | 'last_error' | 'created_at' | 'updated_at'>) {
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO jobs (id, connection_id, job_type, state, attempts, created_at, updated_at)
      VALUES (@id, @connection_id, @job_type, 'queued', 0, @created_at, @updated_at)`)
      .run({ ...job, created_at: now, updated_at: now });
  },
  pickNext(): JobRow | undefined {
    const job = db.prepare(`SELECT * FROM jobs WHERE state='queued' ORDER BY created_at ASC LIMIT 1`).get() as JobRow | undefined;
    if (!job) return undefined;
    const now = new Date().toISOString();
    db.prepare(`UPDATE jobs SET state='running', updated_at=@updated_at WHERE id=@id`).run({ id: job.id, updated_at: now });
    return { ...job, state: 'running' };
  },
  succeed(id: string) {
    const now = new Date().toISOString();
    db.prepare(`UPDATE jobs SET state='succeeded', updated_at=@updated_at WHERE id=@id`).run({ id, updated_at: now });
  },
  fail(id: string, error: string, maxAttempts = 5) {
    const now = new Date().toISOString();
    const row = db.prepare(`SELECT attempts FROM jobs WHERE id=@id`).get({ id }) as { attempts: number } | undefined;
    const attempts = (row?.attempts ?? 0) + 1;
    if (attempts >= maxAttempts) {
      db.prepare(`UPDATE jobs SET state='dead', last_error=@error, attempts=@attempts, updated_at=@updated_at WHERE id=@id`)
        .run({ id, error, attempts, updated_at: now });
      return;
    }
    // Mark failed, then requeue by setting state back to queued (simple retry)
    db.prepare(`UPDATE jobs SET state='queued', last_error=@error, attempts=@attempts, updated_at=@updated_at WHERE id=@id`)
      .run({ id, error, attempts, updated_at: now });
  },
  list(limit = 100) {
    return db.prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT @limit`).all({ limit }) as JobRow[];
  }
};

export const JobItemRepo = {
  addMany(job_id: string, skus: string[], action: JobItemRow['action'] = 'update') {
    const now = new Date().toISOString();
    const stmt = db.prepare(`INSERT INTO job_items (id, job_id, sku, action, state, created_at, updated_at)
      VALUES (@id, @job_id, @sku, @action, 'queued', @created_at, @updated_at)`);
    const insertMany = db.transaction((rows: { id: string; job_id: string; sku: string; action: string; created_at: string; updated_at: string }[]) => {
      for (const r of rows) stmt.run(r);
    });
    const rows = skus.map((sku, idx) => ({
      id: `ji_${Date.now()}_${idx}_${Math.random().toString(36).slice(2,8)}`,
      job_id,
      sku,
      action,
      created_at: now,
      updated_at: now
    }));
    insertMany(rows);
  },
  listSkus(job_id: string): string[] {
    const rows = db.prepare(`SELECT sku FROM job_items WHERE job_id=@job_id`).all({ job_id }) as { sku: string }[];
    return rows.map(r => r.sku);
  }
};

export const AuditRepo = {
  write(entry: { id?: string; ts?: string; level: 'info' | 'warn' | 'error'; connection_id?: string | null; job_id?: string | null; sku?: string | null; message: string; meta?: any }) {
    const id = entry.id || `al_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
    const ts = entry.ts || new Date().toISOString();
    const meta = entry.meta ? JSON.stringify(entry.meta) : null;
    db.prepare(`INSERT INTO audit_logs (id, ts, level, connection_id, job_id, sku, message, meta)
      VALUES (@id, @ts, @level, @connection_id, @job_id, @sku, @message, @meta)`)
      .run({ id, ts, level: entry.level, connection_id: entry.connection_id ?? null, job_id: entry.job_id ?? null, sku: entry.sku ?? null, message: entry.message, meta });
  },
  recent(limit = 200) {
    return db.prepare(`SELECT * FROM audit_logs ORDER BY ts DESC LIMIT @limit`).all({ limit });
  }
};

