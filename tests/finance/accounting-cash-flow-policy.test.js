'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildCashFlowStatement
} = require('../../lib/finance/accounting/cash-flow-statement-engine');
const {
  runCashFlowEngineFromStatement
} = require('../../lib/finance/financial-engine-registry');
const {
  SupabaseUserCashFlowStore
} = require('../../lib/finance/accounting/supabase-user-cash-flow-store');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026001000_accounting_cash_flow_policy.sql'),
  'utf8'
);

const HARDENING = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026004500_cash_flow_advisor_hardening.sql'),
  'utf8'
);

const SECURITY_HARDENING = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026010000_cash_flow_security_hardening.sql'),
  'utf8'
);

describe('explicit-policy cash flow reporting', () => {
  test('builds operating/investing/financing statement with opening and closing cash', () => {
    const statement = buildCashFlowStatement({
      opening_balance:1000,
      movements:[
        {
          financial_event_id:'e1',
          event_key:'payment-1',
          event_type:'payment.received',
          effective_date:'2026-10-01',
          cash_flow_category:'operating',
          cash_amount:500
        },
        {
          financial_event_id:'e2',
          event_key:'capex-1',
          event_type:'asset.purchased',
          effective_date:'2026-10-02',
          cash_flow_category:'investing',
          cash_amount:-300
        },
        {
          financial_event_id:'e3',
          event_key:'loan-1',
          event_type:'financing.received',
          effective_date:'2026-10-03',
          cash_flow_category:'financing',
          cash_amount:400
        }
      ]
    });

    expect(statement).toMatchObject({
      opening_cash:1000,
      operating_activities:{inflows:500,outflows:0,net:500},
      investing_activities:{inflows:0,outflows:300,net:-300},
      financing_activities:{inflows:400,outflows:0,net:400},
      net_change_in_cash:600,
      closing_cash:1600
    });
    expect(statement.analysis_input.periods).toHaveLength(3);
    expect(statement.provenance).toMatchObject({
      classification_source:'accounting_cash_flow_policies',
      cash_account_source:'accounting_cash_accounts',
      deterministic:true,
      ai_generated:false
    });
  });

  test('rejects any unclassified cash movement', () => {
    expect(() => buildCashFlowStatement({
      opening_balance:0,
      movements:[{
        event_key:'unknown-1',
        event_type:'unknown.event',
        effective_date:'2026-10-01',
        cash_amount:100
      }]
    })).toThrow('CASH_FLOW_CLASSIFICATION_REQUIRED');
  });

  test('feeds statement into existing cash flow engine', () => {
    const statement = buildCashFlowStatement({
      opening_balance:100,
      movements:[
        {
          event_key:'a',
          event_type:'payment.received',
          effective_date:'2026-10-01',
          cash_flow_category:'operating',
          cash_amount:50
        },
        {
          event_key:'b',
          event_type:'expense.paid',
          effective_date:'2026-10-01',
          cash_flow_category:'operating',
          cash_amount:-20
        },
        {
          event_key:'c',
          event_type:'asset.purchased',
          effective_date:'2026-10-02',
          cash_flow_category:'investing',
          cash_amount:-60
        }
      ]
    });

    const result = runCashFlowEngineFromStatement(statement, {
      serviceCode:'liquidity_gap_analysis'
    });

    expect(result.ok).toBe(true);
    expect(result.executed).toBe(true);
    expect(result.metrics).toMatchObject({
      opening_balance:100,
      total_inflows:50,
      total_outflows:80,
      net_cash_flow:-30,
      closing_balance:70
    });
    expect(result.diagnostics).toMatchObject({
      input_source:'accounting_cash_flow_statement',
      classification_verified:true,
      cash_accounts_explicit:true
    });
  });

  test('database policy is explicit and fail-closed for unclassified cash events', () => {
    expect(MIGRATION).toContain('create table if not exists public.accounting_cash_accounts');
    expect(MIGRATION).toContain('create table if not exists public.accounting_cash_flow_policies');
    expect(MIGRATION).toContain("check (cash_flow_category in ('operating','investing','financing'))");
    expect(MIGRATION).toContain("raise exception 'CASH_FLOW_CLASSIFICATION_REQUIRED'");
    expect(MIGRATION).toContain('join public.accounting_cash_accounts ca');
    expect(MIGRATION).toContain('join public.accounting_cash_flow_policies p');
    expect(MIGRATION).not.toMatch(/INV-|PO-|RENT-|LOAN-|CAP-|ASSET-/);
  });

  test('authenticated cash flow RPCs reuse accounting entity access boundary', () => {
    expect(MIGRATION).toContain('public.accounting_user_can_access_entity(p_accounting_entity_id)');
    expect(MIGRATION).toContain("raise exception 'ACCOUNTING_ENTITY_ACCESS_DENIED'");
    expect(MIGRATION).toContain("raise exception 'AUTHENTICATION_REQUIRED'");
    expect(MIGRATION).toContain('revoke all on function public.accounting_user_cash_balance(uuid,date) from public, anon');
    expect(MIGRATION).toContain('revoke all on function public.accounting_user_cash_flow_movements(uuid,date,date) from public, anon');
  });

  test('store fetches opening balance and period movements through governed RPCs', async () => {
    const rpc = jest.fn(async (name) => {
      if (name === 'accounting_user_cash_balance') return {data:250,error:null};
      if (name === 'accounting_user_cash_flow_movements') {
        return {
          data:[{
            event_key:'payment-1',
            event_type:'payment.received',
            effective_date:'2026-10-01',
            cash_flow_category:'operating',
            cash_amount:100
          }],
          error:null
        };
      }
      throw new Error('unexpected');
    });

    const store = new SupabaseUserCashFlowStore({rpc});
    const data = await store.reportInputs({
      accountingEntityId:'entity-1',
      startsOn:'2026-10-01',
      endsOn:'2026-10-31'
    });

    expect(rpc).toHaveBeenCalledWith('accounting_user_cash_balance', {
      p_accounting_entity_id:'entity-1',
      p_before:'2026-10-01'
    });
    expect(rpc).toHaveBeenCalledWith('accounting_user_cash_flow_movements', {
      p_accounting_entity_id:'entity-1',
      p_from:'2026-10-01',
      p_to:'2026-10-31'
    });
    expect(data.opening_balance).toBe(250);
    expect(data.movements).toHaveLength(1);
  });

  test('invalid report date range fails before database execution', async () => {
    const rpc = jest.fn();
    const store = new SupabaseUserCashFlowStore({rpc});
    await expect(store.reportInputs({
      accountingEntityId:'entity-1',
      startsOn:'2026-11-01',
      endsOn:'2026-10-01'
    })).rejects.toThrow('CASH_FLOW_DATE_RANGE_INVALID');
    expect(rpc).not.toHaveBeenCalled();
  });

  test('advisor hardening covers cash-flow foreign keys and optimized RLS auth lookups', () => {
    for (const indexName of [
      'idx_accounting_cash_accounts_created_by',
      'idx_accounting_cash_flow_policies_created_by',
      'idx_client_cash_flow_reports_client_id'
    ]) {
      expect(HARDENING).toContain(indexName);
    }

    expect(HARDENING).toContain('using (user_id = (select auth.uid()))');
    expect(HARDENING).toContain('with check (user_id = (select auth.uid()))');
    expect(HARDENING).not.toMatch(/user_id\s*=\s*auth\.uid\(\)/);
  });

  test('security hardening pins legacy search paths and narrows user RPC execution', () => {
    expect(SECURITY_HARDENING).toContain(
      'alter function public.touch_cash_flow_updated_at()'
    );
    expect(SECURITY_HARDENING).toContain(
      'alter function public.normalize_cash_flow_report()'
    );
    expect(SECURITY_HARDENING).toContain(
      "coalesce((select auth.role()), '') = 'authenticated'"
    );

    for (const signature of [
      'public.accounting_user_can_access_entity(uuid)',
      'public.accounting_user_ledger_balances(uuid,date,date)',
      'public.accounting_user_cash_balance(uuid,date)',
      'public.accounting_user_cash_flow_movements(uuid,date,date)'
    ]) {
      expect(SECURITY_HARDENING).toContain(
        `revoke all on function ${signature}`
      );
      expect(SECURITY_HARDENING).toContain(
        `grant execute on function ${signature}`
      );
    }

    expect(SECURITY_HARDENING).toContain(
      'from public, anon, service_role;'
    );
  });
});
