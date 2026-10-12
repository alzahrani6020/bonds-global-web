'use strict';

const AlertEngine = require('../../v3/engine/AlertEngine');

class EventMonitorEngine {
  constructor({ supabase = null } = {}) {
    this.supabase = supabase;
  }

  async evaluate(options = {}) {
    if (!this.supabase) {
      return {
        output: { alerts: [] },
        confidence: 0,
        evidence: [],
        engine: 'event_monitor',
        status: 'not_executed',
        executed: false,
        decisionEligible: true,
        reason: 'supabase_not_available'
      };
    }

    if (options.evaluateAlerts !== true) {
      return {
        output: { alerts: [] },
        confidence: 0,
        evidence: [],
        engine: 'event_monitor',
        status: 'available_not_requested',
        executed: false,
        decisionEligible: true
      };
    }

    const alertEngine = new AlertEngine(this.supabase);
    const dryRun = options.persistAlerts !== true;
    const alerts = await alertEngine.evaluateAll({
      dryRun,
      metricCodes: options.metricCodes || [],
      cityIds: options.cityIds || []
    });

    let notifications = null;
    if (!dryRun && options.sendNotifications === true && alerts.length) {
      notifications = await alertEngine.sendNotifications(alerts);
    }

    return {
      output: {
        alerts,
        count: alerts.length,
        dryRun,
        notifications
      },
      confidence: alerts.length ? 85 : 80,
      evidence: alerts.map((alert, index) => ({
        source: 'alert_engine',
        evidence_type: 'event',
        evidence_code: alert.metric_code || `alert_${index}`,
        value: {
          oldValue: alert.old_value,
          newValue: alert.new_value,
          changePercent: alert.change_percent,
          severity: alert.severity
        },
        confidence: 85,
        timestamp: alert.created_at || new Date().toISOString()
      })),
      engine: 'event_monitor',
      status: 'computed',
      executed: true,
      decisionEligible: true
    };
  }
}

module.exports = { EventMonitorEngine };
