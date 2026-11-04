'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
const { getActivityCategory } = require('../v3/engine/data-acquisition/adapters/BenchmarkAdapter');

const pricing = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../v3/engine/data-acquisition/benchmarks/pricing.json'),
  'utf8'
));
const market = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../v3/engine/data-acquisition/benchmarks/market.json'),
  'utf8'
));

const SIZE_BASE = {
  small: { capex: [100000, 300000], revenue: [200000, 500000], emp: [2, 5], roi: 18, mult: 1, ar: 'صغير', en: 'Small' },
  medium: { capex: [400000, 1000000], revenue: [800000, 2000000], emp: [6, 15], roi: 24, mult: 1.5, ar: 'متوسط', en: 'Medium' },
  large: { capex: [1500000, 5000000], revenue: [2500000, 8000000], emp: [16, 40], roi: 36, mult: 3, ar: 'كبير', en: 'Large' }
};

const DENTAL = {
  small: { capex: [250000, 450000], revenue: [400000, 700000], emp: [2, 4], roi: 18 },
  medium: { capex: [600000, 1200000], revenue: [1000000, 2000000], emp: [5, 10], roi: 24 },
  large: { capex: [1500000, 3000000], revenue: [2500000, 5000000], emp: [12, 25], roi: 36 }
};

const DENTAL_EXCLUDE = [
  'small_dental_clinic_model',
  'medium_dental_clinic_model',
  'large_dental_clinic_model'
];

const MISSING = [
  { activityCode: 'beauty', modelPrefix: 'beauty', analog: 'size_base' },
  { activityCode: 'gym', modelPrefix: 'gym', analog: 'size_base' },
  { activityCode: 'dermatology_clinics', modelPrefix: 'dermatology_clinics', analog: 'dental' },
  { activityCode: 'ophthalmology_clinics', modelPrefix: 'ophthalmology_clinics', analog: 'dental' },
  { activityCode: 'pediatric_clinics', modelPrefix: 'pediatric_clinics', analog: 'dental' }
];

function roundMoney(n) {
  return Math.max(1000, Math.round(Number(n) / 1000) * 1000);
}

function pricingFor(category) {
  return pricing.activities[category] || pricing.activities.default;
}

function marketFor(category) {
  return market.activities[category] || market.activities.default;
}

function factorsFor(activityCode) {
  const category = getActivityCategory(activityCode);
  const p = pricingFor(category);
  const m = marketFor(category);
  return {
    category,
    capexFactor: p.equipment_cost_avg / pricing.activities.default.equipment_cost_avg,
    revenueFactor: m.per_capita_spending / market.activities.default.per_capita_spending,
    p
  };
}

