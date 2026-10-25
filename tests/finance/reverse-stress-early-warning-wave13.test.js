const {
  runFinancialEngine
} = require('../../lib/finance/financial-engine-registry');

const {
  getRuntimeAdapter
} = require('../../lib/capabilities/runtime-adapters');

describe('Financial core wave 13 reverse stress and early warning', () => {
  test('computes rule-driven early warning severity without hidden thresholds', () => {
    const result = runFinancialEngine(
      'risk_analysis',
      {
        operating_cash_flow: 140,
        annual_debt_service: 100,
        current_assets: 180,
        current_liabilities: 150,
        total_debt: 300,
        equity: 200,
        cash_buffer_months: 1.5,
        prior_metrics: {
          dscr: 1.6,
          current_ratio: 1.4,
          debt_to_equity: 1.3,
          cash_buffer_months: 2
        },
        early_warning_rules: [
          {
            metric: 'dscr',
            direction: 'below',
            warning_threshold: 1.5,
            critical_threshold: 1.1,
            weight: 2
          },
          {
            metric: 'cash_buffer_months',
            direction: 'below',
            warning_threshold: 2,
            critical_threshold: 1,
            weight: 1
          },
          {
            metric: 'debt_to_equity',
            direction: 'above',
            warning_threshold: 1.4,
            critical_threshold: 2,
            weight: 1
          }
        ]
      },
      { serviceCode: 'early_warning_analysis' }
    );

    expect(result.ok).toBe(true);
    expect(result.metrics.overall_severity).toBe('warning');
    expect(result.metrics.warning_count).toBe(3);
    expect(result.metrics.critical_count).toBe(0);
    expect(result.metrics.deteriorating_count).toBe(3);
    expect(result.diagnostics.method).toBe('explicit_threshold_rules');
  });

  test('fails closed when early-warning thresholds are missing or inconsistent', () => {
    const result = runFinancialEngine(
      'risk_analysis',
      {
        metrics: { dscr: 1.2 },
        early_warning_rules: [
          {
            metric: 'dscr',
            direction: 'below',
            warning_threshold: 1,
            critical_threshold: 1.5
          }
        ]
      },
      { serviceCode: 'early_warning_analysis' }
    );

    expect(result.ok).toBe(false);
    expect(result.required_inputs)
      .toContain('early_warning_rules[0].critical_lte_warning');
  });

  test('reverse-solves the shock needed to reach an explicit failure threshold', () => {
    const result = runFinancialEngine(
      'scenario_forecast',
      {
        reverse_stress_cases: [
          {
            metric: 'dscr',
            baseline_value: 1.6,
            failure_threshold: 1.0,
            shock_direction: 'decrease',
            metric_change_per_1pct_shock: 0.03,
            max_shock_pct: 30
          },
          {
            metric: 'debt_to_ebitda',
            baseline_value: 2.5,
            failure_threshold: 4,
            shock_direction: 'increase',
            metric_change_per_1pct_shock: 0.05,
            max_shock_pct: 25
          }
        ]
      },
      { serviceCode: 'reverse_stress_testing' }
    );

    expect(result.ok).toBe(true);
    expect(result.metrics.case_count).toBe(2);
    expect(result.metrics.nearest_failure_metric).toBe('dscr');
    expect(result.metrics.nearest_failure_shock_pct).toBeCloseTo(20, 8);
    expect(result.metrics.cases[0].breach_within_max_shock).toBe(true);
    expect(result.metrics.cases[1].required_shock_pct).toBeCloseTo(30, 8);
    expect(result.metrics.cases[1].breach_within_max_shock).toBe(false);
    expect(result.diagnostics.method)
      .toBe('explicit_linear_sensitivity_reverse_solve');
  });

  test('reverse stress rejects inconsistent failure direction', () => {
    const result = runFinancialEngine(
      'scenario_forecast',
      {
        reverse_stress_cases: [
          {
            metric: 'dscr',
            baseline_value: 1.2,
            failure_threshold: 1.5,
            shock_direction: 'decrease',
            metric_change_per_1pct_shock: 0.02
          }
        ]
      },
      { serviceCode: 'reverse_stress_testing' }
    );

    expect(result.ok).toBe(false);
    expect(result.required_inputs)
      .toContain('reverse_stress_cases[0].failure_threshold_consistent_with_direction');
  });

  test('runtime adapters preserve early-warning and reverse-stress service scope', async () => {
    const riskAdapter = getRuntimeAdapter('risk_analysis_engine');
    const scenarioAdapter = getRuntimeAdapter('scenario_forecast_engine');

    const warning = await riskAdapter({
      service_code: 'early_warning_analysis',
      inputs: {
        metrics: { dscr: 1.0 },
        early_warning_rules: [{
          metric: 'dscr',
          direction: 'below',
          warning_threshold: 1.3,
          critical_threshold: 1.1
        }]
      }
    });

    const reverse = await scenarioAdapter({
      service_code: 'reverse_stress_testing',
      inputs: {
        reverse_stress_cases: [{
          metric: 'cash_balance',
          baseline_value: 100,
          failure_threshold: 0,
          shock_direction: 'decrease',
          metric_change_per_1pct_shock: 5
        }]
      }
    });

    expect(warning.ok).toBe(true);
    expect(warning.metrics.overall_severity).toBe('critical');
    expect(reverse.ok).toBe(true);
    expect(reverse.metrics.nearest_failure_shock_pct).toBe(20);
  });
});
