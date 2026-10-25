'use strict';

const crypto = require('crypto');
const {
  normalizeFinancialEvent,
  deriveIdempotencyKey
} = require('../../lib/finance/accounting/financial-event');
const {
  AccountingPolicyRegistry,
  createDefaultPolicyRegistry
} = require('../../lib/finance/accounting/accounting-policy');
const {
  buildPosting,
  validateBalanced,
  postFinancialEvent
} = require('../../lib/finance/accounting/posting-engine');
const {
  SupabasePostingStore
} = require('../../lib/finance/accounting/supabase-posting-store');

describe('BONDS financial operations core', () => {
  test('fails closed when accounting entity is missing', () => {
    expect(() => normalizeFinancialEvent({
      type:'invoice.issued',
      amount:1000,
      source:{system:'crm',record_id:'inv-1'}
    })).toThrow('FINANCIAL_EVENT_ACCOUNTING_ENTITY_REQUIRED');
  });

  test('normalizes a supported financial event deterministically', () => {
    const event = normalizeFinancialEvent({
      id:'fevt_test_1',
      type:'invoice.issued',
      accounting_entity_id:'entity-1',
      occurred_at:'2026-10-25T10:00:00Z',
      effective_date:'2026-10-25T10:00:00Z',
      amount:1250.5,
      currency:'sar',
      source:{system:'crm',record_id:'invoice-100'},
      payload:{customer_id:'c1'}
    });

    expect(event.currency).toBe('SAR');
    expect(event.amount).toBe(1250.5);
    expect(event.accounting_entity_id).toBe('entity-1');
    expect(event.idempotency_key).toMatch(/^[0-9a-f]{64}$/);
  });

  test('derives a stable idempotency key independent of object key order', () => {
    const a = deriveIdempotencyKey({
      type:'payment.received',
      accounting_entity_id:'entity-1',
      effective_date:'2026-10-25T10:00:00Z',
      amount:100,
      currency:'SAR',
      source:{system:'payments',record_id:'p1'},
      payload:{b:2,a:1}
    });
    const b = deriveIdempotencyKey({
      type:'payment.received',
      accounting_entity_id:'entity-1',
      effective_date:'2026-10-25T10:00:00Z',
      amount:100,
      currency:'SAR',
      source:{system:'payments',record_id:'p1'},
      payload:{a:1,b:2}
    });
    expect(a).toBe(b);
  });

  test('rejects unsupported event types instead of guessing accounting treatment', () => {
    expect(() => normalizeFinancialEvent({
      type:'unknown.event',
      accounting_entity_id:'entity-1',
      amount:100,
      source:{system:'test',record_id:'1'}
    })).toThrow('FINANCIAL_EVENT_TYPE_UNSUPPORTED');
  });

  test('maps invoice event to a balanced double-entry journal', () => {
    const posting = buildPosting({
      type:'invoice.issued',
      accounting_entity_id:'entity-1',
      amount:1000,
      currency:'SAR',
      source:{system:'crm',record_id:'invoice-1'}
    });

    expect(posting.journal.status).toBe('ready_to_post');
    expect(posting.journal.total_debit).toBe(1000);
    expect(posting.journal.total_credit).toBe(1000);
    expect(posting.journal.lines).toEqual([
      expect.objectContaining({account_code:'1100',debit:1000,credit:0}),
      expect.objectContaining({account_code:'4100',debit:0,credit:1000})
    ]);
  });

  test('supports service-specific accounting policy overrides', () => {
    const registry = createDefaultPolicyRegistry([
      {
        event_type:'service_fee.accrued',
        service_code:'financing_success_fee',
        debit_account:{code:'1100',name:'Accounts Receivable'},
        credit_account:{code:'4210',name:'Financing Success Fee Revenue'},
        description:'Specific financing success fee'
      }
    ]);

    const posting = buildPosting({
      type:'service_fee.accrued',
      service_code:'financing_success_fee',
      accounting_entity_id:'entity-1',
      amount:5000,
      source:{system:'service_execution',record_id:'svc-1'}
    }, { policyRegistry: registry });

    expect(posting.journal.lines[1].account_code).toBe('4210');
  });

  test('refund completion reverses the posted customer payment through the accounting core', () => {
    const posting = buildPosting({type:'refund.completed',accounting_entity_id:'entity-1',amount:250,currency:'SAR',source:{system:'finance_refunds',record_id:'refund-1'}});
    expect(posting.journal.lines).toEqual([expect.objectContaining({account_code:'1100',debit:250,credit:0}),expect.objectContaining({account_code:'1010',debit:0,credit:250})]);
  });

  test('rejects accounting policy that debits and credits the same account', () => {
    expect(() => new AccountingPolicyRegistry([{
      event_type:'invoice.issued',
      debit_account:{code:'1100',name:'A/R'},
      credit_account:{code:'1100',name:'A/R'}
    }])).toThrow('ACCOUNTING_POLICY_SAME_ACCOUNT_FORBIDDEN');
  });

  test('journal validation rejects unbalanced or two-sided lines', () => {
    expect(() => validateBalanced([
      {debit:100,credit:0},
      {debit:0,credit:90}
    ])).toThrow('JOURNAL_NOT_BALANCED');

    expect(() => validateBalanced([
      {debit:100,credit:20},
      {debit:0,credit:80}
    ])).toThrow('JOURNAL_LINE_ONE_SIDED_REQUIRED');
  });

  test('posting store replays idempotently without committing twice', async () => {
    const commits = [];
    const replayedPosting = { posting_id:'jp-1', journal:{status:'posted'} };
    const store = {
      claimEvent: jest.fn()
        .mockResolvedValueOnce({state:'claimed'})
        .mockResolvedValueOnce({state:'replayed',posting:replayedPosting}),
      commitPosting: jest.fn(async posting => {
        commits.push(posting);
        return {ok:true,posting_id:'jp-1'};
      })
    };
    const event = {
      type:'payment.received',
      accounting_entity_id:'entity-1',
      amount:250,
      source:{system:'payments',record_id:'p-1'},
      idempotency_key:crypto.createHash('sha256').update('p-1').digest('hex')
    };

    const first = await postFinancialEvent({event,store});
    const second = await postFinancialEvent({event,store});

    expect(first.replayed).toBe(false);
    expect(second.replayed).toBe(true);
    expect(store.commitPosting).toHaveBeenCalledTimes(1);
    expect(commits).toHaveLength(1);
  });

  test('idempotency conflict fails closed', async () => {
    const store = {
      claimEvent: jest.fn(async () => ({state:'conflict'})),
      commitPosting: jest.fn()
    };

    await expect(postFinancialEvent({
      event:{
        type:'expense.approved',
        accounting_entity_id:'entity-1',
        amount:300,
        source:{system:'approvals',record_id:'exp-1'}
      },
      store
    })).rejects.toThrow('POSTING_IDEMPOTENCY_CONFLICT');

    expect(store.commitPosting).not.toHaveBeenCalled();
  });
  test('Supabase posting store uses one atomic RPC and preserves replay state', async () => {
    const rpc = jest.fn(async () => ({
      data:{
        ok:true,
        state:'replayed',
        posting_id:'jp-9',
        event_id:'evt-9',
        subledger_id:'sl-9',
        period_id:'per-9'
      },
      error:null
    }));
    const store = new SupabasePostingStore({ rpc });
    const posting = buildPosting({
      id:'fevt_store_1',
      type:'invoice.issued',
      accounting_entity_id:'11111111-1111-1111-1111-111111111111',
      effective_date:'2026-10-25T10:00:00Z',
      amount:750,
      source:{system:'crm',record_id:'inv-750'}
    });

    await store.claimEvent({
      accounting_entity_id:posting.accounting_entity_id,
      event_id:posting.event_id,
      idempotency_key:posting.idempotency_key
    });
    const result = await store.commitPosting(posting);

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('accounting_commit_posting', {
      p_event:posting.event,
      p_posting:posting
    });
    expect(result).toMatchObject({
      ok:true,
      replayed:true,
      posting_id:'jp-9'
    });
  });
});
