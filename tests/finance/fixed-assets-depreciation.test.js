'use strict';

const fs = require('fs');
const path = require('path');
const { straightLineMonthlyDepreciation, buildDepreciationAccrual, createDepreciationPolicy, buildDepreciationEvent } = require('../../lib/finance/accounting/fixed-asset-depreciation');
const { SupabaseFixedAssetStore } = require('../../lib/finance/accounting/supabase-fixed-asset-store');

const MIGRATION = fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261026020000_fixed_assets_depreciation.sql'),'utf8');

describe('fixed assets depreciation', () => {
  test('reuses bonds_assets and enforces same accounting entity', () => {
    expect(MIGRATION).toContain('create table if not exists public.accounting_fixed_asset_profiles');
    expect(MIGRATION).toContain('foreign key (accounting_entity_id, asset_id)');
    expect(MIGRATION).toContain('references public.bonds_assets(accounting_entity_id, id)');
    expect(MIGRATION).not.toMatch(/create table if not exists public\\.fixed_assets/i);
  });

  test('profile storage is server-mediated', () => {
    expect(MIGRATION).toContain('revoke all on public.accounting_fixed_asset_profiles from anon, authenticated');
    expect(MIGRATION).toContain('on public.accounting_fixed_asset_profiles to service_role');
  });

  test('calculates deterministic straight-line monthly depreciation', () => {
    expect(straightLineMonthlyDepreciation({acquisitionCost:120000,residualValue:12000,usefulLifeMonths:36})).toBe(3000);
  });

  test('builds accumulated depreciation and carrying amount without AI', () => {
    const result = buildDepreciationAccrual({
      profile:{accounting_entity_id:'entity-1',in_service_date:'2026-01-01',useful_life_months:12,residual_value:12000},
      asset:{id:'asset-1',asset_number:'A-1',accounting_entity_id:'entity-1',acquisition_cost:120000},
      periodEnd:'2026-03-31'
    });
    expect(result).toMatchObject({monthly_depreciation:9000,elapsed_months:3,accumulated_depreciation:27000,carrying_amount:93000,fully_depreciated:false});
  });

  test('posting accounts are explicit and never guessed', () => {
    expect(() => createDepreciationPolicy({depreciation_expense_account_code:'',accumulated_depreciation_account_code:'1590'})).toThrow('FIXED_ASSET_EXPENSE_ACCOUNT_REQUIRED');
    const registry = createDepreciationPolicy({depreciation_expense_account_code:'5200',accumulated_depreciation_account_code:'1590'});
    const rule = registry.resolve({type:'asset.depreciation'});
    expect(rule.debit_account.code).toBe('5200');
    expect(rule.credit_account.code).toBe('1590');
  });

  test('event is idempotent by entity asset period and amount', () => {
    const input = {
      profile:{accounting_entity_id:'entity-1',in_service_date:'2026-01-01',useful_life_months:12,residual_value:0},
      asset:{id:'asset-1',asset_number:'A-1',accounting_entity_id:'entity-1',acquisition_cost:12000,currency:'SAR'},
      periodEnd:'2026-01-31'
    };
    const a = buildDepreciationEvent(input);
    const b = buildDepreciationEvent(input);
    expect(a.idempotency_key).toBe(b.idempotency_key);
    expect(a.idempotency_key).toMatch(/^[0-9a-f]{64}$/);
    expect(a.type).toBe('asset.depreciation');
    expect(a.amount).toBe(1000);
  });

  test('store rejects invalid profile before database write', async () => {
    const from = jest.fn();
    const store = new SupabaseFixedAssetStore({from});
    await expect(store.createProfile({accountingEntityId:'entity-1',assetId:'asset-1',inServiceDate:'2026-01-01',usefulLifeMonths:0,depreciationExpenseAccountCode:'5200',accumulatedDepreciationAccountCode:'1590'})).rejects.toThrow('FIXED_ASSET_USEFUL_LIFE_INVALID');
    expect(from).not.toHaveBeenCalled();
  });
});