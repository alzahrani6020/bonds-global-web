const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const total = await client.query("SELECT COUNT(*) FROM public.cities WHERE code LIKE '__-__-___' ESCAPE '\\'");
  const withInd = await client.query('SELECT COUNT(DISTINCT city_id) FROM public.city_indicators WHERE year=2026');
  const withMkt = await client.query('SELECT COUNT(DISTINCT city_id) FROM public.city_market_data WHERE data_year=2026');
  const modernWithMkt = await client.query("SELECT COUNT(DISTINCT m.city_id) FROM public.city_market_data m JOIN public.cities c ON c.id=m.city_id WHERE m.data_year=2026 AND c.code LIKE '__-__-___' ESCAPE '\\'");

  console.log('Modern cities:', total.rows[0].count);
  console.log('Cities with 2026 indicators:', withInd.rows[0].count);
  console.log('Cities with 2026 market data (all):', withMkt.rows[0].count);
  console.log('Modern cities with 2026 market data:', modernWithMkt.rows[0].count);

  await client.end();
}

main().catch(console.error);
