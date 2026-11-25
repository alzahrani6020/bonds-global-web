'use strict';
// Read-only reconciliation. Never assumes a migration is applied from its name alone.
const fs = require('node:fs');
const path = require('node:path');

const EXPECTED_REF = 'hutxsqzplyuqgnghsrcs';
function identity(file) {
  if (!/^supabase\/migrations\/\d{14}_[a-zA-Z0-9._-]+\.sql$/.test(file)) {
    throw new Error('Invalid migration path');
  }
  const match = path.posix.basename(file).match(/^(\d{14})_(.+)\.sql$/);
  return { version: match[1], name: match[2] };
}
const normalize = sql => String(sql || '').replace(/\r\n/g, '\n').trim();

function classify(files, remoteRows, readFile = f => fs.readFileSync(f, 'utf8')) {
  if (!Array.isArray(remoteRows)) throw new Error('Migration API response must be an array');
  const pending = [], verified = [];
  for (const file of files) {
    const id = identity(file);
    const sql = normalize(readFile(file));
    if (!sql) throw new Error('Empty migration file: ' + file);
    const candidates = remoteRows.filter(r => r && (r.name === id.name || r.version === id.version));
    if (!candidates.length) { pending.push(file); continue; }
    const equal = candidates.find(r => r.name === id.name &&
      Array.isArray(r.statements) && normalize(r.statements.join('\n')) === sql);
    if (!equal || candidates.some(r => r.version === id.version &&
        (r.name !== id.name || normalize((r.statements || []).join('\n')) !== sql))) {
      throw new Error('Recorded migration differs from checked-in SQL: ' + file);
    }
    verified.push({ file, recordedVersion: equal.version });
  }
  return { pending, verified };
}

async function reconcile(files, { token, ref, request = fetch, readFile } = {}) {
  if (!token || ref !== EXPECTED_REF) throw new Error('Missing access token or unexpected production project reference');
  files.forEach(identity);
  if (!files.length) return { pending: [], verified: [] };
  const names = files.map(f => identity(f).name);
  const ids = files.map(f => identity(f).version);
  const quote = x => "'" + x.replace(/'/g, "''") + "'";
  const sql = 'select version,name,statements from supabase_migrations.schema_migrations ' +
    'where name in (' + names.map(quote).join(',') + ') or version in (' + ids.map(quote).join(',') + ')';
  const response = await request('https://api.supabase.com/v1/projects/' + ref + '/database/query/read-only', {
    method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }), signal: AbortSignal.timeout(30000)
  });
  if (response.status !== 201) throw new Error('Read-only migration history lookup failed: HTTP ' + response.status);
  const remote = await response.json();
  return classify(files, remote, readFile);
}

async function main() {
  const input = process.env.MIGRATIONS_INPUT || '/tmp/migrations.txt';
  const output = process.env.MIGRATIONS_PENDING || '/tmp/pending-migrations.txt';
  const files = fs.readFileSync(input, 'utf8').split(/\r?\n/).filter(Boolean);
  const result = await reconcile(files, {
    token: process.env.SUPABASE_ACCESS_TOKEN,
    ref: process.env.SUPABASE_PROJECT_REF
  });
  fs.writeFileSync(output, result.pending.length ? result.pending.join('\n') + '\n' : '');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, 'pending_count=' + result.pending.length + '\n');
  for (const row of result.verified) {
    console.log('VERIFIED_SQL_MATCH: ' + row.file + ' (recorded as ' + row.recordedVersion + ')');
  }
  console.log('PENDING_MIGRATIONS:', result.pending.length);
}
if (require.main === module) main().catch(err => {
  console.error('MIGRATION_RECONCILIATION_FAIL:', err.message);
  process.exitCode = 1;
});
module.exports = { identity, normalize, classify, reconcile };
