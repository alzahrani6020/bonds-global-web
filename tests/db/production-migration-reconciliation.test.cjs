'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { classify, reconcile } = require('../../scripts/reconcile-production-migrations');

const file = 'supabase/migrations/20261117040000_standalone_hr_saas_baseline.sql';
const original = 'create table public.example (id uuid);';
const readFile = () => original;
const recorded = [{ version: '20261125000218', name: 'standalone_hr_saas_baseline', statements: [original] }];

test('exact recorded SQL under a legacy version is verified and not pending', () => {
  assert.deepEqual(classify([file], recorded, readFile), {
    pending: [],
    verified: [{ file, recordedVersion: '20261125000218' }]
  });
});

test('migration not yet recorded remains pending', () => {
  assert.deepEqual(classify([file], [], readFile), { pending: [file], verified: [] });
});

test('name collision with changed SQL fails closed', () => {
  assert.throws(() => classify([file], [{ ...recorded[0], statements: ['select 1;'] }], readFile), /differs/);
});

test('version collision with a different migration name fails closed', () => {
  const current = [{ version: '20261117040000', name: 'other_migration', statements: [original] }];
  assert.throws(() => classify([file], current, readFile), /differs/);
});

test('management response must be valid array and SQL not empty', () => {
  assert.throws(() => classify([file], { data: recorded }, readFile), /array/);
  assert.throws(() => classify([file], [], () => ' '), /Empty/);
});

test('invalid path and wrong production project reject before request', async () => {
  assert.throws(() => classify(['../danger.sql'], [], readFile), /Invalid migration/);
  await assert.rejects(
    reconcile([file], { token: 'not-a-real-token', ref: 'wrong-project', request: () => { throw Error('Must not call network'); }, readFile }),
    /unexpected production project/
  );
});

test('reconciler uses dedicated read-only endpoint with scoped project', async () => {
  let url, opts;
  const mock = async (u, o) => {
    url = u; opts = o;
    return { status: 201, json: async () => recorded };
  };
  const result = await reconcile([file], { token: 'synthetic-test-token', ref: 'hutxsqzplyuqgnghsrcs', request: mock, readFile });
  assert.equal(url, 'https://api.supabase.com/v1/projects/hutxsqzplyuqgnghsrcs/database/query/read-only');
  assert.equal(opts.method, 'POST');
  assert.match(JSON.parse(opts.body).query, /supabase_migrations.schema_migrations/);
  assert.deepEqual(result.pending, []);
  assert.equal(result.verified.length, 1);
});

test('management query non-201 response fails closed', async () => {
  await assert.rejects(
    reconcile([file], { token: 'synthetic-test-token', ref: 'hutxsqzplyuqgnghsrcs',
      request: async () => ({ status: 403 }), readFile }),
    /HTTP 403/
  );
});
