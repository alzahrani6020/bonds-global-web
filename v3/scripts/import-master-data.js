/**
 * Bonds V3 — Import master data from CSV files.
 *
 * Reads files from master-data/ and upserts into Supabase Postgres.
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

function parseCsv(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  return lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, i) => {
      row[h] = values[i] !== undefined ? values[i] : '';
      // Convert numeric fields
      if (['sort_order', 'capex_min', 'capex_max', 'revenue_min', 'revenue_max',
           'employee_count_min', 'employee_count_max', 'typical_roi_months',
           'population', 'avg_household_income', 'purchasing_power_index',
           'value', 'score', 'estimated_cost'].includes(h)) {
        row[h] = row[h] === '' ? null : Number(row[h]);
      }
      // Convert booleans
      if (['is_published', 'is_active', 'mandatory'].includes(h)) {
        row[h] = row[h] === 'true' || row[h] === '1';
      }
    });
    return row;
  });
}

async function importSectors(client, rows) {
  for (const r of rows) {
    await client.query(
      `INSERT INTO public.economic_sectors (code, name_ar, name_en, description, risk_category, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET
         name_ar = EXCLUDED.name_ar,
         name_en = EXCLUDED.name_en,
         description = EXCLUDED.description,
         risk_category = EXCLUDED.risk_category,
         sort_order = EXCLUDED.sort_order`,
      [r.code, r.name_ar, r.name_en, r.description || null, r.risk_category || 'medium', r.sort_order || 0]
    );
  }
  console.log(`Imported ${rows.length} sectors`);
}

async function importSubSectors(client, rows) {
  const { rows: sectors } = await client.query('SELECT id, code FROM public.economic_sectors');
  const sectorMap = Object.fromEntries(sectors.map(s => [s.code, s.id]));

  for (const r of rows) {
    const sectorId = sectorMap[r.sector_code];
    if (!sectorId) { console.warn('Sector not found:', r.sector_code); continue; }
    await client.query(
      `INSERT INTO public.economic_sub_sectors (sector_id, code, name_ar, name_en, description, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET
         sector_id = EXCLUDED.sector_id,
         name_ar = EXCLUDED.name_ar,
         name_en = EXCLUDED.name_en,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order`,
      [sectorId, r.code, r.name_ar, r.name_en, r.description || null, r.sort_order || 0]
    );
  }
  console.log(`Imported ${rows.length} sub-sectors`);
}

async function importActivities(client, rows) {
  const { rows: subSectors } = await client.query('SELECT id, code, sector_id FROM public.economic_sub_sectors');
  const subMap = Object.fromEntries(subSectors.map(s => [s.code, { id: s.id, sector_id: s.sector_id }]));

  for (const r of rows) {
    const sub = subMap[r.sub_sector_code];
    if (!sub) { console.warn('Sub-sector not found:', r.sub_sector_code); continue; }
    await client.query(
      `INSERT INTO public.economic_activities (sub_sector_id, sector_id, code, name_ar, name_en, description, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (code) DO UPDATE SET
         sub_sector_id = EXCLUDED.sub_sector_id,
         sector_id = EXCLUDED.sector_id,
         name_ar = EXCLUDED.name_ar,
         name_en = EXCLUDED.name_en,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order`,
      [sub.id, sub.sector_id, r.code, r.name_ar, r.name_en, r.description || null, r.sort_order || 0]
    );
  }
  console.log(`Imported ${rows.length} activities`);
}

async function importActivityDetails(client, rows) {
  const { rows: activities } = await client.query('SELECT id, code FROM public.economic_activities');
  const actMap = Object.fromEntries(activities.map(a => [a.code, a.id]));

  for (const r of rows) {
    const activityId = actMap[r.activity_code];
    if (!activityId) { console.warn('Activity not found:', r.activity_code); continue; }
    await client.query(
      `INSERT INTO public.economic_activity_details (activity_id, code, name_ar, name_en, description, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET
         activity_id = EXCLUDED.activity_id,
         name_ar = EXCLUDED.name_ar,
         name_en = EXCLUDED.name_en,
         description = EXCLUDED.description,
         sort_order = EXCLUDED.sort_order`,
      [activityId, r.code, r.name_ar, r.name_en, r.description || null, r.sort_order || 0]
    );
  }
  console.log(`Imported ${rows.length} activity details`);
}

async function importProjectModels(client, rows) {
  const { rows: details } = await client.query(
    `SELECT d.id, d.code, d.activity_id, a.sub_sector_id, s.sector_id
     FROM public.economic_activity_details d
     JOIN public.economic_activities a ON a.id = d.activity_id
     JOIN public.economic_sub_sectors s ON s.id = a.sub_sector_id`
  );
  const detailMap = Object.fromEntries(details.map(d => [d.code, d]));

  for (const r of rows) {
    const d = detailMap[r.activity_detail_code];
    if (!d) { console.warn('Activity detail not found:', r.activity_detail_code); continue; }
    await client.query(
      `INSERT INTO public.project_models
         (activity_detail_id, activity_id, sub_sector_id, sector_id, code, name_ar, name_en,
          size_category, model_type, capex_min, capex_max, revenue_min, revenue_max,
          employee_count_min, employee_count_max, typical_roi_months, is_published)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
       ON CONFLICT (code) DO UPDATE SET
         activity_detail_id = EXCLUDED.activity_detail_id,
         activity_id = EXCLUDED.activity_id,
         sub_sector_id = EXCLUDED.sub_sector_id,
         sector_id = EXCLUDED.sector_id,
         name_ar = EXCLUDED.name_ar,
         name_en = EXCLUDED.name_en,
         size_category = EXCLUDED.size_category,
         model_type = EXCLUDED.model_type,
         capex_min = EXCLUDED.capex_min,
         capex_max = EXCLUDED.capex_max,
         revenue_min = EXCLUDED.revenue_min,
         revenue_max = EXCLUDED.revenue_max,
         employee_count_min = EXCLUDED.employee_count_min,
         employee_count_max = EXCLUDED.employee_count_max,
         typical_roi_months = EXCLUDED.typical_roi_months,
         is_published = EXCLUDED.is_published`,
      [d.id, d.activity_id, d.sub_sector_id, d.sector_id, r.code, r.name_ar, r.name_en,
       r.size_category, r.model_type, r.capex_min, r.capex_max, r.revenue_min, r.revenue_max,
       r.employee_count_min, r.employee_count_max, r.typical_roi_months, r.is_published]
    );
  }
  console.log(`Imported ${rows.length} project models`);
}

async function importFinancialAssumptions(client, rows) {
  for (const r of rows) {
    await client.query(
      `INSERT INTO public.financial_assumptions (code, name_ar, name_en, category, unit_type, description, default_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (code) DO UPDATE SET
         name_ar = EXCLUDED.name_ar,
         name_en = EXCLUDED.name_en,
         category = EXCLUDED.category,
         unit_type = EXCLUDED.unit_type,
         description = EXCLUDED.description,
         default_value = EXCLUDED.default_value`,
      [r.code, r.name_ar, r.name_en, r.category, r.unit_type, r.description || null, r.default_value]
    );
  }
  console.log(`Imported ${rows.length} financial assumptions`);
}

async function batchInsert(client, table, columns, rows, onConflictClause, transformRow, batchSize = 500) {
  if (rows.length === 0) return;
  const quotedColumns = columns.map(c => `"${c}"`).join(',');
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const values = [];
    const params = [];
    let paramIndex = 1;
    for (const r of batch) {
      const rowValues = transformRow(r);
      values.push('(' + rowValues.map(() => `$${paramIndex++}`).join(',') + ')');
      params.push(...rowValues);
    }
    const sql = `INSERT INTO public.${table} (${quotedColumns}) VALUES ${values.join(',')} ${onConflictClause}`;
    await client.query(sql, params);
  }
}

async function importProjectModelAssumptions(client, rows) {
  const { rows: models } = await client.query('SELECT id, code FROM public.project_models');
  const { rows: assumptions } = await client.query('SELECT id, code FROM public.financial_assumptions');
  const modelMap = Object.fromEntries(models.map(m => [m.code, m.id]));
  const assumptionMap = Object.fromEntries(assumptions.map(a => [a.code, a.id]));

  const validRows = rows
    .map(r => {
      const modelId = modelMap[r.model_code];
      const assumptionId = assumptionMap[r.assumption_code];
      if (!modelId || !assumptionId) {
        console.warn('Missing model/assumption:', r.model_code, r.assumption_code);
        return null;
      }
      return { modelId, assumptionId, value: r.value };
    })
    .filter(Boolean);

  await batchInsert(
    client, 'project_model_assumptions',
    ['project_model_id', 'assumption_id', 'value'],
    validRows,
    'ON CONFLICT (project_model_id, assumption_id) DO UPDATE SET value = EXCLUDED.value',
    r => [r.modelId, r.assumptionId, r.value]
  );
  console.log(`Imported ${validRows.length} project model assumptions`);
}

async function importRiskFactors(client, rows) {
  await batchInsert(
    client, 'risk_factors',
    ['code', 'name_ar', 'name_en', 'category', 'default_score', 'description'],
    rows,
    `ON CONFLICT (code) DO UPDATE SET
       name_ar = EXCLUDED.name_ar,
       name_en = EXCLUDED.name_en,
       category = EXCLUDED.category,
       default_score = EXCLUDED.default_score,
       description = EXCLUDED.description`,
    r => [r.code, r.name_ar, r.name_en, r.category, r.default_score, r.description || null]
  );
  console.log(`Imported ${rows.length} risk factors`);
}

async function importProjectModelRisks(client, rows) {
  const { rows: models } = await client.query('SELECT id, code FROM public.project_models');
  const { rows: factors } = await client.query('SELECT id, code FROM public.risk_factors');
  const modelMap = Object.fromEntries(models.map(m => [m.code, m.id]));
  const factorMap = Object.fromEntries(factors.map(f => [f.code, f.id]));

  const validRows = rows
    .map(r => {
      const modelId = modelMap[r.model_code];
      const factorId = factorMap[r.risk_factor_code];
      if (!modelId || !factorId) {
        console.warn('Missing model/risk:', r.model_code, r.risk_factor_code);
        return null;
      }
      return { modelId, factorId, score: r.score };
    })
    .filter(Boolean);

  await batchInsert(
    client, 'project_model_risks',
    ['project_model_id', 'risk_factor_id', 'score'],
    validRows,
    'ON CONFLICT (project_model_id, risk_factor_id) DO UPDATE SET score = EXCLUDED.score',
    r => [r.modelId, r.factorId, r.score]
  );
  console.log(`Imported ${validRows.length} project model risks`);
}

async function importRegulatoryRequirements(client, rows) {
  const { rows: details } = await client.query(
    `SELECT d.id, d.code, d.activity_id, a.sub_sector_id, s.sector_id
     FROM public.economic_activity_details d
     JOIN public.economic_activities a ON a.id = d.activity_id
     JOIN public.economic_sub_sectors s ON s.id = a.sub_sector_id`
  );
  const detailMap = Object.fromEntries(details.map(d => [d.code, d]));

  const validRows = rows
    .map(r => {
      const d = detailMap[r.activity_detail_code];
      if (!d) {
        console.warn('Activity detail not found:', r.activity_detail_code);
        return null;
      }
      return { ...r, ...d };
    })
    .filter(Boolean);

  // Delete existing regulatory rows for the activity details we are about to import
  // to keep the import idempotent (the table has no unique constraint).
  const detailIds = [...new Set(validRows.map(r => r.id))];
  if (detailIds.length > 0) {
    await client.query('DELETE FROM public.regulatory_requirements WHERE activity_detail_id = ANY($1)', [detailIds]);
  }

  await batchInsert(
    client, 'regulatory_requirements',
    ['sector_id', 'sub_sector_id', 'activity_id', 'activity_detail_id', 'requirement_name_ar', 'requirement_name_en', 'issuing_authority', 'estimated_cost', 'mandatory', 'sort_order'],
    validRows,
    '',
    r => [r.sector_id, r.sub_sector_id, r.activity_id, r.id, r.requirement_name_ar, r.requirement_name_en || null,
          r.issuing_authority || null, r.estimated_cost, r.mandatory, r.sort_order || 0]
  );
  console.log(`Imported ${validRows.length} regulatory requirements`);
}

async function importCities(client, rows) {
  for (const r of rows) {
    const derivedCountryCode = r.code ? String(r.code).split('-')[0].toUpperCase() : (r.country_code || 'SA');
    const cityTypes = r.city_types
      ? String(r.city_types).split(';').map(s => s.trim()).filter(Boolean)
      : null;
    await client.query(
      `INSERT INTO public.cities (code, name_ar, name_en, region, country_code, population, avg_household_income, purchasing_power_index, city_types)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (code) DO UPDATE SET
         name_ar = EXCLUDED.name_ar,
         name_en = EXCLUDED.name_en,
         region = EXCLUDED.region,
         country_code = EXCLUDED.country_code,
         population = EXCLUDED.population,
         avg_household_income = EXCLUDED.avg_household_income,
         purchasing_power_index = EXCLUDED.purchasing_power_index,
         city_types = COALESCE(EXCLUDED.city_types, public.cities.city_types)`,
      [r.code, r.name_ar, r.name_en, r.region, derivedCountryCode, r.population, r.avg_household_income, r.purchasing_power_index, cityTypes]
    );
  }
  console.log(`Imported ${rows.length} cities`);
}

async function main() {
  const env = loadEnvLocal();
  if (!env.SUPABASE_DB_URL) throw new Error('SUPABASE_DB_URL missing');

  const client = new Client({
    connectionString: env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  console.log('Connected to database.\n');

  const dataDir = path.join(__dirname, '..', 'master-data');

  try {
    await importSectors(client, parseCsv(path.join(dataDir, 'sectors.csv')));
    await importSubSectors(client, parseCsv(path.join(dataDir, 'sub-sectors.csv')));
    await importActivities(client, parseCsv(path.join(dataDir, 'activities.csv')));
    await importActivityDetails(client, parseCsv(path.join(dataDir, 'activity-details.csv')));
    await importProjectModels(client, parseCsv(path.join(dataDir, 'project-models.csv')));
    await importFinancialAssumptions(client, parseCsv(path.join(dataDir, 'financial-assumptions.csv')));
    await importProjectModelAssumptions(client, parseCsv(path.join(dataDir, 'project-model-assumptions.csv')));
    await importRiskFactors(client, parseCsv(path.join(dataDir, 'risk-factors.csv')));
    await importProjectModelRisks(client, parseCsv(path.join(dataDir, 'project-model-risks.csv')));
    await importRegulatoryRequirements(client, parseCsv(path.join(dataDir, 'regulatory-requirements.csv')));
    await importCities(client, parseCsv(path.join(dataDir, 'cities.csv')));
    await importCities(client, parseCsv(path.join(dataDir, 'special-city-types.csv')));

    console.log("\n Master data import complete");
  } catch (err) {
    console.error("\n Import failed:", err.message);
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(() => process.exit(1));
