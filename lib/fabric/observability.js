/**
 * BONDS Fabric Observability
 *
 * Tracks imports, refreshes, overrides, failures, retries, calculations,
 * cache, connector health, latency, queues, errors, and warnings.
 */

class Observability {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async log(event) {
    const record = {
      event_type: event.eventType,
      connector_code: event.connectorCode || null,
      source_id: event.sourceId || null,
      metric_code: event.metricCode || null,
      status: event.status,
      details: event.details || {},
      latency_ms: event.latencyMs || null,
      created_at: new Date().toISOString()
    };

    if (!this.supabase) {
      return { persisted: false, record };
    }
    const { data, error } = await this.supabase
      .from('fabric_observability_events')
      .insert(record)
      .select()
      .single();
    if (error) {
      // Do not throw; observability failures should not break the pipeline.
      console.error('[fabric/observability] insert failed:', error.message);
      return { persisted: false, record, error: error.message };
    }
    return { persisted: true, record: data };
  }

  async summary({ since } = {}) {
    if (!this.supabase) return { events: [], count: 0 };
    let query = this.supabase.from('fabric_observability_events').select('*');
    if (since) query = query.gte('created_at', since);
    const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
    if (error) throw error;
    const events = data || [];
    const byStatus = {};
    const byType = {};
    for (const e of events) {
      byStatus[e.status] = (byStatus[e.status] || 0) + 1;
      byType[e.event_type] = (byType[e.event_type] || 0) + 1;
    }
    return { events, count: events.length, byStatus, byType };
  }
}

module.exports = { Observability };
