#!/usr/bin/env node
/**
 * SQLite to PostgreSQL Data Migration Script (Node.js version)
 * More robust than shell script, handles data types and constraints better
 */

const Database = require('better-sqlite3');
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const SQLITE_DB_PATH = process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'app.db');
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set');
  console.error("Set it with: export DATABASE_URL='postgresql://user:password@host:port/database'");
  process.exit(1);
}

if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.error(`Error: SQLite database not found at ${SQLITE_DB_PATH}`);
  console.error('Set SQLITE_DB_PATH environment variable if database is elsewhere');
  process.exit(1);
}

async function main() {
  console.log('Starting SQLite to PostgreSQL migration...');
  console.log(`SQLite DB: ${SQLITE_DB_PATH}`);
  console.log(`PostgreSQL: ${DATABASE_URL.split('@')[0]}@***`);

  // Step 1: Connect to databases
  console.log('\nStep 1: Connecting to databases...');
  const sqliteDb = new Database(SQLITE_DB_PATH, { readonly: true });
  const pgClient = new Client({ connectionString: DATABASE_URL });
  
  try {
    await pgClient.connect();
    console.log('✓ Connected to PostgreSQL');
  } catch (err) {
    console.error('Error connecting to PostgreSQL:', err.message);
    process.exit(1);
  }

  // Step 2: Verify schema exists
  console.log('\nStep 2: Verifying PostgreSQL schema...');
  const schemaCheck = await pgClient.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'installations'
  `);
  
  if (schemaCheck.rows.length === 0) {
    console.log('Schema not found, running migration...');
    const migrationPath = path.join(process.cwd(), 'src', 'db', 'postgres-migration.sql');
    if (fs.existsSync(migrationPath)) {
      const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
      const statements = migrationSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      
      for (const statement of statements) {
        try {
          await pgClient.query(statement);
        } catch (err) {
          // Ignore "already exists" errors
          if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
            console.error('Migration error:', err.message);
          }
        }
      }
      console.log('✓ Schema migration complete');
    } else {
      console.error('Migration SQL file not found');
      process.exit(1);
    }
  } else {
    console.log('✓ Schema verified');
  }

  // Step 3: Export and import each table
  const tables = [
    'resellers',
    'installations',
    'connections',
    'jobs',
    'job_items',
    'audit_logs',
    'shopify_sessions',
    'shopify_oauth_states',
    'shopify_webhooks'
  ];

  for (const table of tables) {
    console.log(`\nStep 3: Migrating ${table}...`);
    
    try {
      // Check if table exists in SQLite
      const sqliteCheck = sqliteDb.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(table);
      
      if (!sqliteCheck) {
        console.log(`  Skipping ${table} (not in SQLite)`);
        continue;
      }

      // Get all rows from SQLite
      const rows = sqliteDb.prepare(`SELECT * FROM ${table}`).all();
      console.log(`  Found ${rows.length} rows in SQLite`);

      if (rows.length === 0) {
        console.log(`  Skipping ${table} (empty)`);
        continue;
      }

      // Get column names
      const columns = Object.keys(rows[0]);
      const columnList = columns.join(', ');
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

      // Check existing data in PostgreSQL
      const existingCount = await pgClient.query(`SELECT COUNT(*) as count FROM ${table}`);
      const existingRows = parseInt(existingCount.rows[0].count);
      
      if (existingRows > 0) {
        console.log(`  Warning: ${table} already has ${existingRows} rows in PostgreSQL`);
        console.log('  Will insert new rows (may cause duplicates)');
      }

      // Insert rows in batches
      const batchSize = 100;
      let inserted = 0;
      let skipped = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        
        for (const row of batch) {
          const values = columns.map(col => {
            const value = row[col];
            // Convert undefined/null appropriately
            if (value === undefined || value === null) return null;
            // Keep strings, numbers, and dates as-is
            return value;
          });

          try {
            await pgClient.query(
              `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})`,
              values
            );
            inserted++;
          } catch (err) {
            // Skip duplicates and constraint violations
            if (err.message.includes('duplicate key') || 
                err.message.includes('violates unique constraint') ||
                err.message.includes('violates foreign key constraint')) {
              skipped++;
            } else {
              console.error(`  Error inserting row:`, err.message);
            }
          }
        }
      }

      console.log(`  ✓ Inserted ${inserted} rows, skipped ${skipped} duplicates/conflicts`);
      
    } catch (err) {
      console.error(`  Error migrating ${table}:`, err.message);
    }
  }

  // Step 4: Verify migration
  console.log('\nStep 4: Verifying migration...');
  
  const verifications = {};
  for (const table of tables) {
    try {
      const sqliteCount = sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${table}`).get()?.count || 0;
      const pgResult = await pgClient.query(`SELECT COUNT(*) as count FROM ${table}`);
      const pgCount = parseInt(pgResult.rows[0].count);
      
      verifications[table] = { sqlite: sqliteCount, postgres: pgCount };
    } catch (err) {
      // Table might not exist in one or the other
      verifications[table] = { sqlite: 0, postgres: 0 };
    }
  }

  console.log('\nRecord counts (SQLite -> PostgreSQL):');
  let allMatch = true;
  for (const [table, counts] of Object.entries(verifications)) {
    const match = counts.sqlite === counts.postgres ? '✓' : '✗';
    if (counts.sqlite !== counts.postgres) allMatch = false;
    console.log(`  ${match} ${table.padEnd(25)} ${String(counts.sqlite).padStart(5)} -> ${String(counts.postgres).padStart(5)}`);
  }

  if (allMatch) {
    console.log('\n✓ Migration verification successful!');
  } else {
    console.log('\n⚠ Warning: Some record counts don\'t match. This may be due to:');
    console.log('  - Duplicate keys being skipped');
    console.log('  - Foreign key constraints');
    console.log('  - Manual data in PostgreSQL');
  }

  // Cleanup
  sqliteDb.close();
  await pgClient.end();

  console.log('\n✓ Migration complete!');
  console.log('\nNext steps:');
  console.log('1. Test the application: npm run dev');
  console.log('2. Verify all operations work correctly');
  console.log('3. Create a backup: npm run backup');
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});

