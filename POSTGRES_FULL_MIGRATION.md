# Full PostgreSQL Migration Guide

## Overview

This document describes the full migration from SQLite to PostgreSQL. The migration makes all database operations async and uses PostgreSQL when `DATABASE_URL` is set.

## Migration Status

**✅ Completed:**
- PostgreSQL migration SQL created
- Database utility functions for async operations
- Core repository functions converted to async

**🔄 In Progress:**
- Converting all repository functions to async
- Updating all callers throughout the codebase

**⏳ Pending:**
- Update all route handlers to use async/await
- Update worker functions to use async/await
- Update all Next.js API routes to use async/await
- Testing all database operations

## Architecture

The migration uses a unified async interface:
- `execQuery()` - Execute SELECT queries
- `execQueryOne()` - Execute SELECT and return one row
- `execCommand()` - Execute INSERT/UPDATE/DELETE
- `execTransaction()` - Execute transactions

These functions automatically use PostgreSQL when `DATABASE_URL` is set, otherwise they use SQLite.

## Migration Steps

1. **Set DATABASE_URL:**
   ```bash
   export DATABASE_URL="postgresql://user:password@localhost:5432/inventory_sync"
   ```

2. **Run Migration:**
   ```bash
   npm run migrate:postgres
   # Or the app will auto-migrate on startup
   ```

3. **Update Code:**
   All repository functions are now async. Update callers to use `await`:

   ```typescript
   // Before (sync)
   const installations = InstallationRepo.list();
   
   // After (async)
   const installations = await InstallationRepo.list();
   ```

4. **Test:**
   Ensure all database operations work correctly with PostgreSQL.

## Breaking Changes

- All repository functions are now async (return Promises)
- All callers must use `await` or `.then()`
- SQLite is still supported but operations are async for consistency

## Rollback

If you need to rollback to SQLite:
1. Remove or unset `DATABASE_URL`
2. The app will automatically use SQLite
3. All operations will still be async but use SQLite internally

