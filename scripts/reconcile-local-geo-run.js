#!/usr/bin/env node
'use strict';

const { Client } = require('pg');
const { scoreCandidate } = require('../lib/geo/normalization');

const RUN_ID = process.argv[2];
const APPLY = process.env.GEO_RECONCILE_APPLY === '1';

function providerAdmin1Code(countryCode, admin1Code) {
  const country = String(countryCode || '').trim().toUpperCase();
  const code = String(admin1Code || '').trim();
  if (!country || !code) return null;
  return code.includes('.') ? code.toUpperCase() : country + '.' + code;
}

async function main() {
  if (!RUN_ID) throw new Error('Usage: node scripts/reconcile-local-geo-run.js <run_id>');
  if (!APPLY) throw new Error('Reconciliation requires GEO_RECONCILE_APPLY=1');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const runRes = await client.query(
      `select id,status,stage from geo_ingest.runs where id=$1`,
      [RUN_ID]
    );
    if (!runRes.rows[0]) throw new Error('Run not found');
    if (runRes.rows[0].status === 'failed') throw new Error('Run failed quality gates and cannot be reconciled');

    const rawRes = await client.query(
      `select * from geo_ingest.raw_places
       where run_id=$1 and validation_status='valid'
       order by id`,
      [RUN_ID]
    );

    await client.query('delete from geo_ingest.match_candidates where run_id=$1', [RUN_ID]);

    let matched = 0;
    let created = 0;
    let review = 0;

    for (const raw of rawRes.rows) {
      const sourceMatch = await client.query(
        `select p.id,p.canonical_code,p.country_code,p.admin1_id,p.name_ar,p.name_en,p.canonical_name,
                p.lat,p.lng,l.source_code,l.source_id
         from public.geo_place_source_links l
         join public.geo_places p on p.id=l.place_id
         where l.source_code=$1 and l.source_id=$2 and p.is_active=true
         limit 1`,
        [raw.source_code, raw.source_id]
      );

      let candidates = sourceMatch.rows;
      if (!candidates.length) {
        const primarySourceMatch = await client.query(
          `select id,canonical_code,country_code,admin1_id,name_ar,name_en,canonical_name,lat,lng,source_code,source_id
           from public.geo_places
           where source_code=$1 and source_id=$2 and is_active=true
           limit 1`,
          [raw.source_code, raw.source_id]
        );
        candidates = primarySourceMatch.rows;
      }
      let mappedAdmin1Id = null;
      const providerAdminCode = providerAdmin1Code(raw.country_code, raw.admin1_code);
      if (!candidates.length && providerAdminCode) {
        const adminLink = await client.query(
          `select admin_area_id
           from public.geo_admin_area_source_links
           where source_code=$1 and country_code=$2 and admin_level=1
             and source_admin_code=$3
           limit 2`,
          [raw.source_code, raw.country_code, providerAdminCode]
        );
        if (adminLink.rows.length === 1) {
          mappedAdmin1Id = adminLink.rows[0].admin_area_id;
        }
      }

      if (!candidates.length) {
        const nameCandidates = await client.query(
          `select id,canonical_code,country_code,admin1_id,name_ar,name_en,canonical_name,lat,lng,source_code,source_id
           from public.geo_places
           where country_code=$1 and is_active=true
             and ($5::uuid is null or admin1_id=$5)
             and (
               lower(coalesce(name_ar,''))=lower(coalesce($2,''))
               or lower(coalesce(name_en,''))=lower(coalesce($3,''))
               or lower(coalesce(canonical_name,''))=lower(coalesce($4,''))
             )
           limit 20`,
          [raw.country_code, raw.name_ar, raw.name_en, raw.name_ar || raw.name_en, mappedAdmin1Id]
        );
        candidates = nameCandidates.rows;
      }

      const scored = candidates
        .map(c => ({ canonical: c, score: scoreCandidate(raw, c) }))
        .filter(x => x.score)
        .sort((a,b) => b.score.score - a.score.score);

      let chosen = scored[0] || null;
      let decision;
      let matchType;
      let overallScore;
      let canonicalId = null;
      let reason;
      let adminScore = null;

      if (!chosen) {
        decision = 'new_canonical';
        matchType = 'new_place';
        overallScore = 90;
        created++;
        reason = { reason: 'no_existing_candidate' };
      } else if (
        scored.length === 1 &&
        chosen.score.matchType === 'exact_name' &&
        mappedAdmin1Id &&
        chosen.canonical.admin1_id === mappedAdmin1Id
      ) {
        decision = 'auto_match';
        matchType = 'exact_name';
        overallScore = 96;
        canonicalId = chosen.canonical.id;
        adminScore = 100;
        matched++;
        reason = {
          reason: 'exact_name_admin1_identity',
          admin1_id: mappedAdmin1Id,
          provider_admin1_code: providerAdminCode
        };
      } else if (scored.length > 1 &&
                 scored[1].score.score >= chosen.score.score - 3 &&
                 chosen.score.matchType !== 'source_identity') {
        decision = 'review';
        matchType = 'ambiguous';
        overallScore = chosen.score.score;
        canonicalId = chosen.canonical.id;
        review++;
        reason = { reason: 'multiple_close_candidates', alternatives: scored.length };
      } else {
        decision = chosen.score.decision;
        matchType = chosen.score.matchType;
        overallScore = chosen.score.score;
        canonicalId = chosen.canonical.id;
        if (decision === 'auto_match') matched++;
        else review++;
        reason = { reason: 'deterministic_match', distance_m: chosen.score.distanceM };
      }

      await client.query(
        `insert into geo_ingest.match_candidates(
           run_id,raw_place_id,canonical_place_id,match_type,
           name_score,distance_m,admin_score,overall_score,decision,reason
         ) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [
          RUN_ID, raw.id, canonicalId, matchType,
          matchType === 'source_identity' ? 100 : (matchType === 'new_place' ? null : overallScore),
          chosen?.score.distanceM ?? null,
          adminScore, overallScore, decision, JSON.stringify(reason)
        ]
      );
    }

    await client.query(
      `update geo_ingest.runs
       set stage='promotion',status='passed',
           matched_count=$2,new_count=$3,review_count=$4,
           metrics=metrics || jsonb_build_object(
             'matched_count',$2,'new_count',$3,'review_count',$4
           )
       where id=$1`,
      [RUN_ID, matched, created, review]
    );

    console.log(JSON.stringify({
      run_id: RUN_ID,
      raw_valid: rawRes.rows.length,
      auto_match: matched,
      new_canonical: created,
      review
    }, null, 2));
  } finally {
    await client.end();
  }
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
