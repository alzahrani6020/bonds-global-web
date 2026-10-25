'use strict';

const fs = require('fs');
const path = require('path');
const {
  SupabaseUserLedgerReportingStore
} = require('../../lib/finance/accounting/supabase-user-ledger-reporting-store');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261025233000_accounting_entity_access_boundary.sql'),
  'utf8'
);

describe('accounting entity access boundary', () => {
  test('membership table is fail-closed and users can only select their own memberships', () => {
    expect(MIGRATION).toContain('create table if not exists public.accounting_entity_members');
    expect(MIGRATION).toContain('alter table public.accounting_entity_members enable row level security');
    expect(MIGRATION).toContain('revoke all on public.accounting_entity_members from anon, authenticated');
    expect(MIGRATION).toContain('grant select on public.accounting_entity_members to authenticated');
    expect(MIGRATION).toContain('user_id = (select auth.uid())');
    expect(MIGRATION).not.toMatch(/grant\s+(insert|update|delete).*authenticated/i);
  });

  test('user ledger RPC derives identity from auth.uid and denies anonymous/cross-entity access', () => {
    expect(MIGRATION).toContain('create or replace function public.accounting_user_can_access_entity');
    expect(MIGRATION).toContain('create or replace function public.accounting_user_ledger_balances');
    expect(MIGRATION).toContain("raise exception 'AUTHENTICATION_REQUIRED'");
    expect(MIGRATION).toContain("raise exception 'ACCOUNTING_ENTITY_ACCESS_DENIED'");
    expect(MIGRATION).toContain('m.user_id = (select auth.uid())');
    expect(MIGRATION).toContain("m.status = 'active'");
    expect(MIGRATION).toContain("e.status = 'active'");
    expect(MIGRATION).toContain('revoke all on function public.accounting_user_ledger_balances(uuid,date,date) from anon');
    expect(MIGRATION).toContain('grant execute on function public.accounting_user_ledger_balances(uuid,date,date)');
  });

  test('new accounting entity seeds creator as owner without opening self-enrollment', () => {
    expect(MIGRATION).toContain('create or replace function public.accounting_seed_owner_membership');
    expect(MIGRATION).toContain("new.created_by");
    expect(MIGRATION).toContain("'owner'");
    expect(MIGRATION).toContain('on conflict (accounting_entity_id, user_id)');
    expect(MIGRATION).toContain('after insert on public.accounting_entities');
  });

  test('authenticated store calls only governed user ledger RPC', async () => {
    const rpc = jest.fn(async () => ({
      data:[
        {account_code:'1010',account_name:'Cash',account_type:'asset',debit:100,credit:0}
      ],
      error:null
    }));
    const store = new SupabaseUserLedgerReportingStore({rpc});

    const rows = await store.balances({
      accountingEntityId:'entity-1',
      from:'2026-10-01',
      to:'2026-10-31'
    });

    expect(rpc).toHaveBeenCalledWith('accounting_user_ledger_balances', {
      p_accounting_entity_id:'entity-1',
      p_from:'2026-10-01',
      p_to:'2026-10-31'
    });
    expect(rows).toHaveLength(1);
  });

  test('authenticated store preserves access denial and authentication failures', async () => {
    const denied = new SupabaseUserLedgerReportingStore({
      rpc:jest.fn(async () => ({data:null,error:{message:'ACCOUNTING_ENTITY_ACCESS_DENIED'}}))
    });
    await expect(denied.balances({
      accountingEntityId:'entity-2'
    })).rejects.toThrow('ACCOUNTING_ENTITY_ACCESS_DENIED');

    const unauthenticated = new SupabaseUserLedgerReportingStore({
      rpc:jest.fn(async () => ({data:null,error:{message:'AUTHENTICATION_REQUIRED'}}))
    });
    await expect(unauthenticated.balances({
      accountingEntityId:'entity-2'
    })).rejects.toThrow('AUTHENTICATION_REQUIRED');
  });

  test('invalid date range fails before RPC execution', async () => {
    const rpc = jest.fn();
    const store = new SupabaseUserLedgerReportingStore({rpc});
    await expect(store.statementRows({
      accountingEntityId:'entity-1',
      startsOn:'2026-11-01',
      endsOn:'2026-10-31'
    })).rejects.toThrow('ACCOUNTING_REPORT_DATE_RANGE_INVALID');
    expect(rpc).not.toHaveBeenCalled();
  });
});
