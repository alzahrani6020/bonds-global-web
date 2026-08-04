/**
 * Bonds V3 — Import all Arab cities from the migration SQL file.
 *
 * Usage:
 *   SUPABASE_DB_URL=postgresql://postgres:... node scripts/import-cities-sql.js
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(" Please set SUPABASE_DB_URL or DATABASE_URL environment variable.");
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260617000001_add_all_arab_cities.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error(" Migration file not found:", sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(" Connected to database.");

    // Check current city count
    const before = await client.query('SELECT COUNT(*) FROM public.cities');
    console.log(` Cities before import: ${before.rows[0].count}`);

    await client.query(sql);

    const after = await client.query('SELECT COUNT(*) FROM public.cities');
    console.log(` Cities after import: ${after.rows[0].count}`);
    console.log(` New cities added: ${Number(after.rows[0].count) - Number(before.rows[0].count)}`);

    // Show distribution by country
    const dist = await client.query(`
      SELECT country_code, COUNT(*) as count
      FROM public.cities
      GROUP BY country_code
      ORDER BY count DESC
    `);
    console.log("\n Distribution by country:");
    dist.rows.forEach(r => {
      console.log(`  ${r.country_code}: ${r.count} cities`);
    });
  } catch (err) {
    console.error(" Import failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
