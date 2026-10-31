'use strict';

const { buildServiceProfitability } = require('../../lib/analytics/service-profitability');

describe('Service profitability v1', () => {
  test('uses posted revenue recognition and direct expense only', () => {
    const result = buildServiceProfitability({
      catalog:[{id:'svc-1',code:'feasibility',name_en:'Feasibility'}],
      serviceRequests:[{id:'r1',service_id:'svc-1'}],
      financialEvents:[
        {service_code:'feasibility',event_type:'invoice.issued',amount:1000,currency:'SAR',status:'posted'},
        {service_code:'feasibility',event_type:'expense.approved',amount:400,currency:'SAR',status:'posted'},
        {service_code:'feasibility',event_type:'payment.received',amount:1000,currency:'SAR',status:'posted'}
      ]
    });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toEqual(expect.objectContaining({
      recognizedRevenue:1000,
      directCost:400,
      observedDirectProfit:600,
      observedDirectMarginPct:60,
      dataState:'observed_direct_margin'
    }));
    expect(result.coverage.ignoredUnsupported).toBe(1);
    expect(result.semantics).toBe('observed_direct_margin_not_full_operating_profit');
  });

  test('does not invent zero cost when no posted cost evidence exists', () => {
    const result = buildServiceProfitability({
      catalog:[{id:'svc-1',code:'advisory',name_en:'Advisory'}],
      serviceRequests:[{id:'r1',service_id:'svc-1'}],
      financialEvents:[
        {service_code:'advisory',event_type:'service_fee.accrued',amount:2500,currency:'SAR',status:'posted'}
      ]
    });

    expect(result.rows[0].recognizedRevenue).toBe(2500);
    expect(result.rows[0].directCost).toBeNull();
    expect(result.rows[0].observedDirectProfit).toBeNull();
    expect(result.rows[0].observedDirectMarginPct).toBeNull();
    expect(result.rows[0].dataState).toBe('partial_evidence');
    expect(result.totals).toBeNull();
  });

  test('ignores accepted reversed rejected and missing-service events', () => {
    const result = buildServiceProfitability({
      catalog:[{id:'svc-1',code:'valuation',name_en:'Valuation'}],
      serviceRequests:[],
      financialEvents:[
        {service_code:'valuation',event_type:'invoice.issued',amount:1000,currency:'SAR',status:'accepted'},
        {service_code:'valuation',event_type:'expense.approved',amount:100,currency:'SAR',status:'reversed'},
        {service_code:null,event_type:'invoice.issued',amount:500,currency:'SAR',status:'posted'}
      ]
    });

    expect(result.rows).toHaveLength(0);
    expect(result.dataState).toBe('unknown');
    expect(result.coverage.ignoredUnposted).toBe(2);
    expect(result.coverage.ignoredMissingService).toBe(1);
  });

  test('does not aggregate across currencies', () => {
    const result = buildServiceProfitability({
      catalog:[
        {id:'svc-1',code:'a',name_en:'A'},
        {id:'svc-2',code:'b',name_en:'B'}
      ],
      serviceRequests:[],
      financialEvents:[
        {service_code:'a',event_type:'invoice.issued',amount:100,currency:'SAR',status:'posted'},
        {service_code:'a',event_type:'expense.approved',amount:50,currency:'SAR',status:'posted'},
        {service_code:'b',event_type:'invoice.issued',amount:100,currency:'USD',status:'posted'},
        {service_code:'b',event_type:'expense.approved',amount:25,currency:'USD',status:'posted'}
      ]
    });

    expect(result.currencies).toEqual(['SAR','USD']);
    expect(result.totals).toBeNull();
  });

  test('surfaces requested services with no posted financial events as unknown', () => {
    const result = buildServiceProfitability({
      catalog:[{id:'svc-1',code:'research',name_en:'Research'}],
      serviceRequests:[{id:'r1',service_id:'svc-1'},{id:'r2',service_id:'svc-1'}],
      financialEvents:[]
    });

    expect(result.status).toBe('partial');
    expect(result.dataState).toBe('unknown');
    expect(result.requestedWithoutFinancials).toEqual([
      expect.objectContaining({serviceCode:'research',requestCount:2,dataState:'unknown_no_posted_financial_events'})
    ]);
  });
});
