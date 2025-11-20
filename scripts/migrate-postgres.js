#!/usr/bin/env node
/**
 * PostgreSQL Migration Script (Node.js)
 * Uses pg library instead of psql command
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function main() {
  console.log('Starting PostgreSQL migration...');
  console.log(`Database: ${DATABASE_URL.split('@')[1] || '***'}`);

  const client = new Client({ connectionString: DATABASE_URL });

  try {
    await client.connect();
    console.log('✓ Connected to PostgreSQL');

    // Read migration SQL file
    const migrationPath = path.join(__dirname, '..', 'src', 'db', 'postgres-migration.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error(`Error: Migration file not found at ${migrationPath}`);
      process.exit(1);
    }

    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');
    
    // Split by semicolons and filter out empty statements
    const statements = migrationSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && !s.startsWith('/*'));

    console.log(`Found ${statements.length} SQL statements to execute`);

    let executed = 0;
    let skipped = 0;

    for (const statement of statements) {
      try {
        await client.query(statement);
        executed++;
      } catch (err) {
        // Ignore "already exists" errors (idempotent migration)
        if (err.message.includes('already exists') || 
            err.message.includes('duplicate') ||
            err.message.includes('relation') && err.message.includes('already exists')) {
          skipped++;
          console.log(`  ⚠ Skipped (already exists): ${statement.substring(0, 50)}...`);
        } else {
          console.error(`  ✗ Error executing statement:`, err.message);
          console.error(`  Statement: ${statement.substring(0, 100)}...`);
          throw err;
        }
      }
    }

    console.log(`\n✓ Migration completed!`);
    console.log(`  Executed: ${executed} statements`);
    console.log(`  Skipped: ${skipped} statements (already exists)`);

    // Verify tables were created
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log(`\n✓ Tables in database: ${tablesResult.rows.length}`);
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

