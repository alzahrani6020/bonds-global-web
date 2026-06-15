/**
 * Apply Bonds V3 seeds directly to Supabase Postgres.
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
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
  if (!env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL missing');

  const seedPath = path.join(__dirname, '..', 'supabase', 'seed', 'all-seeds.sql');
  const sql = fs.readFileSync(seedPath, 'utf8');

  const client = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });

  console.log('Connecting to database...');
  await client.connect();
  console.log('Applying seeds...');
  await client.query(sql);
  console.log('Seeds applied successfully.');
  await client.end();
}

main().catch(err => {
  console.error('Seeds failed:', err.message);
  process.exit(1);
});
