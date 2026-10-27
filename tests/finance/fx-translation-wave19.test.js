const {
  fxTranslationAnalysis
} = require('../../lib/finance/engines/fx-translation-engine');

describe('FX translation engine wave 18', () => {
  test('translates assets at closing rate, equity historically and balances CTA in OCI', () => {
    const result = fxTranslationAnalysis({
      functional_currency:'USD',
      presentation_currency:'SAR',
      balance_rows:[
        { account_code:'1010', account_name:'Cash', account_type:'asset', debit:100, credit:0 },
        { account_code:'3100', account_name:'Equity', account_type:'equity', debit:0, credit:100 }
      ],
      period_rows:[],
      rates:{
        closing:{ rate:3.75, as_of:'2026-10-26', source:'governed_test' },
        historical:{
          '3100':{ rate:3.50, as_of:'2025-01-01', source:'governed_test' }
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.balance_rows.find(row=>row.account_code==='1010').debit).toBe(375);
    expect(result.metrics.balance_rows.find(row=>row.account_code==='3100').credit).toBe(350);
    expect(result.metrics.cta.credit).toBe(25);
    expect(result.metrics.balance_rows.find(row=>row.account_code==='FX-CTA').credit).toBe(25);
    expect(result.provenance.ai_generated).toBe(false);
  });

  test('uses transaction rate or explicitly appropriate average for income and expense', () => {
    const result = fxTranslationAnalysis({
      functional_currency:'EUR',
      presentation_currency:'SAR',
      balance_rows:[],
      period_rows:[
        { account_code:'4100', account_name:'Revenue', account_type:'revenue', debit:0, credit:100 },
        { account_code:'5100', account_name:'Expense', account_type:'expense', debit:40, credit:0 }
      ],
      rates:{
        average:{ rate:4.10, appropriate:true, source:'governed_test' },
        transaction:{
          '4100':{ rate:4.20, as_of:'2026-10-10', source:'governed_test' }
        }
      }
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.period_rows.find(row=>row.account_code==='4100').credit).toBe(420);
    expect(result.metrics.period_rows.find(row=>row.account_code==='5100').debit).toBe(164);
  });

  test('is identity when functional and presentation currencies match', () => {
    const result = fxTranslationAnalysis({
      functional_currency:'SAR',
      presentation_currency:'SAR',
      balance_rows:[
        { account_code:'1010', account_name:'Cash', account_type:'asset', debit:100, credit:0 }
      ],
      period_rows:[]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.balance_rows[0].debit).toBe(100);
    expect(result.metrics.balance_rows[0].translation_rate).toBe(1);
    expect(result.metrics.cta.amount).toBe(0);
  });

  test('fails closed without historical equity rate', () => {
    const result = fxTranslationAnalysis({
      functional_currency:'USD',
      presentation_currency:'SAR',
      balance_rows:[
        { account_code:'3100', account_name:'Equity', account_type:'equity', debit:0, credit:100 }
      ],
      period_rows:[],
      rates:{ closing:{ rate:3.75 } }
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('rates.historical.3100');
  });

  test('fails closed when average rate is not explicitly appropriate', () => {
    const result = fxTranslationAnalysis({
      functional_currency:'USD',
      presentation_currency:'SAR',
      balance_rows:[],
      period_rows:[
        { account_code:'4100', account_name:'Revenue', account_type:'revenue', debit:0, credit:100 }
      ],
      rates:{ average:{ rate:3.75, appropriate:false } }
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs[0]).toContain('appropriate_average');
  });

  test('fails closed for hyperinflation before IAS 29 restatement', () => {
    const result = fxTranslationAnalysis({
      functional_currency:'USD',
      presentation_currency:'SAR',
      balance_rows:[],
      period_rows:[],
      hyperinflationary:true
    });

    expect(result.ok).toBe(false);
    expect(result.required_inputs).toContain('ias29_restatement_before_translation');
  });

  test('measures multi-currency net exposure, hedge coverage and FX shock impact', () => {
    const result = fxTranslationAnalysis({
      functional_currency:'USD',
      presentation_currency:'SAR',
      balance_rows:[],
      period_rows:[],
      fx_shock_pct:5,
      currency_exposures:[
        {
          currency:'EUR',
          asset_exposure_foreign:1000,
          liability_exposure_foreign:400,
          hedge_amount_foreign:300,
          current_rate_to_presentation:4
        },
        {
          currency:'USD',
          asset_exposure_foreign:100,
          liability_exposure_foreign:300,
          hedge_amount_foreign:100,
          current_rate_to_presentation:3.75
        }
      ]
    });

    expect(result.ok).toBe(true);
    expect(result.metrics.fx_exposure_risk).toMatchObject({
      exposure_count:2,
      fx_shock_pct:5,
      net_exposure_presentation:1650,
      absolute_net_exposure_presentation:3150,
      hedged_exposure_presentation:1575,
      unhedged_absolute_exposure_presentation:1575,
      hedge_coverage_pct:50,
      shock_impact_presentation:41.25,
      largest_unhedged_currency:'EUR',
      largest_unhedged_exposure_presentation:1200
    });
    expect(result.metrics.fx_exposure_risk.exposures[0]).toMatchObject({
      currency:'EUR',
      net_exposure_foreign:600,
      unhedged_net_exposure_foreign:300,
      hedge_coverage_pct:50,
      shock_impact_presentation:60
    });
    expect(result.metrics.fx_exposure_risk.exposures[1]).toMatchObject({
      currency:'USD',
      net_exposure_foreign:-200,
      unhedged_net_exposure_foreign:-100,
      hedge_coverage_pct:50,
      shock_impact_presentation:-18.75
    });
    expect(result.diagnostics.fx_exposure_method)
      .toBe('net_exposure_less_explicit_hedges_with_optional_parallel_shock');
  });

  test('fails closed when hedge amount exceeds absolute net FX exposure', () => {
    const result = fxTranslationAnalysis({
      functional_currency:'USD',
      presentation_currency:'SAR',
      balance_rows:[],
      period_rows:[],
      currency_exposures:[{
        currency:'EUR',
        asset_exposure_foreign:100,
        liability_exposure_foreign:20,
        hedge_amount_foreign:100,
        current_rate_to_presentation:4
      }]
    });

    expect(result.ok).toBe(false);
    expect(result.executed).toBe(false);
    expect(result.required_inputs)
      .toContain('currency_exposures[0].hedge_amount_lte_absolute_net_exposure');
  });
});
