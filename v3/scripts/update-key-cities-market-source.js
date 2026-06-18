const { Client } = require('pg');

const KEY_CODES = [
  'SA-01-001','SA-02-001','SA-02-002','AE-01-001','AE-02-001','EG-01-001','EG-02-001',
  'JO-01-001','QA-01-001','KW-01-001','BH-01-001','OM-01-001','IQ-01-001','LB-01-001',
  'SY-01-001','PS-01-001','TN-01-001','DZ-01-001','MA-01-001','LY-01-001','SD-01-001',
  'YE-01-001','SO-01-001','DJ-01-001','MR-01-001','KM-01-001'
];

async function main() {
  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();

  const { rowCount } = await client.query(`
    UPDATE public.city_market_data m
    SET source = 'key_city_enriched_estimate', confidence = 60
    FROM public.cities c
    WHERE m.city_id = c.id AND c.code = ANY($1::text[]) AND m.data_year = 2026
  `, [KEY_CODES]);

  console.log('Updated', rowCount, 'market rows for key cities');
  await client.end();
}

main().catch(console.error);
