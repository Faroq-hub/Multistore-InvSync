# PostgreSQL Migration Guide

This guide explains how to migrate from SQLite to PostgreSQL for production use.

## Overview

The application currently uses SQLite by default for development. For production deployments, PostgreSQL is recommended for better performance, concurrency, and reliability.

## Prerequisites

1. PostgreSQL 12+ installed and running
2. A PostgreSQL database created
3. Connection string in the format: `postgresql://user:password@host:port/database`

## Migration Steps

### 1. Set Up PostgreSQL Database

```bash
# Create a database
createdb inventory_sync

# Or using psql
psql -U postgres
CREATE DATABASE inventory_sync;
\q
```

### 2. Set Environment Variable

Set the `DATABASE_URL` environment variable:

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/inventory_sync"
```

Or in your `.env` file:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/inventory_sync
```

### 3. Run Migration

The application will automatically detect PostgreSQL and run migrations on startup. Alternatively, you can run the migration SQL manually:

```bash
psql $DATABASE_URL -f src/db/postgres-migration.sql
```

### 4. Migrate Data (Optional)

If you have existing SQLite data, you can export and import it:

```bash
# Export SQLite data to CSV or SQL
sqlite3 data/app.db ".dump" > sqlite_dump.sql

# Convert and import to PostgreSQL
# Note: You'll need to manually adjust the SQL syntax for PostgreSQL compatibility
```

### 5. Update Application Code

**Important**: The current codebase uses synchronous SQLite operations. Full PostgreSQL support requires making database operations async. Currently:

- ✅ Migration works (async)
- ⚠️ Database queries still use SQLite (synchronous)
- ⚠️ Full PostgreSQL support requires async refactoring

For now, the application will:
- Use SQLite if `DATABASE_URL` is not set
- Use PostgreSQL for migrations if `DATABASE_URL` is set
- Database queries will still use SQLite until full async refactoring is complete

## Backup and Restore

### Backup

```bash
# PostgreSQL
./scripts/backup-db.sh

# Or manually
pg_dump $DATABASE_URL > backup.sql

# SQLite
./scripts/backup-db.sh
# Or manually
sqlite3 data/app.db ".backup backup.db"
```

### Restore

```bash
# PostgreSQL
./scripts/restore-db.sh backups/postgres_backup_20240101_120000.sql.gz

# Or manually
psql $DATABASE_URL < backup.sql

# SQLite
./scripts/restore-db.sh backups/sqlite_backup_20240101_120000.db.gz
```

## Automated Backups

Set up a cron job for automated backups:

```bash
# Edit crontab
crontab -e

# Add daily backup at 2 AM
0 2 * * * cd /path/to/app && ./scripts/backup-db.sh
```

## Full PostgreSQL Support (Future Work)

To fully support PostgreSQL, the following refactoring is needed:

1. **Make all database operations async**
   - Update all `db.prepare().run()` calls to use async/await
   - Update all repository functions to return Promises
   - Update all callers to use await

2. **Use connection pooling**
   - Replace direct database access with pool queries
   - Handle connection lifecycle properly

3. **Update transaction handling**
   - Convert synchronous transactions to async
   - Use PostgreSQL transaction syntax

4. **Test thoroughly**
   - Ensure all queries work with PostgreSQL
   - Test concurrent operations
   - Verify data integrity

## Current Status

- ✅ PostgreSQL migration SQL created
- ✅ Backup/restore scripts created
- ✅ Migration function supports PostgreSQL
- ⚠️ Database queries still use SQLite (synchronous)
- ⚠️ Full PostgreSQL support requires async refactoring

## Recommendations

For production:
1. Use SQLite if you have low concurrency (< 10 concurrent users)
2. Use PostgreSQL if you need:
   - High concurrency
   - Better performance
   - Production-grade reliability
   - Horizontal scaling

## Troubleshooting

### Connection Issues

```bash
# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT version();"
```

### Migration Errors

If migration fails, check:
1. Database user has CREATE TABLE permissions
2. Database exists
3. Connection string is correct
4. PostgreSQL version is 12+

### Performance Issues

- Enable connection pooling (already configured)
- Add indexes for frequently queried columns
- Monitor query performance with `EXPLAIN ANALYZE`

