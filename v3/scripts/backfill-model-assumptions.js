/**
 * Bonds V3 — Backfill missing standard assumptions for all project models.
 *
 * Ensures every model has the complete set of financial assumptions used by
 * the calculator engine. Missing assumptions are filled with their default_value.
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

async function batchInsert(client, rows, batchSize = 500) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = [];
    const params = [];
    let idx = 1;
    for (const r of batch) {
      values.push(`($${idx++}, $${idx++}, $${idx++})`);
      params.push(r.project_model_id, r.assumption_id, r.value);
    }
    await client.query(
      `INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
       VALUES ${values.join(',')}
       ON CONFLICT (project_model_id, assumption_id) DO UPDATE SET value = EXCLUDED.value`,
      params
    );
  }
}

async function main() {
  const env = loadEnvLocal();
  const client = new Client({ connectionString: env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const { rows: assumptions } = await client.query('SELECT id, code, default_value FROM public.financial_assumptions');
  const { rows: models } = await client.query('SELECT id, code FROM public.project_models');
  const { rows: existing } = await client.query(
    'SELECT project_model_id, assumption_id FROM public.project_model_assumptions'
  );

  const assumptionMap = Object.fromEntries(assumptions.map(a => [a.code, a]));
  const modelAssumptions = new Set(existing.map(r => `${r.project_model_id}:${r.assumption_id}`));

  const missing = [];
  for (const model of models) {
    for (const assumption of assumptions) {
      const key = `${model.id}:${assumption.id}`;
      if (!modelAssumptions.has(key)) {
        missing.push({
          project_model_id: model.id,
          assumption_id: assumption.id,
          value: assumption.default_value
        });
      }
    }
  }

  if (missing.length > 0) {
    await batchInsert(client, missing);
    console.log(`Backfilled ${missing.length} missing assumption values across ${models.length} models.`);
  } else {
    console.log('No missing assumptions found.');
  }

  await client.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
