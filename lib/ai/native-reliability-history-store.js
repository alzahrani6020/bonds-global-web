'use strict';

const crypto = require('crypto');

const TABLE_NAME = 'ai_native_reliability_history';

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function hashEndpoint(value) {
  const endpoint = clean(value);
  if (!endpoint) return null;
  return 'sha256:' + crypto.createHash('sha256').update(endpoint, 'utf8').digest('hex');
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeEvent(input = {}) {
  const snapshot = input.snapshot && typeof input.snapshot === 'object'
    ? input.snapshot
    : {};
  const context = input.context && typeof input.context === 'object'
    ? input.context
    : {};

  const eventType = clean(input.event_type || 'snapshot').toLowerCase();
  const nodeId = clean(input.node_id || snapshot.node_id);
  if (!nodeId) throw new Error('NATIVE_RELIABILITY_HISTORY_NODE_REQUIRED');

  const allowedEvents = new Set([
    'snapshot',
    'retry',
    'failover',
    'breaker_open',
    'breaker_closed',
    'slo_degraded',
    'slo_recovered'
  ]);
  if (!allowedEvents.has(eventType)) {
    throw new Error('NATIVE_RELIABILITY_HISTORY_EVENT_INVALID');
  }

  const status = clean(snapshot.status || 'insufficient_data').toLowerCase();
  if (!['insufficient_data', 'healthy', 'degraded'].includes(status)) {
    throw new Error('NATIVE_RELIABILITY_HISTORY_STATUS_INVALID');
  }

  return Object.freeze({
    event_type:eventType,
    node_id:nodeId,
    node_endpoint_hash:hashEndpoint(
      input.node_endpoint || snapshot.base_url || input.base_url
    ),
    operation:clean(input.operation || 'generate').toLowerCase() || 'generate',
    status,
    requests:Math.max(0, Math.floor(finiteNumber(snapshot.requests))),
    successes:Math.max(0, Math.floor(finiteNumber(snapshot.successes))),
    failures:Math.max(0, Math.floor(finiteNumber(snapshot.failures))),
    failure_rate:Math.max(0, Math.min(1, finiteNumber(snapshot.failure_rate))),
    recoverable_failures:Math.max(0, Math.floor(finiteNumber(snapshot.recoverable_failures))),
    retries:Math.max(0, Math.floor(finiteNumber(snapshot.retries))),
    failovers:Math.max(0, Math.floor(finiteNumber(snapshot.failovers))),
    average_latency_ms:Math.max(0, finiteNumber(snapshot.average_latency_ms)),
    max_latency_ms:Math.max(0, finiteNumber(snapshot.max_latency_ms)),
    last_failure_code:clean(snapshot.last_failure_code) || null,
    last_failure_category:clean(snapshot.last_failure_category) || null,
    breaker_open:input.breaker_open === true,
    breaker_failures:Math.max(0, Math.floor(finiteNumber(input.breaker_failures))),
    lifecycle_generation:Number.isInteger(Number(context.lifecycle_generation))
      ? Number(context.lifecycle_generation)
      : null,
    champion_model_id:clean(context.champion_model_id) || null,
    challenger_model_id:clean(context.challenger_model_id) || null,
    canary_percentage:Number.isFinite(Number(context.canary_percentage))
      ? Math.max(0, Math.min(100, Number(context.canary_percentage)))
      : null,
    incident_id:clean(input.incident_id || context.incident_id) || null,
    deployment_sha:clean(
      context.deployment_sha ||
      process.env.BONDS_RELEASE_SHA ||
      process.env.VERCEL_GIT_COMMIT_SHA ||
      process.env.GITHUB_SHA
    ) || null,
    evidence:Array.isArray(snapshot.failures_evidence)
      ? snapshot.failures_evidence.slice(0, 8)
      : []
  });
}

class MemoryNativeReliabilityHistoryStore {
  constructor() {
    this.rows = [];
  }

  async append(input) {
    const event = normalizeEvent(input);
    const row = Object.freeze({
      id:'memory-' + String(this.rows.length + 1),
      observed_at:new Date().toISOString(),
      ...event
    });
    this.rows.push(row);
    return row;
  }

  async recent({ nodeId = null, limit = 100 } = {}) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    return this.rows
      .filter(row => !nodeId || row.node_id === nodeId)
      .slice(-safeLimit)
      .reverse();
  }
}

class SupabaseNativeReliabilityHistoryStore {
  constructor({ client } = {}) {
    if (!client || typeof client.from !== 'function') {
      throw new Error('NATIVE_RELIABILITY_HISTORY_SUPABASE_CLIENT_REQUIRED');
    }
    this.client = client;
  }

