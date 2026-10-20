#!/usr/bin/env node
'use strict';

const { Client } = require('pg');

const RUN_ID = process.argv[2];

async function main() {
  if (!RUN_ID) throw new Error('Usage: node scripts/promote-local-geo-run.js <run_id>');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

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

    const newCountries = [...new Set(
      rows.rows.filter(row => row.decision === 'new_canonical').map(row => row.country_code).filter(Boolean)
    )];

    if (newCountries.length) {
      const adminReadiness = await client.query(
        `select country_code,count(*)::int as n
         from public.geo_admin_areas
         where country_code = any($1::text[]) and is_active=true
         group by country_code`,
        [newCountries]
      );
      const ready = new Map(adminReadiness.rows.map(row => [row.country_code, Number(row.n || 0)]));
      const missing = newCountries.filter(code => !ready.get(code));
      if (missing.length) {
        throw new Error(
          'Promotion blocked: canonical admin hierarchy is not ready for ' + missing.join(', ')
        );
      }
    }

    let matched = 0;
    let created = 0;

    await client.query('begin');

    for (const row of rows.rows) {
      let canonicalId = row.canonical_place_id;
      let action = 'matched_existing';

      if (row.decision === 'new_canonical') {
        const inserted = await client.query(
          `insert into public.geo_places(
            canonical_code,country_code,name_ar,name_en,canonical_name,place_type,
            lat,lng,population,elevation_m,source_code,source_id,source_updated_at,
            confidence,is_canonical,is_active,metadata
          ) values(
            $1,$2,$3,$4,coalesce($3,$4,$1),$5,$6,$7,$8,$9,$10,$11,$12,
            least(100,greatest(0,$13::int)),true,true,$14::jsonb
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
            'SRC-' + row.source_code + '-' + row.source_id,
            row.country_code,row.name_ar,row.name_en,row.place_type || 'other',
            row.lat,row.lng,row.population,row.elevation_m,row.source_code,row.source_id,
            row.source_updated_at,row.overall_score,
            JSON.stringify({ ingestion_run_id: RUN_ID, raw_place_id: row.raw_place_id })
          ]
        );
        canonicalId = inserted.rows[0].id;
        action = 'created_canonical';
        created++;
      } else {
        await client.query(
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
           where id=$1`,
          [
            canonicalId,row.name_ar,row.name_en,row.population,row.elevation_m,
            row.lat,row.lng,row.overall_score,row.source_code,RUN_ID
          ]
        );
        matched++;
      }

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

      const aliases = Array.isArray(row.aliases) ? row.aliases : [];
      for (const alias of aliases) {
        if (!alias || !alias.alias) continue;
        await client.query(
          `insert into public.geo_place_aliases(place_id,alias,language,alias_type,source_code)
           values($1,$2,$3,$4,$5)
           on conflict(place_id,alias,language) do nothing`,
          [canonicalId,alias.alias,alias.language || null,alias.alias_type || 'source',row.source_code]
        );
      }

      await client.query(
        `insert into geo_ingest.promotions(
          run_id,raw_place_id,canonical_place_id,action,decision_score,reason
        ) values($1,$2,$3,$4,$5,$6::jsonb)
        on conflict(run_id,raw_place_id) do nothing`,
        [RUN_ID,row.raw_place_id,canonicalId,action,row.overall_score,JSON.stringify(row.reason || {})]
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
