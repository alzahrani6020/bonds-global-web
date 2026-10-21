#!/usr/bin/env node
'use strict';

const fs = require('fs');
const readline = require('readline');
const path = require('path');
const { normalizeKey } = require('../lib/geo/normalization');

function parseArgs(argv) {
  const args = {
    cities: path.join('.tmp-geo', 'current-cities.json'),
    source: path.join('.tmp-geo', 'arab-localities.ndjson'),
    output: path.join('.tmp-geo', 'geonames-safe-candidates.ndjson'),
    report: path.join('.tmp-geo', 'geonames-safe-candidate-report.json'),
    maxRows: 5000
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const value = argv[i + 1];

    if (arg === '--cities') {
      args.cities = value;
      i += 1;
    } else if (arg === '--source') {
      args.source = value;
      i += 1;
    } else if (arg === '--output') {
      args.output = value;
      i += 1;
    } else if (arg === '--report') {
      args.report = value;
      i += 1;
    } else if (arg === '--max-rows') {
      args.maxRows = Number(value);
      i += 1;
    } else {
      throw new Error('Unknown argument: ' + arg);
    }
  }

  if (!Number.isInteger(args.maxRows) || args.maxRows < 1) {
    throw new Error('--max-rows must be a positive integer');
  }

  return args;
}

function directKeys(row) {
  return [...new Set(
    [row.name_ar, row.name_en, row.canonical_name]
      .map(normalizeKey)
      .filter(Boolean)
  )];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const payload = JSON.parse(fs.readFileSync(args.cities, 'utf8'));
  const cities = Array.isArray(payload.cities) ? payload.cities : [];

  const cityRefsByKey = new Map();

  for (const city of cities) {
    const cc = String(city.country_code || '').trim().toUpperCase();
    if (!cc) continue;

    const cityRef = {
      code: city.code || null,
      name_ar: city.name_ar || null,
      name_en: city.name_en || null,
      region: city.region || null
    };

    const keys = [...new Set(
      [city.name_ar, city.name_en]
        .map(normalizeKey)
        .filter(Boolean)
    )];

    for (const key of keys) {
      const id = cc + ':' + key;
      if (!cityRefsByKey.has(id)) cityRefsByKey.set(id, []);
      cityRefsByKey.get(id).push(cityRef);
    }
  }

  const sourceCountByKey = new Map();
  const candidateRows = [];
  let sourceRows = 0;
  let directCandidateRows = 0;

  const input = fs.createReadStream(args.source);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });

  for await (const line of rl) {
    if (!line.trim()) continue;
    sourceRows += 1;

    const row = JSON.parse(line);
    const cc = String(row.country_code || '').trim().toUpperCase();
    if (!cc) continue;

    const matchedIds = [...new Set(
      directKeys(row)
        .map(key => cc + ':' + key)
        .filter(id => cityRefsByKey.has(id))
    )];

    if (!matchedIds.length) continue;

    directCandidateRows += 1;
    candidateRows.push({ row, matchedIds });

    for (const id of matchedIds) {
      sourceCountByKey.set(id, (sourceCountByKey.get(id) || 0) + 1);
    }
  }

  const rejected = {
    ambiguous_city_key: 0,
    ambiguous_source_key: 0,
    multiple_canonical_cities: 0
  };

  const safeRows = [];
  const countries = {};

  for (const candidate of candidateRows) {
    let rejectReason = null;
    const canonicalCodes = new Set();

    for (const id of candidate.matchedIds) {
      const refs = cityRefsByKey.get(id) || [];

      if (refs.length !== 1) {
        rejectReason = 'ambiguous_city_key';
        break;
      }

      if ((sourceCountByKey.get(id) || 0) !== 1) {
        rejectReason = 'ambiguous_source_key';
        break;
      }

      canonicalCodes.add(String(refs[0].code || ''));
    }

    if (!rejectReason && canonicalCodes.size !== 1) {
      rejectReason = 'multiple_canonical_cities';
    }

    if (rejectReason) {
      rejected[rejectReason] += 1;
      continue;
    }

    const cc = String(candidate.row.country_code || '').trim().toUpperCase();

    safeRows.push({
      ...candidate.row,
      _candidate_match_keys: candidate.matchedIds.map(
        id => id.slice(id.indexOf(':') + 1)
      ),
      _candidate_city_code: [...canonicalCodes][0]
    });

    countries[cc] = (countries[cc] || 0) + 1;
  }

  if (safeRows.length === 0) {
    throw new Error('Safe candidate subset is empty');
  }

  if (safeRows.length > args.maxRows) {
    throw new Error(`Safe candidate subset ${safeRows.length} exceeds hard cap ${args.maxRows}`);
  }

  if (safeRows.length >= sourceRows) {
    throw new Error('Refusing to stage the full source dataset');
  }

  fs.mkdirSync(path.dirname(args.output), { recursive: true });

  fs.writeFileSync(
    args.output,
    safeRows.map(row => JSON.stringify(row)).join('\n') + '\n'
  );

  const report = {
    production_city_count: cities.length,
    source_rows: sourceRows,
    direct_candidate_rows: directCandidateRows,
    safe_rows: safeRows.length,
    rejected,
    countries,
    hard_cap: args.maxRows,
    matching_policy:
      'direct canonical names only; unique source key; unique production city'
  };

  fs.writeFileSync(
    args.report,
    JSON.stringify(report, null, 2) + '\n'
  );

  console.log(JSON.stringify(report, null, 2));
}

main().catch(err => {
  console.error(err.stack || err.message);
  process.exit(1);
});
