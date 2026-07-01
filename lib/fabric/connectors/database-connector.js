/**
 * BONDS Database Connector
 *
 * Reads already-normalized metrics from Supabase tables.
 * This connector does not call external APIs; it trusts the V3 Bronze/Silver/Gold pipeline.
 */

const BaseConnector = require('../connector');

class DatabaseConnector extends BaseConnector {
  constructor(options = {}) {
    super({
      sourceCode: options.sourceCode || 'database',
      sourceName: options.sourceName || 'Database Connector',
      category: options.category || 'internal',
      supportedCountries: options.supportedCountries || [],
      supportedIndustries: options.supportedIndustries || [],
      supportedOperations: options.supportedOperations || ['read'],
      authType: 'service_role',
      ...options
    });
    this.supabase = options.supabase || null;
    this.table = options.table || 'normalized_metrics';
    this.metricColumn = options.metricColumn || 'metric_code';
    this.valueColumn = options.valueColumn || 'value';
  }

  async healthCheck() {
    if (!this.supabase) {
      return { healthy: false, latencyMs: 0, message: 'No Supabase client' };
    }
    const start = Date.now();
    try {
      const { error } = await this.supabase.from(this.table).select('id', { count: 'exact', head: true }).limit(1);
      return { healthy: !error, latencyMs: Date.now() - start, message: error ? error.message : 'ok' };
    } catch (err) {
      return { healthy: false, latencyMs: Date.now() - start, message: err.message };
    }
  }

  async fetch(request = {}) {
    if (!this.supabase) return [];
    const { metricCode, cityId, activityId, year, sourceCode } = request;

    let query = this.supabase.from(this.table).select('*');
    if (metricCode) query = query.eq(this.metricColumn, metricCode);
    if (cityId) query = query.eq('city_id', cityId);
    if (activityId) query = query.eq('activity_id', activityId);
    if (year) query = query.eq('year', year);
    if (sourceCode) query = query.eq('source_id', sourceCode);

    const { data, error } = await query.order('fetched_at', { ascending: false }).limit(100);
    if (error) throw error;
    return data || [];
  }

  async normalize(raw) {
    if (!Array.isArray(raw)) raw = [raw];
    return raw.map(row => ({
      metricCode: row[this.metricColumn] || row.metric_code,
      value: row[this.valueColumn] !== undefined ? row[this.valueColumn] : row.value,
      valueText: row.value_text,
      cityId: row.city_id,
      activityId: row.activity_id,
      year: row.year,
      sourceId: row.source_id || this.sourceCode,
      sourceCode: row.source_id || this.sourceCode,
      confidence: row.confidence || this.getConfidence('open_data'),
      collectedAt: row.fetched_at || row.created_at,
      evidence: {
        source_url: row.source_url,
        is_override: row.is_override,
        metadata: row.metadata
      }
    }));
  }

  async validate(normalized) {
    const errors = [];
    if (normalized.value === null || normalized.value === undefined) {
      errors.push('missing value');
    }
    if (!normalized.metricCode) {
      errors.push('missing metricCode');
    }
    return { valid: errors.length === 0, errors };
  }

  getSupportedMetrics() {
    return this.config.supportedMetrics || [];
  }
}

module.exports = { DatabaseConnector };
