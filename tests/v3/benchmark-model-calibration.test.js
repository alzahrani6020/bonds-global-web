'use strict';

const fs = require('fs');
const path = require('path');
const { getActivityCategory } = require('../../v3/engine/data-acquisition/adapters/BenchmarkAdapter');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');
const migration = read('supabase/migrations/20261104181100_benchmark_model_financial_calibration.sql');
const pricing = JSON.parse(read('v3/engine/data-acquisition/benchmarks/pricing.json'));
const market = JSON.parse(read('v3/engine/data-acquisition/benchmarks/market.json'));
const generator = read('scripts/generate-benchmark-model-calibration.js');
const sizeProfiles = read('v3/scripts/generate-master-data.js');
const variants = read('v3/scripts/generate-model-variants.js');

function roundMoney(n) {
  return Math.max(1000, Math.round(Number(n) / 1000) * 1000);
}

describe('benchmark model financial calibration', () => {
  test('maps the five missing activities to documented benchmark categories', () => {
    expect(getActivityCategory('beauty')).toBe('beauty');
    expect(getActivityCategory('gym')).toBe('gym');
    expect(getActivityCategory('dermatology_clinics')).toBe('medical_clinic');
    expect(getActivityCategory('ophthalmology_clinics')).toBe('medical_clinic');
    expect(getActivityCategory('pediatric_clinics')).toBe('medical_clinic');
  });

  test('uses documented size bases, multipliers and benchmark files only', () => {
    expect(sizeProfiles).toMatch(/capex_min:\s*100000/);
    expect(sizeProfiles).toMatch(/capex_min:\s*400000/);
    expect(sizeProfiles).toMatch(/capex_min:\s*1500000/);
    expect(variants).toContain('multiplier: 1.5');
    expect(variants).toContain('multiplier: 3');
    expect(migration).toContain('v3/engine/data-acquisition/benchmarks/pricing.json');
    expect(migration).toContain('v3/engine/data-acquisition/benchmarks/market.json');
    expect(migration).toContain('BenchmarkAdapter');
    expect(migration).toContain('ليست معياراً حكومياً');
    expect(generator).toContain("require('../v3/engine/data-acquisition/adapters/BenchmarkAdapter')");
  });

  test('calibrates clones and publishes 15 documented models without deleting or remapping FKs', () => {
    expect(migration).toContain("UPDATE public.project_models pm");
    expect(migration).toContain("pm.code NOT IN ('small_dental_clinic_model'");
    expect(migration).toContain("'beauty_small_model'");
    expect(migration).toContain("'gym_small_model'");
    expect(migration).toContain("'dermatology_clinics_small_model'");
    expect(migration).toContain("'ophthalmology_clinics_small_model'");
    expect(migration).toContain("'pediatric_clinics_small_model'");
    expect(migration).toContain('ON CONFLICT (code) DO UPDATE');
    expect(migration).toContain("WHEN 'bonds_benchmark_v1' = ANY(pm.tags) THEN pm.tags");
    expect(migration).toContain('CROSS JOIN size_mult sm');
    expect(migration).toContain('AND sm.size_category = pm.size_category');
    expect(migration).toContain('small_dental_clinic_model');
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.project_models/i);
    expect(migration).not.toMatch(/UPDATE\s+public\.project_models\s+SET\s+activity_id/i);
  });

  test('beauty and gym inserts scale the documented size bases by benchmark factors', () => {
    const beautyCapex = pricing.activities.beauty.equipment_cost_avg / pricing.activities.default.equipment_cost_avg;
    const beautyRev = market.activities.beauty.per_capita_spending / market.activities.default.per_capita_spending;
    expect(migration).toContain(`${roundMoney(100000 * beautyCapex)}, ${roundMoney(300000 * beautyCapex)}, ${roundMoney(200000 * beautyRev)}, ${roundMoney(500000 * beautyRev)}`);
    expect(migration).toContain("('beauty', 'beauty', 1.083333, 1.333333");

    const gymCapex = pricing.activities.gym.equipment_cost_avg / pricing.activities.default.equipment_cost_avg;
    const gymRev = market.activities.gym.per_capita_spending / market.activities.default.per_capita_spending;
    expect(migration).toContain(`${roundMoney(100000 * gymCapex)}, ${roundMoney(300000 * gymCapex)}, ${roundMoney(200000 * gymRev)}, ${roundMoney(500000 * gymRev)}`);
    expect(migration).toContain("('gym', 'gym', 2.083333, 1.166667");
  });

  test('specialty clinic inserts scale documented dental ranges by medical_clinic equipment ratio', () => {
    const clinicFactor =
      pricing.activities.medical_clinic.equipment_cost_avg /
      pricing.activities.dental_clinics.equipment_cost_avg;
    expect(clinicFactor).toBe(0.7);
    expect(migration).toContain(`${roundMoney(250000 * clinicFactor)}, ${roundMoney(450000 * clinicFactor)}, ${roundMoney(400000 * clinicFactor)}, ${roundMoney(700000 * clinicFactor)}`);
    expect(migration).toContain("donor.code = 'small_dental_clinic_model'");
    expect(migration).toContain("donor.code = 'medium_dental_clinic_model'");
    expect(migration).toContain("donor.code = 'large_dental_clinic_model'");
  });
});
