/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');

describe('accounting period onboarding capability contract',()=>{
  const registry=fs.readFileSync(path.join(process.cwd(),'lib/capabilities/generated-service-registry.js'),'utf8');
  const adapters=fs.readFileSync(path.join(process.cwd(),'lib/capabilities/runtime-adapters.js'),'utf8');
  const ui=fs.readFileSync(path.join(process.cwd(),'components/service-request.js'),'utf8');
  const migration=fs.readFileSync(path.join(process.cwd(),'supabase/migrations/20261105131500_accounting_period_onboarding_capability.sql'),'utf8');

  test('registers a governed database-write capability',()=>{
    expect(registry).toContain('"accounting_period_initialize_monthly"');
    expect(registry).toContain('"BONDS-CAP-FIN-051"');
    expect(registry).toContain('"sideEffect": "database_write"');
    expect(registry).toContain('"adapter": "accounting_period_initialize_monthly"');
  });

  test('adapter requires accounting membership and authorized finance role',()=>{
    expect(adapters).toContain('accounting_period_initialize_monthly: async');
    expect(adapters).toContain("['owner','admin','accountant']");
    expect(adapters).toContain('ensureMonthlyAccountingPeriods');
  });

  test('budget workspace exposes explicit period initialization only when needed',()=>{
    expect(ui).toContain('function initializeAccountingPeriods');
    expect(ui).toContain("'accounting_period_initialize_monthly'");
    expect(ui).toContain('id="financialPeriodInitialize"');
    expect(ui).toContain("periodInit.hidden=(payload.periods||[]).length>0");
  });

  test('migration maps the capability idempotently to planning budgeting forecasting',()=>{
    expect(migration).toContain("'planning_budgeting_forecasting'");
    expect(migration).toContain("'accounting_period_initialize_monthly'");
    expect(migration).toContain('not exists');
  });
});
