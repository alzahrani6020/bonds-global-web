/**
 * Bonds V3 — Seed official country-level statistics.
 *
 * Sources: World Bank, IMF, national statistics bureaus (2024-2025 estimates).
 * These are used as ground truth to estimate city-level indicators.
 */

const { Client } = require('pg');

// 2024-2025 official estimates (World Bank / IMF / national bureaus)
const OFFICIAL_DATA = {
  SA: {
    gdp_per_capita: 32500,
    growth_rate: 3.2,
    unemployment_rate: 5.2,
    inflation_rate: 2.4,
    business_ease_index: 78,
    source: 'World Bank / GASTAT 2024'
  },
  AE: {
    gdp_per_capita: 49000,
    growth_rate: 3.5,
    unemployment_rate: 3.1,
    inflation_rate: 3.2,
    business_ease_index: 88,
    source: 'World Bank / UAE FCSA 2024'
  },
  EG: {
    gdp_per_capita: 3800,
    growth_rate: 3.8,
    unemployment_rate: 7.2,
    inflation_rate: 25.0,
    business_ease_index: 55,
    source: 'World Bank / CAPMAS 2024'
  },
  QA: {
    gdp_per_capita: 88000,
    growth_rate: 2.1,
    unemployment_rate: 0.1,
    inflation_rate: 2.9,
    business_ease_index: 82,
    source: 'World Bank / Qatar PSA 2024'
  },
  JO: {
    gdp_per_capita: 4700,
    growth_rate: 2.6,
    unemployment_rate: 21.0,
    inflation_rate: 3.5,
    business_ease_index: 58,
    source: 'World Bank / Jordan DOS 2024'
  },
  KW: {
    gdp_per_capita: 36000,
    growth_rate: 2.4,
    unemployment_rate: 2.1,
    inflation_rate: 3.0,
    business_ease_index: 70,
    source: 'World Bank / Kuwait CSB 2024'
  },
  BH: {
    gdp_per_capita: 28000,
    growth_rate: 2.7,
    unemployment_rate: 3.8,
    inflation_rate: 2.5,
    business_ease_index: 68,
    source: 'World Bank / Bahrain CIO 2024'
  },
  OM: {
    gdp_per_capita: 19000,
    growth_rate: 2.9,
    unemployment_rate: 4.5,
    inflation_rate: 2.6,
    business_ease_index: 65,
    source: 'World Bank / Oman NCSI 2024'
  },
  IQ: {
    gdp_per_capita: 5600,
    growth_rate: 3.5,
    unemployment_rate: 14.0,
    inflation_rate: 4.5,
    business_ease_index: 40,
    source: 'World Bank / Iraq CSO 2024'
  },
  LB: {
    gdp_per_capita: 4100,
    growth_rate: 1.2,
    unemployment_rate: 12.0,
    inflation_rate: 90.0,
    business_ease_index: 45,
    source: 'World Bank / IMF 2024'
  },
  SY: {
    gdp_per_capita: 900,
    growth_rate: 1.5,
    unemployment_rate: 20.0,
    inflation_rate: 60.0,
    business_ease_index: 35,
    source: 'World Bank / IMF 2024'
  },
  PS: {
    gdp_per_capita: 3800,
    growth_rate: 2.0,
    unemployment_rate: 18.0,
    inflation_rate: 3.8,
    business_ease_index: 42,
    source: 'World Bank / PCBS 2024'
  },
  TN: {
    gdp_per_capita: 3900,
    growth_rate: 2.2,
    unemployment_rate: 15.0,
    inflation_rate: 7.5,
    business_ease_index: 52,
    source: 'World Bank / INS Tunisia 2024'
  },
  DZ: {
    gdp_per_capita: 4300,
    growth_rate: 2.8,
    unemployment_rate: 11.5,
    inflation_rate: 9.0,
    business_ease_index: 48,
    source: 'World Bank / ONS Algeria 2024'
  },
  MA: {
    gdp_per_capita: 3900,
    growth_rate: 3.0,
    unemployment_rate: 10.5,
    inflation_rate: 6.0,
    business_ease_index: 55,
    source: 'World Bank / HCP Morocco 2024'
  },
  LY: {
    gdp_per_capita: 6500,
    growth_rate: 1.8,
    unemployment_rate: 19.0,
    inflation_rate: 12.0,
    business_ease_index: 38,
    source: 'World Bank / IMF 2024'
  },
  SD: {
    gdp_per_capita: 750,
    growth_rate: 1.5,
    unemployment_rate: 22.0,
    inflation_rate: 35.0,
    business_ease_index: 36,
    source: 'World Bank / IMF 2024'
  },
  YE: {
    gdp_per_capita: 650,
    growth_rate: 1.0,
    unemployment_rate: 25.0,
    inflation_rate: 20.0,
    business_ease_index: 32,
    source: 'World Bank / IMF 2024'
  },
  SO: {
    gdp_per_capita: 450,
    growth_rate: 2.5,
    unemployment_rate: 20.0,
    inflation_rate: 6.0,
    business_ease_index: 30,
    source: 'World Bank / IMF 2024'
  },
  DJ: {
    gdp_per_capita: 3100,
    growth_rate: 5.0,
    unemployment_rate: 25.0,
    inflation_rate: 3.5,
    business_ease_index: 50,
    source: 'World Bank / IMF 2024'
  },
  MR: {
    gdp_per_capita: 2300,
    growth_rate: 3.5,
    unemployment_rate: 18.0,
    inflation_rate: 7.0,
    business_ease_index: 42,
    source: 'World Bank / IMF 2024'
  },
  KM: {
    gdp_per_capita: 1500,
    growth_rate: 3.0,
    unemployment_rate: 12.0,
    inflation_rate: 5.0,
    business_ease_index: 40,
    source: 'World Bank / IMF 2024'
  }
};

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
    let inserted = 0;

    for (const [countryCode, data] of Object.entries(OFFICIAL_DATA)) {
      const metrics = [
        { code: 'gdp_per_capita', value: data.gdp_per_capita },
        { code: 'growth_rate', value: data.growth_rate },
        { code: 'unemployment_rate', value: data.unemployment_rate },
        { code: 'inflation_rate', value: data.inflation_rate },
        { code: 'business_ease_index', value: data.business_ease_index }
      ];

      for (const metric of metrics) {
        await client.query(`
          INSERT INTO public.official_country_data (country_code, year, metric_code, value, source, confidence, metadata)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          ON CONFLICT (country_code, year, metric_code) DO UPDATE SET
            value = EXCLUDED.value,
            source = EXCLUDED.source,
            confidence = EXCLUDED.confidence,
            metadata = EXCLUDED.metadata,
            updated_at = NOW()
        `, [countryCode, year, metric.code, metric.value, data.source, 90, JSON.stringify({ official: true })]);
        inserted++;
      }
      console.log(`✓ ${countryCode}: 5 official metrics inserted`);
    }

    console.log(`\n✅ Done. Inserted/updated ${inserted} official country metrics.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
