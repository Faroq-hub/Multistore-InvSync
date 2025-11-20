#!/bin/bash
# Database Restore Script
# Supports both SQLite and PostgreSQL

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <backup_file>"
  echo "Example: $0 backups/postgres_backup_20240101_120000.sql.gz"
  exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Check if compressed
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "Decompressing backup..."
  TEMP_FILE="${BACKUP_FILE%.gz}"
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
  RESTORE_FILE="$TEMP_FILE"
else
  RESTORE_FILE="$BACKUP_FILE"
fi

if [ -n "$DATABASE_URL" ]; then
  # PostgreSQL restore
  echo "Restoring PostgreSQL database..."
  echo "WARNING: This will overwrite the current database!"
  read -p "Are you sure? (yes/no): " confirm
  
  if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
  fi
  
  psql "$DATABASE_URL" < "$RESTORE_FILE"
  echo "PostgreSQL database restored successfully!"
  
else
  # SQLite restore
  echo "Restoring SQLite database..."
  echo "WARNING: This will overwrite the current database!"
  read -p "Are you sure? (yes/no): " confirm
  
  if [ "$confirm" != "yes" ]; then
    echo "Restore cancelled."
    exit 0
  fi
  
  DB_PATH="${DB_PATH:-./data/app.db}"
  mkdir -p "$(dirname "$DB_PATH")"
  
  # Stop the application first (if running)
  echo "Please stop the application before restoring."
  read -p "Press Enter to continue..."
  
  cp "$RESTORE_FILE" "$DB_PATH"
  echo "SQLite database restored successfully!"
fi

# Clean up temp file if we decompressed
if [ -n "$TEMP_FILE" ] && [ -f "$TEMP_FILE" ]; then
  rm "$TEMP_FILE"
fi

echo "Restore completed!"

