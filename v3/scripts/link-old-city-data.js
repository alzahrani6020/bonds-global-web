/**
 * Bonds V3 — Link market/indicators data from old cities to new cities.
 *
 * Old cities use short codes (RUH, JED, DXB, CAI...).
 * New cities use codes like SA-01-001.
 * This script copies city_indicators and city_market_data from old cities
 * to new cities matched by name_ar + country_code.
 */

const { Client } = require('pg');

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(" Please set SUPABASE_DB_URL or DATABASE_URL");
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    // Find old cities with data and their new matches
    const { rows: pairs } = await client.query(`
      SELECT
        o.id AS old_id,
        o.code AS old_code,
        o.name_ar,
        o.country_code,
        n.id AS new_id,
        n.code AS new_code
      FROM public.cities o
      JOIN public.cities n
        ON n.name_ar = o.name_ar
        AND n.country_code = o.country_code
        AND n.code ~ '^[A-Z]{2}-'
      WHERE o.code !~ '^[A-Z]{2}-'
      ORDER BY o.country_code, o.name_ar
    `);

    console.log(`Found ${pairs.length} old→new city pairs`);

    let indicatorsCopied = 0;
    let marketCopied = 0;

    for (const p of pairs) {
      // Copy city_indicators
      const { rowCount: indCount } = await client.query(`
        INSERT INTO public.city_indicators (
          city_id, year, gdp_city, growth_rate, unemployment_rate,
          establishments_count, inflation_rate, business_ease_index,
          avg_rent_per_sqm, avg_land_price_per_sqm, warehouse_rent_per_sqm,
          factory_rent_per_sqm, new_licenses_count, investment_volume,
          saturation_index, overall_confidence, metadata, updated_at
        )
        SELECT
          $2, year, gdp_city, growth_rate, unemployment_rate,
          establishments_count, inflation_rate, business_ease_index,
          avg_rent_per_sqm, avg_land_price_per_sqm, warehouse_rent_per_sqm,
          factory_rent_per_sqm, new_licenses_count, investment_volume,
          saturation_index, overall_confidence, metadata, NOW()
        FROM public.city_indicators
        WHERE city_id = $1
        ON CONFLICT (city_id, year) DO UPDATE SET
          gdp_city = EXCLUDED.gdp_city,
          growth_rate = EXCLUDED.growth_rate,
          unemployment_rate = EXCLUDED.unemployment_rate,
          establishments_count = EXCLUDED.establishments_count,
          inflation_rate = EXCLUDED.inflation_rate,
          business_ease_index = EXCLUDED.business_ease_index,
          avg_rent_per_sqm = EXCLUDED.avg_rent_per_sqm,
          avg_land_price_per_sqm = EXCLUDED.avg_land_price_per_sqm,
          warehouse_rent_per_sqm = EXCLUDED.warehouse_rent_per_sqm,
          factory_rent_per_sqm = EXCLUDED.factory_rent_per_sqm,
          new_licenses_count = EXCLUDED.new_licenses_count,
          investment_volume = EXCLUDED.investment_volume,
          saturation_index = EXCLUDED.saturation_index,
          overall_confidence = EXCLUDED.overall_confidence,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [p.old_id, p.new_id]);
      indicatorsCopied += indCount || 0;

      // Copy city_market_data
      const { rowCount: mktCount } = await client.query(`
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
        )
        SELECT
          $2, activity_id, data_year, competitors_count, avg_market_share,
          avg_rent_per_sqm, avg_land_price_per_sqm, avg_salary,
          labor_availability_score, market_saturation_score,
          source, market_size, annual_growth_rate, per_capita_spending,
          expected_demand, profit_margin_min, profit_margin_avg, profit_margin_max,
          risk_score, confidence, specialists_count, saudization_rate,
          opportunity_score, opportunity_rank, opportunity_breakdown,
          warehouse_rent_per_sqm, factory_rent_per_sqm, construction_cost_per_sqm,
          equipment_cost_min, equipment_cost_avg, equipment_cost_max,
          monthly_operation_cost_min, monthly_operation_cost_avg, monthly_operation_cost_max,
          NOW(), NOW()
        FROM public.city_market_data
        WHERE city_id = $1
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
      `, [p.old_id, p.new_id]);
      marketCopied += mktCount || 0;

      console.log(` ${p.name_ar} (${p.country_code}): ${indCount} indicators, ${mktCount} market rows`);
    }

    console.log(`\n Done. Copied ${indicatorsCopied} indicator rows and ${marketCopied} market rows.`);
  } catch (err) {
    console.error(" Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
