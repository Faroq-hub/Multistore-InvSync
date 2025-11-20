-- PostgreSQL Migration Script
-- Run this to create the schema in PostgreSQL
-- Usage: psql $DATABASE_URL -f src/db/postgres-migration.sql

-- Resellers table
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
  dest_shop_domain TEXT,
  dest_location_id TEXT,
  base_url TEXT,
  consumer_key TEXT,
  consumer_secret TEXT,
  access_token TEXT,
  rules_json TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
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
  FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
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
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
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

-- Shopify webhooks
CREATE TABLE IF NOT EXISTS shopify_webhooks (
  installation_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  webhook_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (installation_id, topic),
  FOREIGN KEY (installation_id) REFERENCES installations(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_shopify_webhooks_installation ON shopify_webhooks(installation_id);

