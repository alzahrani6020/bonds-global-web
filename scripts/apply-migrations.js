#!/usr/bin/env node
/**
 * Bonds Global — Apply all Supabase Migrations
 * Usage: SUPABASE_DB_URL="postgresql://..." node scripts/apply-migrations.js
 *        or: node scripts/apply-migrations.js --dry-run
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

async function main() {
  const isDryRun = process.argv.includes('--dry-run');
  const dbUrl = process.env.SUPABASE_DB_URL;

  // List all SQL files sorted
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.error(" No SQL files found in supabase/migrations/");
    process.exit(1);
  }

  console.log(` Found ${files.length} migration(s)\n`);

  if (isDryRun || !dbUrl) {
    console.log(" DRY RUN — Copy & paste into Supabase SQL Editor\n");
    console.log("".repeat(60));
    for (const file of files) {
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`\n--  ${file}`);
      console.log(content.trim());
      console.log('\n' + "".repeat(60));
    }
    if (!dbUrl) {
      console.log("\n  Set SUPABASE_DB_URL to execute automatically:");
      console.log('   SUPABASE_DB_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" node scripts/apply-migrations.js');
    }
    return;
  }

  // Connect to database
  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log(" Connected to Supabase\n");

    // Create migrations tracking table if not exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1',
        [file]
      );

      if (rows.length > 0) {
        console.log(`⏭  ${file} — already applied`);
        continue;
      }

      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(` Applying: ${file}`);

      try {
        await client.query(content);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        );
        console.log(`    Applied successfully\n`);
      } catch (err) {
        console.error(`    FAILED: ${err.message}`);
        console.error("\n  Stopping. Fix the error and re-run.");
        process.exit(1);
      }
    }

    console.log("\n All migrations applied successfully!");

  } catch (err) {
    console.error(" Database connection failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
