#!/usr/bin/env node
/**
 * Apply a single SQL migration file using node-postgres.
 * Usage: node scripts/apply-migration.js <path-to-sql>
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/apply-migration.js <path-to-sql>');
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Please set SUPABASE_DB_URL or DATABASE_URL');
  process.exit(1);
}

const sql = fs.readFileSync(path.resolve(file), 'utf8');
const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

(async () => {
  await client.connect();
  try {
    await client.query(sql);
    console.log(` Applied ${path.basename(file)}`);
  } catch (err) {
    console.error(` Failed to apply ${path.basename(file)}:`, err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
