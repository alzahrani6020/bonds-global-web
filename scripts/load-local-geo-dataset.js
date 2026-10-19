#!/usr/bin/env node
'use strict';

/**
 * Load the locally built Arab geography NDJSON into Postgres/PostGIS.
 * Uses DATABASE_URL only; no third-party API, AI provider, API key, or provider token.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');

const ROOT = path.join(__dirname, '..');
const INPUT = process.argv[2] || path.join(ROOT, '.tmp-geo', 'arab-localities.ndjson');
const BATCH_SIZE = Math.max(50, Math.min(Number(process.env.GEO_BATCH_SIZE || 500), 2000));

async function upsertPlace(client, row) {
  const result = await client.query(
    `insert into public.geo_places (
      canonical_code,country_code,name_ar,name_en,canonical_name,place_type,
      lat,lng,population,elevation_m,source_code,source_id,source_updated_at,
      confidence,is_canonical,is_active,metadata
    ) values (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
      case when $13::text is null or $13::text = '' then null else $13::date::timestamptz end,
      $14,true,true,$15::jsonb
    )
    on conflict (source_code,source_id) do update set
      canonical_code=excluded.canonical_code,
      country_code=excluded.country_code,
      name_ar=coalesce(excluded.name_ar,public.geo_places.name_ar),
      name_en=coalesce(excluded.name_en,public.geo_places.name_en),
      canonical_name=excluded.canonical_name,
      place_type=excluded.place_type,
      lat=excluded.lat,
      lng=excluded.lng,
      population=coalesce(excluded.population,public.geo_places.population),
      elevation_m=coalesce(excluded.elevation_m,public.geo_places.elevation_m),
      source_updated_at=excluded.source_updated_at,
      confidence=greatest(public.geo_places.confidence,excluded.confidence),
      metadata=public.geo_places.metadata || excluded.metadata,
      updated_at=now()
    returning id`,
    [
      row.canonical_code,row.country_code,row.name_ar,row.name_en,row.canonical_name,row.place_type,
      row.lat,row.lng,row.population,row.elevation_m,row.source_code,row.source_id,row.source_updated_at,
      row.confidence,JSON.stringify(row.metadata || {})
    ]
  );

  const placeId = result.rows[0].id;
  for (const alias of row.aliases || []) {
    await client.query(
      `insert into public.geo_place_aliases(place_id,alias,language,alias_type,source_code)
       values($1,$2,$3,$4,$5)
       on conflict(place_id,alias,language) do nothing`,
      [placeId, alias.alias, alias.language || null, alias.alias_type || 'source', row.source_code]
    );
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!fs.existsSync(INPUT)) throw new Error('Dataset not found: ' + INPUT);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
  await client.connect();

  let total = 0;
  let batch = 0;
  const countries = {};

  try {
    const rl = readline.createInterface({
      input: fs.createReadStream(INPUT),
      crlfDelay: Infinity
    });

    await client.query('begin');

    for await (const line of rl) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      await upsertPlace(client, row);
      total++;
      batch++;
      countries[row.country_code] = (countries[row.country_code] || 0) + 1;

      if (batch >= BATCH_SIZE) {
        await client.query('commit');
        await client.query('begin');
        batch = 0;
        process.stdout.write('Loaded ' + total + ' places\n');
      }
    }

    await client.query('commit');
    console.log(JSON.stringify({ loaded: total, countries }, null, 2));
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});
