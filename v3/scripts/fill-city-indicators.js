/**
 * Bonds V3 — Fill missing city_indicators for modern cities using country averages.
 *
 * For each country, computes average indicator values from cities that already
 * have indicators, then inserts estimated indicators for modern cities
 * (code matching XX-NN-NNN) that do not yet have any indicator row.
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
    const year = new Date().getFullYear();

    // Get modern cities without indicators for the current year
    const { rows: missingCities } = await client.query(`
      SELECT c.id, c.code, c.name_ar, c.country_code, c.population, c.purchasing_power_index
      FROM public.cities c
      WHERE c.code ~ '^[A-Z]{2}-\\d{2}-\\d{3}$'
        AND NOT EXISTS (
          SELECT 1 FROM public.city_indicators ci
          WHERE ci.city_id = c.id AND ci.year = $1
        )
      ORDER BY c.country_code, c.name_ar
    `, [year]);

    console.log(`Found ${missingCities.length} modern cities without ${year} indicators`);

    // Get country averages from cities that have indicators
    const { rows: countryAvgs } = await client.query(`
      SELECT
        c.country_code,
        AVG(ci.gdp_city) AS gdp_city,
        AVG(ci.growth_rate) AS growth_rate,
        AVG(ci.unemployment_rate) AS unemployment_rate,
        AVG(ci.establishments_count) AS establishments_count,
        AVG(ci.inflation_rate) AS inflation_rate,
        AVG(ci.business_ease_index) AS business_ease_index,
        AVG(ci.avg_rent_per_sqm) AS avg_rent_per_sqm,
        AVG(ci.avg_land_price_per_sqm) AS avg_land_price_per_sqm,
        AVG(ci.warehouse_rent_per_sqm) AS warehouse_rent_per_sqm,
        AVG(ci.factory_rent_per_sqm) AS factory_rent_per_sqm,
        AVG(ci.new_licenses_count) AS new_licenses_count,
        AVG(ci.investment_volume) AS investment_volume,
        AVG(ci.saturation_index) AS saturation_index,
        mode() WITHIN GROUP (ORDER BY ci.currency_code) AS currency_code
      FROM public.city_indicators ci
      JOIN public.cities c ON c.id = ci.city_id
      WHERE ci.year = $1
      GROUP BY c.country_code
    `, [year]);

    const avgByCountry = new Map(countryAvgs.map(r => [r.country_code, r]));

    let inserted = 0;
    let skipped = 0;

    for (const city of missingCities) {
      const base = avgByCountry.get(city.country_code);
      if (!base || !base.growth_rate) {
        skipped++;
        continue;
      }

      // Scale some metrics by population relative to country-average population
      const { rows: popStats } = await client.query(`
        SELECT AVG(c.population) AS avg_pop
        FROM public.cities c
        JOIN public.city_indicators ci ON ci.city_id = c.id
        WHERE c.country_code = $1 AND ci.year = $2
      `, [city.country_code, year]);
      const avgPop = Number(popStats[0].avg_pop) || 1000000;
      const popRatio = (Number(city.population) || avgPop) / avgPop;

      const currencyCode = base.currency_code || null;
      const gdpCity = currencyCode ? scale(base.gdp_city, popRatio, 0.7) : null;
      const establishmentsCount = Math.round(scale(base.establishments_count, popRatio, 0.8));
      const newLicensesCount = Math.round(scale(base.new_licenses_count, popRatio, 0.8));
      const investmentVolume = currencyCode ? scale(base.investment_volume, popRatio, 0.7) : null;

      await client.query(`
        INSERT INTO public.city_indicators (
          city_id, year, gdp_city, growth_rate, unemployment_rate,
          establishments_count, inflation_rate, business_ease_index,
          avg_rent_per_sqm, avg_land_price_per_sqm, warehouse_rent_per_sqm,
          factory_rent_per_sqm, new_licenses_count, investment_volume,
          saturation_index, overall_confidence, currency_code, metadata, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, NOW())
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
          currency_code = EXCLUDED.currency_code,
          new_licenses_count = EXCLUDED.new_licenses_count,
          investment_volume = EXCLUDED.investment_volume,
          saturation_index = EXCLUDED.saturation_index,
          overall_confidence = EXCLUDED.overall_confidence,
          metadata = EXCLUDED.metadata,
          updated_at = NOW()
      `, [
        city.id,
        year,
        gdpCity,
        base.growth_rate,
        base.unemployment_rate,
        establishmentsCount,
        base.inflation_rate,
        base.business_ease_index,
        currencyCode ? base.avg_rent_per_sqm : null,
        currencyCode ? base.avg_land_price_per_sqm : null,
        currencyCode ? base.warehouse_rent_per_sqm : null,
        currencyCode ? base.factory_rent_per_sqm : null,
        newLicensesCount,
        investmentVolume,
        base.saturation_index,
        30,
        currencyCode,
        JSON.stringify({ source: 'country_average_estimate', estimated: true })
      ]);

      inserted++;
      if (inserted % 100 === 0) console.log(`Inserted ${inserted}...`);
    }

    console.log(`\n Done. Inserted ${inserted} indicator rows. Skipped ${skipped}.`);
  } catch (err) {
    console.error(" Error:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
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

main();
