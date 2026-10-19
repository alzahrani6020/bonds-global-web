#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const { Client } = require('pg');
const { normalizeText } = require('../lib/geo/normalization');

const ROOT = path.join(__dirname, '..');
const INPUT = process.argv[2] || path.join(ROOT, '.tmp-geo', 'arab-localities.ndjson');
const SOURCE_CODE = process.env.GEO_SOURCE_CODE || 'geonames_dump';
const DATASET_VERSION = process.env.GEO_DATASET_VERSION || path.basename(INPUT) + ':' + new Date().toISOString().slice(0,10);

async function sha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!fs.existsSync(INPUT)) throw new Error('Dataset not found: ' + INPUT);

  const checksum = await sha256(INPUT);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const snapshot = await client.query(
      `insert into geo_ingest.source_snapshots(
        source_code,dataset_version,checksum_sha256,source_uri,status,metadata
      ) values($1,$2,$3,$4,'ready',$5::jsonb)
      on conflict(source_code,dataset_version,checksum_sha256)
      do update set source_uri=excluded.source_uri, metadata=excluded.metadata
      returning id`,
      [SOURCE_CODE, DATASET_VERSION, checksum, INPUT, JSON.stringify({ local_file: true })]
    );

    const run = await client.query(
      `insert into geo_ingest.runs(snapshot_id,stage,status)
       values($1,'staging','running') returning id`,
      [snapshot.rows[0].id]
    );
    const runId = run.rows[0].id;

    const rl = readline.createInterface({
      input: fs.createReadStream(INPUT),
      crlfDelay: Infinity
    });

    await client.query('begin');
    let count = 0;
    for await (const line of rl) {
      if (!line.trim()) continue;
      const row = JSON.parse(line);
      const errors = [];
      if (!row.source_id) errors.push('missing_source_id');
      if (!row.country_code) errors.push('missing_country_code');
      if (!row.name_ar && !row.name_en && !row.canonical_name) errors.push('missing_name');
      if (!Number.isFinite(Number(row.lat)) || !Number.isFinite(Number(row.lng))) errors.push('missing_coordinates');

      await client.query(
        `insert into geo_ingest.raw_places(
          run_id,source_code,source_id,country_code,name_ar,name_en,
          normalized_name_ar,normalized_name_en,place_type,
          admin1_code,admin2_code,admin3_code,admin4_code,
          lat,lng,population,elevation_m,source_updated_at,aliases,raw_payload,
          validation_status,validation_errors
        ) values(
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
          case when $18::text is null or $18::text='' then null else $18::date::timestamptz end,
          $19::jsonb,$20::jsonb,$21,$22::jsonb
        )
        on conflict(run_id,source_code,source_id) do nothing`,
        [
          runId,SOURCE_CODE,String(row.source_id),String(row.country_code).toUpperCase(),
          row.name_ar || null,row.name_en || null,
          normalizeText(row.name_ar),normalizeText(row.name_en),
          row.place_type || 'other',
          row.metadata?.admin1_code || null,row.metadata?.admin2_code || null,
          row.metadata?.admin3_code || null,row.metadata?.admin4_code || null,
          Number(row.lat),Number(row.lng),
          Number.isFinite(Number(row.population)) ? Number(row.population) : null,
          Number.isFinite(Number(row.elevation_m)) ? Number(row.elevation_m) : null,
          row.source_updated_at || null,
          JSON.stringify(row.aliases || []),JSON.stringify(row),
          errors.length ? 'invalid' : 'valid',JSON.stringify(errors)
        ]
      );
      count++;
      if (count % 1000 === 0) process.stdout.write('Staged ' + count + ' rows\n');
    }
    await client.query('commit');

    await client.query(
      `update geo_ingest.runs set stage='validation' where id=$1`,
      [runId]
    );
    const metrics = await client.query('select geo_ingest.refresh_run_metrics($1) as metrics', [runId]);
    const gates = await client.query('select * from geo_ingest.evaluate_quality_gates($1)', [runId]);
    const blocked = gates.rows.some(r => r.severity === 'blocker' && r.passed === false);

    await client.query(
      `update geo_ingest.runs
       set status=$2, stage=$3, finished_at=case when $2='failed' then now() else null end
       where id=$1`,
      [runId, blocked ? 'failed' : 'passed', blocked ? 'validation' : 'matching']
    );
    await client.query(
      `update geo_ingest.source_snapshots set status=$2 where id=$1`,
      [snapshot.rows[0].id, blocked ? 'rejected' : 'validated']
    );

    console.log(JSON.stringify({
      run_id: runId,
      snapshot_id: snapshot.rows[0].id,
      checksum_sha256: checksum,
      metrics: metrics.rows[0]?.metrics || {},
      quality_gates: gates.rows,
      status: blocked ? 'failed' : 'passed'
    }, null, 2));

    if (blocked) process.exitCode = 2;
  } catch (err) {
    try { await client.query('rollback'); } catch (_) {}
    throw err;
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
