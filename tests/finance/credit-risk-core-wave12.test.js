const { runFinancialEngine } = require('../../lib/finance/financial-engine-registry');

describe('Credit Risk Core wave 12', () => {
  test('computes PD x LGD x EAD deterministically from explicit calibrated parameters', () => {
    const result = runFinancialEngine('credit_risk', {
      pd_pct: 2,
      lgd_pct: 40,
      ead: 1000000,
      parameter_source: 'model',
      as_of_date: '2026-10-26',
      calibration: {
        model_id: 'corp_pd_v1',
        model_version: '1.0.0',
        calibrated_at: '2026-09-30',
        sample_size: 2500,
        observed_default_rate_pct: 1.8
      },
      collateral_value: 600000,
      stress_pd_multiplier: 2,
      stress_lgd_addon_pct: 10,
      grade_thresholds: [
        { grade: 'A', max_pd_pct: 1 },
        { grade: 'B', max_pd_pct: 3 },
        { grade: 'C', max_pd_pct: 7 },
        { grade: 'D', max_pd_pct: 100 }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.pd_pct).toBe(2);
    expect(result.metrics.lgd_pct).toBe(40);
    expect(result.metrics.ead).toBe(1000000);
    expect(result.metrics.expected_loss).toBe(8000);
    expect(result.metrics.expected_loss_pct_of_ead).toBeCloseTo(0.8, 10);
    expect(result.metrics.risk_grade).toBe('B');
    expect(result.metrics.collateral_coverage).toBeCloseTo(0.6, 10);
    expect(result.metrics.stress_pd_pct).toBe(4);
    expect(result.metrics.stress_lgd_pct).toBe(50);
    expect(result.metrics.stress_expected_loss).toBe(20000);
    expect(result.metrics.calibration_gap_pct).toBeCloseTo(0.2, 10);
  });

  test('derives EAD from drawn exposure plus undrawn commitment times CCF', () => {
    const result = runFinancialEngine('credit_risk', {
      pd_pct: 3,
      lgd_pct: 45,
      drawn_exposure: 500000,
      undrawn_commitment: 200000,
      ccf_pct: 50,
      parameter_source: 'policy',
      as_of_date: '2026-10-26'
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.ead).toBe(600000);
    expect(result.metrics.expected_loss).toBe(8100);
    expect(result.diagnostics.ead_method).toBe('drawn_plus_undrawn_times_ccf');
  });

  test('does not invent PD or LGD from credit score', () => {
    const result = runFinancialEngine('credit_risk', {
      credit_score: 88,
      ead: 500000,
      parameter_source: 'model',
      as_of_date: '2026-10-26'
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs).toContain('pd_pct');
    expect(result.required_inputs).toContain('lgd_pct');
    expect(result.required_inputs).toContain('calibration');
  });

  test('requires model calibration metadata when parameter source is model', () => {
    const result = runFinancialEngine('credit_risk', {
      pd_pct: 2,
      lgd_pct: 40,
      ead: 100000,
      parameter_source: 'model',
      as_of_date: '2026-10-26'
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('calibration');
  });

  test('rejects invalid percentages and stress assumptions', () => {
    const result = runFinancialEngine('credit_risk', {
      pd_pct: 120,
      lgd_pct: -1,
      ead: 100000,
      parameter_source: 'policy',
      as_of_date: '2026-10-26',
      stress_pd_multiplier: 0.5,
      stress_lgd_addon_pct: -2
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('pd_pct_0_to_100');
    expect(result.required_inputs).toContain('lgd_pct_0_to_100');
    expect(result.required_inputs).toContain('stress_pd_multiplier_gte_1');
    expect(result.required_inputs).toContain('stress_lgd_addon_pct_non_negative');
  });
});
