'use strict';
// Apply only previously reconciled pending SQL through Supabase's transactional
// Management API migration endpoint. No direct Postgres password is needed.
const fs = require('node:fs');
const { identity, normalize, reconcile } = require('./reconcile-production-migrations');
const EXPECTED_REF = 'hutxsqzplyuqgnghsrcs';
const MAX_BYTES = 1024 * 1024;

function readValidatedSql(file, readFile = f => fs.readFileSync(f, 'utf8')) {
  identity(file);
  if (/_rollback\.sql$/.test(file)) throw new Error('Rollback migrations are forbidden');
  const sql = String(readFile(file));
  if (!normalize(sql)) throw new Error('Empty migration: ' + file);
  if (Buffer.byteLength(sql, 'utf8') > MAX_BYTES) throw new Error('Migration exceeds 1 MiB: ' + file);
  return sql;
}

async function applyPending(files, { token, ref, request = fetch, readFile } = {}) {
  if (!token || ref !== EXPECTED_REF) throw new Error('Missing token or wrong production project');
  const applied = [], verified = [];
  for (const file of files) {
    const sql = readValidatedSql(file, readFile);
    const args = { token, ref, request, readFile: () => sql };
    const before = await reconcile([file], args);
    if (!before.pending.length) {
      verified.push(file);
      continue;
    }

    const url = 'https://api.supabase.com/v1/projects/' + ref + '/database/migrations';
    let response;
    let requestError;
    try {
      response = await request(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: identity(file).name, query: sql }),
        signal: AbortSignal.timeout(90000)
      });
    } catch (error) {
      requestError = error;
    }

    // A network or 5xx response could occur after a successful commit.
    // Reconcile read-only before deciding; NEVER blindly retry the write.
    if (requestError || (response && response.status >= 500)) {
      const afterAmbiguous = await reconcile([file], args);
      if (!afterAmbiguous.pending.length) {
        applied.push(file);
        continue;
      }
      throw new Error('Migration outcome unverified; no retry: ' + file);
    }

    if (!response || response.status !== 200) {
      throw new Error('Migration Management API rejected ' + file + ': HTTP ' + (response?.status ?? 'unknown'));
    }

    const after = await reconcile([file], args);
    if (after.pending.length) throw new Error('Migration success response without exact SQL history: ' + file);
    applied.push(file);
  }
  return { applied, verified };
}

async function main() {
  const input = process.env.MIGRATIONS_PENDING || '/tmp/pending-migrations.txt';
  const files = fs.readFileSync(input, 'utf8').split(/\r?\n/).filter(Boolean);
  const result = await applyPending(files, {
    token: process.env.SUPABASE_ACCESS_TOKEN,
    ref: process.env.SUPABASE_PROJECT_REF
  });
  for (const file of result.applied) console.log('APPLIED_AND_VERIFIED:', file);
  for (const file of result.verified) console.log('ALREADY_VERIFIED:', file);
  console.log('MIGRATION_API_APPLIED_COUNT:', result.applied.length);
}
if (require.main === module) main().catch(error => {
  console.error('MIGRATION_API_FAIL:', error.message);
  process.exitCode = 1;
});
module.exports = { readValidatedSql, applyPending };
