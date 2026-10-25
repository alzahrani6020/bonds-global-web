'use strict';

const fs = require('fs');
const path = require('path');
const {
  SupabasePeriodCloseStore
} = require('../../lib/finance/accounting/supabase-period-close-store');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026023000_governed_period_close.sql'),
  'utf8'
);

describe('governed accounting period close workflow', () => {
  test('reuses accounting_periods and does not create a parallel period master', () => {
    expect(MIGRATION).toContain('references public.accounting_periods(accounting_entity_id, id)');
    expect(MIGRATION).toContain('update public.accounting_periods');
    expect(MIGRATION).not.toMatch(/create table if not exists public\.accounting_period_master/i);
  });

  test('records an immutable close transition audit trail', () => {
    expect(MIGRATION).toContain('create table if not exists public.accounting_period_close_events');
    expect(MIGRATION).toContain("action in ('soft_close','close','reopen')");
    expect(MIGRATION).toContain('from_status');
    expect(MIGRATION).toContain('to_status');
    expect(MIGRATION).toContain('actor_user_id');
    expect(MIGRATION).toContain('actor_role');
  });

  test('keeps transition RPC server-mediated', () => {
    expect(MIGRATION).toContain(
      'from public, anon, authenticated'
    );
    expect(MIGRATION).toContain(
      'to service_role'
    );
  });

  test('enforces role boundaries', () => {
    expect(MIGRATION).toContain(
      "v_actor_role not in ('owner','admin','accountant')"
    );
    expect(MIGRATION).toContain(
      "v_actor_role not in ('owner','admin')"
    );
    expect(MIGRATION).toContain(
      'ACCOUNTING_PERIOD_REOPEN_REASON_REQUIRED'
    );
  });

  test('runs pre-close integrity gates', () => {
    expect(MIGRATION).toContain('ACCOUNTING_PERIOD_HAS_DRAFT_JOURNALS');
    expect(MIGRATION).toContain('ACCOUNTING_PERIOD_JOURNAL_DATE_MISMATCH');
    expect(MIGRATION).toContain('ACCOUNTING_PERIOD_HAS_UNPOSTED_EVENTS');
    expect(MIGRATION).toContain('ACCOUNTING_PERIOD_HAS_PENDING_SUBLEDGER');
  });

  test('store calls governed transition RPC', async () => {
    const rpc = jest.fn(async () => ({
      data:{ok:true,state:'transitioned',to_status:'soft_closed'},
      error:null
    }));
    const store = new SupabasePeriodCloseStore({rpc});

    const result = await store.softClose({
      accountingEntityId:'entity-1',
      periodId:'period-1',
      actorUserId:'user-1'
    });

    expect(rpc).toHaveBeenCalledWith('accounting_transition_period', {
      p_accounting_entity_id:'entity-1',
      p_period_id:'period-1',
      p_action:'soft_close',
      p_actor_user_id:'user-1',
      p_reason:null,
      p_metadata:{}
    });
    expect(result.to_status).toBe('soft_closed');
  });

  test('store requires a reason for reopen', async () => {
    const rpc = jest.fn();
    const store = new SupabasePeriodCloseStore({rpc});

    await expect(store.reopen({
      accountingEntityId:'entity-1',
      periodId:'period-1',
      actorUserId:'user-1'
    })).rejects.toThrow('ACCOUNTING_PERIOD_REOPEN_REASON_REQUIRED');

    expect(rpc).not.toHaveBeenCalled();
  });
});
