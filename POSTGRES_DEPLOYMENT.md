# PostgreSQL Deployment Guide

## Overview

This guide covers deploying the application with PostgreSQL in production environments.

## Prerequisites

- PostgreSQL 12+ installed and accessible
- Database user with appropriate permissions
- Backup strategy in place
- Environment variable management configured

## Deployment Options

### Option 1: Managed PostgreSQL (Recommended)

**Popular Providers:**
- **AWS RDS**: `postgresql://user:pass@rds-instance.region.rds.amazonaws.com:5432/dbname`
- **Heroku Postgres**: Automatically sets `DATABASE_URL`
- **DigitalOcean Managed Databases**: `postgresql://user:pass@db-instance.region.db.ondigitalocean.com:25060/dbname?sslmode=require`
- **Railway**: Automatically sets `DATABASE_URL`
- **Render**: Automatically sets `DATABASE_URL`
- **Supabase**: `postgresql://user:pass@db.project.supabase.co:5432/postgres`

**Advantages:**
- Automatic backups
- High availability
- Managed updates
- Monitoring included
- Scaling support

### Option 2: Self-Hosted PostgreSQL

**On VPS/Dedicated Server:**
```bash
# Install PostgreSQL
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE inventory_sync;
CREATE USER inventory_user WITH PASSWORD 'strong_password_here';
GRANT ALL PRIVILEGES ON DATABASE inventory_sync TO inventory_user;
ALTER USER inventory_user CREATEDB;
\q
```

## Production Setup Steps

### 1. Create Production Database

```bash
# Connect to PostgreSQL server
psql -h your-host -U postgres

# Create database
CREATE DATABASE inventory_sync_prod;

# Create user
CREATE USER inventory_app WITH PASSWORD 'your_secure_password';

# Grant permissions
GRANT ALL PRIVILEGES ON DATABASE inventory_sync_prod TO inventory_app;

# Connect to the new database
\c inventory_sync_prod

# Grant schema permissions
GRANT ALL ON SCHEMA public TO inventory_app;

# Exit
\q
```

### 2. Set Environment Variables

**In your deployment platform:**

```bash
# Production DATABASE_URL
DATABASE_URL=postgresql://inventory_app:your_secure_password@your-host:5432/inventory_sync_prod

# Other required variables (if not already set)
APP_URL=https://your-app-domain.com
SHOPIFY_API_KEY=your_api_key
SHOPIFY_API_SECRET=your_api_secret
ENCRYPTION_KEY=your_encryption_key_32_chars_min
```

**For platforms like Heroku, Railway, Render:**
- Add `DATABASE_URL` in the platform's environment variables UI
- They often auto-set this for managed databases

### 3. Run Migration

**Option A: Via npm script (recommended)**
```bash
# If running migration from deployment server
export DATABASE_URL="postgresql://..."
npm run migrate:postgres
```

**Option B: Direct psql**
```bash
# Upload migration file to server
scp src/db/postgres-migration.sql server:/tmp/

# Run migration
psql $DATABASE_URL -f /tmp/postgres-migration.sql
```

**Option C: During app startup** (automatic)
- The app automatically runs migrations on startup when using PostgreSQL
- Check logs for: `[DB] PostgreSQL migration completed`

### 4. Migrate Existing Data (if upgrading)

If you're migrating from SQLite to PostgreSQL:

```bash
# Option 1: Use Node.js migration script (recommended)
export DATABASE_URL="postgresql://..."
export SQLITE_DB_PATH="./data/app.db"  # Path to your SQLite DB
node scripts/migrate-sqlite-to-postgres.js

# Option 2: Use shell script
chmod +x scripts/migrate-sqlite-to-postgres.sh
./scripts/migrate-sqlite-to-postgres.sh
```

### 5. Configure Backups

**Option A: Automated Backups via Script**

Add to crontab (runs daily at 2 AM):
```bash
crontab -e
# Add:
0 2 * * * cd /path/to/app && /usr/bin/env DATABASE_URL="postgresql://..." npm run backup
```

