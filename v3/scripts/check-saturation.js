const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const { rows } = await client.query(`
    SELECT m.market_saturation_score, COUNT(*) as cnt
    FROM public.city_market_data m
    JOIN public.cities c ON c.id = m.city_id
    WHERE m.data_year = 2026 AND c.code LIKE '__-__-___' ESCAPE '\\'
    GROUP BY m.market_saturation_score
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log(rows);

  const zero = await client.query(`
    SELECT COUNT(*) FROM public.city_market_data m
    JOIN public.cities c ON c.id = m.city_id
    WHERE m.data_year = 2026 AND c.code LIKE '__-__-___' ESCAPE '\\' AND m.market_saturation_score = 0
  `);
  console.log('Zero saturation rows:', zero.rows[0].count);

  await client.end();
}

main().catch(console.error);
