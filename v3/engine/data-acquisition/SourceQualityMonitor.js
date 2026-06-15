/**
 * SourceQualityMonitor — مراقبة جودة مصادر البيانات الخارجية وإنشاء تنبيهات.
 */
const https = require('https');
const http = require('http');
const { URL } = require('url');
const { sendEmail } = require('../../lib/email');

class SourceQualityMonitor {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * فحص جودة المصادر وإرجاع قائمة بالتنبيهات.
   * @param {Object} options
   * @param {number} options.minSuccessRate - أقل نسبة نجاح مقبولة (0-1)
   * @param {number} options.recentDays - عدد الأيام الأخيرة لفحصها
   */
  async checkAlerts({ minSuccessRate = 0.5, recentDays = 7 } = {}) {
    if (!this.supabase) return [];

    const since = new Date(Date.now() - recentDays * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await this.supabase
      .from('data_source_quality')
      .select(`
        *,
        city:city_id (code, name_ar, country_code),
        activity:activity_id (code, name_ar)
      `)
      .gte('last_attempted_at', since)
      .order('last_attempted_at', { ascending: false });

    if (error) throw error;

    const alerts = [];
    const grouped = {};

    for (const row of data || []) {
      const key = `${row.source_id}:${row.metric_code}:${row.year}`;
      if (!grouped[key]) {
        grouped[key] = { rows: [], sourceId: row.source_id, metricCode: row.metric_code, year: row.year };
      }
      grouped[key].rows.push(row);
    }

    for (const group of Object.values(grouped)) {
      const attempts = group.rows.reduce((sum, r) => sum + (r.attempts || 0), 0);
      const successes = group.rows.reduce((sum, r) => sum + (r.successes || 0), 0);
      const rate = attempts > 0 ? successes / attempts : 0;

      if (rate < minSuccessRate) {
        const failures = group.rows.filter(r => !r.success).map(r => ({
          cityCode: r.city?.code,
          cityName: r.city?.name_ar,
          countryCode: r.city?.country_code,
          activityCode: r.activity?.code,
          activityName: r.activity?.name_ar,
          failureReason: r.failure_reason,
          lastAttemptedAt: r.last_attempted_at
        }));

        alerts.push({
          severity: rate === 0 ? 'critical' : 'warning',
          sourceId: group.sourceId,
          metricCode: group.metricCode,
          year: group.year,
          successRate: Math.round(rate * 100),
          attempts,
          successes,
          failures: failures.slice(0, 20),
          message: `Source ${group.sourceId} for ${group.metricCode} has ${Math.round(rate * 100)}% success rate (${successes}/${attempts}) over the last ${recentDays} days.`
        });
      }
    }

    return alerts.sort((a, b) => b.successRate - a.successRate);
  }

  /**
   * إرسال التنبيهات بالبريد الإلكتروني إلى ALERT_EMAIL_TO إذا كان مُconfigured.
   */
  async sendEmailAlerts(alerts) {
    const to = process.env.ALERT_EMAIL_TO;
    if (!to || !alerts.length) return { sent: false };

    const subject = `Bonds V3: ${alerts.length} source quality alert${alerts.length > 1 ? 's' : ''}`;
    const lines = alerts.map(a => `- ${a.severity.toUpperCase()}: ${a.message}`).join('\n');
    const text = `Source quality alerts detected:\n\n${lines}\n\nReview at: ${process.env.ADMIN_URL || 'https://bonds-global.com/admin'}`;
    const html = `<h2>Source Quality Alerts</h2>` + alerts.map(a =>
      `<p><strong>${a.severity.toUpperCase()}</strong>: ${a.message}<br>Success rate: ${a.successRate}% (${a.successes}/${a.attempts})</p>`
    ).join('');

    return sendEmail({ to, subject, text, html });
  }

  /**
   * إرسال التنبيهات إلى webhook إذا كان مُconfigured.
   */
  async sendWebhook(alerts) {
    const webhookUrl = process.env.SOURCE_QUALITY_ALERT_WEBHOOK_URL;
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
        console.warn('[SourceQualityMonitor] Webhook failed:', err.message);
        resolve({ sent: false, error: err.message });
      });

      req.write(payload);
      req.end();
    });
  }
}

module.exports = SourceQualityMonitor;
