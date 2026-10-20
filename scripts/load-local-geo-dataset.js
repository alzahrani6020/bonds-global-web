#!/usr/bin/env node
'use strict';

/**
 * Backward-compatible entrypoint.
 * Direct writes into public.geo_places are intentionally disabled.
 * All imports must pass through governed staging, quality gates, reconciliation,
 * and promotion.
 */

const { spawnSync } = require('child_process');
const path = require('path');

const dataset = process.argv[2] || path.join(__dirname, '..', '.tmp-geo', 'arab-localities.ndjson');
const runner = path.join(__dirname, 'ingest-local-geo-dataset.js');
const result = spawnSync(process.execPath, [runner, dataset], {
  env: process.env,
  stdio: 'inherit'
});
process.exit(result.status || 0);
