'use strict';

const fs = require('fs');
const path = require('path');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '../../admin/finance.html'),
  'utf8'
);

describe('finance accounting entity onboarding UI', () => {
  test('uses the existing governed accounting entity API instead of direct table writes', () => {
    expect(SOURCE).toContain('/api/v3/services/accounting/entities');
    expect(SOURCE).toContain('window.BondsAuth.authenticatedFetch');
    expect(SOURCE).not.toMatch(/from\(['"]accounting_entities['"]\)/);
    expect(SOURCE).not.toMatch(/from\(['"]accounting_entity_members['"]\)/);
  });

  test('supports listing and creating accounting entities from the existing finance page', () => {
    expect(SOURCE).toContain('id="accountingEntityRows"');
    expect(SOURCE).toContain('onsubmit="createAccountingEntity(event)"');
    expect(SOURCE).toContain('async function loadAccountingEntities()');
    expect(SOURCE).toContain('async function createAccountingEntity(ev)');
    expect(SOURCE).toContain("method:'POST'");
  });

  test('does not accept owner identity from the browser payload', () => {
    const fn = SOURCE.match(/async function createAccountingEntity\(ev\)[\s\S]*?return null\}\}/)?.[0] || '';
    expect(fn).toContain('JSON.stringify({name,base_currency})');
    expect(fn).not.toContain('user_id');
    expect(fn).not.toContain('created_by');
  });

  test('locks duplicate submits and sends an idempotency key', () => {
    const fn = SOURCE.match(/async function createAccountingEntity\\(ev\\)[\\s\\S]*?finally\\{[\\s\\S]*?\\}\\}/)?.[0] || '';
    expect(SOURCE).toContain('id="accountingEntitySubmit"');
    expect(fn).toContain('accountingEntityCreateInFlight');
    expect(fn).toContain("'Idempotency-Key':accountingEntityRequestKey");
    expect(fn).toContain('submit.disabled=true');
    expect(fn).toContain('submit.disabled=false');
  });
});
