/**
 * Bonds V3 — Clean old seed records that are not in master-data/sectors.csv
 *
 * Deactivates sectors (and their sub-sectors, activities, project models) that
 * do not appear in the current CSV master data.
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

  const csvPath = path.join(__dirname, '..', 'master-data', 'sectors.csv');
  const lines = fs.readFileSync(csvPath, 'utf8').split('\n').filter(l => l.trim());
  const csvCodes = lines.slice(1).map(l => l.split(',')[0].trim());

  const { rows: oldSectors } = await client.query(
    'SELECT id, code, name_ar FROM public.economic_sectors WHERE NOT (code = ANY($1))',
    [csvCodes]
  );

  if (oldSectors.length === 0) {
    console.log('No old seed sectors found.');
    await client.end();
    return;
  }

  const ids = oldSectors.map(s => s.id);
  console.log('Deactivating old sectors:', oldSectors.map(s => `${s.code} (${s.name_ar})`).join(', '));

  await client.query('UPDATE public.economic_sectors SET is_active = false WHERE id = ANY($1)', [ids]);
  await client.query('UPDATE public.economic_sub_sectors SET is_active = false WHERE sector_id = ANY($1)', [ids]);
  await client.query('UPDATE public.economic_activities SET is_active = false WHERE sector_id = ANY($1)', [ids]);
  await client.query('UPDATE public.project_models SET is_active = false, is_published = false WHERE sector_id = ANY($1)', [ids]);

  console.log(`Deactivated ${oldSectors.length} old sectors and their children.`);
  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
