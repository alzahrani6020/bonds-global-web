/**
 * Bonds V3 — Alert Engine
 *
 * Monitors city and market metrics against alert rules and generates
 * notifications when thresholds are crossed.
 */

const { sendEmail } = require('../lib/email');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Map metric codes to the table that holds them.
const METRIC_TABLE_MAP = {
  // city_indicators
  gdp_city: 'city_indicators',
  growth_rate: 'city_indicators',
  unemployment_rate: 'city_indicators',
  establishments_count: 'city_indicators',
  inflation_rate: 'city_indicators',
  business_ease_index: 'city_indicators',
  avg_rent_per_sqm: 'city_indicators',
  avg_land_price_per_sqm: 'city_indicators',
  warehouse_rent_per_sqm: 'city_indicators',
  factory_rent_per_sqm: 'city_indicators',
  new_licenses_count: 'city_indicators',
  investment_volume: 'city_indicators',
  saturation_index: 'city_indicators',
  // city_market_data
  competitors_count: 'city_market_data',
  market_saturation_score: 'city_market_data',
  avg_salary: 'city_market_data',
  labor_availability_score: 'city_market_data',
  specialists_count: 'city_market_data',
  saudization_rate: 'city_market_data',
  market_size: 'city_market_data',
  annual_growth_rate: 'city_market_data',
  per_capita_spending: 'city_market_data',
  expected_demand: 'city_market_data',
  profit_margin_min: 'city_market_data',
  profit_margin_avg: 'city_market_data',
  profit_margin_max: 'city_market_data',
  risk_score: 'city_market_data',
  opportunity_score: 'city_market_data',
  opportunity_rank: 'city_market_data'
};

function resolveTable(metricCode, entityType) {
  // Activity-level metrics always live in city_market_data
  if (entityType === 'activity' || entityType === 'city_activity') {
    return 'city_market_data';
  }
  return METRIC_TABLE_MAP[metricCode] || 'city_indicators';
}

function round(num, decimals = 2) {
  return Number.isFinite(num) ? Number(num.toFixed(decimals)) : num;
}

class AlertEngine {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async evaluateAll(options = {}) {
    const { dryRun = false, metricCodes = [], cityIds = [] } = options;

    let query = this.supabase.from('alert_rules').select('*').eq('is_active', true);
    if (metricCodes.length) query = query.in('metric_code', metricCodes);

    const { data: rules, error } = await query;
    if (error) throw error;

    const created = [];
    for (const rule of rules || []) {
      if (cityIds.length && rule.city_id && !cityIds.includes(rule.city_id)) continue;
      try {
        const alert = await this.evaluateRule(rule, { dryRun });
        if (alert) created.push(alert);
      } catch (err) {
        console.warn(`[AlertEngine] Rule ${rule.id} failed:`, err.message);
      }
    }

    return created;
  }

  async evaluateRule(rule, { dryRun = false } = {}) {
    const currentYear = new Date().getFullYear();
    const table = resolveTable(rule.metric_code, rule.entity_type);

    let currentQuery = this.supabase.from(table).select('*');
    if (rule.city_id) currentQuery = currentQuery.eq('city_id', rule.city_id);
    if (rule.activity_id && table === 'city_market_data') {
      currentQuery = currentQuery.eq('activity_id', rule.activity_id);
    }

    // For city_indicators use year column; for city_market_data use data_year
    const yearColumn = table === 'city_indicators' ? 'year' : 'data_year';

    // Try current calendar year first, then fall back to the most recent year available
    let current = null;
    const exactCurrentQuery = currentQuery
      .eq(yearColumn, currentYear)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data: exactCurrent, error: currentError } = await exactCurrentQuery;
    if (currentError) throw currentError;
    current = exactCurrent;

    if (!current) {
      const latestQuery = this.supabase.from(table).select('*');
      if (rule.city_id) latestQuery = latestQuery.eq('city_id', rule.city_id);
      if (rule.activity_id && table === 'city_market_data') {
        latestQuery = latestQuery.eq('activity_id', rule.activity_id);
      }
      const { data: latest } = await latestQuery
        .lte(yearColumn, currentYear)
        .order(yearColumn, { ascending: false })
        .limit(1)
        .maybeSingle();
      current = latest;
    }

    if (!current) return null;

    const newValue = Number(current[rule.metric_code]);
    if (!Number.isFinite(newValue)) return null;