function sqlStr(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function titleCase(value) {
  return String(value).replace(/\b\w/g, ch => ch.toUpperCase());
}

function modelCode(item, size) {
  return `${item.modelPrefix}_${size}_model`;
}

async function main() {
  const password = process.env.BONDS_MIGRATE_PASSWORD;
  if (!password) {
    throw new Error('BONDS_MIGRATE_PASSWORD is required to list canonical activity codes');
  }

  const client = new Client({
    host: 'aws-1-eu-central-1.pooler.supabase.com',
    port: 5432,
    user: 'postgres.hutxsqzplyuqgnghsrcs',
    password,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  const { rows: activities } = await client.query(`
    SELECT code FROM canonical_activities
    WHERE is_active IS TRUE AND superseded_by IS NULL
    ORDER BY code
  `);
  const { rows: missingRows } = await client.query(`
    SELECT
      a.code,
      a.name_ar,
      a.name_en,
      s.name_ar AS sector_ar,
      s.name_en AS sector_en
    FROM canonical_activities a
    LEFT JOIN canonical_activity_investment_sectors cais
      ON cais.canonical_activity_id = a.id AND cais.is_primary IS TRUE
    LEFT JOIN canonical_investment_sectors s ON s.id = cais.sector_id
    WHERE a.code = ANY($1)
    ORDER BY a.code
  `, [MISSING.map(row => row.activityCode)]);
  await client.end();

  const clinicFactor =
    pricing.activities.medical_clinic.equipment_cost_avg /
    pricing.activities.dental_clinics.equipment_cost_avg;

  const newModelCodes = MISSING.flatMap(item =>
    ['small', 'medium', 'large'].map(size => modelCode(item, size))
  );
  const excludedCodes = [...DENTAL_EXCLUDE, ...newModelCodes];

  const factorValues = activities.map(row => {
    const f = factorsFor(row.code);
    return `    (${sqlStr(row.code)}, ${sqlStr(f.category)}, ${f.capexFactor.toFixed(6)}, ${f.revenueFactor.toFixed(6)}, ${f.p.equipment_cost_min}, ${f.p.equipment_cost_avg}, ${f.p.equipment_cost_max}, ${f.p.monthly_operation_cost_min}, ${f.p.monthly_operation_cost_avg}, ${f.p.monthly_operation_cost_max}, ${f.p.construction_cost_per_sqm})`;
  }).join(',\n');

  const insertBlocks = MISSING.map(item => {
    const meta = missingRows.find(row => row.code === item.activityCode);
    if (!meta) throw new Error('Missing canonical activity ' + item.activityCode);
    const category = getActivityCategory(item.activityCode);
    const isClinic = item.analog === 'dental';
    return ['small', 'medium', 'large'].map(size => {
      const base = isClinic ? DENTAL[size] : SIZE_BASE[size];
      const f = isClinic
        ? { capexFactor: clinicFactor, revenueFactor: clinicFactor, p: pricingFor(category) }
        : factorsFor(item.activityCode);
      const capexMin = roundMoney(base.capex[0] * f.capexFactor);
      const capexMax = roundMoney(base.capex[1] * f.capexFactor);
      const revMin = roundMoney(base.revenue[0] * f.revenueFactor);
      const revMax = roundMoney(base.revenue[1] * f.revenueFactor);
      const code = modelCode(item, size);
      const nameAr = `نموذج ${meta.name_ar} — ${meta.sector_ar} (${SIZE_BASE[size].ar})`;
      const nameEn = `${SIZE_BASE[size].en} ${titleCase(meta.sector_en)} ${titleCase(meta.name_en)} Model`;
      const desc = 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.';
      const eqMult = SIZE_BASE[size].mult;
      const donorCode = isClinic
        ? `${size}_dental_clinic_model`
        : `advertising_cleaning_activity_${size}_model`;
      return `
INSERT INTO public.project_models (
  sector_id, sub_sector_id, activity_id, code, name_ar, name_en, description,
  model_type, size_category, default_currency,
  capex_min, capex_max, revenue_min, revenue_max,
  employee_count_min, employee_count_max, typical_roi_months,
  construction_cost_per_sqm,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  tags, is_published, is_active
)
SELECT
  a.sector_id, a.sub_sector_id, a.id,
  ${sqlStr(code)}, ${sqlStr(nameAr)}, ${sqlStr(nameEn)}, ${sqlStr(desc)},
  'greenfield', ${sqlStr(size)}, 'SAR',
  ${capexMin}, ${capexMax}, ${revMin}, ${revMax},
  ${base.emp[0]}, ${base.emp[1]}, ${base.roi},
  ${f.p.construction_cost_per_sqm},
  ${Math.round(f.p.equipment_cost_min * eqMult)}, ${Math.round(f.p.equipment_cost_avg * eqMult)}, ${Math.round(f.p.equipment_cost_max * eqMult)},
  ${Math.round(f.p.monthly_operation_cost_min * eqMult)}, ${Math.round(f.p.monthly_operation_cost_avg * eqMult)}, ${Math.round(f.p.monthly_operation_cost_max * eqMult)},
  ARRAY['bonds_benchmark_v1']::text[], true, true
FROM public.economic_activities a
WHERE a.code = ${sqlStr(item.activityCode)}
ON CONFLICT (code) DO UPDATE
SET
  capex_min = EXCLUDED.capex_min,
  capex_max = EXCLUDED.capex_max,
  revenue_min = EXCLUDED.revenue_min,
  revenue_max = EXCLUDED.revenue_max,
  employee_count_min = EXCLUDED.employee_count_min,
  employee_count_max = EXCLUDED.employee_count_max,
  typical_roi_months = EXCLUDED.typical_roi_months,
  construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
  equipment_cost_min = EXCLUDED.equipment_cost_min,
  equipment_cost_avg = EXCLUDED.equipment_cost_avg,
  equipment_cost_max = EXCLUDED.equipment_cost_max,
  monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
  monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
  monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
  description = EXCLUDED.description,
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  is_published = true,
  is_active = true,
  updated_at = NOW();

INSERT INTO public.project_model_assumptions (project_model_id, assumption_id, value)
SELECT nm.id, pma.assumption_id, pma.value
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = ${sqlStr(donorCode)}
JOIN public.project_model_assumptions pma ON pma.project_model_id = donor.id
WHERE nm.code = ${sqlStr(code)}
ON CONFLICT (project_model_id, assumption_id) DO NOTHING;

INSERT INTO public.project_model_risks (project_model_id, risk_factor_id, score, notes)
SELECT nm.id, pmr.risk_factor_id, pmr.score, pmr.notes
FROM public.project_models nm
JOIN public.project_models donor ON donor.code = ${sqlStr(donorCode)}
JOIN public.project_model_risks pmr ON pmr.project_model_id = donor.id
WHERE nm.code = ${sqlStr(code)}
ON CONFLICT (project_model_id, risk_factor_id) DO NOTHING;`;
    }).join('\n');
  }).join('\n');

  const sql = `-- Calibrate published project-model financials from Bonds internal benchmarks.
-- Sources: v3/engine/data-acquisition/benchmarks/pricing.json
-- and v3/engine/data-acquisition/benchmarks/market.json
-- via BenchmarkAdapter.getActivityCategory. Size multipliers match
-- v3/scripts/generate-model-variants.js (small 1 / medium 1.5 / large 3).
-- Clone size bases match v3/scripts/generate-master-data.js SIZE_PROFILES.
-- Dental clinic models keep their existing specialized ranges.
-- Specialty clinics scale the documented dental ranges by
-- medical_clinic.equipment_cost_avg / dental_clinics.equipment_cost_avg.
-- These are internal Bonds benchmarks, not official sector statistics.

WITH factors (
  activity_code, category, capex_factor, revenue_factor,
  equipment_cost_min, equipment_cost_avg, equipment_cost_max,
  monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
  construction_cost_per_sqm
) AS (
  VALUES
${factorValues}
),
size_mult (size_category, mult) AS (
  VALUES ('small'::text, 1.0), ('medium'::text, 1.5), ('large'::text, 3.0)
)
UPDATE public.project_models pm
SET
  capex_min = GREATEST(1000, ROUND((
    CASE pm.size_category WHEN 'small' THEN 100000 WHEN 'medium' THEN 400000 ELSE 1500000 END
    * f.capex_factor
  )::numeric / 1000) * 1000),
  capex_max = GREATEST(1000, ROUND((
    CASE pm.size_category WHEN 'small' THEN 300000 WHEN 'medium' THEN 1000000 ELSE 5000000 END
    * f.capex_factor
  )::numeric / 1000) * 1000),
  revenue_min = GREATEST(1000, ROUND((
    CASE pm.size_category WHEN 'small' THEN 200000 WHEN 'medium' THEN 800000 ELSE 2500000 END
    * f.revenue_factor
  )::numeric / 1000) * 1000),
  revenue_max = GREATEST(1000, ROUND((
    CASE pm.size_category WHEN 'small' THEN 500000 WHEN 'medium' THEN 2000000 ELSE 8000000 END
    * f.revenue_factor
  )::numeric / 1000) * 1000),
  construction_cost_per_sqm = f.construction_cost_per_sqm,
  equipment_cost_min = ROUND(f.equipment_cost_min * sm.mult),
  equipment_cost_avg = ROUND(f.equipment_cost_avg * sm.mult),
  equipment_cost_max = ROUND(f.equipment_cost_max * sm.mult),
  monthly_operation_cost_min = ROUND(f.monthly_operation_cost_min * sm.mult),
  monthly_operation_cost_avg = ROUND(f.monthly_operation_cost_avg * sm.mult),
  monthly_operation_cost_max = ROUND(f.monthly_operation_cost_max * sm.mult),
  description = 'مصدر مالي: v3/engine/data-acquisition/benchmarks/pricing.json و market.json عبر BenchmarkAdapter. ليست معياراً حكومياً.',
  tags = CASE
    WHEN pm.tags IS NULL THEN ARRAY['bonds_benchmark_v1']
    WHEN 'bonds_benchmark_v1' = ANY(pm.tags) THEN pm.tags
    ELSE pm.tags || ARRAY['bonds_benchmark_v1']
  END,
  updated_at = NOW()
FROM public.project_model_canonical_reconciliation r
JOIN public.canonical_activities ca ON ca.id = r.canonical_activity_id
JOIN factors f ON f.activity_code = ca.code
CROSS JOIN size_mult sm
WHERE pm.id = r.id
  AND sm.size_category = pm.size_category
  AND r.is_published IS TRUE
  AND r.is_active IS TRUE
  AND r.mapping_status = 'mapped'
  AND pm.size_category IN ('small', 'medium', 'large')
  AND pm.code NOT IN (${excludedCodes.map(sqlStr).join(', ')});
${insertBlocks}
`;

  const out = path.join(__dirname, '../supabase/migrations/20261104181100_benchmark_model_financial_calibration.sql');
  fs.writeFileSync(out, sql, 'utf8');
  console.log('wrote ' + out);
  console.log('activities=' + activities.length);
  console.log('new_models=' + newModelCodes.length);
  console.log('clinic_factor=' + clinicFactor);
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
