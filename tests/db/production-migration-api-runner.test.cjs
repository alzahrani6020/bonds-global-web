'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyPending, readValidatedSql } = require('../../scripts/apply-production-migration-api');

const REF = 'hutxsqzplyuqgnghsrcs';
const FILE = 'supabase/migrations/20261125110000_runner_contract.sql';
const SQL = 'select 1;';
const row = (sql = SQL) => ({ version: '20261125110000', name: 'runner_contract', statements: [sql] });

function mockApi({ exists = false, recordedSql = SQL, writeStatus = 200, failAfterCommit = false } = {}) {
  let recorded = exists, writes = 0, queries = 0;
  const request = async (url, options) => {
    if (url.endsWith('/database/query/read-only')) {
      queries++;
      return { status: 201, json: async () => recorded ? [row(recordedSql)] : [] };
    }
    assert.match(url, /\/database\/migrations$/);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    const payload = JSON.parse(options.body);
    assert.equal(payload.name, 'runner_contract');
    assert.equal(payload.query, SQL);
    writes++;
    if (failAfterCommit) {
      recorded = true;
      throw new Error('connection reset after commit');
    }
    if (writeStatus === 200) recorded = true;
    return { status: writeStatus };
  };
  return { request, counters: () => ({ writes, queries }) };
}

const config = request => ({ token: 'test-token', ref: REF, request, readFile: () => SQL });

test('no pending migration never reaches the database', async () => {
  const api = mockApi();
  const result = await applyPending([], config(api.request));
  assert.deepEqual(result, { applied: [], verified: [] });
  assert.deepEqual(api.counters(), { writes: 0, queries: 0 });
});

test('exactly recorded SQL is verified without write', async () => {
  const api = mockApi({ exists: true });
  const result = await applyPending([FILE], config(api.request));
  assert.deepEqual(result.applied, []);
  assert.deepEqual(result.verified, [FILE]);
  assert.equal(api.counters().writes, 0);
});

test('new migration is applied once and its SQL history is rechecked', async () => {
  const api = mockApi();
  const result = await applyPending([FILE], config(api.request));
  assert.deepEqual(result.applied, [FILE]);
  assert.equal(api.counters().writes, 1);
  assert.equal(api.counters().queries, 2);
});

test('same version with different recorded SQL fails closed before writing', async () => {
  const api = mockApi({ exists: true, recordedSql: 'select 2;' });
  await assert.rejects(() => applyPending([FILE], config(api.request)), /differs/);
  assert.equal(api.counters().writes, 0);
});

test('connection failure after commit reconciles without a blind retry', async () => {
  const api = mockApi({ failAfterCommit: true });
  const result = await applyPending([FILE], config(api.request));
  assert.deepEqual(result.applied, [FILE]);
  assert.equal(api.counters().writes, 1);
});

test('HTTP 503 with absent history stops rather than retrying SQL', async () => {
  const api = mockApi({ writeStatus: 503 });
  await assert.rejects(() => applyPending([FILE], config(api.request)), /outcome unverified/);
  assert.equal(api.counters().writes, 1);
});

test('rollback file is rejected before read or write', () => {
  assert.throws(() => readValidatedSql('supabase/migrations/20261125110000_do_rollback.sql', () => SQL), /Rollback/);
});
