'use strict';

const fs = require('fs');
const path = require('path');
const {
  SupabaseAssetCollateralStore
} = require('../../lib/finance/accounting/supabase-asset-collateral-store');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026013000_asset_collateral_registry.sql'),
  'utf8'
);

const HARDENING = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026014500_asset_collateral_advisor_hardening.sql'),
  'utf8'
);

describe('governed asset and collateral registry', () => {
  test('reuses bonds_assets instead of creating a parallel asset master', () => {
    expect(MIGRATION).toContain('alter table public.bonds_assets');
    expect(MIGRATION).not.toMatch(/create table if not exists public\.accounting_assets/i);
    expect(MIGRATION).not.toMatch(/create table if not exists public\.asset_registry/i);
  });

  test('asset-to-accounting-entity assignment is guarded', () => {
    expect(MIGRATION).toContain('accounting_entity_id uuid');
    expect(MIGRATION).toContain('accounting_assert_asset_entity_assignment');
    expect(MIGRATION).toContain('public.accounting_user_can_access_entity(new.accounting_entity_id)');
    expect(MIGRATION).toContain("raise exception 'ACCOUNTING_ENTITY_ACCESS_DENIED'");
  });

  test('collateral cannot cross accounting entities', () => {
    expect(MIGRATION).toContain('create table if not exists public.asset_collateral_assignments');
    expect(MIGRATION).toContain('foreign key (accounting_entity_id, asset_id)');
    expect(MIGRATION).toContain('references public.bonds_assets(accounting_entity_id, id)');
  });

  test('asset ownership RLS avoids per-row auth.uid init plans', () => {
    expect(HARDENING).toContain('p.user_id = (select auth.uid())');
    expect(HARDENING).not.toMatch(/p\.user_id\s*=\s*auth\.uid\(\)/);
    expect(HARDENING).toContain('drop policy if exists bonds_assets_user_isolation');
    expect(HARDENING).toContain('create policy bonds_assets_user_isolation');
  });

  test('collateral writes are server-mediated', () => {
    expect(MIGRATION).toContain(
      'alter table public.asset_collateral_assignments enable row level security'
    );
    expect(MIGRATION).toContain(
      'revoke all on public.asset_collateral_assignments from anon, authenticated'
    );
    expect(MIGRATION).toContain(
      'on public.asset_collateral_assignments to service_role'
    );
  });

  test('store writes canonical asset and collateral tables', async () => {
    const single = jest.fn(async () => ({data:{id:'row-1'},error:null}));
    const select = jest.fn(() => ({single}));
    const insert = jest.fn(() => ({select}));
    const from = jest.fn(() => ({insert}));

    const store = new SupabaseAssetCollateralStore({from});

    await store.createAsset({
      accountingEntityId:'entity-1',
      assetNumber:'A-001',
      assetClass:'real_estate',
      acquisitionCost:1000000
    });

    await store.assignCollateral({
      accountingEntityId:'entity-1',
      assetId:'asset-1',
      collateralValue:800000,
      securedAmount:500000
    });

    expect(from).toHaveBeenNthCalledWith(1, 'bonds_assets');
    expect(from).toHaveBeenNthCalledWith(2, 'asset_collateral_assignments');
  });

  test('store rejects invalid governed values before database execution', async () => {
    const from = jest.fn();
    const store = new SupabaseAssetCollateralStore({from});

    await expect(store.createAsset({
      accountingEntityId:'entity-1',
      assetNumber:'A-001',
      assetClass:'equipment',
      usefulLifeMonths:0
    })).rejects.toThrow('ASSET_USEFUL_LIFE_INVALID');

    await expect(store.assignCollateral({
      accountingEntityId:'entity-1',
      assetId:'asset-1',
      priority:0
    })).rejects.toThrow('COLLATERAL_PRIORITY_INVALID');

    expect(from).not.toHaveBeenCalled();
  });
});