**Option B: Managed Database Backups**

Most managed PostgreSQL providers include:
- Automated daily backups
- Point-in-time recovery
- Retention policies (7-30 days)

**Option C: Manual Backup Script**

Create `scripts/production-backup.sh`:
```bash
#!/bin/bash
# Production backup script with retention

BACKUP_DIR="/backups/inventory-sync"
RETENTION_DAYS=30
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

# Backup PostgreSQL
pg_dump "$DATABASE_URL" | gzip > "$BACKUP_DIR/postgres_backup_${TIMESTAMP}.sql.gz"

# Cleanup old backups
find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -mtime +$RETENTION_DAYS -delete

# Optional: Upload to S3/cloud storage
# aws s3 cp "$BACKUP_DIR/postgres_backup_${TIMESTAMP}.sql.gz" s3://your-bucket/backups/
```

### 6. Deploy Application

**Heroku:**
```bash
heroku config:set DATABASE_URL="postgresql://..."
git push heroku main
```

**Railway:**
```bash
# Set DATABASE_URL in Railway dashboard
railway up
```

**Docker:**
```dockerfile
# Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

```yaml
# docker-compose.yml example
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - APP_URL=${APP_URL}
    depends_on:
      - postgres
  
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=inventory_sync
      - POSTGRES_USER=inventory_user
      - POSTGRES_PASSWORD=secure_password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

**PM2:**
```bash
# Install PM2
npm install -g pm2

# Start app
pm2 start npm --name "inventory-sync" -- start

# Save PM2 configuration
pm2 save
pm2 startup
```

### 7. Verify Deployment

```bash
# Check application is running
curl https://your-app-domain.com/health

# Check database connection
psql $DATABASE_URL -c "SELECT COUNT(*) FROM installations;"

# Check logs
# Heroku: heroku logs --tail
# Railway: railway logs
# PM2: pm2 logs inventory-sync
```

## Performance Optimization

### 1. Connection Pooling

The application already uses connection pooling (max 20 connections). For high-traffic scenarios:

```bash
# Adjust in src/db/postgres.ts if needed
max: 20,  # Increase for more concurrent requests
```

### 2. Indexes

The migration script creates essential indexes. Monitor query performance:

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Analyze table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

### 3. Vacuum and Analyze

Schedule regular maintenance:

```bash
# Add to crontab (weekly)
0 3 * * 0 psql $DATABASE_URL -c "VACUUM ANALYZE;"
```

## Monitoring

### 1. Application Metrics

Monitor these in production:
- Database connection pool usage
- Query execution times
- Job processing times
- Error rates

### 2. Database Metrics

Key PostgreSQL metrics:
- Connection count
- Query performance
- Table sizes
- Lock waits
- Replication lag (if using replicas)

### 3. Logging

The application logs to console. For production:

```bash
# PM2 with log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30

# Or use a logging service (Datadog, Loggly, etc.)
```

## Security Best Practices

### 1. Database Access

```sql
-- Restrict database access to application user only
REVOKE ALL ON DATABASE inventory_sync_prod FROM PUBLIC;
GRANT CONNECT ON DATABASE inventory_sync_prod TO inventory_app;

-- Use SSL connections (if supported)
-- Add ?sslmode=require to DATABASE_URL
```

### 2. Environment Variables

- Never commit `.env` files
- Use secure secret management (AWS Secrets Manager, HashiCorp Vault, etc.)
- Rotate passwords regularly

### 3. Network Security

- Use VPC/private networking when possible
- Restrict database access to application servers only
- Use firewall rules to limit access

## Scaling Considerations

### 1. Read Replicas

For read-heavy workloads:
```bash
# Set READ_REPLICA_URL for read operations (future enhancement)
READ_REPLICA_URL=postgresql://...  # Read replica connection
```

### 2. Connection Limits

PostgreSQL default connection limit is 100. For multiple app instances:

```sql
-- Check current limit
SHOW max_connections;

-- Adjust postgresql.conf if needed
max_connections = 200
```

