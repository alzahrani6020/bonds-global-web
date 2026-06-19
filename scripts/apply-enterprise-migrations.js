/**
 * Apply enterprise upgrade migrations automatically using Postgres connection.
 *
 * Usage:
 *   DATABASE_URL="postgresql://postgres:PASSWORD@db.hutxsqzplyuqgnghsrcs.supabase.co:5432/postgres" node scripts/apply-enterprise-migrations.js
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ Please set the DATABASE_URL environment variable.');
  console.error('Example: postgresql://postgres:PASSWORD@db.hutxsqzplyuqgnghsrcs.supabase.co:5432/postgres');
  process.exit(1);
}

const MIGRATION_FILE = path.join(__dirname, '../supabase/migrations/20260619190000_enterprise_upgrade_combined.sql');

async function main() {
  const sql = fs.readFileSync(MIGRATION_FILE, 'utf8');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  console.log('🔌 Connecting to database...');
  await client.connect();

  try {
    console.log('🚀 Running enterprise migrations...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query("SELECT public.refresh_global_search_index()");
    await client.query('COMMIT');
    console.log('✅ Migrations applied successfully.');

    const checks = [
      'SELECT COUNT(*) AS workflow_definitions FROM public.workflow_definitions',
      'SELECT COUNT(*) AS enterprise_roles FROM public.enterprise_roles',
      'SELECT COUNT(*) AS data_quality_issues FROM public.data_quality_issues',
      'SELECT COUNT(*) AS global_search_index FROM public.global_search_index'
    ];

    console.log('\n📊 Verification:');
    for (const q of checks) {
      const res = await client.query(q);
      console.log('  ', res.rows[0]);
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('\n❌ Migration failed:');
    console.error(err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
