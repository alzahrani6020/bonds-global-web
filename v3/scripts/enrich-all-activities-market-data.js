/**
 * Bonds V3 — Enrich market data for ALL cities × ALL activities using economic formulas.
 *
 * Applies a category-aware economic model to every economic_activity for every modern city,
 * while preserving higher-quality rows already present.
 */

const { Client } = require('pg');

function hashCode(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h) + str.charCodeAt(i);
  return h;
}

function pseudoRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

// Helper: classify activity code/name into a category
function classifyActivity(code, name) {
  const c = `${code} ${name || ''}`.toLowerCase();
  if (c.match(/restaurant|cafe|coffee|bakery|food_truck|burger|fast_food|catering|food_beverage/)) return 'food';
  if (c.match(/supermarket|retail|clothing|store|shop|ecommerce|wholesale|commerce/)) return 'retail';
  if (c.match(/pharmacy|medical|dental|dermatology|ophthalmology|pediatric|lab|clinic/)) return 'healthcare';
  if (c.match(/beauty|cosmetic/)) return 'beauty';
  if (c.match(/gym|sports|fitness/)) return 'gym';
  if (c.match(/hotel|boutique|hospitality|tourism/)) return 'hospitality';
  if (c.match(/kindergarten|education|school|training|university|elearning/)) return 'education';
  if (c.match(/mobile|technology|software|hardware|telecom|cybersecurity|it_services|artificial_intelligence/)) return 'tech';
  if (c.match(/bank|financial|insurance|investment|fintech|payment/)) return 'finance';
  if (c.match(/real_estate|commercial|industrial|residential|contracting|construction/)) return 'realestate';
  if (c.match(/logistics|transport|warehouse|shipping|last_mile/)) return 'logistics';
  if (c.match(/agriculture|farming|livestock|poultry|vegetable|fisheries/)) return 'agriculture';
  if (c.match(/mining|oil_gas|energy|refiner|utility/)) return 'industrial';
  if (c.match(/media|entertainment|events|culture/)) return 'media';
  if (c.match(/consulting|security|cleaning|maintenance|human_resources|facilities/)) return 'services';
  return 'general';
}

const CATEGORY_DEFAULTS = {
  food: { spend: 2200, salaryMult: 0.43, peoplePerComp: 3500 },
  retail: { spend: 1800, salaryMult: 0.45, peoplePerComp: 8000 },
  healthcare: { spend: 900, salaryMult: 0.60, peoplePerComp: 5000 },
  beauty: { spend: 1200, salaryMult: 0.42, peoplePerComp: 7000 },
  gym: { spend: 900, salaryMult: 0.45, peoplePerComp: 6500 },
  hospitality: { spend: 400, salaryMult: 0.48, peoplePerComp: 20000 },
  education: { spend: 600, salaryMult: 0.40, peoplePerComp: 12000 },
  tech: { spend: 800, salaryMult: 0.65, peoplePerComp: 10000 },
  finance: { spend: 500, salaryMult: 0.75, peoplePerComp: 15000 },
  realestate: { spend: 300, salaryMult: 0.55, peoplePerComp: 25000 },
  logistics: { spend: 400, salaryMult: 0.45, peoplePerComp: 18000 },
  agriculture: { spend: 250, salaryMult: 0.38, peoplePerComp: 30000 },
  industrial: { spend: 200, salaryMult: 0.60, peoplePerComp: 40000 },
  media: { spend: 350, salaryMult: 0.50, peoplePerComp: 22000 },
  services: { spend: 450, salaryMult: 0.42, peoplePerComp: 12000 },
  general: { spend: 600, salaryMult: 0.45, peoplePerComp: 10000 }
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

    // Get all modern cities with population
    const { rows: cities } = await client.query(`
      SELECT c.id, c.code, c.name_ar, c.country_code, c.population
      FROM public.cities c
      WHERE c.code LIKE '__-__-___' ESCAPE '\\'
      ORDER BY c.country_code, c.name_ar
    `);

    // Get ALL activities
    const { rows: activities } = await client.query(`
      SELECT id, code, name_ar FROM public.economic_activities ORDER BY code
    `);

    // Fetch existing high-confidence rows to preserve
    const { rows: existingRows } = await client.query(`
      SELECT city_id, activity_id, source, confidence
      FROM public.city_market_data
      WHERE data_year = $1 AND (
        (source = 'key_city_economic_model' AND confidence >= 65)
        OR confidence >= 60
      )
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

        const category = classifyActivity(activity.code, activity.name_ar);
        const defs = CATEGORY_DEFAULTS[category] || CATEGORY_DEFAULTS.general;

        const seed = hashCode(city.code + activity.code);
        const variation = (pseudoRandom(seed) - 0.5) * 0.2;

        const marketSize = Math.round(pop * defs.spend * (countryGdpSAR / 80000) * (1 + variation));
        const compVariation = 0.85 + pseudoRandom(seed + 1) * 0.3;
        const competitorsCount = Math.max(1, Math.round((pop / defs.peoplePerComp) * compVariation));
        const expectedCompetitors = pop / defs.peoplePerComp;
        const saturationScore = Math.min(95, Math.round((competitorsCount / expectedCompetitors) * 70));
        const avgSalary = Math.round(countryGdpSAR * defs.salaryMult / 12);

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

      if ((updated + skipped) % 5000 === 0) {
        console.log(`Prepared ${updated} rows, skipped ${skipped}...`);
      }
    }

    // Delete low-confidence rows for current year
    console.log(`\nDeleting old low-confidence rows for ${activities.length} activities...`);
    await client.query(`
      DELETE FROM public.city_market_data
      WHERE data_year = $1
        AND NOT (source = 'key_city_economic_model' AND confidence >= 65)
        AND NOT (confidence >= 60)
    `, [year]);

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

    console.log(`\n Done. Updated ${updated} rows. Skipped ${skipped} high-confidence rows.`);
  } catch (err) {
    console.error(" Error:", err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
