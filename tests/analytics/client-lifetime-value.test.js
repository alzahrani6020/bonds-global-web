const { buildClientLifetimeValue } = require('../../lib/analytics/client-lifetime-value');

describe('Client Lifetime Value adapter', () => {
  test('stays fail-honest when production evidence is incomplete', () => {
    const result = buildClientLifetimeValue({
      clients:[{id:'c1'}],
      serviceRequests:[{id:'r1',client_id:'c1'}],
      financialEvents:[],
      customerSuccess:[]
    });

    expect(result.status).toBe('partial');
    expect(result.dataState).toBe('unknown');
    expect(result.ltv).toBeNull();
    expect(result.coverage.clients).toBe(1);
    expect(result.coverage.clientsWithServiceRequests).toBe(1);
    expect(result.coverage.postedClientAttributedFinancialEvents).toBe(0);
    expect(result.missingEvidence).toContain('posted_client_attributed_financial_events');
    expect(result.semantics).toBe('governed_ltv_not_crm_pipeline_value');
  });

  test('uses the existing unit-economics engine for governed LTV evidence', () => {
    const result = buildClientLifetimeValue({
      clients:[{id:'c1'}],
      serviceRequests:[{id:'r1',client_id:'c1'}],
      financialEvents:[{
        status:'posted',
        event_type:'invoice.issued',
        amount:1000,
        payload:{client_id:'c1'}
      }],
      customerSuccess:[{client_id:'c1',lifecycle_stage:'active'}],
      governedUnitEconomicsInput:{
        period_basis:'monthly',
        active_customers:10,
        gross_profit:4000,
        churn_rate_pct:5
      }
    });

    expect(result.status).toBe('partial');
    expect(result.dataState).toBe('available');
    expect(result.ltv).toBe(8000);
    expect(result.engine).toBe('unit_economics');
    expect(result.method).toBe('gross_profit_per_customer_divided_by_churn');
    expect(result.coverage.postedClientAttributedFinancialEvents).toBe(1);
  });

  test('does not treat CRM pipeline value as CLV evidence', () => {
    const result = buildClientLifetimeValue({
      clients:[{id:'c1'}],
      serviceRequests:[],
      financialEvents:[],
      customerSuccess:[],
      governedUnitEconomicsInput:null
    });
    expect(result.ltv).toBeNull();
    expect(result.semantics).toBe('governed_ltv_not_crm_pipeline_value');
  });
});
