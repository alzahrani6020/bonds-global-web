/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');

describe('accounting chart and fiscal onboarding contract',()=>{
  const registry=fs.readFileSync(path.join(process.cwd(),'lib/capabilities/generated-service-registry.js'),'utf8');
  const manifest=fs.readFileSync(path.join(process.cwd(),'services/manifests/financial-engine.service.json'),'utf8');
  const adapters=fs.readFileSync(path.join(process.cwd(),'lib/capabilities/runtime-adapters.js'),'utf8');
  const store=fs.readFileSync(path.join(process.cwd(),'lib/finance/accounting/supabase-accounting-account-store.js'),'utf8');
  const services=fs.readFileSync(path.join(process.cwd(),'v3/api/services.js'),'utf8');
  const ui=fs.readFileSync(path.join(process.cwd(),'components/service-request.js'),'utf8');
  const migration=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20261105143000_accounting_chart_fiscal_onboarding.sql'),'utf8');

  test('registers FIN-052 on financial-engine v25',()=>{
    expect(manifest).toContain('"version": 25');
    expect(manifest).toContain('"accounting_account_create"');
    expect(manifest).toContain('"BONDS-CAP-FIN-052"');
    expect(registry).toContain('"accounting_account_create"');
    expect(registry).toContain('"adapter": "accounting_account_create"');
  });

  test('requires governed owner or admin membership',()=>{
    expect(adapters).toContain('accounting_account_create: async');
    expect(adapters).toContain("['owner','admin']");
    expect(adapters).toContain('SupabaseAccountingAccountStore');
  });

  test('store validates canonical account types and duplicate codes',()=>{
    expect(store).toContain("'equity'");
    expect(store).toContain('ACCOUNTING_ACCOUNT_TYPE_INVALID');
    expect(store).toContain('ACCOUNTING_ACCOUNT_CODE_CONFLICT');
    expect(store).toContain(".eq('accounting_entity_id', accountingEntityId)");
    expect(store).toContain(".eq('code', code)");
  });

  test('budget reference exposes year-end policy from the same governed endpoint',()=>{
    expect(services).toContain("from('accounting_year_end_policies')");
    expect(services).toContain('year_end_policy:yearEndRes.data || null');
  });

  test('workspace saves fiscal policy before period initialization',()=>{
    expect(ui).toContain('function saveFiscalYearPolicy');
    expect(ui).toContain("'accounting_year_end_policy_configure'");
    expect(ui).toContain("'accounting_account_create'");
    expect(ui).toContain('if(!policy)throw new Error');
    expect(ui).toContain('Nهاية السنة');
    expect(ui).toContain('financialRetainedEarningsAccount');
  });

  test('maps account creation and existing year-end policy capability to planning service',()=>{
    expect(migration).toContain("'accounting_account_create'");
    expect(migration).toContain("'accounting_year_end_policy_configure'");
    expect(migration).toContain("'planning_budgeting_forecasting'");
    expect(migration).toContain('not exists');
  });
});
