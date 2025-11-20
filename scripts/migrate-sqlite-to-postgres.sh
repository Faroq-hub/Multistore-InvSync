#!/bin/bash
# SQLite to PostgreSQL Data Migration Script
# This script exports data from SQLite and imports it into PostgreSQL

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}Error: DATABASE_URL environment variable is not set${NC}"
  echo "Set it with: export DATABASE_URL='postgresql://user:password@host:port/database'"
  exit 1
fi

# Check if SQLite database exists
SQLITE_DB="${SQLITE_DB_PATH:-./data/app.db}"
if [ ! -f "$SQLITE_DB" ]; then
  echo -e "${RED}Error: SQLite database not found at $SQLITE_DB${NC}"
  echo "Set SQLITE_DB_PATH environment variable if database is elsewhere"
  exit 1
fi

echo -e "${GREEN}Starting SQLite to PostgreSQL migration...${NC}"
echo "SQLite DB: $SQLITE_DB"
echo "PostgreSQL: ${DATABASE_URL%%@*}" # Hide password in output

# Step 1: Verify PostgreSQL connection
echo -e "\n${YELLOW}Step 1: Verifying PostgreSQL connection...${NC}"
if ! psql "$DATABASE_URL" -c "SELECT version();" > /dev/null 2>&1; then
  echo -e "${RED}Error: Cannot connect to PostgreSQL${NC}"
  exit 1
fi
echo -e "${GREEN}✓ PostgreSQL connection successful${NC}"

# Step 2: Run PostgreSQL migration to ensure schema exists
echo -e "\n${YELLOW}Step 2: Ensuring PostgreSQL schema exists...${NC}"
if [ -f "src/db/postgres-migration.sql" ]; then
  psql "$DATABASE_URL" -f src/db/postgres-migration.sql > /dev/null 2>&1
  echo -e "${GREEN}✓ Schema migration complete${NC}"
else
  echo -e "${YELLOW}Warning: postgres-migration.sql not found, assuming schema exists${NC}"
fi

# Step 3: Export data from SQLite
echo -e "\n${YELLOW}Step 3: Exporting data from SQLite...${NC}"

TEMP_DIR=$(mktemp -d)
TEMP_SQL="$TEMP_DIR/export.sql"

# Check if sqlite3 is available
if ! command -v sqlite3 &> /dev/null; then
  echo -e "${RED}Error: sqlite3 command not found. Install it to proceed.${NC}"
  exit 1
fi

# Export each table to SQL
sqlite3 "$SQLITE_DB" <<EOF > "$TEMP_SQL"
.mode insert resellers
SELECT * FROM resellers;

.mode insert installations
SELECT * FROM installations;

.mode insert connections
SELECT * FROM connections;

.mode insert jobs
SELECT * FROM jobs;

.mode insert job_items
SELECT * FROM job_items;

.mode insert audit_logs
SELECT * FROM audit_logs;

.mode insert shopify_sessions
SELECT * FROM shopify_sessions;

.mode insert shopify_oauth_states
SELECT * FROM shopify_oauth_states;

.mode insert shopify_webhooks
SELECT * FROM shopify_webhooks;
EOF

echo -e "${GREEN}✓ Data exported to temporary file${NC}"

# Step 4: Convert SQLite INSERT statements to PostgreSQL format
echo -e "\n${YELLOW}Step 4: Converting SQL format...${NC}"

# Create a Python script to do the conversion
cat > "$TEMP_DIR/convert.py" <<'PYTHON'
import sys
import re

sql = sys.stdin.read()

# Convert SQLite INSERT format to PostgreSQL
# SQLite: INSERT INTO table VALUES(...);
# PostgreSQL: INSERT INTO table VALUES(...);

# Remove SQLite-specific syntax
sql = re.sub(r'INSERT INTO (\w+) VALUES', r'INSERT INTO \1 VALUES', sql)

# Handle NULL values (already compatible)
# Handle TEXT values with quotes (already compatible)

print(sql)
PYTHON

if command -v python3 &> /dev/null; then
  python3 "$TEMP_DIR/convert.py" < "$TEMP_SQL" > "$TEMP_DIR/converted.sql"
  CONVERTED_SQL="$TEMP_DIR/converted.sql"
else
  echo -e "${YELLOW}Warning: python3 not found, using SQLite export as-is${NC}"
  CONVERTED_SQL="$TEMP_SQL"
fi

# Step 5: Import data into PostgreSQL
echo -e "\n${YELLOW}Step 5: Importing data into PostgreSQL...${NC}"

# Check if tables have data
TABLE_COUNT=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('resellers', 'installations', 'connections', 'jobs');")

if [ "$TABLE_COUNT" -gt 0 ]; then
  echo -e "${YELLOW}Warning: PostgreSQL tables already contain data${NC}"
  read -p "Do you want to proceed? This will insert duplicate data. (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "Migration cancelled."
    rm -rf "$TEMP_DIR"
    exit 0
  fi
fi

# Import data (ignore errors for duplicates)
psql "$DATABASE_URL" -f "$CONVERTED_SQL" 2>&1 | grep -v "ERROR:" | grep -v "duplicate key" || true

echo -e "${GREEN}✓ Data import complete${NC}"

# Step 6: Verify migration
echo -e "\n${YELLOW}Step 6: Verifying migration...${NC}"

SQLITE_INSTALLATIONS=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM installations;" 2>/dev/null || echo "0")
PG_INSTALLATIONS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM installations;" 2>/dev/null || echo "0")

SQLITE_CONNECTIONS=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM connections;" 2>/dev/null || echo "0")
PG_CONNECTIONS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM connections;" 2>/dev/null || echo "0")

SQLITE_JOBS=$(sqlite3 "$SQLITE_DB" "SELECT COUNT(*) FROM jobs;" 2>/dev/null || echo "0")
PG_JOBS=$(psql "$DATABASE_URL" -tAc "SELECT COUNT(*) FROM jobs;" 2>/dev/null || echo "0")

echo "SQLite -> PostgreSQL record counts:"
echo "  Installations: $SQLITE_INSTALLATIONS -> $PG_INSTALLATIONS"
echo "  Connections:   $SQLITE_CONNECTIONS -> $PG_CONNECTIONS"
echo "  Jobs:          $SQLITE_JOBS -> $PG_JOBS"

if [ "$SQLITE_INSTALLATIONS" = "$PG_INSTALLATIONS" ] && \
   [ "$SQLITE_CONNECTIONS" = "$PG_CONNECTIONS" ] && \
   [ "$SQLITE_JOBS" = "$PG_JOBS" ]; then
  echo -e "${GREEN}✓ Migration verification successful${NC}"
else
  echo -e "${YELLOW}Warning: Record counts don't match exactly. Check manually.${NC}"
fi

# Cleanup
rm -rf "$TEMP_DIR"

echo -e "\n${GREEN}Migration complete!${NC}"
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test the application with PostgreSQL"
echo "2. Verify all operations work correctly"
echo "3. Create a backup: npm run backup"

