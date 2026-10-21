/** @jest-environment node */
'use strict';

const path = require('node:path');
const { execFile } = require('node:child_process');

test('real isolated token runtime satisfies governed Capability acceptance', async () => {
  const report = await new Promise((resolve, reject) => {
    execFile(process.execPath, [path.join(__dirname, 'governed-token-runtime-acceptance.js')], {
      cwd: path.resolve(__dirname, '../..'), timeout: 60_000, maxBuffer: 2 * 1024 * 1024,
      killSignal: 'SIGTERM', encoding: 'utf8'
    }, (error, stdout, stderr) => {
      if (error) return reject(new Error(`Isolated runtime acceptance failed:\n${stdout}\n${stderr}`));
      try { resolve(JSON.parse(stdout)); } catch (parseError) { reject(parseError); }
    });
  });
  expect(report.status).toBe('PASS');
  expect(report.production_executed).toBe(false);
  expect(report.cases.length).toBeGreaterThanOrEqual(24);
  expect(report.cases.every(result => result.status === 'PASS')).toBe(true);
  expect(report.previous_runtime_source).toMatchObject({
    source_commit: 'f9bb67a286b3de2990cc5e1f4a12a5a286f5bb24',
    exact_fixture_hash_verified: true, unchanged_engine_hash_verified: true,
    copied_to_temporary_package_only: true
  });
  expect(report.cleanup).toMatchObject({
    runtime_stopped: true, https_server_closed: true, temporary_files_removed: true
  });
}, 65_000);
