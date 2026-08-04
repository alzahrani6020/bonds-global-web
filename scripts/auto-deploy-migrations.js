#!/usr/bin/env node
/**
 * Bonds Global — Auto Deploy Migrations to Supabase
 * Usage: SUPABASE_DB_URL="postgresql://..." node scripts/auto-deploy-migrations.js
 * 
 * This script automatically applies all migrations safely,
 * skipping anything that already exists (policies, tables, etc.)
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'supabase', 'migrations');

// Safe wrapper for statements that might fail (policies, etc.)
function wrapInSafeBlock(sql) {
  // Wrap CREATE POLICY in safe DO blocks
  sql = sql.replace(
    /CREATE POLICY "([^"]+)"\s+ON\s+(\S+)\s+FOR\s+(\S+)\s+((?:(?!EXCEPTION)[\s\S])+?);(?=\s|$)/g,
    (match, g1, g2, g3, g4) => `DO $$ BEGIN\nCREATE POLICY "${g1}" ON ${g2} FOR ${g3} ${g4};\nEXCEPTION WHEN duplicate_object THEN NULL;\nEND $$;`
  );
  return sql;
}

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  
  if (!dbUrl) {
    console.error(" Error: SUPABASE_DB_URL is required");
    console.error('   Get it from: Supabase Dashboard → Project Settings → Database → Connection string');
    console.error('   Then run:');
    console.error('   SUPABASE_DB_URL="postgresql://postgres:password@db.xxx.supabase.co:5432/postgres" node scripts/auto-deploy-migrations.js');
    process.exit(1);
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log(` Found ${files.length} migration files\n`);

  const client = new Client({ connectionString: dbUrl });

  try {
    await client.connect();
    console.log(" Connected to Supabase\n");

    // Create tracking table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    let applied = 0;
    let skipped = 0;

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM _migrations WHERE filename = $1',
        [file]
      );

      if (rows.length > 0) {
        console.log(`⏭  ${file} — already applied`);
        skipped++;
        continue;
      }

      let content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
      content = wrapInSafeBlock(content);

      console.log(` Applying: ${file}`);

      try {
        await client.query(content);
        await client.query(
          'INSERT INTO _migrations (filename) VALUES ($1)',
          [file]
        );
        console.log(`    Success\n`);
        applied++;
      } catch (err) {
        console.error(`    FAILED: ${err.message}`);
        console.error("\n  Stopping. Fix the error and re-run.");
        process.exit(1);
      }
    }

    console.log(`\n Done! Applied: ${applied}, Skipped: ${skipped}, Total: ${files.length}`);
    console.log("\n All migrations are now in your database.");

  } catch (err) {
    console.error(" Connection failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
