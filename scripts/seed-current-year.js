/**
 * Seed production data for the current year by copying previous-year rows.
 *
 * Usage:
 *   node scripts/seed-current-year.js [sourceYear] [targetYear]
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnvLocal() {
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
  const env = loadEnvLocal();
  const sourceYear = parseInt(process.argv[2] || '2025', 10);
  const targetYear = parseInt(process.argv[3] || new Date().getFullYear(), 10);

  if (!env.SUPABASE_DB_URL) {
    throw new Error('SUPABASE_DB_URL not found in .env.local');
  }

  const client = new Client({ connectionString: env.SUPABASE_DB_URL });
  await client.connect();

  try {
    console.log(`Copying ${sourceYear} -> ${targetYear} ...`);

    const benchmarks = await client.query(`
      INSERT INTO public.country_benchmarks (country_code, metric_code, benchmark_value, year, source, created_at, updated_at)
      SELECT country_code, metric_code, benchmark_value, $2, source, NOW(), NOW()
      FROM public.country_benchmarks
      WHERE year = $1
      ON CONFLICT (country_code, metric_code, year) DO NOTHING;
    `, [sourceYear, targetYear]);
    console.log(`  country_benchmarks: ${benchmarks.rowCount} rows`);

    const market = await client.query(`
      INSERT INTO public.city_market_data (
        city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
        avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score,
        opportunity_score, opportunity_rank, data_year, source, created_at, updated_at
      )
      SELECT
        city_id, activity_id, competitors_count, avg_market_share, avg_rent_per_sqm,
        avg_land_price_per_sqm, avg_salary, labor_availability_score, market_saturation_score,
        opportunity_score, opportunity_rank, $2, source, NOW(), NOW()
      FROM public.city_market_data
      WHERE data_year = $1
      ON CONFLICT (city_id, activity_id, data_year) DO NOTHING;
    `, [sourceYear, targetYear]);
    console.log(`  city_market_data: ${market.rowCount} rows`);

    const indicators = await client.query(`
      INSERT INTO public.city_indicators (
        city_id, year, gdp_city, growth_rate, unemployment_rate, establishments_count, inflation_rate,
        business_ease_index, avg_rent_per_sqm, avg_land_price_per_sqm, warehouse_rent_per_sqm,
        factory_rent_per_sqm, new_licenses_count, investment_volume, saturation_index, overall_confidence,
        metadata, updated_at
      )
      SELECT
        city_id, $2, gdp_city, growth_rate, unemployment_rate, establishments_count, inflation_rate,
        business_ease_index, avg_rent_per_sqm, avg_land_price_per_sqm, warehouse_rent_per_sqm,
        factory_rent_per_sqm, new_licenses_count, investment_volume, saturation_index, overall_confidence,
        metadata, NOW()
      FROM public.city_indicators
      WHERE year = $1
      ON CONFLICT (city_id, year) DO NOTHING;
    `, [sourceYear, targetYear]);
    console.log(`  city_indicators: ${indicators.rowCount} rows`);

    console.log('Done.');
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
