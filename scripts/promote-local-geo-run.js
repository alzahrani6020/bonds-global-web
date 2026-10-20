#!/usr/bin/env node
'use strict';

const { Client } = require('pg');
const { randomUUID } = require('crypto');

const RUN_ID = process.argv[2];
const APPLY = process.env.GEO_PROMOTE_APPLY === '1';

function providerAdmin1Code(countryCode, admin1Code) {
  const country = String(countryCode || '').trim().toUpperCase();
  const code = String(admin1Code || '').trim();
  if (!country || !code) return null;
  return code.includes('.') ? code.toUpperCase() : country + '.' + code;
}

function admin1MapKey(sourceCode, countryCode, admin1Code) {
  const providerCode = providerAdmin1Code(countryCode, admin1Code);
  if (!sourceCode || !countryCode || !providerCode) return null;
  return sourceCode + ':' + String(countryCode).toUpperCase() + ':' + providerCode;
}

async function main() {
  if (!RUN_ID) throw new Error('Usage: node scripts/promote-local-geo-run.js <run_id>');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!APPLY) throw new Error('Promotion requires GEO_PROMOTE_APPLY=1');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const gates = await client.query('select * from geo_ingest.evaluate_quality_gates($1)', [RUN_ID]);
    const blocked = gates.rows.some(r => r.severity === 'blocker' && r.passed === false);
    if (blocked) throw new Error('Promotion blocked by quality gates');

    const unresolved = await client.query(
      `select count(*)::int as n
       from geo_ingest.match_candidates
       where run_id=$1 and decision='review'`,
      [RUN_ID]
    );
    if (Number(unresolved.rows[0]?.n || 0) > 0) {
      throw new Error('Promotion blocked: unresolved review candidates remain');
    }

    const rows = await client.query(
      `select
         m.id as match_id,m.raw_place_id,m.canonical_place_id,m.decision,m.overall_score,m.reason,
         r.*
       from geo_ingest.match_candidates m
       join geo_ingest.raw_places r on r.id=m.raw_place_id
       where m.run_id=$1 and m.decision in ('auto_match','new_canonical')
         and not exists (
           select 1 from geo_ingest.promotions p
           where p.run_id=m.run_id and p.raw_place_id=m.raw_place_id
         )
       order by r.id`,
      [RUN_ID]
    );

    const newRows = rows.rows.filter(row => row.decision === 'new_canonical');
    const newCountries = [...new Set(newRows.map(row => row.country_code).filter(Boolean))];

    const admin1Map = new Map();
    const admin1For = row => {
      const key = admin1MapKey(row?.source_code, row?.country_code, row?.admin1_code);
      return key ? (admin1Map.get(key) || null) : null;
    };

    if (newCountries.length) {
      const adminReadiness = await client.query(
        `select id,country_code
         from public.geo_admin_areas
         where country_code = any($1::text[])
           and is_active=true
           and admin_level=1`,
        [newCountries]
      );

      const countriesWithAdmin1 = new Set(adminReadiness.rows.map(row => row.country_code));
      const missingCountries = newCountries.filter(code => !countriesWithAdmin1.has(code));
      if (missingCountries.length) {
        throw new Error(
          'Promotion blocked: canonical admin hierarchy is not ready for ' + missingCountries.join(', ')
        );
      }

      const sourceCodes = [...new Set(newRows.map(row => row.source_code).filter(Boolean))];
      const sourceLinks = await client.query(
        `select admin_area_id,source_code,country_code,source_admin_code
         from public.geo_admin_area_source_links
         where source_code = any($1::text[])
           and country_code = any($2::text[])
           and admin_level=1`,
        [sourceCodes,newCountries]
      );

      for (const link of sourceLinks.rows) {
        const key = admin1MapKey(link.source_code, link.country_code, link.source_admin_code);
        if (key) admin1Map.set(key, link.admin_area_id);
      }

      const unresolvedAdmin = newRows.filter(row => !admin1For(row));
      if (unresolvedAdmin.length) {
        const sample = unresolvedAdmin
          .slice(0, 10)
          .map(row => row.source_code + ':' + row.country_code + ':' + (row.admin1_code || 'missing'))
          .join(', ');
        throw new Error(
          'Promotion blocked: unresolved provider ADM1 source mapping for ' +
          unresolvedAdmin.length + ' candidates. Sample: ' + sample
        );
      }
    }

    let matched = 0;
    let created = 0;

    await client.query('begin');

    for (const row of rows.rows) {
      let canonicalId = row.canonical_place_id;
      let action = 'matched_existing';
      let promotionReason = row.reason || {};

      if (row.decision === 'new_canonical') {
        const canonicalCode = 'BG-' + row.country_code + '-' +
          randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
        const inserted = await client.query(
          `insert into public.geo_places(
            canonical_code,country_code,admin1_id,name_ar,name_en,canonical_name,place_type,
            lat,lng,population,elevation_m,source_code,source_id,source_updated_at,
            confidence,is_canonical,is_active,metadata
          ) values(
            $1,$2,$3,$4,$5,coalesce($4,$5,$1),$6,$7,$8,$9,$10,$11,$12,$13,
            least(100,greatest(0,$14::int)),true,true,$15::jsonb
          )
          on conflict(source_code,source_id) do update set
            name_ar=coalesce(excluded.name_ar,public.geo_places.name_ar),
            name_en=coalesce(excluded.name_en,public.geo_places.name_en),
            canonical_name=coalesce(excluded.canonical_name,public.geo_places.canonical_name),
            place_type=excluded.place_type,
            lat=excluded.lat,lng=excluded.lng,
            population=coalesce(excluded.population,public.geo_places.population),
            elevation_m=coalesce(excluded.elevation_m,public.geo_places.elevation_m),
            source_updated_at=excluded.source_updated_at,
            confidence=greatest(public.geo_places.confidence,excluded.confidence),
            metadata=public.geo_places.metadata || excluded.metadata,
            updated_at=now()
          returning id`,
          [
            canonicalCode,
            row.country_code,admin1For(row),row.name_ar,row.name_en,row.place_type || 'other',
            row.lat,row.lng,row.population,row.elevation_m,row.source_code,row.source_id,
            row.source_updated_at,row.overall_score,
            JSON.stringify({
              ingestion_run_id: RUN_ID,
              raw_place_id: row.raw_place_id,
              raw_admin1_code: row.admin1_code
            })
          ]
        );
        canonicalId = inserted.rows[0].id;
        action = 'created_canonical';
        created++;
      } else {
        const before = await client.query(
          `select name_ar,name_en,population,elevation_m,lat,lng,confidence,metadata
           from public.geo_places
           where id=$1
           for update`,
          [canonicalId]
        );
        if (!before.rows[0]) throw new Error('Canonical place not found for matched_existing promotion');

        const updated = await client.query(
          `update public.geo_places
           set name_ar=coalesce(name_ar,$2),
               name_en=coalesce(name_en,$3),
               population=coalesce(population,$4),
               elevation_m=coalesce(elevation_m,$5),
               lat=case when lat is null and lng is null and $6::double precision is not null and $7::double precision is not null then $6 else lat end,
               lng=case when lat is null and lng is null and $6::double precision is not null and $7::double precision is not null then $7 else lng end,
               confidence=greatest(confidence,least(100,greatest(0,$8::int))),
               metadata=metadata || jsonb_build_object(
                 'last_enrichment_source',$9::text,
                 'last_enrichment_run_id',$10::text
               ),
               updated_at=now()
           where id=$1
           returning name_ar,name_en,population,elevation_m,lat,lng,confidence,metadata`,
          [
            canonicalId,row.name_ar,row.name_en,row.population,row.elevation_m,
            row.lat,row.lng,row.overall_score,row.source_code,RUN_ID
          ]
        );

        promotionReason = {
          ...(row.reason || {}),
          rollback_guard: {
            previous_state: before.rows[0],
            promoted_state: updated.rows[0]
          }
        };
        matched++;
      }

      const sourceLinkBefore = await client.query(
        `select place_id,source_updated_at,confidence,metadata
         from public.geo_place_source_links
         where source_code=$1 and source_id=$2
         for update`,
        [row.source_code,row.source_id]
      );

      await client.query(
        `insert into public.geo_place_source_links(
           place_id,source_code,source_id,source_updated_at,confidence,metadata
         ) values($1,$2,$3,$4,$5,$6::jsonb)
         on conflict(source_code,source_id) do update set
           place_id=excluded.place_id,
           source_updated_at=excluded.source_updated_at,
           confidence=greatest(public.geo_place_source_links.confidence,excluded.confidence),
           metadata=public.geo_place_source_links.metadata || excluded.metadata,
           updated_at=now()`,
        [
          canonicalId,row.source_code,row.source_id,row.source_updated_at,
          Math.round(Number(row.overall_score || 50)),
          JSON.stringify({ ingestion_run_id: RUN_ID, raw_place_id: row.raw_place_id })
        ]
      );

      promotionReason.rollback_guard = {
        ...(promotionReason.rollback_guard || {}),
        source_link_previous: sourceLinkBefore.rows[0] || null
      };

      const insertedAliases = [];
      const aliases = Array.isArray(row.aliases) ? row.aliases : [];
      for (const alias of aliases) {
        if (!alias || !alias.alias) continue;
        const aliasLanguage = alias.language || 'und';
        const insertedAlias = await client.query(
          `insert into public.geo_place_aliases(place_id,alias,language,alias_type,source_code)
           values($1,$2,$3,$4,$5)
           on conflict(place_id,alias,language) do nothing
           returning id`,
          [canonicalId,alias.alias,aliasLanguage,alias.alias_type || 'source',row.source_code]
        );
        if (insertedAlias.rows.length) {
          insertedAliases.push({ alias: alias.alias, language: aliasLanguage });
        }
      }
      promotionReason.rollback_guard.inserted_aliases = insertedAliases;

      await client.query(
        `insert into geo_ingest.promotions(
          run_id,raw_place_id,canonical_place_id,action,decision_score,reason
        ) values($1,$2,$3,$4,$5,$6::jsonb)
        on conflict(run_id,raw_place_id) do nothing`,
        [RUN_ID,row.raw_place_id,canonicalId,action,row.overall_score,JSON.stringify(promotionReason)]
      );
    }

    await client.query(
      `update geo_ingest.runs
       set stage='complete',
           status=case when $2::int>0 then 'blocked' else 'passed' end,
           finished_at=now(),
           metrics=metrics || jsonb_build_object(
             'promoted_count',$3::int,
             'unresolved_review_count',$2::int
           )
       where id=$1`,
      [RUN_ID, unresolved.rows[0].n, rows.rows.length]
    );

    await client.query(
      `update geo_ingest.source_snapshots s
       set status=case when $2::int>0 then 'validated' else 'promoted' end
       from geo_ingest.runs r
       where r.id=$1 and s.id=r.snapshot_id`,
      [RUN_ID, unresolved.rows[0].n]
    );

    await client.query('commit');

    console.log(JSON.stringify({
      run_id: RUN_ID,
      promoted: rows.rows.length,
      matched_existing: matched,
      created_canonical: created,
      unresolved_review: unresolved.rows[0].n,
      status: unresolved.rows[0].n > 0 ? 'blocked' : 'complete'
    }, null, 2));

    if (unresolved.rows[0].n > 0) process.exitCode = 3;
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
