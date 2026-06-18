/**
 * Bonds V3 — Fix zero market_saturation_score in estimated city_market_data rows.
 *
 * For modern cities (code XX-NN-NNN) with data_year = current year and
 * market_saturation_score = 0, replace with the country average saturation
 * for the same activity (excluding zeros). If no country average exists,
 * use a sensible default based on the activity.
 */

const { Client } = require('pg');

const DEFAULT_SATURATION_BY_ACTIVITY = {
  restaurant: 55,
  cafe: 50,
  supermarket: 60,
  pharmacy: 40,
  gym: 45,
  beauty: 55,
  mobile_shop: 65,
  clothing_shop: 60,
  hotel_boutique: 35,
  kindergarten: 30,
  short_delivery: 50,
  bakery: 55,
  food_truck: 40,
  burger_restaurant: 50
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

    // Compute country/activity averages excluding zeros
    const { rows: countryAvgs } = await client.query(`
      SELECT
        c.country_code,
        m.activity_id,
        a.code as activity_code,
        AVG(NULLIF(m.market_saturation_score, 0)) AS avg_sat,
        AVG(NULLIF(m.competitors_count, 0)) AS avg_comp,
        AVG(m.opportunity_score) AS avg_opp
      FROM public.city_market_data m
      JOIN public.cities c ON c.id = m.city_id
      JOIN public.economic_activities a ON a.id = m.activity_id
      WHERE m.data_year = $1 AND c.code LIKE '__-__-___' ESCAPE '\\'
      GROUP BY c.country_code, m.activity_id, a.code
    `, [year]);

    const key = (cc, aid) => `${cc}|${aid}`;
    const avgMap = new Map(countryAvgs.map(r => [key(r.country_code, r.activity_id), r]));

    // Find zero-saturation rows for modern cities
    const { rows: zeros } = await client.query(`
      SELECT m.id, c.country_code, m.activity_id, a.code as activity_code
      FROM public.city_market_data m
      JOIN public.cities c ON c.id = m.city_id
      JOIN public.economic_activities a ON a.id = m.activity_id
      WHERE m.data_year = $1
        AND c.code LIKE '__-__-___' ESCAPE '\\'
        AND (m.market_saturation_score = 0 OR m.market_saturation_score IS NULL)
    `, [year]);

    console.log(`Found ${zeros.length} zero-saturation rows`);

    let fixed = 0;
    for (const row of zeros) {
      const avg = avgMap.get(key(row.country_code, row.activity_id));
      let newSat = avg?.avg_sat ? Math.round(avg.avg_sat) : DEFAULT_SATURATION_BY_ACTIVITY[row.activity_code];
      if (newSat == null) newSat = 50;

      // Slightly vary per row so all cities are not identical
      const variation = Math.round((Math.random() - 0.5) * 6);
      newSat = Math.max(10, Math.min(95, newSat + variation));

      // Also fix competitors if zero
      let newComp = null;
      if (avg?.avg_comp && !Number.isNaN(avg.avg_comp)) {
        newComp = Math.max(1, Math.round(Number(avg.avg_comp) + (Math.random() - 0.5) * 10));
      }

      await client.query(`
        UPDATE public.city_market_data
        SET market_saturation_score = $1,
            competitors_count = COALESCE(NULLIF(competitors_count, 0), $2, competitors_count),
            opportunity_score = GREATEST(opportunity_score, 20),
            updated_at = NOW()
        WHERE id = $3
      `, [newSat, newComp, row.id]);
      fixed++;
      if (fixed % 200 === 0) console.log(`Fixed ${fixed}...`);
    }

    console.log(`\n✅ Done. Fixed ${fixed} rows.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
