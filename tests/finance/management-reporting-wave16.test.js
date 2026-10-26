const {
  runFinancialEngine
} = require('../../lib/finance/financial-engine-registry');

describe('Management reporting core wave 16', () => {
  test('builds a deterministic CFO pack with actual budget prior and KPI coverage', () => {
    const result = runFinancialEngine('management_reporting', {
      pack_type: 'cfo',
      period: '2026-10',
      currency: 'SAR',
      materiality_pct: 5,
      actual: {
        revenue: 1200,
        gross_profit: 500,
        operating_profit: 240,
        cash_balance: 300
      },
      budget: {
        revenue: 1000,
        gross_profit: 480,
        operating_profit: 260,
        cash_balance: 350
      },
      prior: {
        revenue: 900,
        gross_profit: 420,
        operating_profit: 200,
        cash_balance: 280
      },
      kpis: [
        { code: 'DSCR', name: 'DSCR', value: 1.8, target: 1.5 }
      ],
      risks: [
        { id: 'R1', title: 'Liquidity concentration', severity: 'warning' }
      ],
      actions: [
        { id: 'A1', title: 'Reduce receivable days', owner: 'CFO', status: 'open' }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.pack.type).toBe('cfo');
    expect(result.metrics.pack.period).toBe('2026-10');
    expect(result.metrics.metric_count).toBe(4);
    expect(result.metrics.kpi_count).toBe(1);
    expect(result.metrics.risk_count).toBe(1);
    expect(result.metrics.action_count).toBe(1);
    expect(result.metrics.material_variance_count).toBe(4);
    expect(result.metrics.pack.cfo_focus.material_variance_count).toBe(4);
    expect(result.diagnostics.commentary_method).toBe('formula_based_no_ai');
  });

  test('builds board focus from largest material variances', () => {
    const result = runFinancialEngine('management_reporting', {
      pack_type: 'board',
      materiality_pct: 5,
      actual: {
        revenue: 1200,
        operating_profit: 150,
        cash_balance: 300
      },
      budget: {
        revenue: 1000,
        operating_profit: 200,
        cash_balance: 360
      },
      risks: [
        { id: 'R1', title: 'Margin erosion', severity: 'critical' }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.pack.board_focus.risk_count).toBe(1);
    expect(result.metrics.pack.board_focus.top_material_variances.length)
      .toBeGreaterThan(0);
  });

  test('supports monthly management and KPI packs from the same engine', () => {
    const monthly = runFinancialEngine('management_reporting', {
      pack_type: 'monthly_management',
      actual: { revenue: 100, operating_profit: 20 },
      kpis: [{ code: 'MARGIN', name: 'Operating Margin', value: 20, target: 18 }],
      actions: [{ id: 'A1', title: 'Action', status: 'open' }]
    });

    const kpi = runFinancialEngine('management_reporting', {
      pack_type: 'kpi',
      actual: { revenue: 100 },
      kpis: [{ code: 'REV', name: 'Revenue', value: 100, target: 95 }]
    });

    expect(monthly.ok).toBe(true);
    expect(monthly.metrics.pack.monthly_focus.open_action_count).toBe(1);
    expect(kpi.ok).toBe(true);
    expect(kpi.metrics.pack.kpi_focus.with_target_count).toBe(1);
  });

  test('fails closed on invalid pack type or non-numeric actuals', () => {
    const result = runFinancialEngine('management_reporting', {
      pack_type: 'unknown',
      actual: { revenue: 'abc' }
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs)
      .toContain('pack_type_cfo_board_monthly_management_or_kpi');
    expect(result.required_inputs).toContain('actual.revenue_numeric');
  });

  test('does not invent risks or actions when none are supplied', () => {
    const result = runFinancialEngine('management_reporting', {
      pack_type: 'board',
      actual: { revenue: 1000 }
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.risk_count).toBe(0);
    expect(result.metrics.action_count).toBe(0);
    expect(result.metrics.pack.risks).toEqual([]);
    expect(result.metrics.pack.actions_required).toEqual([]);
  });
});
