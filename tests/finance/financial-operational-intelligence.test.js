'use strict';

const {
  buildExecutiveFinancialMetrics,
  evaluateFinancialOperationalAlerts,
  persistExecutiveFinancialMetrics
} = require('../../lib/finance/accounting/financial-operational-intelligence');
const {
  notificationFromFinancialOperationalAlert
} = require('../../lib/assistant/notification-engine');

describe('financial operational intelligence', () => {
  test('builds executive metrics from existing statement, aging, CRM and operations inputs', () => {
    const metrics = buildExecutiveFinancialMetrics({
      statements:{
        balance_sheet:{total_assets:1000,total_liabilities:400,total_equity:600},
        income_statement:{revenue:900,net_income:180},
        normalized_input:{}
      },
      financialAnalysis:{metrics:{working_capital:-50,current_ratio:0.8,debt_to_equity:1.5}},
      receivablesAging:{total:200,current:100,b30:40,b60:20,b90:20,b120:10,over120:10},
      payablesAging:{total:100,current:60,b30:20,b60:10,b90:5,b120:5,over120:0},
      crm:{pipeline_value:5000,weighted_pipeline_value:2500,opportunity_count:10,won_count:6,lost_count:4},
      operations:{average_processing_hours:30,completed_count:8,rejected_count:2}
    });

    expect(metrics).toMatchObject({
      revenue:900,
      net_income:180,
      total_assets:1000,
      total_liabilities:400,
      total_equity:600,
      working_capital:-50,
      current_ratio:0.8,
      debt_to_equity:1.5,
      receivables_total:200,
      receivables_overdue:100,
      receivables_overdue_ratio:0.5,
      payables_total:100,
      payables_overdue:40,
      payables_overdue_ratio:0.4,
      conversion_rate:0.6
    });
  });

  test('emits bounded deterministic alerts without auto execution', () => {
    const alerts = evaluateFinancialOperationalAlerts({
      metrics:{
        receivables_overdue_ratio:0.5,
        payables_overdue_ratio:0.4,
        working_capital:-100,
        current_ratio:0.7,
        debt_to_equity:3.5
      },
      context:{
        accounting_entity_id:'entity-1',
        application_id:'app-1',
        missing_document_count:2,
        bank_statement_age_days:120,
        application_stuck_hours:100,
        contract_id:'contract-1',
        contract_days_to_expiry:5,
        evidence_contradiction_count:1
      }
    });

    const types = new Set(alerts.map(a => a.type));
    for (const expected of [
      'PAYMENT_OVERDUE',
      'OBLIGATION_OVERDUE',
      'LIQUIDITY_PRESSURE',
      'CURRENT_RATIO_LOW',
      'LEVERAGE_HIGH',
      'FINANCING_DOCUMENT_MISSING',
      'BANK_STATEMENT_STALE',
      'APPLICATION_STUCK',
      'CONTRACT_EXPIRING',
      'EVIDENCE_CONTRADICTION'
    ]) {
      expect(types.has(expected)).toBe(true);
    }
    expect(alerts.every(a => a.informational_only === true)).toBe(true);
    expect(alerts.every(a => a.auto_execute === false)).toBe(true);
  });

  test('routes financial alert through existing notification engine', () => {
    const [alert] = evaluateFinancialOperationalAlerts({
      metrics:{receivables_overdue_ratio:0.5},
      context:{accounting_entity_id:'entity-1'}
    });
    const notification = notificationFromFinancialOperationalAlert(alert);

    expect(notification).toMatchObject({
      source:'financial_operations',
      event_type:'financial_operational_alert',
      financial_alert_type:'PAYMENT_OVERDUE',
      priority:'critical',
      read:false
    });
    expect(notification.event_id).toBe(alert.id);
    expect(notification.policy).toEqual({
      informational_only:true,
      auto_execute:false,
      authorization_granted:false
    });
  });

  test('does not emit ratios when denominator is absent or zero', () => {
    const metrics = buildExecutiveFinancialMetrics({
      receivablesAging:{total:0,over120:100},
      payablesAging:{}
    });
    expect(metrics.receivables_overdue_ratio).toBeNull();
    expect(metrics.payables_overdue_ratio).toBeNull();
  });

  test('persists metrics into existing admin metric snapshots without new analytics store', async () => {
    const upsert = jest.fn(async () => ({error:null}));
    const from = jest.fn(() => ({upsert}));
    const result = await persistExecutiveFinancialMetrics({
      supabase:{from},
      metricDate:'2026-10-25',
      metrics:{revenue:1000,current_ratio:1.5,unknown:null},
      dimensions:{accounting_entity_id:'entity-1'}
    });

    expect(from).toHaveBeenCalledWith('admin_metric_snapshots');
    expect(upsert).toHaveBeenCalledWith([
      expect.objectContaining({metric_key:'financial.revenue',value:1000}),
      expect.objectContaining({metric_key:'financial.current_ratio',value:1.5})
    ], {onConflict:'metric_date,metric_key,dimensions'});
    expect(result).toEqual({ok:true,upserted:2});
  });

  test('invalid metric date fails before database write', async () => {
    const from = jest.fn();
    await expect(persistExecutiveFinancialMetrics({
      supabase:{from},
      metricDate:'25/10/2026',
      metrics:{revenue:1000}
    })).rejects.toThrow('EXECUTIVE_METRICS_DATE_INVALID');
    expect(from).not.toHaveBeenCalled();
  });
});
