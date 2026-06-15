/**
 * Bonds V3 — Deactivate project models that are not in master-data/project-models.csv
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
  const client = new Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const csvPath = path.join(__dirname, '..', 'master-data', 'project-models.csv');
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim());
  const csvCodes = lines.slice(1).map(l => l.split(',')[1].trim());

  const { rows: old } = await client.query(
    'SELECT id, code FROM public.project_models WHERE NOT (code = ANY($1)) AND is_active = true',
    [csvCodes]
  );

  if (old.length === 0) {
    console.log('No old project models to deactivate.');
    await client.end();
    return;
  }

  const ids = old.map(r => r.id);
  await client.query(
    'UPDATE public.project_models SET is_active = false, is_published = false WHERE id = ANY($1)',
    [ids]
  );

  console.log(`Deactivated ${old.length} old project models not in CSV.`);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
