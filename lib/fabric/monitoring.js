/**
 * BONDS Enterprise Monitoring
 *
 * Aggregates connector health, data quality, confidence distribution, evidence
 * coverage, import/refresh/conflict statistics, latency, availability, and performance.
 */

class Monitoring {
  constructor(options = {}) {
    this.supabase = options.supabase || null;
    this.observability = options.observability || null;
  }

  async summary() {
    const [health, quality, confidence, coverage, events] = await Promise.all([
      this.connectorHealth(),
      this.qualitySummary(),
      this.confidenceDistribution(),
      this.evidenceCoverage(),
      this.eventSummary()
    ]);

    return {
      generatedAt: new Date().toISOString(),
      connectorHealth: health,
      dataQuality: quality,
      confidenceDistribution: confidence,
      evidenceCoverage: coverage,
      eventSummary: events
    };
  }

  async connectorHealth() {
    if (!this.supabase) return { overall: 0, connectors: [] };
    const { data, error } = await this.supabase
      .from('data_sources')
      .select('id, source_code, status, last_run_at, connector_code');
    if (error) throw error;
    const connectors = (data || []).map(s => ({
      sourceCode: s.source_code,
      status: s.status,
      healthy: s.status === 'active',
      lastRun: s.last_run_at
    }));
    const healthyCount = connectors.filter(c => c.healthy).length;
    return {
      overall: connectors.length ? Math.round((healthyCount / connectors.length) * 100) : 0,
      connectors
    };
  }

  async qualitySummary() {
    if (!this.supabase) return { overall: 0, dimensions: {} };
    const { data, error } = await this.supabase
      .from('fabric_data_quality')
      .select('completeness, accuracy, consistency, uniqueness, validity, integrity, timeliness, availability, overall_score');
    if (error) throw error;
    const rows = data || [];
    if (rows.length === 0) return { overall: 0, dimensions: {}, count: 0 };
    const avg = key => Math.round(rows.reduce((sum, r) => sum + (r[key] || 0), 0) / rows.length);
    return {
      overall: avg('overall_score'),
      count: rows.length,
      dimensions: {
        completeness: avg('completeness'),
        accuracy: avg('accuracy'),
        consistency: avg('consistency'),
        uniqueness: avg('uniqueness'),
        validity: avg('validity'),
        integrity: avg('integrity'),
        timeliness: avg('timeliness'),
        availability: avg('availability')
      }
    };
  }

  async confidenceDistribution() {
    if (!this.supabase) return { buckets: {}, average: 0 };
    const { data, error } = await this.supabase
      .from('fabric_consensus')
      .select('confidence');
    if (error) throw error;
    const rows = data || [];
    const buckets = { '0-49': 0, '50-69': 0, '70-84': 0, '85-100': 0 };
    let total = 0;
    for (const r of rows) {
      const c = r.confidence || 0;
      total += c;
      if (c < 50) buckets['0-49']++;
      else if (c < 70) buckets['50-69']++;
      else if (c < 85) buckets['70-84']++;
      else buckets['85-100']++;
    }
    return { buckets, average: rows.length ? Math.round(total / rows.length) : 0, count: rows.length };
  }

  async evidenceCoverage() {
    if (!this.supabase) return { covered: 0, total: 0 };
    const { count: covered, error } = await this.supabase
      .from('fabric_provenance')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return { covered: covered || 0, total: covered || 0 };
  }

  async eventSummary() {
    if (!this.observability) return {};
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    return this.observability.summary({ since });
  }
}

module.exports = { Monitoring };
