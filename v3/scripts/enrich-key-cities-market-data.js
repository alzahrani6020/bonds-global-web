/**
 * Bonds V3 — Enrich market data for key cities using realistic economic formulas.
 *
 * Replaces coarse estimates with calculated values based on:
 * - City population
 * - Country GDP per capita
 * - Activity-specific per-capita spending
 * - Realistic competitor density
 */

const { Client } = require('pg');

const KEY_CODES = [
  'SA-01-001','SA-02-001','SA-02-002','SA-03-001','SA-05-001','SA-05-002','SA-06-001','SA-07-001','SA-08-001','SA-04-001',
  'AE-01-001','AE-02-001','EG-01-001','EG-02-001','JO-01-001','QA-01-001','KW-01-001','BH-01-001','OM-01-001','IQ-01-001',
  'LB-01-001','SY-01-001','PS-01-001','TN-01-001','DZ-01-001','MA-01-001','LY-01-001','SD-01-001','YE-01-001','SO-01-001',
  'DJ-01-001','MR-01-001','KM-01-001'
];

// Annual per-capita spending in SAR by activity
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

// Average salary as multiplier of GDP per capita
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

    // Get key cities with population
    const { rows: cities } = await client.query(`
      SELECT c.id, c.code, c.name_ar, c.country_code, c.population
      FROM public.cities c
      WHERE c.code = ANY($1::text[])
    `, [KEY_CODES]);

    // Get activity IDs
    const { rows: activities } = await client.query(`
      SELECT id, code FROM public.economic_activities
      WHERE code = ANY($1::text[])
    `, [Object.keys(SPENDING_PER_CAPITA)]);

    let updated = 0;

    for (const city of cities) {
      const pop = Number(city.population) || 1000000;
      const countryGdp = gdpPerCapita.get(city.country_code) || 5000;

      for (const activity of activities) {
        const spend = SPENDING_PER_CAPITA[activity.code] || 1000;
        const salaryMult = SALARY_MULTIPLIER[activity.code] || 0.4;

        // Convert GDP per capita from USD to SAR (approx 3.75)
        const countryGdpSAR = countryGdp * 3.75;

        // Market size = population * per-capita spending * purchasing power adjustment
        const marketSize = Math.round(pop * spend * (countryGdpSAR / 80000));

        // Competitors: 1 per 50k-200k population depending on activity
        const peoplePerCompetitor = activity.code === 'supermarket' ? 80000 :
                                     activity.code === 'pharmacy' ? 6000 :
                                     activity.code === 'restaurant' ? 2500 :
                                     activity.code === 'cafe' ? 5000 :
                                     activity.code === 'mobile_shop' ? 8000 :
                                     activity.code === 'clothing_shop' ? 12000 :
                                     10000;
        const competitorsCount = Math.max(1, Math.round(pop / peoplePerCompetitor * (0.5 + Math.random() * 0.5)));

        // Saturation: 0-100 based on competitors per capita
        const saturationScore = Math.min(95, Math.round((competitorsCount / (pop / peoplePerCompetitor)) * 70));

        // Salary (monthly, in SAR)
        const avgSalary = Math.round(countryGdpSAR * salaryMult / 12);

        // Opportunity score: market attractiveness
        const marketSizeScore = Math.min(40, Math.log10(marketSize + 1) * 4);
        const saturationPenalty = saturationScore * 0.35;
        const gdpBonus = Math.min(15, countryGdpSAR / 20000);
        const opportunityScore = Math.round(Math.max(20, Math.min(85, 50 + marketSizeScore - saturationPenalty + gdpBonus)));

        await client.query(`
          UPDATE public.city_market_data
          SET market_size = $1,
              competitors_count = $2,
              market_saturation_score = $3,
              avg_salary = $4,
              opportunity_score = $5,
              source = 'key_city_economic_model',
              confidence = 65,
              updated_at = NOW()
          WHERE city_id = $6 AND activity_id = $7 AND data_year = $8
        `, [marketSize, competitorsCount, saturationScore, avgSalary, opportunityScore, city.id, activity.id, year]);

        updated++;
      }
      console.log(` ${city.name_ar}: ${activities.length} activities`);
    }

    console.log(`\n Done. Updated ${updated} market rows for key cities.`);
  } catch (err) {
    console.error(" Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
