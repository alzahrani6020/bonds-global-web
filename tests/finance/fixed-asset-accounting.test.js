'use strict';

const fs = require('fs');
const path = require('path');

const {
  buildStraightLineDepreciationSchedule,
  buildDepreciationPosting
} = require('../../lib/finance/accounting/fixed-asset-depreciation-engine');
const {
  normalizeFinancialEvent,
  EVENT_TYPES
} = require('../../lib/finance/accounting/financial-event');
const {
  SupabaseFixedAssetAccountingStore
} = require('../../lib/finance/accounting/supabase-fixed-asset-accounting-store');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026013000_accounting_fixed_assets_cost_centers.sql'),
  'utf8'
);

function asset(overrides = {}) {
  return {
    id:'asset-accounting-1',
    accounting_entity_id:'entity-1',
    bonds_asset_id:'bonds-asset-1',
    asset_code:'FA-001',
    name:'Production Machine',
    acquisition_date:'2026-09-10',
    in_service_date:'2026-10-15',
    acquisition_cost:1200,
    residual_value:200,
    useful_life_months:10,
    depreciation_method:'straight_line',
    depreciation_convention:'full_month',
    currency:'SAR',
    depreciation_expense_account_code:'6100',
    depreciation_expense_account_name:'Depreciation Expense',
    accumulated_depreciation_account_code:'1290',
    accumulated_depreciation_account_name:'Accumulated Depreciation',
    cost_center_id:'cc-1',
    ...overrides
  };
}

function monthlyPeriod(id, month, status = 'open') {
  const [year, mon] = month.split('-').map(Number);
  const end = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0,10);
  return {
    id,
    period_code:month,
    starts_on:month + '-01',
    ends_on:end,
    status
  };
}

