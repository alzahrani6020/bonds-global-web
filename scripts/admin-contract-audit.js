#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const fail = msg => { console.error('[admin-contract-audit] FAIL:', msg); process.exitCode = 1; };
const ok = msg => console.log('[admin-contract-audit] OK:', msg);

const api = read('api/admin.js');
const a11y = read('tests/a11y/a11y-tests.js');

const sensitive = new Map([
  ['finance-refund-create', 'billing.refund'],
  ['finance-reconciliation-upsert', 'billing.reconcile'],
  ['crm-organization-create', 'crm.write'],
  ['support-ticket-create', 'support.manage'],
  ['temporary-permission-grant', 'roles.manage'],
  ['feature-flag-upsert', 'product.flags'],
  ['feature-flag-rollback', 'product.flags'],
  ['entitlement-override-create', 'entitlements.manage'],
  ['workflow-upsert', 'workflow.manage'],
  ['incident-create', 'incident.manage'],
  ['backup-check-record', 'recovery.manage'],
  ['config-snapshot-record', 'configuration.manage'],
  ['ai-kill-switch-update', 'ai.operations.manage'],
  ['privacy-request-create', 'governance.manage'],
  ['data-export-request', 'governance.manage'],
  ['user-merge-dry-run', 'governance.manage'],
  ['admin-session-revoke', 'security.sessions.manage'],
  ['admin-access-policy-upsert', 'security.policies.manage'],
  ['admin-device-trust', 'security.sessions.manage']
]);

for (const [action, permission] of sensitive) {
  const actionAt = api.indexOf("action === '" + action + "'");
  if (actionAt < 0) { fail('missing sensitive action ' + action); continue; }
  const window = api.slice(actionAt, actionAt + 900);
  if (!window.includes('requireAdminPermission(req') || !window.includes("'" + permission + "'")) {
    fail(action + ' is not visibly gated by ' + permission);
  }
}
if (!process.exitCode) ok('sensitive actions retain granular permission gates');

if (!api.includes("req.adminRequestId = req.headers['x-request-id'] || generateRequestId()")) fail('correlation ID assignment missing');
if (!api.includes("res.setHeader('X-Request-ID', req.adminRequestId)")) fail('X-Request-ID response header missing');
if (!process.exitCode) ok('correlation ID contract present');

const cronAt = api.indexOf("action === 'workflow-cron'");
if (cronAt < 0) fail('workflow-cron action missing');
else {
  const w = api.slice(cronAt, cronAt + 1100);
  if (!w.includes('not configured') || !w.includes('authorization')) {
    fail('workflow cron no longer appears fail-closed');
  } else ok('workflow cron retains explicit authorization checks');
}

const limits = [...api.matchAll(/\.limit\((\d+)\)/g)].map(m => Number(m[1]));
const largest = limits.length ? Math.max(...limits) : 0;
if (largest > 10000) fail('query limit exceeds 10,000 rows: ' + largest);
else ok('static query limits bounded; largest=' + largest);

if (a11y.includes("waitUntil: 'networkidle'") || a11y.includes('waitUntil: "networkidle"')) fail('a11y suite can stall on polling pages');
else ok('a11y navigation avoids networkidle stalls');

if (!api.includes('destructiveExecution:false') || api.includes('async function executeUserMerge')) {
  fail('user merge safety contract changed');
} else ok('user merge remains dry-run/approval gated');

const actionNames = [...api.matchAll(/action === '([^']+)'/g)].map(m => m[1]);
const unique = [...new Set(actionNames)];
if (unique.length < 90) fail('unexpectedly low admin action surface: ' + unique.length);
else ok('admin action surface detected: ' + unique.length + ' unique actions');

if (process.exitCode) process.exit(process.exitCode);
console.log('[admin-contract-audit] PASS');
