# PostgreSQL Testing Guide

## Prerequisites

1. **Install PostgreSQL** (if not already installed):
   ```bash
   # macOS
   brew install postgresql@15
   brew services start postgresql@15

   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib

   # Verify installation
   psql --version
   ```

2. **Create a test database**:
   ```bash
   # Connect to PostgreSQL
   psql postgres

   # Create database
   CREATE DATABASE inventory_sync_test;

   # Create user (optional, or use existing user)
   CREATE USER inventory_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE inventory_sync_test TO inventory_user;

   # Exit psql
   \q
   ```

## Testing Steps

### 1. Set Environment Variable

```bash
# Set DATABASE_URL for PostgreSQL
export DATABASE_URL="postgresql://inventory_user:your_password@localhost:5432/inventory_sync_test"

# Or add to .env file
echo "DATABASE_URL=postgresql://inventory_user:your_password@localhost:5432/inventory_sync_test" >> .env
```

### 2. Run Migration

```bash
# Run PostgreSQL migration to create schema
npm run migrate:postgres

# Or manually:
psql $DATABASE_URL -f src/db/postgres-migration.sql
```

### 3. Start the Application

```bash
# The app will auto-detect PostgreSQL when DATABASE_URL is set
npm run dev

# You should see in the console:
# [DB] Using PostgreSQL (DATABASE_URL detected)
# [DB] PostgreSQL migration completed
```

### 4. Verify Operations

Test these operations to ensure everything works:

#### A. Installation Operations
- Install the app through Shopify OAuth
- Verify installation is stored in PostgreSQL

#### B. Connection Operations
- Create a Shopify connection
- Create a WooCommerce connection
- List connections
- Update connection (location_id, name, rules)
- Pause/Resume connection

#### C. Job Operations
- Trigger a full sync job
- Check job status via admin endpoint
- Verify job processing

#### D. Audit Logs
- Check audit logs are being written
- Verify SKU count is calculated correctly

### 5. Check Database Directly

```bash
# Connect to PostgreSQL
psql $DATABASE_URL

# List tables
\dt

# Check installations
SELECT id, shop_domain, status, created_at FROM installations;

# Check connections
SELECT id, name, type, status, dest_shop_domain FROM connections;

# Check jobs
SELECT id, connection_id, job_type, state, attempts FROM jobs ORDER BY created_at DESC LIMIT 10;

# Check audit logs
SELECT id, level, connection_id, sku, message, ts FROM audit_logs ORDER BY ts DESC LIMIT 10;

# Exit
\q
```

### 6. Verify Data Integrity

```bash
# Check foreign key constraints work
SELECT 
  c.id as connection_id,
  c.name,
  i.shop_domain
FROM connections c
JOIN installations i ON c.installation_id = i.id;

# Check job counts by state
SELECT state, COUNT(*) as count FROM jobs GROUP BY state;

# Check recent sync activity
SELECT 
  c.name,
  c.last_synced_at,
  COUNT(j.id) as job_count
FROM connections c
LEFT JOIN jobs j ON c.id = j.connection_id
GROUP BY c.id, c.name, c.last_synced_at
ORDER BY c.last_synced_at DESC NULLS LAST;
```

### 7. Test Concurrent Operations

```bash
# Test multiple workers (in separate terminals)
# Terminal 1:
npm run dev

# Terminal 2 (if you have a worker-only script):
# The app should handle concurrent job processing correctly
```

### 8. Test Error Handling

- Test with invalid DATABASE_URL
- Test with connection failures
- Test transaction rollbacks

## Troubleshooting

### Connection Issues

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"

# If connection fails, check:
# 1. PostgreSQL is running: pg_isready
# 2. Database exists: psql -l | grep inventory_sync_test
# 3. User has permissions
# 4. DATABASE_URL format is correct
```

### Migration Issues

```bash
# Check if tables exist
psql $DATABASE_URL -c "\dt"

# If tables don't exist, run migration manually:
psql $DATABASE_URL -f src/db/postgres-migration.sql

# Check for errors:
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE datname = 'inventory_sync_test';"
```

### Performance Testing

```bash
# Check query performance
psql $DATABASE_URL -c "EXPLAIN ANALYZE SELECT * FROM connections WHERE installation_id = 'some_id';"

# Check index usage
psql $DATABASE_URL -c "\d+ connections"
```

## Clean Up Test Database

```bash
# Drop test database (WARNING: This deletes all data!)
psql postgres -c "DROP DATABASE inventory_sync_test;"

# Recreate for fresh start
psql postgres -c "CREATE DATABASE inventory_sync_test;"
```