describe('fixed asset accounting and cost centers', () => {
  test('builds deterministic straight-line monthly schedule and respects residual floor', () => {
    const periods = [];
    for (let i = 0; i < 10; i += 1) {
      const d = new Date(Date.UTC(2026, 9 + i, 1));
      const month = d.toISOString().slice(0,7);
      periods.push(monthlyPeriod('p-' + (i + 1), month));
    }

    const result = buildStraightLineDepreciationSchedule({
      asset:asset(),
      periods
    });

    expect(result.depreciable_basis).toBe(1000);
    expect(result.monthly_depreciation).toBe(100);
    expect(result.schedule).toHaveLength(10);
    expect(result.schedule[0]).toMatchObject({
      depreciation_amount:100,
      accumulated_depreciation:100,
      ending_book_value:1100
    });
    expect(result.schedule[9]).toMatchObject({
      depreciation_amount:100,
      accumulated_depreciation:1000,
      ending_book_value:200
    });
    expect(result.provenance).toMatchObject({
      method:'straight_line',
      convention:'full_month',
      deterministic:true,
      ai_generated:false
    });
  });

  test('skips periods before service and after useful life', () => {
    const result = buildStraightLineDepreciationSchedule({
      asset:asset({useful_life_months:2,residual_value:1000}),
      periods:[
        monthlyPeriod('sep','2026-09'),
        monthlyPeriod('oct','2026-10'),
        monthlyPeriod('nov','2026-11'),
        monthlyPeriod('dec','2026-12')
      ]
    });

    expect(result.schedule.map(row => row.period_id)).toEqual(['oct','nov']);
    expect(result.schedule[1].ending_book_value).toBe(1000);
  });

  test('rejects non-monthly accounting periods for full-month convention', () => {
    expect(() => buildStraightLineDepreciationSchedule({
      asset:asset(),
      periods:[{
        id:'p1',
        starts_on:'2026-10-15',
        ends_on:'2026-10-31',
        status:'open'
      }]
    })).toThrow('DEPRECIATION_MONTHLY_PERIOD_REQUIRED');
  });

  test('builds depreciation event and balanced posting through existing posting contract', () => {
    const schedule = buildStraightLineDepreciationSchedule({
      asset:asset(),
      periods:[monthlyPeriod('p-oct','2026-10')]
    }).schedule[0];

    const bundle = buildDepreciationPosting({
      asset:asset(),
      scheduleRow:{...schedule,id:'schedule-1'}
    });

    expect(bundle.event).toMatchObject({
      type:'asset.depreciation.recorded',
      accounting_entity_id:'entity-1',
      amount:100,
      currency:'SAR',
      source:{
        system:'accounting_fixed_assets',
        record_id:'schedule-1'
      },
      payload:{
        fixed_asset_id:'asset-accounting-1',
        period_id:'p-oct',
        schedule_id:'schedule-1',
        bonds_asset_id:'bonds-asset-1',
        method:'straight_line',
        convention:'full_month'
      }
    });

    expect(bundle.posting.journal).toMatchObject({
      total_debit:100,
      total_credit:100
    });
    expect(bundle.posting.journal.lines).toEqual([
      expect.objectContaining({
        account_code:'6100',
        debit:100,
        credit:0,
        dimensions:{cost_center_id:'cc-1'}
      }),
      expect.objectContaining({
        account_code:'1290',
        debit:0,
        credit:100,
        dimensions:{cost_center_id:'cc-1'}
      })
    ]);
  });

  test('closed period cannot build a depreciation posting', () => {
    const schedule = buildStraightLineDepreciationSchedule({
      asset:asset(),
      periods:[monthlyPeriod('p-oct','2026-10','soft_closed')]
    }).schedule[0];

    expect(() => buildDepreciationPosting({
      asset:asset(),
      scheduleRow:{...schedule,id:'schedule-1'}
    })).toThrow('ACCOUNTING_PERIOD_NOT_OPEN');
  });

  test('financial event taxonomy accepts asset depreciation without adding another posting engine', () => {
    expect(EVENT_TYPES).toContain('asset.depreciation.recorded');
    const event = normalizeFinancialEvent({
      type:'asset.depreciation.recorded',
      accounting_entity_id:'entity-1',
      effective_date:'2026-10-31T23:59:59Z',
      occurred_at:'2026-10-31T23:59:59Z',
      amount:100,
      currency:'SAR',
      source:{system:'accounting_fixed_assets',record_id:'schedule-1'},
      payload:{fixed_asset_id:'asset-1',period_id:'period-1'}
    });
    expect(event.idempotency_key).toMatch(/^[0-9a-f]{64}$/);
  });

  test('schema links accounting fixed assets to existing bonds_assets instead of creating a duplicate registry', () => {
    expect(MIGRATION).toContain(
      'bonds_asset_id uuid references public.bonds_assets(id) on delete set null'
    );
    expect(MIGRATION).not.toMatch(/create table if not exists public\.bonds_assets/i);
    expect(MIGRATION).toContain('create table if not exists public.accounting_fixed_assets');
    expect(MIGRATION).toContain('create table if not exists public.accounting_cost_centers');
    expect(MIGRATION).toContain('create table if not exists public.accounting_asset_depreciation_schedule');
  });

  test('cost center is first-class and validated before journal-line persistence', () => {
    expect(MIGRATION).toContain('add column if not exists cost_center_id uuid');
    expect(MIGRATION).toContain('accounting_resolve_line_cost_center');
    expect(MIGRATION).toContain("raise exception 'COST_CENTER_ID_INVALID'");
    expect(MIGRATION).toContain("raise exception 'COST_CENTER_NOT_ACTIVE'");
    expect(MIGRATION).toContain('idx_accounting_journal_lines_entity_cost_center');
  });

  test('depreciation commit is atomic and reuses accounting_commit_posting', () => {
    expect(MIGRATION).toContain('create or replace function public.accounting_commit_asset_depreciation');
    expect(MIGRATION).toContain('v_result := public.accounting_commit_posting(p_event,p_posting)');
    expect(MIGRATION).toContain("raise exception 'DEPRECIATION_AMOUNT_MISMATCH'");
    expect(MIGRATION).toContain("raise exception 'DEPRECIATION_EVENT_REFERENCE_MISMATCH'");
    expect(MIGRATION).toContain(
      'grant execute on function public.accounting_commit_asset_depreciation(uuid,jsonb,jsonb)'
    );
    expect(MIGRATION).not.toMatch(
      /grant execute on function public\.accounting_commit_asset_depreciation\(uuid,jsonb,jsonb\)[\s\S]{0,80}to authenticated/i
    );
  });

  test('store upserts schedules and commits via governed depreciation RPC', async () => {
    const select = jest.fn(async () => ({
      data:[{id:'schedule-1',status:'scheduled'}],
      error:null
    }));
    const upsert = jest.fn(() => ({select}));
    const from = jest.fn(() => ({upsert}));
    const rpc = jest.fn(async () => ({
      data:{ok:true,state:'claimed',schedule_id:'schedule-1'},
      error:null
    }));

    const store = new SupabaseFixedAssetAccountingStore({from,rpc});

    const result = await store.upsertSchedule([{
      accounting_entity_id:'entity-1',
      fixed_asset_id:'asset-1',
      period_id:'period-1',
      period_code:'2026-10',
      effective_date:'2026-10-31',
      month_index:0,
      depreciation_amount:100,
      accumulated_depreciation:100,
      ending_book_value:1100,
      status:'scheduled'
    }]);

    expect(from).toHaveBeenCalledWith('accounting_asset_depreciation_schedule');
    expect(upsert).toHaveBeenCalledWith([
      expect.objectContaining({
        accounting_entity_id:'entity-1',
        fixed_asset_id:'asset-1',
        period_id:'period-1',
        depreciation_amount:100,
        accumulated_depreciation:100,
        ending_book_value:1100,
        status:'scheduled'
      })
    ], {onConflict:'accounting_entity_id,fixed_asset_id,period_id'});
    expect(result.upserted).toBe(1);

    await store.commitDepreciation({
      scheduleId:'schedule-1',
      event:{type:'asset.depreciation.recorded'},
      posting:{journal:{total_debit:100,total_credit:100}}
    });

    expect(rpc).toHaveBeenCalledWith('accounting_commit_asset_depreciation', {
      p_schedule_id:'schedule-1',
      p_event:{type:'asset.depreciation.recorded'},
      p_posting:{journal:{total_debit:100,total_credit:100}}
    });
  });
});