  async _resolveIncident(event) {
    if (event.incident_id) return event.incident_id;
    if (!event.deployment_sha) return null;

    const response = await this.client
      .from('admin_incidents')
      .select('id')
      .eq('deployment_sha', event.deployment_sha)
      .is('resolved_at', null)
      .order('detected_at', { ascending:false })
      .limit(1);

    if (response?.error) return null;
    const rows = Array.isArray(response?.data) ? response.data : [];
    return clean(rows[0]?.id) || null;
  }

  async _resolveLifecycle(event) {
    if (
      event.lifecycle_generation !== null &&
      event.champion_model_id
    ) {
      return null;
    }

    const response = await this.client
      .from('ai_model_lifecycle_state')
      .select('generation,champion_model_id,canary')
      .eq('scope', 'global')
      .maybeSingle();

    if (response?.error || !response?.data) return null;
    const canary = response.data.canary && typeof response.data.canary === 'object'
      ? response.data.canary
      : null;

    return {
      lifecycle_generation:Number.isInteger(Number(response.data.generation))
        ? Number(response.data.generation)
        : null,
      champion_model_id:clean(response.data.champion_model_id) || null,
      challenger_model_id:clean(canary?.challenger_model_id) || null,
      canary_percentage:Number.isFinite(Number(canary?.percentage))
        ? Math.max(0, Math.min(100, Number(canary.percentage)))
        : null
    };
  }

  async append(input) {
    const event = normalizeEvent(input);
    const [incidentId, lifecycle] = await Promise.all([
      this._resolveIncident(event),
      this._resolveLifecycle(event)
    ]);
    const row = {
      ...event,
      lifecycle_generation:
        event.lifecycle_generation ?? lifecycle?.lifecycle_generation ?? null,
      champion_model_id:
        event.champion_model_id || lifecycle?.champion_model_id || null,
      challenger_model_id:
        event.challenger_model_id || lifecycle?.challenger_model_id || null,
      canary_percentage:
        event.canary_percentage ?? lifecycle?.canary_percentage ?? null,
      incident_id:incidentId
    };

    const response = await this.client
      .from(TABLE_NAME)
      .insert(row)
      .select('id,observed_at,event_type,node_id,status,incident_id,deployment_sha')
      .single();

    if (response?.error) {
      throw new Error(
        'NATIVE_RELIABILITY_HISTORY_SAVE_FAILED:' +
        clean(response.error.code || response.error.message)
      );
    }

    return Object.freeze(response.data);
  }

  async recent({ nodeId = null, limit = 100 } = {}) {
    const safeLimit = Math.max(1, Math.min(500, Number(limit) || 100));
    let query = this.client
      .from(TABLE_NAME)
      .select('id,observed_at,event_type,node_id,status,requests,successes,failures,failure_rate,recoverable_failures,retries,failovers,average_latency_ms,max_latency_ms,last_failure_code,last_failure_category,breaker_open,breaker_failures,lifecycle_generation,champion_model_id,challenger_model_id,canary_percentage,incident_id,deployment_sha,evidence')
      .order('observed_at', { ascending:false })
      .limit(safeLimit);

    if (clean(nodeId)) query = query.eq('node_id', clean(nodeId));

    const response = await query;
    if (response?.error) {
      throw new Error(
        'NATIVE_RELIABILITY_HISTORY_LOAD_FAILED:' +
        clean(response.error.code || response.error.message)
      );
    }

    return Object.freeze(Array.isArray(response?.data) ? response.data : []);
  }
}

let defaultSupabaseHistoryStore = null;

function createSupabaseNativeReliabilityHistoryStoreFromEnv() {
  if (defaultSupabaseHistoryStore) return defaultSupabaseHistoryStore;

  const url = clean(
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const serviceRoleKey = clean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  if (!url || !serviceRoleKey) return null;

  const { createClient } = require('@supabase/supabase-js');
  const client = createClient(url, serviceRoleKey, {
    auth:{
      persistSession:false,
      autoRefreshToken:false,
      detectSessionInUrl:false
    }
  });
  defaultSupabaseHistoryStore = new SupabaseNativeReliabilityHistoryStore({ client });
  return defaultSupabaseHistoryStore;
}

module.exports = {
  TABLE_NAME,
  hashEndpoint,
  normalizeEvent,
  MemoryNativeReliabilityHistoryStore,
  SupabaseNativeReliabilityHistoryStore,
  createSupabaseNativeReliabilityHistoryStoreFromEnv
};
