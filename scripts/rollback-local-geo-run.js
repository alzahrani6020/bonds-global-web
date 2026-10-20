#!/usr/bin/env node
'use strict';

/**
 * Safe rollback for one geo ingestion run.
 * Canonical rows created by the run are deactivated only when they have not
 * acquired provenance from any later/other ingestion. Existing canonical rows
 * are never deleted.
 */

const { Client } = require('pg');

const RUN_ID = process.argv[2];
const APPLY = process.env.GEO_ROLLBACK_APPLY === '1';

function stableJson(value) {
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(key =>
      JSON.stringify(key) + ':' + stableJson(value[key])
    ).join(',') + '}';
  }
  return JSON.stringify(value);
}

function canonicalStateMatches(current, expected) {
  if (!current || !expected) return false;
  const fields = [
    'name_ar','name_en','population','elevation_m',
    'lat','lng','confidence','metadata'
  ];
  return fields.every(field => stableJson(current[field] ?? null) === stableJson(expected[field] ?? null));
}

async function main() {
  if (!RUN_ID) throw new Error('Usage: node scripts/rollback-local-geo-run.js <run_id>');
  if (!APPLY) throw new Error('Rollback requires GEO_ROLLBACK_APPLY=1');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const run = await client.query(
      'select id,snapshot_id,stage,status from geo_ingest.runs where id=$1',
      [RUN_ID]
    );
    if (!run.rows[0]) throw new Error('Run not found');

    const promoted = await client.query(
      `select p.id as promotion_id,p.raw_place_id,p.canonical_place_id,p.action,p.reason,r.source_code,r.source_id
       from geo_ingest.promotions p
       join geo_ingest.raw_places r on r.id=p.raw_place_id
       where p.run_id=$1
       order by p.id desc`,
      [RUN_ID]
    );

    let deactivated = 0;
    let restored = 0;
    let detached = 0;
    let blocked = 0;

    await client.query('begin');

    for (const row of promoted.rows) {
      const guard = row.reason?.rollback_guard || null;

      if (row.action === 'matched_existing') {
        const previousState = guard?.previous_state || null;
        const promotedState = guard?.promoted_state || null;
        if (!previousState || !promotedState) {
          blocked++;
          continue;
        }

        const later = await client.query(
          `select count(*)::int as n
           from geo_ingest.promotions
           where canonical_place_id=$1 and id>$2`,
          [row.canonical_place_id,row.promotion_id]
        );
        if (Number(later.rows[0]?.n || 0) > 0) {
          blocked++;
          continue;
        }

        const current = await client.query(
          `select name_ar,name_en,population,elevation_m,lat,lng,confidence,metadata
           from public.geo_places
           where id=$1
           for update`,
          [row.canonical_place_id]
        );
        if (!canonicalStateMatches(current.rows[0], promotedState)) {
          blocked++;
          continue;
        }

        await client.query(
          `update public.geo_places
           set name_ar=$2,
               name_en=$3,
               population=$4,
               elevation_m=$5,
               lat=$6,
               lng=$7,
               confidence=$8,
               metadata=$9::jsonb,
               updated_at=now()
           where id=$1`,
          [
            row.canonical_place_id,
            previousState.name_ar ?? null,
            previousState.name_en ?? null,
            previousState.population ?? null,
            previousState.elevation_m ?? null,
            previousState.lat ?? null,
            previousState.lng ?? null,
            previousState.confidence ?? 0,
            JSON.stringify(previousState.metadata || {})
          ]
        );

        const insertedAliases = Array.isArray(guard?.inserted_aliases)
          ? guard.inserted_aliases
          : [];
        for (const alias of insertedAliases) {
          if (!alias?.alias) continue;
          await client.query(
            `delete from public.geo_place_aliases
             where place_id=$1 and alias=$2 and language=$3`,
            [row.canonical_place_id,alias.alias,alias.language || 'und']
          );
        }

        const previousLink = guard?.source_link_previous || null;
        if (previousLink) {
          await client.query(
            `update public.geo_place_source_links
             set place_id=$3,
                 source_updated_at=$4,
                 confidence=$5,
                 metadata=$6::jsonb,
                 updated_at=now()
             where source_code=$1 and source_id=$2
               and coalesce(metadata->>'ingestion_run_id','')=$7`,
            [
              row.source_code,row.source_id,previousLink.place_id,
              previousLink.source_updated_at ?? null,
              previousLink.confidence ?? 50,
              JSON.stringify(previousLink.metadata || {}),
              RUN_ID
            ]
          );
        } else {
          const deleted = await client.query(
            `delete from public.geo_place_source_links
             where place_id=$1 and source_code=$2 and source_id=$3
               and coalesce(metadata->>'ingestion_run_id','')=$4`,
            [row.canonical_place_id,row.source_code,row.source_id,RUN_ID]
          );
          detached += deleted.rowCount || 0;
        }

        restored++;
        continue;
      }

      const deleted = await client.query(
        `delete from public.geo_place_source_links
         where place_id=$1 and source_code=$2 and source_id=$3
           and coalesce(metadata->>'ingestion_run_id','')=$4`,
        [row.canonical_place_id,row.source_code,row.source_id,RUN_ID]
      );
      detached += deleted.rowCount || 0;

      if (row.action !== 'created_canonical') {
        blocked++;
        continue;
      }

      const externalRefs = await client.query(
        `select
           (select count(*) from public.geo_place_source_links l
             where l.place_id=$1) as source_links,
           (select count(*) from geo_ingest.promotions p
             where p.canonical_place_id=$1 and p.run_id<>$2) as other_promotions`,
        [row.canonical_place_id,RUN_ID]
      );

      const refs = externalRefs.rows[0];
      if (Number(refs.source_links) > 0 || Number(refs.other_promotions) > 0) {
        blocked++;
        continue;
      }

      await client.query(
        `update public.geo_places
         set is_active=false,
             metadata=metadata || jsonb_build_object('rolled_back_run_id',$2::text),
             updated_at=now()
         where id=$1`,
        [row.canonical_place_id,RUN_ID]
      );
      deactivated++;
    }

    await client.query(
      `update geo_ingest.runs
       set status='cancelled',
           finished_at=coalesce(finished_at,now()),
           metrics=metrics || jsonb_build_object(
             'rollback_deactivated',$2::int,
             'rollback_restored_existing',$3::int,
             'rollback_detached_sources',$4::int,
             'rollback_blocked',$5::int,
             'rolled_back_at',now()
           )
       where id=$1`,
      [RUN_ID,deactivated,restored,detached,blocked]
    );

    await client.query(
      `update geo_ingest.source_snapshots s
       set status='superseded'
       from geo_ingest.runs r
       where r.id=$1 and s.id=r.snapshot_id`,
      [RUN_ID]
    );

    await client.query('commit');

    console.log(JSON.stringify({
      run_id: RUN_ID,
      deactivated_created_places: deactivated,
      restored_existing_places: restored,
      detached_source_links: detached,
      blocked_due_to_later_provenance: blocked,
      status: blocked ? 'partial-safe-rollback' : 'rolled-back'
    }, null, 2));

    if (blocked) process.exitCode = 4;
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
