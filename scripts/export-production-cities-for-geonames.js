#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

function parseArgs(argv) {
  const args = {
    output: path.join('.tmp-geo', 'current-cities.json')
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === '--output') {
      args.output = value;
      i += 1;
    } else {
      throw new Error('Unknown argument: ' + arg);
    }
  }

  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable'
      ? false
      : { rejectUnauthorized: false }
  });

  await client.connect();

  try {
    await client.query('begin read only');

    const result = await client.query(
      `select
         id,
         code,
         geo_place_id,
         name_ar,
         name_en,
         region,
         admin_level_2,
         locality_type,
         country_code,
         lat,
         lng
       from public.cities
       where is_active = true
       order by country_code, code`
    );

    const payload = {
      cities: result.rows,
      count: result.rowCount,
      source: 'production_database_read_only'
    };

    fs.mkdirSync(path.dirname(args.output), { recursive: true });
    fs.writeFileSync(args.output, JSON.stringify(payload, null, 2) + '\n');

    console.log(JSON.stringify({
      output: args.output,
      city_count: result.rowCount,
      source: payload.source
    }));
  } finally {
    try {
      await client.query('rollback');
    } catch (_error) {
      // Connection cleanup still runs below.
    }
    await client.end();
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
