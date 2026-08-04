/**
 * Bonds V3 — Enrich market data for ALL modern cities using economic formulas.
 *
 * Applies the same rigorous model used for key cities to all 818 modern cities,
 * while preserving higher-quality data already present for key cities.
 */

const { Client } = require('pg');

const ACTIVITY_CODES = [
  'restaurant', 'cafe', 'supermarket', 'pharmacy', 'gym', 'beauty',
  'mobile_shop', 'clothing_shop', 'hotel_boutique', 'kindergarten', 'short_delivery',
  'bakery', 'food_truck', 'burger_restaurant'
];

const SPENDING_PER_CAPITA = {
  restaurant: 2500,
  cafe: 1200,
  supermarket: 4000,
  pharmacy: 800,
  gym: 1000,
  beauty: 1500,
  mobile_shop: 1000,
  clothing_shop: 2000,
  hotel_boutique: 300,
  kindergarten: 500,
  short_delivery: 600,
  bakery: 800,
  food_truck: 400,
  burger_restaurant: 1500
};

const SALARY_MULTIPLIER = {
  restaurant: 0.45,
  cafe: 0.42,
  supermarket: 0.40,
  pharmacy: 0.55,
  gym: 0.45,
  beauty: 0.40,
  mobile_shop: 0.48,
  clothing_shop: 0.42,
  hotel_boutique: 0.50,
  kindergarten: 0.38,
  short_delivery: 0.35,
  bakery: 0.40,
  food_truck: 0.35,
  burger_restaurant: 0.43
};

const PEOPLE_PER_COMPETITOR = {
  supermarket: 80000,
  pharmacy: 6000,
  restaurant: 2500,
  cafe: 5000,
  mobile_shop: 8000,
  clothing_shop: 12000,
  gym: 7000,
  beauty: 9000,
  hotel_boutique: 30000,
  kindergarten: 15000,
  short_delivery: 10000,
  bakery: 6000,
  food_truck: 12000,
  burger_restaurant: 4000
};

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
  return h;
}

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(" Please set SUPABASE_DB_URL or DATABASE_URL");
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const year = new Date().getFullYear();

    // Get official GDP per capita
    const { rows: gdpRows } = await client.query(`
      SELECT country_code, value FROM public.official_country_data
      WHERE year = $1 AND metric_code = 'gdp_per_capita'
    `, [year]);
    const gdpPerCapita = new Map(gdpRows.map(r => [r.country_code, Number(r.value)]));

    // Get all modern cities with population
    const { rows: cities } = await client.query(`
      SELECT c.id, c.code, c.name_ar, c.country_code, c.population
      FROM public.cities c
      WHERE c.code LIKE '__-__-___' ESCAPE '\\'
      ORDER BY c.country_code, c.name_ar
    `);

    // Get activity IDs
    const { rows: activities } = await client.query(`
      SELECT id, code FROM public.economic_activities
      WHERE code = ANY($1::text[])
    `, [ACTIVITY_CODES]);

    // Fetch existing high-confidence key city rows in one query
    const { rows: existingRows } = await client.query(`
      SELECT city_id, activity_id, source, confidence
      FROM public.city_market_data
      WHERE data_year = $1 AND source = 'key_city_economic_model' AND confidence >= 65
    `, [year]);
    const existingSet = new Set(existingRows.map(r => `${r.city_id}|${r.activity_id}`));

    let updated = 0;
    let skipped = 0;
    const rows = [];

    for (const city of cities) {
      const pop = Number(city.population) || 1000000;
      const countryGdp = gdpPerCapita.get(city.country_code) || 5000;
      const countryGdpSAR = countryGdp * 3.75;

      for (const activity of activities) {
        if (existingSet.has(`${city.id}|${activity.id}`)) {
          skipped++;
          continue;
        }

        const spend = SPENDING_PER_CAPITA[activity.code] || 1000;
        const salaryMult = SALARY_MULTIPLIER[activity.code] || 0.4;
        const peoplePerComp = PEOPLE_PER_COMPETITOR[activity.code] || 10000;

        const seed = hashCode(city.code + activity.code);
        const variation = (pseudoRandom(seed) - 0.5) * 0.2;

        const marketSize = Math.round(pop * spend * (countryGdpSAR / 80000) * (1 + variation));
        const compVariation = 0.85 + pseudoRandom(seed + 1) * 0.3;
        const competitorsCount = Math.max(1, Math.round((pop / peoplePerComp) * compVariation));
        const expectedCompetitors = pop / peoplePerComp;
        const saturationScore = Math.min(95, Math.round((competitorsCount / expectedCompetitors) * 70));
        const avgSalary = Math.round(countryGdpSAR * salaryMult / 12);

        const marketSizeScore = Math.min(40, Math.log10(marketSize + 1) * 4);
        const saturationPenalty = saturationScore * 0.35;
        const gdpBonus = Math.min(15, countryGdpSAR / 20000);
        const opportunityScore = Math.round(Math.max(20, Math.min(85, 50 + marketSizeScore - saturationPenalty + gdpBonus)));

        rows.push({
          city_id: city.id,
          activity_id: activity.id,
          data_year: year,
          market_size: marketSize,
          competitors_count: competitorsCount,
          market_saturation_score: saturationScore,
          avg_salary: avgSalary,
          opportunity_score: opportunityScore,
          source: 'economic_model_population_weighted',
          confidence: 50
        });

        updated++;
      }

      if ((updated + skipped) % 2000 === 0) {
        console.log(`Prepared ${updated} rows, skipped ${skipped}...`);
      }
    }

    // Delete old low-confidence rows and insert new ones in bulk
    console.log(`\nDeleting old low-confidence rows for ${ACTIVITY_CODES.length} activities...`);
    const activityIds = activities.map(a => a.id);
    await client.query(`
      DELETE FROM public.city_market_data
      WHERE data_year = $1
        AND activity_id = ANY($2::uuid[])
        AND NOT (source = 'key_city_economic_model' AND confidence >= 65)
    `, [year, activityIds]);

    console.log(`Inserting ${rows.length} rows in bulk...`);
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      await client.query(`
        INSERT INTO public.city_market_data (
          city_id, activity_id, data_year, market_size, competitors_count,
          market_saturation_score, avg_salary, opportunity_score, source, confidence,
          created_at, updated_at
        )
        SELECT x.city_id, x.activity_id, x.data_year, x.market_size, x.competitors_count,
               x.market_saturation_score, x.avg_salary, x.opportunity_score, x.source, x.confidence,
               NOW(), NOW()
        FROM jsonb_to_recordset($1::jsonb) AS x(
          city_id uuid,
          activity_id uuid,
          data_year int,
          market_size numeric,
          competitors_count int,
          market_saturation_score numeric,
          avg_salary numeric,
          opportunity_score numeric,
          source text,
          confidence numeric
        )
        ON CONFLICT (city_id, activity_id, data_year) DO UPDATE SET
          market_size = EXCLUDED.market_size,
          competitors_count = EXCLUDED.competitors_count,
          market_saturation_score = EXCLUDED.market_saturation_score,
          avg_salary = EXCLUDED.avg_salary,
          opportunity_score = EXCLUDED.opportunity_score,
          source = EXCLUDED.source,
          confidence = EXCLUDED.confidence,
          updated_at = NOW()
      `, [JSON.stringify(batch)]);
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} - ${Math.min(i + batchSize, rows.length)}`);
    }

    console.log(`\n Done. Updated ${updated} rows. Skipped ${skipped} high-confidence key-city rows.`);
  } catch (err) {
    console.error(" Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
