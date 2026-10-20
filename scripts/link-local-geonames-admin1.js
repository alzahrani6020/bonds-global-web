#!/usr/bin/env node
'use strict';

/**
 * Link local GeoNames ADM1 identities to Bonds canonical admin areas.
 * Reads local dump files only. No runtime API, AI API, API key or provider token.
 *
 * Required:
 *   .tmp-geo/admin1CodesASCII.txt
 *   DATABASE_URL
 * Optional:
 *   .tmp-geo/alternateNames.txt
 *
 * The script plans deterministic one-to-one matches by default. It writes to
 * public.geo_admin_area_source_links only when GEO_ADMIN1_APPLY=1 is set.
 * Ambiguous or unresolved rows block all writes and are written to
 * .tmp-geo/geonames-admin1-review.json so ingestion remains fail-closed.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');
const { normalizeText } = require('../lib/geo/normalization');

const ROOT = path.join(__dirname, '..');
const GEO_DIR = path.join(ROOT, '.tmp-geo');
const ADMIN1_FILE = process.argv[2] || path.join(GEO_DIR, 'admin1CodesASCII.txt');
const ALT_FILE = path.join(GEO_DIR, 'alternateNames.txt');
const REVIEW_FILE = path.join(GEO_DIR, 'geonames-admin1-review.json');
const APPLY = process.env.GEO_ADMIN1_APPLY === '1';
const SOURCE_CODE = 'geonames';

const ARAB_CODES = new Set([
  'DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR',
  'MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE'
]);

function normalizeEnglish(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(governorate|province|region|state|municipality|emirate|wilaya)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeArabic(value) {
  return normalizeText(value)
    .replace(/^(منطقة|محافظة|ولاية|إقليم|اقليم|جهة|إمارة|امارة|بلدية)\s+/u, '')
    .trim();
}

async function readAdmin1Rows() {
  if (!fs.existsSync(ADMIN1_FILE)) throw new Error('Missing local GeoNames ADM1 file: ' + ADMIN1_FILE);
  const rows = [];
  const rl = readline.createInterface({ input: fs.createReadStream(ADMIN1_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line.startsWith('#')) continue;
    const p = line.split('\t');
    const sourceCode = p[0] || '';
    const dot = sourceCode.indexOf('.');
    if (dot < 1) continue;
    const countryCode = sourceCode.slice(0, dot).toUpperCase();
    if (!ARAB_CODES.has(countryCode)) continue;
    rows.push({
      country_code: countryCode,
      source_admin_code: sourceCode,
      source_full_code: sourceCode,
      name: p[1] || null,
      ascii_name: p[2] || null,
      source_id: p[3] || null
    });
  }
  return rows;
}

async function readArabicAliases(ids) {
  const out = new Map();
  if (!fs.existsSync(ALT_FILE) || !ids.size) return out;
  const rl = readline.createInterface({ input: fs.createReadStream(ALT_FILE), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line || line.startsWith('#')) continue;
    const p = line.split('\t');
    const geonameId = p[1];
    const lang = p[2];
    const value = p[3];
    if (!ids.has(geonameId) || lang !== 'ar' || !value) continue;
    if (!out.has(geonameId)) out.set(geonameId, []);
    const arr = out.get(geonameId);
    if (!arr.includes(value)) arr.push(value);
  }
  return out;
}

function buildCanonicalIndexes(rows) {
  const byCountry = new Map();
  for (const row of rows) {
    if (!byCountry.has(row.country_code)) byCountry.set(row.country_code, []);
    byCountry.get(row.country_code).push({
      ...row,
      norm_en: normalizeEnglish(row.name_en),
      norm_ar: normalizeArabic(row.name_ar)
    });
  }
  return byCountry;
}

function matchOne(source, canonicalRows, arabicAliases) {
  const sourceEn = new Set([
    normalizeEnglish(source.name),
    normalizeEnglish(source.ascii_name)
  ].filter(Boolean));
  const sourceAr = new Set((arabicAliases || []).map(normalizeArabic).filter(Boolean));

  const matches = canonicalRows.filter(row => {
    const enMatch = row.norm_en && sourceEn.has(row.norm_en);
    const arMatch = row.norm_ar && sourceAr.has(row.norm_ar);
    return enMatch || arMatch;
  });

  if (matches.length === 1) {
    const m = matches[0];
    return {
      status: 'matched',
      admin_area_id: m.id,
      canonical_code: m.canonical_code,
      confidence: sourceAr.has(m.norm_ar) && sourceEn.has(m.norm_en) ? 100 : 95,
      reason: sourceAr.has(m.norm_ar) ? 'exact_normalized_ar' : 'exact_normalized_en'
    };
  }

  return {
    status: matches.length ? 'ambiguous' : 'unresolved',
    candidates: matches.map(x => ({ id: x.id, canonical_code: x.canonical_code, name_ar: x.name_ar, name_en: x.name_en }))
  };
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const sourceRows = await readAdmin1Rows();
  if (!sourceRows.length) throw new Error('No Arab ADM1 rows found in local GeoNames file');

  const ids = new Set(sourceRows.map(x => x.source_id).filter(Boolean));
  const aliases = await readArabicAliases(ids);

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
  await client.connect();

  try {
    const canonical = await client.query(
      `select id,canonical_code,country_code,name_ar,name_en,admin_level
       from public.geo_admin_areas
       where admin_level=1 and is_active=true
       order by country_code,canonical_code`
    );
    const index = buildCanonicalIndexes(canonical.rows);

    const review = [];
    const matched = [];

    for (const source of sourceRows) {
      const outcome = matchOne(source, index.get(source.country_code) || [], aliases.get(source.source_id));
      if (outcome.status !== 'matched') {
        review.push({ ...source, ...outcome });
        continue;
      }
      matched.push({ source, outcome });
    }

    fs.mkdirSync(GEO_DIR, { recursive: true });
    fs.writeFileSync(REVIEW_FILE, JSON.stringify({
      generated_at: new Date().toISOString(),
      source: ADMIN1_FILE,
      source_code: SOURCE_CODE,
      apply_requested: APPLY,
      matched: matched.length,
      unresolved: review.length,
      review
    }, null, 2) + '\n');

    if (review.length) {
      console.log(JSON.stringify({
        source_rows: sourceRows.length,
        matched: matched.length,
        unresolved: review.length,
        applied: 0,
        apply_requested: APPLY,
        blocked_reason: 'unresolved_admin1_rows',
        review_file: REVIEW_FILE,
        runtime_api_required: false,
        api_key_required: false
      }, null, 2));
      process.exitCode = 3;
      return;
    }

    if (!APPLY) {
      console.log(JSON.stringify({
        source_rows: sourceRows.length,
        matched: matched.length,
        unresolved: 0,
        applied: 0,
        apply_requested: false,
        status: 'planned_only',
        review_file: REVIEW_FILE,
        runtime_api_required: false,
        api_key_required: false
      }, null, 2));
      return;
    }

    await client.query('begin');
    await client.query(
      `insert into public.geo_data_sources(
        code,name,source_type,license,attribution,
        commercial_use_allowed,runtime_api_required,api_key_required,
        refresh_interval,metadata
      ) values(
        'geonames','GeoNames','download','CC BY 4.0','GeoNames',
        true,false,false,'monthly',
        '{"mode":"offline_dump","canonical_provider_code":"geonames"}'::jsonb
      )
      on conflict(code) do update set
        name=excluded.name,
        source_type=excluded.source_type,
        license=excluded.license,
        attribution=excluded.attribution,
        commercial_use_allowed=excluded.commercial_use_allowed,
        runtime_api_required=false,
        api_key_required=false,
        refresh_interval=excluded.refresh_interval,
        metadata=public.geo_data_sources.metadata || excluded.metadata,
        updated_at=now()`
    );

    for (const { source, outcome } of matched) {
      await client.query(
        `insert into public.geo_admin_area_source_links(
          id,admin_area_id,source_code,country_code,admin_level,
          source_admin_code,source_id,confidence,metadata
        ) values(
          nextval('public.geo_admin_area_source_links_id_seq'),
          $1,$2,$3,1,$4,$5,$6,$7::jsonb
        )
        on conflict(source_code,country_code,admin_level,source_admin_code)
        do update set
          admin_area_id=excluded.admin_area_id,
          source_id=excluded.source_id,
          confidence=greatest(public.geo_admin_area_source_links.confidence,excluded.confidence),
          metadata=public.geo_admin_area_source_links.metadata || excluded.metadata,
          updated_at=now()`,
        [
          outcome.admin_area_id,
          SOURCE_CODE,
          source.country_code,
          source.source_admin_code,
          source.source_id,
          outcome.confidence,
          JSON.stringify({
            source_full_code: source.source_full_code,
            source_name: source.name,
            source_ascii_name: source.ascii_name,
            match_reason: outcome.reason,
            local_dump: true
          })
        ]
      );
    }
    await client.query('commit');

    console.log(JSON.stringify({
      source_rows: sourceRows.length,
      matched: matched.length,
      unresolved: 0,
      applied: matched.length,
      apply_requested: true,
      review_file: REVIEW_FILE,
      runtime_api_required: false,
      api_key_required: false
    }, null, 2));
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
