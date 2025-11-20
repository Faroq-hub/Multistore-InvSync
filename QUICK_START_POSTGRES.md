# Quick Start: PostgreSQL Setup

## 1. Install PostgreSQL

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

## 2. Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Run these commands:
CREATE DATABASE inventory_sync;
CREATE USER inventory_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE inventory_sync TO inventory_user;
\q
```

## 3. Set Environment Variable

```bash
# Add to .env file or export
export DATABASE_URL="postgresql://inventory_user:your_password@localhost:5432/inventory_sync"
```

## 4. Run Migration

```bash
# Create schema
npm run migrate:postgres
```

## 5. Migrate Data (Optional)

If you have existing SQLite data:

```bash
# Set SQLite database path (default: ./data/app.db)
export SQLITE_DB_PATH="./data/app.db"

# Run migration
npm run migrate:sqlite-to-postgres
```

## 6. Start Application

```bash
# App will auto-detect PostgreSQL
npm run dev

# Look for this in console:
# [DB] Using PostgreSQL (DATABASE_URL detected)
```

## 7. Verify

```bash
# Check tables exist
psql $DATABASE_URL -c "\dt"

# Check data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM installations;"
```

## Testing Checklist

- [ ] App starts without errors
- [ ] Can install via Shopify OAuth
- [ ] Can create connections
- [ ] Jobs process correctly
- [ ] Audit logs are written
- [ ] Backups work: `npm run backup`

## Next Steps

- See `POSTGRES_TESTING.md` for detailed testing
- See `POSTGRES_DEPLOYMENT.md` for production deployment

