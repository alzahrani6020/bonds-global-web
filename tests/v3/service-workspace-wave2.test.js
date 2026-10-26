'use strict';

const fs = require('fs');
const path = require('path');
const { runFinancialEngine } = require('../../lib/finance/financial-engine-registry');

describe('second service workspace activation wave', () => {
  const sql = fs.readFileSync(
    path.join(process.cwd(), 'supabase/migrations/20261026033700_activate_second_workspace_wave.sql'),
    'utf8'
  );

  test('fails closed unless all six verified candidates are still request-only', () => {
    expect(sql).toContain('if candidate_count <> 6 then');
    expect(sql).toContain('if preexisting_map_count <> 0 then');
  });

  test('maps only governed capabilities that already exist', () => {
    for (const action of [
      'management_reporting_run',
      'scenario_forecast_run',
      'financial_analysis_run',
      'accounting_dimension_create',
      'accounting_period_transition',
      'accounting_year_end_close'
    ]) {
      expect(sql).toContain("'"+action+"'");
    }
    expect(sql).not.toContain("'orchestrator_run'");
  });

  test('financial ratios use scoped requirements', () => {
    const result = runFinancialEngine('financial_analysis', {
      revenue: 1000,
      current_assets: 500,
      current_liabilities: 250
    }, { serviceCode: 'financial_ratios' });

    expect(result.ok).toBe(true);
    expect(result.required_inputs).toEqual([]);
    expect(result.metrics.current_ratio).toBe(2);
  });

  test('liquidity analysis does not require revenue', () => {
    const result = runFinancialEngine('financial_analysis', {
      current_assets: 500,
      current_liabilities: 250,
      cash: 100,
      inventory: 50
    }, { serviceCode: 'liquidity_analysis' });

    expect(result.ok).toBe(true);
    expect(result.required_inputs).toEqual([]);
    expect(result.metrics.current_ratio).toBe(2);
    expect(result.metrics.quick_ratio).toBe(1.8);
    expect(result.metrics.cash_ratio).toBe(0.4);
  });

  test('liquidity analysis fails closed on missing balance inputs', () => {
    const result = runFinancialEngine('financial_analysis', {
      current_assets: 500
    }, { serviceCode: 'liquidity_analysis' });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('current_liabilities');
  });
});
