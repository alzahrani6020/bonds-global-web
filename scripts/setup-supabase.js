#!/usr/bin/env node
/**
 * Bonds Global — Supabase Schema Setup Script
 * Usage: npm run setup:supabase
 *
 * Requires env var: SUPABASE_DB_URL (PostgreSQL connection string)
 * Found in: Supabase Dashboard → Project Settings → Database → Connection string
 */

const fs = require('fs');
const path = require('path');

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ Error: SUPABASE_DB_URL or DATABASE_URL is required');
    console.error('   Get it from: Supabase Dashboard → Project Settings → Database → Connection string');
    console.error('   Example: postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres');
    process.exit(1);
  }

  let pg;
  try {
    pg = require('pg');
  } catch {
    console.error('❌ pg package not found. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install pg --save-dev', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    pg = require('pg');
  }

  const sqlPath = path.resolve(__dirname, '..', 'templates', 'supabase-schema.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ SQL file not found:', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

  try {
    await client.connect();
    console.log('🔗 Connected to Supabase PostgreSQL\n');

    // Split SQL into statements and execute one by one for better error reporting
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    let success = 0;
    let skipped = 0;

    for (const stmt of statements) {
      const cleanStmt = stmt.replace(/\n/g, ' ').substring(0, 60);
      try {
        await client.query(stmt + ';');
        success++;
        console.log(`✅ ${cleanStmt}...`);
      } catch (err) {
        // Ignore "already exists" errors
        if (err.message && (err.message.includes('already exists') || err.code === '42P07' || err.code === '42710')) {
          skipped++;
          console.log(`⏭️  ${cleanStmt}... (already exists)`);
        } else {
          console.error(`❌ ${cleanStmt}...`);
          console.error('   ', err.message);
        }
      }
    }

    console.log(`\n🎉 Done! ${success} statements executed, ${skipped} skipped (already exist)`);
    console.log('\n📋 Next steps:');
    console.log('   1. Go to Supabase Dashboard → Authentication → URL Configuration');
    console.log('   2. Set Site URL to your production domain');
    console.log('   3. Add redirect URLs for /calculators/auth/ and /en/calculators/auth/');
  } catch (err) {
    console.error('\n❌ Connection failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