    let oldValue = null;
    if (rule.check_previous_year) {
      let previousQuery = this.supabase.from(table).select('*');
      if (rule.city_id) previousQuery = previousQuery.eq('city_id', rule.city_id);
      if (rule.activity_id && table === 'city_market_data') {
        previousQuery = previousQuery.eq('activity_id', rule.activity_id);
      }
      previousQuery = previousQuery
        .eq(yearColumn, currentYear - 1)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: previous } = await previousQuery;
      oldValue = previous ? Number(previous[rule.metric_code]) : null;
    }

    if (!Number.isFinite(oldValue)) {
      // Fallback: compare with the most recent row before the current row's year
      const currentRowYear = Number(current[yearColumn]) || currentYear;
      let fallbackQuery = this.supabase.from(table).select('*');
      if (rule.city_id) fallbackQuery = fallbackQuery.eq('city_id', rule.city_id);
      if (rule.activity_id && table === 'city_market_data') {
        fallbackQuery = fallbackQuery.eq('activity_id', rule.activity_id);
      }
      fallbackQuery = fallbackQuery
        .lt(yearColumn, currentRowYear)
        .order(yearColumn, { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: fallback } = await fallbackQuery;
      oldValue = fallback ? Number(fallback[rule.metric_code]) : null;
    }

    if (!Number.isFinite(oldValue)) return null;
    if (oldValue === 0 && rule.threshold_type === 'relative') return null;

    const changeValue = newValue - oldValue;
    const changePercent = oldValue !== 0 ? changeValue / Math.abs(oldValue) : 0;

    const threshold = Number(rule.threshold_value);
    let triggered = false;
    if (rule.threshold_type === 'relative') {
      triggered = threshold >= 0 ? changePercent >= threshold : changePercent <= threshold;
    } else {
      triggered = threshold >= 0 ? changeValue >= threshold : changeValue <= threshold;
    }

    if (!triggered) return null;

    // Avoid duplicate alerts within 24 hours for the same rule + entity + new value
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let existingQuery = this.supabase
      .from('alerts')
      .select('id')
      .eq('rule_id', rule.id)
      .eq('metric_code', rule.metric_code)
      .eq('new_value', newValue)
      .gte('created_at', since)
      .limit(1);

    if (rule.city_id) existingQuery = existingQuery.eq('city_id', rule.city_id);
    else existingQuery = existingQuery.is('city_id', null);

    if (rule.activity_id) existingQuery = existingQuery.eq('activity_id', rule.activity_id);
    else existingQuery = existingQuery.is('activity_id', null);

    const { data: existing } = await existingQuery;

    if (existing && existing.length > 0) return null;

    const direction = changeValue >= 0 ? 'ارتفع' : 'انخفض';
    const message = `${direction} ${rule.metric_code} ${rule.threshold_type === 'relative' ? 'بنسبة ' + round(changePercent * 100, 1) + '%' : 'بمقدار ' + round(changeValue)}. القيمة السابقة: ${oldValue}، الجديدة: ${newValue}`;

    const alertRecord = {
      rule_id: rule.id,
      city_id: rule.city_id || null,
      activity_id: rule.activity_id || null,
      metric_code: rule.metric_code,
      old_value: oldValue,
      new_value: newValue,
      change_value: round(changeValue),
      change_percent: round(changePercent * 100, 2),
      severity: rule.severity,
      message
    };

    if (dryRun) return alertRecord;

    const { data: inserted, error: insertError } = await this.supabase
      .from('alerts')
      .insert(alertRecord)
      .select()
      .single();

    if (insertError) throw insertError;
    return inserted;
  }

  async sendNotifications(alerts) {
    const emailResult = await this._sendEmail(alerts);
    const webhookResult = await this._sendWebhook(alerts);

    // Mark alerts as sent
    const alertIds = alerts.filter(a => a.id).map(a => a.id);
    if (alertIds.length) {
      try {
        await this.supabase
          .from('alerts')
          .update({
            sent_email: emailResult.sent || emailResult.success || false,
            sent_webhook: webhookResult.sent || false
          })
          .in('id', alertIds);
      } catch (err) {
        console.warn('[AlertEngine] Failed to mark alerts sent:', err.message);
      }
    }

    return { emailResult, webhookResult };
  }

  async _sendEmail(alerts) {
    const to = process.env.ALERT_EMAIL_TO;
    if (!to || !alerts.length) return { sent: false };

    const subject = `Bonds V3: ${alerts.length} تنبيه جديد`;
    const text = alerts.map(a => `- [${a.severity}] ${a.message}`).join('\n');
    const html = `<h2>تنبيهات Bonds V3</h2>` +
      alerts.map(a => `<p><strong>${a.severity}</strong>: ${a.message}</p>`).join('');

    return sendEmail({ to, subject, text, html });
  }

  async _sendWebhook(alerts) {
    const webhookUrl = process.env.ALERTS_WEBHOOK_URL;
    if (!webhookUrl || !alerts.length) return { sent: false };

    return new Promise((resolve) => {
      const parsed = new URL(webhookUrl);
      const transport = parsed.protocol === 'https:' ? https : http;
      const payload = JSON.stringify({ alerts, generatedAt: new Date().toISOString() });

      const req = transport.request(
        {
          method: 'POST',
          hostname: parsed.hostname,
          port: parsed.port,
          path: parsed.pathname + parsed.search,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        (res) => {
          let data = '';
          res.on('data', c => (data += c));
          res.on('end', () => resolve({ sent: true, status: res.statusCode, response: data.slice(0, 200) }));
        }
      );

      req.on('error', err => {
        console.warn('[AlertEngine] Webhook failed:', err.message);
        resolve({ sent: false, error: err.message });
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = AlertEngine;
