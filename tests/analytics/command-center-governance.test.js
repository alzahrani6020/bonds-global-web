'use strict';

const {
  riyadhDate,
  buildMetricSnapshot,
  validateTargetInput,
  validateAlertInput
} = require('../../lib/analytics/command-center-governance');

describe('command center governance', () => {
  test('builds the metric snapshot from verified operating sources', () => {
    const snapshot = buildMetricSnapshot(
      { executive: { pipelineValue: 500000, revenueSeries: [{ month: riyadhDate().slice(0,7), value: 120000 }] } },
      { traffic: { visitorsToday: 30, onlineNow: 2 }, leads: { today: 4, fundingRequests30d: 7, aggregateLeadConversionPct30d: 3.2 } },
      { configured: true, status: 'healthy', today: { activeUsers: 40 }, realtime: { activeUsers: 3 } }
    );
    expect(snapshot).toEqual(expect.objectContaining({
      visitors_today: 40,
      active_users_now: 3,
      leads_today: 4,
      funding_requests_30d: 7,
      monthly_revenue: 120000,
      pipeline_value: 500000,
      conversion_rate: 3.2
    }));
  });

  test('falls back to BONDS first-party traffic when GA4 is not healthy', () => {
    const snapshot = buildMetricSnapshot(
      { executive: { pipelineValue: 0, revenueSeries: [] } },
      { traffic: { visitorsToday: 8, onlineNow: 1 }, leads: { today: 0, fundingRequests30d: 0, aggregateLeadConversionPct30d: null } },
      { configured: true, status: 'degraded' }
    );
    expect(snapshot.visitors_today).toBe(8);
    expect(snapshot.active_users_now).toBe(1);
  });

  test('does not invent target defaults', () => {
    expect(() => validateTargetInput({
      metric_key: 'monthly_revenue',
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      comparison: 'gte',
      scenario: 'base'
    })).toThrow('target_value');
  });

  test('validates a complete approved target', () => {
    expect(validateTargetInput({
      metric_key: 'monthly_revenue',
      period_start: '2026-10-01',
      period_end: '2026-10-31',
      target_value: 500000,
      comparison: 'gte',
      scenario: 'base',
      notes: 'Board-approved target'
    })).toEqual(expect.objectContaining({
      metric_key: 'monthly_revenue',
      target_value: 500000,
      comparison: 'gte',
      scenario: 'base'
    }));
  });

  test('requires explicit alert threshold and severity', () => {
    expect(() => validateAlertInput({
      name: 'Revenue floor',
      metric_key: 'monthly_revenue',
      operator: 'lt',
      severity: 'critical',
      cooldown_minutes: 60
    })).toThrow('threshold');

    expect(validateAlertInput({
      name: 'Revenue floor',
      metric_key: 'monthly_revenue',
      operator: 'lt',
      threshold: 100000,
      severity: 'critical',
      cooldown_minutes: 60,
      enabled: true
    })).toEqual(expect.objectContaining({
      operator: 'lt',
      threshold: 100000,
      severity: 'critical',
      enabled: true
    }));
  });
});
