#!/bin/bash
# Database Backup Script
# Supports both SQLite and PostgreSQL

set -e

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

if [ -n "$DATABASE_URL" ]; then
  # PostgreSQL backup
  echo "Backing up PostgreSQL database..."
  BACKUP_FILE="$BACKUP_DIR/postgres_backup_${TIMESTAMP}.sql"
  
  # Extract connection details from DATABASE_URL
  pg_dump "$DATABASE_URL" > "$BACKUP_FILE"
  
  # Compress the backup
  gzip "$BACKUP_FILE"
  
  echo "PostgreSQL backup created: ${BACKUP_FILE}.gz"
  
  # Keep only last 30 days of backups
  find "$BACKUP_DIR" -name "postgres_backup_*.sql.gz" -mtime +30 -delete
  
else
  # SQLite backup
  echo "Backing up SQLite database..."
  DB_PATH="${DB_PATH:-./data/app.db}"
  BACKUP_FILE="$BACKUP_DIR/sqlite_backup_${TIMESTAMP}.db"
  
  if [ ! -f "$DB_PATH" ]; then
    echo "Error: SQLite database not found at $DB_PATH"
    exit 1
  fi
  
  # Use VACUUM INTO for SQLite 3.27+ (creates a backup)
  sqlite3 "$DB_PATH" "VACUUM INTO '$BACKUP_FILE';" || {
    # Fallback for older SQLite versions
    cp "$DB_PATH" "$BACKUP_FILE"
  }
  
  # Compress the backup
  gzip "$BACKUP_FILE"
  
  echo "SQLite backup created: ${BACKUP_FILE}.gz"
  
  # Keep only last 30 days of backups
  find "$BACKUP_DIR" -name "sqlite_backup_*.db.gz" -mtime +30 -delete
fi

echo "Backup completed successfully!"

