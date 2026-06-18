/**
 * Bonds V3 — Apply confidence grading to city_indicators and city_market_data.
 *
 * Confidence scale:
 *   90%: manual/admin verified data
 *   80%: key city enriched estimates
 *   70%: data engine output (gastat, sama, uae_stats, etc.)
 *   60%: country/region average estimate
 *   30%: coarse backfill / unknown source
 */

const { Client } = require('pg');

const INDICATOR_CONFIDENCE = {
  'manual': 95,
  'admin': 95,
  'official': 85,
  'key_city_research_estimate': 80,
  'country_average_estimate': 60,
  'gastat': 75,
  'sama': 75,
  'uae_stats': 75,
  'egypt_capmas': 75,
  'qatar_psa': 75,
  'jordan_dos': 75
};

const MARKET_CONFIDENCE = {
  'manual': 95,
  'admin': 95,
  'economic_model': 70,
  'key_city_enriched_estimate': 60,
  'country_average_estimate': 30,
  'data_engine': 70,
  'engine': 70,
  'llm_estimation': 40,
  'generated': 35,
  'sample': 40,
  'dataset': 50,
  'bonds market dataset': 50
};

function scoreFromSource(source, map) {
  if (!source) return 30;
  const key = Object.keys(map).find(k => source.toLowerCase().includes(k.toLowerCase()));
  return key ? map[key] : 30;
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('❌ Please set SUPABASE_DB_URL or DATABASE_URL');
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const year = new Date().getFullYear();

    // Update city_indicators
    const { rows: indicatorSources } = await client.query(`
      SELECT DISTINCT COALESCE(metadata->>'source', '') AS source
      FROM public.city_indicators
      WHERE year = $1
    `, [year]);

    for (const row of indicatorSources) {
      const source = row.source || '';
      const confidence = scoreFromSource(source, INDICATOR_CONFIDENCE);
      const { rowCount } = await client.query(`
        UPDATE public.city_indicators
        SET overall_confidence = $1
        WHERE year = $2 AND COALESCE(metadata->>'source', '') = $3
      `, [confidence, year, source]);
      console.log(`✓ Indicators source "${source || '(empty)'}" → confidence ${confidence}% (${rowCount} rows)`);
    }

    // Update city_market_data
    const { rows: marketSources } = await client.query(`
      SELECT DISTINCT COALESCE(source, '') AS source
      FROM public.city_market_data
      WHERE data_year = $1
    `, [year]);

    for (const row of marketSources) {
      const source = row.source || '';
      const confidence = scoreFromSource(source, MARKET_CONFIDENCE);
      const { rowCount } = await client.query(`
        UPDATE public.city_market_data
        SET confidence = $1
        WHERE data_year = $2 AND COALESCE(source, '') = $3
      `, [confidence, year, source]);
      console.log(`✓ Market source "${source || '(empty)'}" → confidence ${confidence}% (${rowCount} rows)`);
    }

    console.log('\n✅ Confidence grading applied.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
