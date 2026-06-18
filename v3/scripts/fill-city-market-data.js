/**
 * Bonds V3 — Fill missing city_market_data for modern cities using country averages.
 *
 * For a core set of economic activities, computes average market metrics per
 * country from cities that already have data, then inserts estimated market
 * rows for modern cities (code matching XX-NN-NNN) that do not yet have data
 * for that activity/year.
 */

const { Client } = require('pg');

const ACTIVITY_CODES = [
  'restaurant', 'cafe', 'supermarket', 'dental_clinic', 'pharmacy', 'gym',
  'beauty', 'mobile_shop', 'clothing_shop', 'hotel_boutique', 'kindergarten',
  'short_delivery', 'bakery', 'food_truck', 'burger_restaurant'
];

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

    // Resolve activity IDs
    const { rows: activities } = await client.query(
      'SELECT id, code, name_ar FROM public.economic_activities WHERE code = ANY($1::text[])',
      [ACTIVITY_CODES]
    );
    console.log(`Filling market data for ${activities.length} activities, year ${year}`);

    // Get modern cities without any market data for this year
    const { rows: modernCities } = await client.query(`
      SELECT id, code, name_ar, country_code, population, purchasing_power_index
      FROM public.cities
      WHERE code LIKE '__-__-___' ESCAPE '\\'
      ORDER BY country_code, name_ar
    `);
    console.log(`Modern cities: ${modernCities.length}`);

    let insertedTotal = 0;
    let skippedTotal = 0;

    for (const activity of activities) {
      // Country averages for this activity
      const { rows: countryAvgs } = await client.query(`
        SELECT
          c.country_code,
          AVG(m.competitors_count) AS competitors_count,
          AVG(m.avg_market_share) AS avg_market_share,
          AVG(m.avg_rent_per_sqm) AS avg_rent_per_sqm,
          AVG(m.avg_land_price_per_sqm) AS avg_land_price_per_sqm,
          AVG(m.avg_salary) AS avg_salary,
          AVG(m.labor_availability_score) AS labor_availability_score,
          AVG(m.market_saturation_score) AS market_saturation_score,
          AVG(m.market_size) AS market_size,
          AVG(m.annual_growth_rate) AS annual_growth_rate,
          AVG(m.per_capita_spending) AS per_capita_spending,
          AVG(m.profit_margin_min) AS profit_margin_min,
          AVG(m.profit_margin_avg) AS profit_margin_avg,
          AVG(m.profit_margin_max) AS profit_margin_max,
          AVG(m.risk_score) AS risk_score,
          AVG(m.saudization_rate) AS saudization_rate,
          AVG(m.opportunity_score) AS opportunity_score,
          AVG(m.specialists_count) AS specialists_count,
          AVG(m.warehouse_rent_per_sqm) AS warehouse_rent_per_sqm,
          AVG(m.factory_rent_per_sqm) AS factory_rent_per_sqm,
          AVG(m.construction_cost_per_sqm) AS construction_cost_per_sqm,
          AVG(m.equipment_cost_min) AS equipment_cost_min,
          AVG(m.equipment_cost_avg) AS equipment_cost_avg,
          AVG(m.equipment_cost_max) AS equipment_cost_max,
          AVG(m.monthly_operation_cost_min) AS monthly_operation_cost_min,
          AVG(m.monthly_operation_cost_avg) AS monthly_operation_cost_avg,
          AVG(m.monthly_operation_cost_max) AS monthly_operation_cost_max,
          mode() WITHIN GROUP (ORDER BY m.expected_demand) AS expected_demand
        FROM public.city_market_data m
        JOIN public.cities c ON c.id = m.city_id
        WHERE m.activity_id = $1 AND m.data_year = $2
        GROUP BY c.country_code
      `, [activity.id, year]);

      const avgByCountry = new Map(countryAvgs.map(r => [r.country_code, r]));
      const globalAvg = aggregateGlobal(countryAvgs);

      // Find modern cities missing this activity
      const { rows: missing } = await client.query(`
        SELECT c.id, c.code, c.name_ar, c.country_code, c.population
        FROM public.cities c
        WHERE c.code LIKE '__-__-___' ESCAPE '\\'
          AND c.country_code IN (SELECT country_code FROM public.cities WHERE country_code IS NOT NULL)
          AND NOT EXISTS (
            SELECT 1 FROM public.city_market_data m
            WHERE m.city_id = c.id AND m.activity_id = $1 AND m.data_year = $2
          )
      `, [activity.id, year]);

      let inserted = 0;
      for (const city of missing) {
        const base = avgByCountry.get(city.country_code) || globalAvg;
        if (!base.opportunity_score) {
          skippedTotal++;
          continue;
        }

        const popRatio = (Number(city.population) || 1000000) / 1000000;
        const competitors = Math.max(1, Math.round(Number(base.competitors_count || 0) * Math.pow(popRatio, 0.8)));
        const marketSize = scale(base.market_size, popRatio, 0.9);
        const avgSalary = base.avg_salary;
        const opportunityScore = clamp(base.opportunity_score + (Math.random() - 0.5) * 5, 20, 95);

        await client.query(`
          INSERT INTO public.city_market_data (
            city_id, activity_id, data_year, competitors_count, avg_market_share,
            avg_rent_per_sqm, avg_land_price_per_sqm, avg_salary,
            labor_availability_score, market_saturation_score,
            source, market_size, annual_growth_rate, per_capita_spending,
            expected_demand, profit_margin_min, profit_margin_avg, profit_margin_max,
            risk_score, confidence, specialists_count, saudization_rate,
            opportunity_score, opportunity_rank, opportunity_breakdown,
            warehouse_rent_per_sqm, factory_rent_per_sqm, construction_cost_per_sqm,
            equipment_cost_min, equipment_cost_avg, equipment_cost_max,
            monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, NOW(), NOW()
          )
          ON CONFLICT (city_id, activity_id, data_year) DO UPDATE SET
            competitors_count = EXCLUDED.competitors_count,
            avg_market_share = EXCLUDED.avg_market_share,
            avg_rent_per_sqm = EXCLUDED.avg_rent_per_sqm,
            avg_land_price_per_sqm = EXCLUDED.avg_land_price_per_sqm,
            avg_salary = EXCLUDED.avg_salary,
            labor_availability_score = EXCLUDED.labor_availability_score,
            market_saturation_score = EXCLUDED.market_saturation_score,
            source = EXCLUDED.source,
            market_size = EXCLUDED.market_size,
            annual_growth_rate = EXCLUDED.annual_growth_rate,
            per_capita_spending = EXCLUDED.per_capita_spending,
            expected_demand = EXCLUDED.expected_demand,
            profit_margin_min = EXCLUDED.profit_margin_min,
            profit_margin_avg = EXCLUDED.profit_margin_avg,
            profit_margin_max = EXCLUDED.profit_margin_max,
            risk_score = EXCLUDED.risk_score,
            confidence = EXCLUDED.confidence,
            specialists_count = EXCLUDED.specialists_count,
            saudization_rate = EXCLUDED.saudization_rate,
            opportunity_score = EXCLUDED.opportunity_score,
            opportunity_rank = EXCLUDED.opportunity_rank,
            opportunity_breakdown = EXCLUDED.opportunity_breakdown,
            warehouse_rent_per_sqm = EXCLUDED.warehouse_rent_per_sqm,
            factory_rent_per_sqm = EXCLUDED.factory_rent_per_sqm,
            construction_cost_per_sqm = EXCLUDED.construction_cost_per_sqm,
            equipment_cost_min = EXCLUDED.equipment_cost_min,
            equipment_cost_avg = EXCLUDED.equipment_cost_avg,
            equipment_cost_max = EXCLUDED.equipment_cost_max,
            monthly_operation_cost_min = EXCLUDED.monthly_operation_cost_min,
            monthly_operation_cost_avg = EXCLUDED.monthly_operation_cost_avg,
            monthly_operation_cost_max = EXCLUDED.monthly_operation_cost_max,
            updated_at = NOW()
        `, [
          city.id, activity.id, year,
          competitors,
          base.avg_market_share,
          base.avg_rent_per_sqm,
          base.avg_land_price_per_sqm,
          avgSalary,
          Math.round(clamp(base.labor_availability_score + (Math.random() - 0.5) * 5, 0, 100)),
          Math.round(clamp(base.market_saturation_score + (Math.random() - 0.5) * 5, 0, 100)),
          'country_average_estimate',
          marketSize,
          base.annual_growth_rate,
          base.per_capita_spending,
          base.expected_demand || 'medium',
          base.profit_margin_min,
          base.profit_margin_avg,
          base.profit_margin_max,
          clamp(base.risk_score + (Math.random() - 0.5) * 3, 10, 90),
          30,
          Math.round(base.specialists_count || 0),
          Math.round(base.saudization_rate || 0),
          opportunityScore,
          null,
          JSON.stringify({ source: 'country_average_estimate', estimated: true }),
          base.warehouse_rent_per_sqm,
          base.factory_rent_per_sqm,
          base.construction_cost_per_sqm,
          base.equipment_cost_min,
          base.equipment_cost_avg,
          base.equipment_cost_max,
          base.monthly_operation_cost_min,
          base.monthly_operation_cost_avg,
          base.monthly_operation_cost_max
        ]);
        inserted++;
      }
      insertedTotal += inserted;
      console.log(`✓ ${activity.name_ar}: ${inserted} rows`);
    }

    console.log(`\n✅ Done. Inserted/updated ${insertedTotal} market rows. Skipped ${skippedTotal}.`);
  } catch (err) {
    console.error('❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

function aggregateGlobal(countryAvgs) {
  const out = {};
  for (const key of Object.keys(countryAvgs[0] || {})) {
    if (key === 'country_code' || key === 'expected_demand') continue;
    out[key] = median(countryAvgs.map(r => r[key]));
  }
  const demands = countryAvgs.map(r => r.expected_demand).filter(Boolean);
  out.expected_demand = demands.sort((a, b) => demands.filter(v => v === a).length - demands.filter(v => v === b).length).pop() || 'medium';
  return out;
}

function median(arr) {
  const values = arr.filter(v => v != null).map(Number).sort((a, b) => a - b);
  if (values.length === 0) return 0;
  const mid = Math.floor(values.length / 2);
  return values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
}

function scale(baseValue, ratio, elasticity = 1) {
  const base = Number(baseValue) || 0;
  if (base === 0) return 0;
  return Math.round(base * Math.pow(ratio, elasticity) * 100) / 100;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || min));
}

main();
