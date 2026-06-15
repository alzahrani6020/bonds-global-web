/**
 * Test multi-country city adjustments.
 * Calculates the same project model in Riyadh, Dubai, and Cairo.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { loadProjectModel, createSupabaseClient } = require('../engine/loader');
const { calculate } = require('../engine/calculator');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const env = {};
  if (!fs.existsSync(envPath)) throw new Error('.env.local not found');
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const [k, ...r] = t.split('=');
    if (k && r.length > 0) env[k.trim()] = r.join('=').trim();
  });
  return env;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const modelCode = process.argv[2] || 'medium_dental_clinic_model';
  const cities = ['RUH', 'DXB', 'CAI', 'AMM', 'DOH'];

  console.log(`\nTesting model "${modelCode}" across cities:\n`);
  console.log('City     | NPV          | IRR    | Payback | Risk | Confidence');
  console.log('---------|--------------|--------|---------|------|------------');

  for (const cityCode of cities) {
    try {
      const modelData = await loadProjectModel(supabase, modelCode, cityCode);
      const result = calculate(modelData);
      const { npv, irr, paybackMonths } = result.summary;
      const risk = result.risk?.score ?? '-';
      const confidence = result.cityIndicators?.overall_confidence ?? '-';
      console.log(`${cityCode.padEnd(8)} | ${String(npv != null ? Math.round(npv) : '-').padStart(12)} | ${irr != null ? (irr * 100).toFixed(1) : '-'}% | ${paybackMonths != null ? paybackMonths.toFixed(0) + ' mo' : '-'}  | ${String(risk).padStart(4)} | ${confidence}%`);
    } catch (err) {
      console.log(`${cityCode.padEnd(8)} | ERROR: ${err.message}`);
    }
  }
}

main().catch(err => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
