const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function loadEnv(file) {
  const envPath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(envPath)) return;
  const text = fs.readFileSync(envPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    const key = match[1];
    let value = match[2];
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1).replace(/\\"/g, '"');
    else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1).replace(/\\'/g, "'");
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) process.env[key] = value;
  }
}

['.env.prod', '.env.production', '.env.local', '.env'].forEach(loadEnv);

async function main() {
  const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(" Missing SUPABASE_DB_URL / DATABASE_URL");
    process.exit(1);
  }

  const migrationFile = path.resolve(process.cwd(), 'supabase/migrations/20260722000001_enable_rls_all_tables.sql');
  if (!fs.existsSync(migrationFile)) {
    console.error(" Migration file not found:", migrationFile);
    process.exit(1);
  }
  const sql = fs.readFileSync(migrationFile, 'utf8');

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log(" Connected to Supabase database");
    console.log(" Applying migration:", path.basename(migrationFile));
    const result = await client.query(sql);
    console.log(" Migration applied successfully");
    if (result.length > 0 && result[result.length - 1].rows) {
      const rows = result[result.length - 1].rows;
      if (rows.length === 0) {
        console.log(" All public tables now have RLS policies");
      } else {
        console.log("  Tables still missing policies:", rows);
      }
    }
  } catch (err) {
    console.error(" Migration failed:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
