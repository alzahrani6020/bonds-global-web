#!/usr/bin/env node
'use strict';

const { spawnSync } = require('child_process');
const path = require('path');

const dataset = process.argv[2] || path.join(__dirname, '..', '.tmp-geo', 'arab-localities.ndjson');

function run(script, args = []) {
  const result = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    env: process.env,
    encoding: 'utf8',
    stdio: ['inherit','pipe','inherit']
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.status !== 0) process.exit(result.status || 1);
  return result.stdout;
}

const staged = run('stage-local-geo-dataset.js', [dataset]);
const runMatch = staged.match(/GEO_RUN_ID=([0-9a-f-]{36})/i);
const runId = runMatch && runMatch[1];
if (!runId) throw new Error('Staging did not return run_id');
run('reconcile-local-geo-run.js', [runId]);
run('promote-local-geo-run.js', [runId]);
