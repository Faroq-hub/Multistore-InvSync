#!/bin/bash
# Startup script for production deployment
# Runs database migration if using PostgreSQL, then starts the application

set -e

echo "Starting application..."

# Run migration if using PostgreSQL
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL detected, running PostgreSQL migration..."
  npm run migrate:postgres || {
    echo "Migration failed, but continuing..."
    # Don't exit on migration failure (might already be migrated)
  }
else
  echo "No DATABASE_URL found, using SQLite"
fi

# Start the application
echo "Starting server..."
exec npm start

