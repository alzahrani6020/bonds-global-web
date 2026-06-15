/**
 * Apply Bonds V3 migration directly to Supabase Postgres.
 * Reads SUPABASE_DB_URL from .env.local.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim();
  });
  return env;
}

async function main() {
  const env = loadEnvLocal();
  if (!env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL is missing in .env.local');
  }

  const filename = process.argv[2] || '20260611000000_v3_master_data_v1.sql';
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', filename);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  const client = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting to Supabase database...');
  await client.connect();
  console.log('Applying migration...');
  await client.query(sql);
  console.log('Migration applied successfully.');
  await client.end();
}

main().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
