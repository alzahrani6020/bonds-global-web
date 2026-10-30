'use strict';

const crypto = require('crypto');

const STATE_SCOPE = 'global';
const TABLE_NAME = 'ai_model_lifecycle_state';

function clean(value) {
  return String(value == null ? '' : value).trim();
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, stableValue(value[key])])
    );
  }
  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function stateHash(payload) {
  return 'sha256:' + crypto.createHash('sha256')
    .update(stableJson(payload), 'utf8')
    .digest('hex');
}

function normalizePersistedState(input = {}) {
  const payload = {
    lifecycle_version:clean(input.lifecycle_version),
    generation:Number(input.generation),
    champion_model_id:clean(input.champion_model_id),
    previous_champion_model_id:clean(input.previous_champion_model_id) || null,
    canary:input.canary && typeof input.canary === 'object'
      ? input.canary
      : null,
    policy:input.policy && typeof input.policy === 'object'
      ? input.policy
      : {}
  };

  if (!payload.lifecycle_version) {
    throw new Error('MODEL_ROUTING_STATE_VERSION_REQUIRED');
  }
  if (!Number.isInteger(payload.generation) || payload.generation < 1) {
    throw new Error('MODEL_ROUTING_STATE_GENERATION_INVALID');
  }
  if (!payload.champion_model_id) {
    throw new Error('MODEL_ROUTING_STATE_CHAMPION_REQUIRED');
  }

  return Object.freeze(payload);
}

function verifyPersistedState(row = {}) {
  const normalized = normalizePersistedState(row);
  const expected = stateHash(normalized);
  const actual = clean(row.state_hash);

  if (!actual || actual !== expected) {
    throw new Error('MODEL_ROUTING_STATE_HASH_MISMATCH');
  }

  return normalized;
}

class MemoryModelRoutingStateStore {
  constructor(seed = null) {
    this.row = seed ? {
      ...normalizePersistedState(seed),
      state_hash:stateHash(normalizePersistedState(seed))
    } : null;
  }

  async load() {
    if (!this.row) return null;
    return Object.freeze({
      state:verifyPersistedState(this.row),
      revision:Number(this.row.revision)
    });
  }

  async save(state, { expectedRevision = null } = {}) {
    const normalized = normalizePersistedState(state);
    const currentRevision = this.row ? Number(this.row.revision) : 0;

    if (
      expectedRevision !== null &&
      currentRevision !== Number(expectedRevision)
    ) {
      throw new Error('MODEL_ROUTING_STATE_REVISION_CONFLICT');
    }

    this.row = {
      scope:STATE_SCOPE,
      ...normalized,
      revision:currentRevision + 1,
      state_hash:stateHash(normalized)
    };

    return Object.freeze({
      state:verifyPersistedState(this.row),
      revision:Number(this.row.revision)
    });
  }
}

class SupabaseModelRoutingStateStore {
  constructor({ client, scope = STATE_SCOPE } = {}) {
    if (!client || typeof client.from !== 'function') {
      throw new Error('MODEL_ROUTING_STATE_SUPABASE_CLIENT_REQUIRED');
    }
    this.client = client;
    this.scope = clean(scope) || STATE_SCOPE;
  }

  async load() {
    const response = await this.client
      .from(TABLE_NAME)
      .select('scope,lifecycle_version,generation,revision,champion_model_id,previous_champion_model_id,canary,policy,state_hash')
      .eq('scope', this.scope)
      .maybeSingle();

    if (response?.error) {
      throw new Error('MODEL_ROUTING_STATE_LOAD_FAILED:' + clean(response.error.code || response.error.message));
    }
    if (!response?.data) return null;

    return Object.freeze({
      state:verifyPersistedState(response.data),
      revision:Number(response.data.revision)
    });
  }

  async save(state, { expectedRevision = null } = {}) {
    const normalized = normalizePersistedState(state);
    const current = await this.load();
    const currentRevision = current ? Number(current.revision) : 0;
    if (expectedRevision !== null && currentRevision !== Number(expectedRevision)) {
      throw new Error('MODEL_ROUTING_STATE_REVISION_CONFLICT');
    }

    const row = {
      scope:this.scope,
      ...normalized,
      revision:currentRevision + 1,
      state_hash:stateHash(normalized),
      updated_at:new Date().toISOString()
    };

    if (!current) {
      const response = await this.client
        .from(TABLE_NAME)
        .upsert(row, { onConflict:'scope' })
        .select('scope,lifecycle_version,generation,revision,champion_model_id,previous_champion_model_id,canary,policy,state_hash')
        .single();

      if (response?.error) {
        throw new Error('MODEL_ROUTING_STATE_SAVE_FAILED:' + clean(response.error.code || response.error.message));
      }
      return Object.freeze({
        state:verifyPersistedState(response.data),
        revision:Number(response.data.revision)
      });
    }

    const response = await this.client
      .from(TABLE_NAME)
      .update(row)
      .eq('scope', this.scope)
      .eq('revision', currentRevision)
      .select('scope,lifecycle_version,generation,revision,champion_model_id,previous_champion_model_id,canary,policy,state_hash');

    if (response?.error) {
      throw new Error('MODEL_ROUTING_STATE_SAVE_FAILED:' + clean(response.error.code || response.error.message));
    }

    const rows = Array.isArray(response?.data) ? response.data : [];
    if (rows.length !== 1) {
      throw new Error('MODEL_ROUTING_STATE_REVISION_CONFLICT');
    }

    return Object.freeze({
      state:verifyPersistedState(rows[0]),
      revision:Number(rows[0].revision)
    });
  }
}

module.exports = {
  STATE_SCOPE,
  TABLE_NAME,
  stableJson,
  stateHash,
  normalizePersistedState,
  verifyPersistedState,
  MemoryModelRoutingStateStore,
  SupabaseModelRoutingStateStore
};