/**
 * Bonds V3 — Deactivate sub-sectors and activities not in current master-data CSVs,
 * plus their project models.
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

  const subCsv = path.join(__dirname, '..', 'master-data', 'sub-sectors.csv');
  const actCsv = path.join(__dirname, '..', 'master-data', 'activities.csv');

  const subCodes = fs.readFileSync(subCsv, 'utf8').split('\n').slice(1).filter(l => l.trim()).map(l => l.split(',')[1].trim());
  const actCodes = fs.readFileSync(actCsv, 'utf8').split('\n').slice(1).filter(l => l.trim()).map(l => l.split(',')[1].trim());

  const { rows: oldSubs } = await client.query(
    'SELECT id FROM public.economic_sub_sectors WHERE NOT (code = ANY($1))',
    [subCodes]
  );
  const { rows: oldActs } = await client.query(
    'SELECT id FROM public.economic_activities WHERE NOT (code = ANY($1))',
    [actCodes]
  );

  if (oldSubs.length > 0) {
    await client.query('UPDATE public.economic_sub_sectors SET is_active = false WHERE id = ANY($1)', [oldSubs.map(r => r.id)]);
  }
  if (oldActs.length > 0) {
    await client.query('UPDATE public.economic_activities SET is_active = false WHERE id = ANY($1)', [oldActs.map(r => r.id)]);
  }

  // Deactivate models linked to inactive sub-sectors or activities
  await client.query(`
    UPDATE public.project_models SET is_active = false, is_published = false
    WHERE sub_sector_id IN (SELECT id FROM public.economic_sub_sectors WHERE is_active = false)
       OR activity_id IN (SELECT id FROM public.economic_activities WHERE is_active = false)
  `);

  console.log(`Deactivated ${oldSubs.length} old sub-sectors and ${oldActs.length} old activities.`);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
