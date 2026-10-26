'use strict';

const fs = require('fs');
const path = require('path');
const generated = require('../../lib/capabilities/generated-service-registry');
const { RUNTIME_ADAPTERS } = require('../../lib/capabilities/runtime-adapters');
const {
  actualAmount,
  buildPlanningInputFromBudgetSnapshot
} = require('../../lib/finance/accounting/budget-planning-bridge');

describe('Financial core wave 25 governed budget baselines', () => {
  const manifest = JSON.parse(fs.readFileSync(
    path.join(process.cwd(),'services/manifests/financial-engine.service.json'),
    'utf8'
  ).replace(/^\uFEFF/,''));

  const migration = fs.readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20261027009000_financial_core_wave25_budget_governance.sql'
    ),
    'utf8'
  );

  const router = fs.readFileSync(
    path.join(process.cwd(),'lib/services/service-execution-router.js'),
    'utf8'
  );

  test('normalizes canonical ledger signs without inventing actuals', () => {
    expect(actualAmount({ account_type:'revenue', debit:0, credit:120 })).toBe(120);
    expect(actualAmount({ account_type:'expense', debit:70, credit:0 })).toBe(70);
    expect(actualAmount({ account_type:'contra_revenue', debit:5, credit:0 })).toBe(5);
  });

  test('builds deterministic FIN-043 input from approved baseline snapshot', () => {
    const input = buildPlanningInputFromBudgetSnapshot({
      ok:true,
      currency:'SAR',
      fiscal_year_start:'2026-01-01',
      fiscal_year_end:'2026-03-31',
      budget_plan_id:'budget',
      forecast_plan_id:'forecast',
      periods:[
        { period:'2026-01', starts_on:'2026-01-01', ends_on:'2026-01-31' },
        { period:'2026-02', starts_on:'2026-02-01', ends_on:'2026-02-28' },
        { period:'2026-03', starts_on:'2026-03-01', ends_on:'2026-03-31' }
      ],
      budget_lines:[
        { period:'2026-01', account_code:'4000', amount:100, dimensions:{} },
        { period:'2026-02', account_code:'4000', amount:110, dimensions:{} },
        { period:'2026-03', account_code:'4000', amount:120, dimensions:{} }
      ],
      forecast_lines:[
        { period:'2026-02', account_code:'4000', amount:115, dimensions:{} },
        { period:'2026-03', account_code:'4000', amount:125, dimensions:{} }
      ],
      actual_lines:[
        {
          period:'2026-01', account_code:'4000', account_type:'revenue',
          debit:0, credit:105, dimensions:{}
        }
      ]
    }, {
      actualThrough:'2026-01-31',
      materialityPct:5
    });

    expect(input.periods).toEqual([
      {
        period:'2026-01',
        status:'actual',
        actual:{ '4000':105 },
        budget:{ '4000':100 },
        forecast:{}
      },
      {
        period:'2026-02',
        status:'forecast',
        actual:{},
        budget:{ '4000':110 },
        forecast:{ '4000':115 }
      },
      {
        period:'2026-03',
        status:'forecast',
        actual:{},
        budget:{ '4000':120 },
        forecast:{ '4000':125 }
      }
    ]);
  });

  test('fills sparse approved baseline metrics with zero deterministically', () => {
    const input = buildPlanningInputFromBudgetSnapshot({
      ok:true,
      currency:'SAR',
      fiscal_year_start:'2026-01-01',
      fiscal_year_end:'2026-02-28',
      budget_plan_id:'budget',
      forecast_plan_id:null,
      periods:[
        { period:'P1', starts_on:'2026-01-01', ends_on:'2026-01-31' },
        { period:'P2', starts_on:'2026-02-01', ends_on:'2026-02-28' }
      ],
      budget_lines:[
        { period:'P1', account_code:'5000', amount:10, dimensions:{} },
        { period:'P2', account_code:'4000', amount:20, dimensions:{} }
      ],
      forecast_lines:[],
      actual_lines:[]
    }, {
      actualThrough:'2026-01-31',
      useBudgetAsForecast:true
    });

    expect(input.periods[0].actual).toEqual({ '4000':0, '5000':0 });
    expect(input.periods[0].budget).toEqual({ '4000':0, '5000':10 });
    expect(input.periods[1].budget).toEqual({ '4000':20, '5000':0 });
  });

  test('requires an explicit actual-through date', () => {
    expect(() => buildPlanningInputFromBudgetSnapshot({
      ok:true, periods:[], budget_lines:[], forecast_lines:[], actual_lines:[]
    })).toThrow('ACCOUNTING_BUDGET_ACTUAL_THROUGH_REQUIRED');
  });

  test('registers FIN-045 through FIN-048 on financial-engine v21', () => {
    expect(manifest.version).toBe(22);
    const expected = {
      accounting_budget_plan_create:'BONDS-CAP-FIN-046',
      accounting_budget_draft_save:'BONDS-CAP-FIN-047',
      accounting_budget_version_transition:'BONDS-CAP-FIN-048',
      accounting_budget_analysis:'BONDS-CAP-FIN-049'
    };
    for (const [action,id] of Object.entries(expected)) {
      const entry = manifest.capabilities.find(item => item.action === action);
      expect(entry?.id).toBe(id);
      expect(generated.capabilities[action]?.id).toBe(id);
      expect(typeof RUNTIME_ADAPTERS[action]).toBe('function');
      expect(router).toContain(`'${action}'`);
    }
  });

  test('uses database invariants for immutable approved versions and server-only access', () => {
    expect(migration).toContain('uq_accounting_budget_approved_version');
    expect(migration).toContain("where status = 'approved'");
    expect(migration).toContain('for update');
    expect(migration).toContain("v_status <> 'draft'");
    expect(migration).toContain("ACCOUNTING_BUDGET_VERSION_IMMUTABLE");
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on public.accounting_budget_plans from anon, authenticated');
    expect(migration).toContain('security invoker');
    expect(migration).not.toContain('security definer');
  });

  test('reuses canonical ledger actuals and FIN-043 instead of creating a parallel actuals store', () => {
    expect(migration).toContain('public.accounting_journal_entries');
    expect(migration).toContain('public.accounting_journal_lines');
    expect(migration).toContain('accounting_assert_account_dimensions');
    expect(migration).not.toContain('accounting_budget_actual');
  });
});
