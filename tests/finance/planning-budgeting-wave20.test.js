const {
  planningBudgetingAnalysis
} = require('../../lib/finance/engines/planning-budgeting-engine');

describe('Planning budgeting core wave 20', () => {
  test('combines actuals and explicit future forecast into a rolling forecast', () => {
    const result = planningBudgetingAnalysis({
      fiscal_year:'2026',
      currency:'SAR',
      materiality_pct:5,
      metric_directions:{
        revenue:'higher_is_better',
        operating_expense:'lower_is_better'
      },
      periods:[
        { period:'2026-01', status:'actual', actual:{ revenue:120, operating_expense:70 }, budget:{ revenue:100, operating_expense:75 } },
        { period:'2026-02', status:'actual', actual:{ revenue:90, operating_expense:80 }, budget:{ revenue:100, operating_expense:75 } },
        { period:'2026-03', status:'forecast', budget:{ revenue:110, operating_expense:76 }, forecast:{ revenue:115, operating_expense:74 } }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.summary.revenue.actual_to_date).toBe(210);
    expect(result.metrics.summary.revenue.budget_to_date).toBe(200);
    expect(result.metrics.summary.revenue.full_year_budget).toBe(310);
    expect(result.metrics.summary.revenue.rolling_forecast).toBe(325);
    expect(result.metrics.summary.revenue.forecast_vs_budget_variance).toBe(15);
    expect(result.metrics.summary.revenue.forecast_favorable).toBe(true);
    expect(result.metrics.summary.operating_expense.rolling_forecast).toBe(224);
    expect(result.metrics.rows.find(row =>
      row.period === '2026-01' && row.metric === 'operating_expense'
    ).favorable).toBe(true);
    expect(result.provenance.ai_generated).toBe(false);
  });

  test('uses budget as future forecast only when explicitly enabled', () => {
    const result = planningBudgetingAnalysis({
      use_budget_as_forecast:true,
      periods:[
        { period:'P1', status:'actual', actual:{ revenue:100 }, budget:{ revenue:90 } },
        { period:'P2', status:'forecast', budget:{ revenue:110 } }
      ]
    });

    expect(result.ok).toBe(true);
    const future = result.metrics.rows.find(row => row.period === 'P2');
    expect(future.rolling_forecast).toBe(110);
    expect(future.forecast_source).toBe('explicit_budget_fallback');
  });

  test('fails closed without explicit future forecast when fallback is disabled', () => {
    const result = planningBudgetingAnalysis({
      periods:[
        { period:'P1', status:'actual', actual:{ revenue:100 }, budget:{ revenue:90 } },
        { period:'P2', status:'forecast', budget:{ revenue:110 } }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs)
      .toContain('periods[1].forecast_or_explicit_budget_fallback');
  });

  test('fails closed on duplicate periods invalid direction or nonnumeric values', () => {
    const result = planningBudgetingAnalysis({
      metric_directions:{ revenue:'up' },
      periods:[
        { period:'P1', status:'actual', actual:{ revenue:'bad' } },
        { period:'P1', status:'forecast', forecast:{ revenue:100 } }
      ]
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('metric_directions.revenue_higher_or_lower_is_better');
    expect(result.required_inputs).toContain('periods[0].actual.revenue_numeric');
    expect(result.required_inputs).toContain('periods[1].period_unique');
  });

  test('does not infer growth or seasonality', () => {
    const result = planningBudgetingAnalysis({
      periods:[
        { period:'P1', status:'actual', actual:{ revenue:100 } },
        { period:'P2', status:'forecast', forecast:{ revenue:105 } }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.diagnostics.no_inferred_growth).toBe(true);
    expect(result.diagnostics.no_inferred_seasonality).toBe(true);
    expect(result.diagnostics.forecasting_method)
      .toBe('actuals_plus_explicit_future_values');
  });
});
