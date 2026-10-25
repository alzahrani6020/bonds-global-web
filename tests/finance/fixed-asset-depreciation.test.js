'use strict';

const fs = require('fs');
const path = require('path');
const {
  SupabaseFixedAssetDepreciationStore
} = require('../../lib/finance/accounting/supabase-fixed-asset-depreciation-store');
const { EVENT_TYPES } = require('../../lib/finance/accounting/financial-event');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026020000_fixed_asset_depreciation.sql'),
  'utf8'
);

describe('governed fixed asset accounting depreciation', () => {
  test('recognizes depreciation as a governed financial event', () => {
    expect(EVENT_TYPES).toContain('asset.depreciation');
  });

  test('reuses canonical assets and atomic posting instead of parallel ledgers', () => {
    expect(MIGRATION).toContain('references public.bonds_assets(accounting_entity_id, id)');
    expect(MIGRATION).toContain('public.accounting_commit_posting(v_event, v_posting)');
    expect(MIGRATION).not.toMatch(/create table if not exists public\.fixed_assets\b/i);
    expect(MIGRATION).not.toMatch(/create table if not exists public\.general_ledger\b/i);
  });

  test('uses explicit governed account mappings', () => {
    expect(MIGRATION).toContain('depreciation_expense_account_id uuid not null');
    expect(MIGRATION).toContain('accumulated_depreciation_account_id uuid not null');
    expect(MIGRATION).toContain("v_expense_type <> 'expense'");
    expect(MIGRATION).toContain("v_accum_type <> 'contra_asset'");
  });

  test('prevents duplicate depreciation per asset and period', () => {
    expect(MIGRATION).toContain('unique(accounting_entity_id, asset_id, period_id)');
    expect(MIGRATION).toContain("'state', 'replayed'");
  });

  test('keeps analytical depreciation separate from accounting posting', () => {
    expect(MIGRATION).not.toContain('totalDepreciation');
    expect(MIGRATION).not.toContain('economicDepreciation');
    expect(MIGRATION).not.toContain('technicalDepreciation');
    expect(MIGRATION).toContain("depreciation_method in ('straight_line')");
  });

  test('policy and runs are server-mediated', () => {
    expect(MIGRATION).toContain(
      'revoke all on public.accounting_asset_depreciation_policies from anon, authenticated'
    );
    expect(MIGRATION).toContain(
      'revoke all on public.accounting_fixed_asset_depreciation_runs from anon, authenticated'
    );
    expect(MIGRATION).toContain(
      'grant execute on function public.accounting_post_asset_depreciation(uuid,uuid,uuid)'
    );
  });

  test('store configures policy and posts a period through governed RPC', async () => {
    const single = jest.fn(async () => ({data:{id:'policy-1'},error:null}));
    const select = jest.fn(() => ({single}));
    const upsert = jest.fn(() => ({select}));
    const from = jest.fn(() => ({upsert}));
    const rpc = jest.fn(async () => ({data:{ok:true,state:'claimed',amount:100},error:null}));

    const store = new SupabaseFixedAssetDepreciationStore({from,rpc});

    await store.configurePolicy({
      accountingEntityId:'entity-1',
      assetId:'asset-1',
      inServiceDate:'2026-01-01',
      depreciationExpenseAccountId:'expense-1',
      accumulatedDepreciationAccountId:'accum-1'
    });

    const result = await store.postPeriod({
      accountingEntityId:'entity-1',
      assetId:'asset-1',
      periodId:'period-1'
    });

    expect(from).toHaveBeenCalledWith('accounting_asset_depreciation_policies');
    expect(rpc).toHaveBeenCalledWith('accounting_post_asset_depreciation', {
      p_accounting_entity_id:'entity-1',
      p_asset_id:'asset-1',
      p_period_id:'period-1'
    });
    expect(result.ok).toBe(true);
  });
});