### 3. Partitioning

For large tables (audit_logs, jobs), consider partitioning:

```sql
-- Example: Partition audit_logs by month
CREATE TABLE audit_logs (
  -- columns
) PARTITION BY RANGE (ts);
```

## Backup and Recovery

### 1. Automated Backups

```bash
# Daily backup with retention
0 2 * * * /path/to/scripts/production-backup.sh
```

### 2. Point-in-Time Recovery

Configure WAL archiving for PITR:
```ini
# postgresql.conf
wal_level = replica
archive_mode = on
archive_command = 'cp %p /backup/wal/%f'
```

### 3. Restore Procedure

```bash
# Restore from backup
gunzip -c backup.sql.gz | psql $DATABASE_URL

# Or use restore script
./scripts/restore-db.sh backups/postgres_backup_20240101_020000.sql.gz
```

## Troubleshooting

### Connection Pool Exhausted

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity WHERE datname = 'inventory_sync_prod';

-- Find idle connections
SELECT pid, usename, application_name, state, query_start 
FROM pg_stat_activity 
WHERE datname = 'inventory_sync_prod' 
AND state = 'idle'
ORDER BY query_start;
```

### Slow Queries

```sql
-- Enable query logging (temporarily)
SET log_min_duration_statement = 1000;  -- Log queries > 1 second

-- Check table statistics
SELECT schemaname, tablename, last_vacuum, last_analyze
FROM pg_stat_user_tables;
```

### Disk Space

```sql
-- Check database size
SELECT pg_size_pretty(pg_database_size('inventory_sync_prod'));

-- Check table sizes
SELECT 
  tablename,
  pg_size_pretty(pg_total_relation_size('public.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size('public.' || tablename) DESC;
```

## Rollback Plan

If you need to rollback to SQLite:

1. **Stop the application**
2. **Export data from PostgreSQL:**
   ```bash
   pg_dump $DATABASE_URL > backup_before_rollback.sql
   ```
3. **Unset DATABASE_URL:**
   ```bash
   unset DATABASE_URL
   # Or remove from .env
   ```
4. **Restore SQLite database** (if you have a backup)
5. **Start application** (will use SQLite)

## Platform-Specific Guides

### Heroku

```bash
# Add Heroku Postgres
heroku addons:create heroku-postgresql:mini

# DATABASE_URL is automatically set
heroku config

# Run migration
heroku run npm run migrate:postgres

# Check database
heroku pg:psql
```

### Railway

1. Create PostgreSQL service in Railway dashboard
2. Link to your application service
3. `DATABASE_URL` is automatically set
4. Migration runs on first deployment

### Render

1. Create PostgreSQL database in Render dashboard
2. Copy `DATABASE_URL` from database settings
3. Add to application environment variables
4. Migration runs on deployment

### AWS RDS

```bash
# Create RDS instance via AWS Console or CLI
aws rds create-db-instance \
  --db-instance-identifier inventory-sync-prod \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --master-username admin \
  --master-user-password YourPassword \
  --allocated-storage 20

# Set DATABASE_URL
export DATABASE_URL="postgresql://admin:YourPassword@inventory-sync-prod.region.rds.amazonaws.com:5432/inventory_sync"

# Run migration
npm run migrate:postgres
```

## Checklist

- [ ] PostgreSQL database created
- [ ] Database user created with appropriate permissions
- [ ] `DATABASE_URL` environment variable set
- [ ] Migration run successfully
- [ ] Existing data migrated (if applicable)
- [ ] Backups configured
- [ ] Application deployed and running
- [ ] Health checks passing
- [ ] Monitoring configured
- [ ] Logging configured
- [ ] Security measures in place
- [ ] Performance tested

## Support

If you encounter issues:
1. Check application logs
2. Check PostgreSQL logs
3. Verify `DATABASE_URL` format
4. Test database connection: `psql $DATABASE_URL -c "SELECT version();"`
5. Review migration logs for errors

