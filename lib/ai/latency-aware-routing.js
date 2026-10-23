'use strict';

const observations = new Map();

function finitePositive(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function observationKey(node) {
  if (!node) return null;
  return String(node.baseUrl || node.id || '').trim() || null;
}

function recordLatencyObservation(node, elapsedMs, {
  now = Date.now(),
  alpha = 0.35
} = {}) {
  const key = observationKey(node);
  const elapsed = finitePositive(elapsedMs);
  if (!key || elapsed === null) return null;

  const safeAlpha = Math.min(1, Math.max(0.01, Number(alpha) || 0.35));
  const previous = observations.get(key) || null;
  const ewmaMs = previous
    ? (safeAlpha * elapsed) + ((1 - safeAlpha) * previous.ewma_ms)
    : elapsed;

  const next = {
    node_id: node.id || null,
    base_url: node.baseUrl || null,
    ewma_ms: Math.round(ewmaMs * 100) / 100,
    last_ms: elapsed,
    samples: (previous?.samples || 0) + 1,
    updated_at_ms: Number(now)
  };
  observations.set(key, next);
  return { ...next };
}

function getLatencyObservation(node, {
  now = Date.now(),
  staleAfterMs = 300000
} = {}) {
  const key = observationKey(node);
  if (!key) return null;
  const value = observations.get(key);
  if (!value) return null;

  const stale = Number(now) - Number(value.updated_at_ms || 0) > Number(staleAfterMs || 300000);
  if (stale) return null;
  return { ...value };
}

function rankNodesByLatency(nodes, {
  enabled = false,
  now = Date.now(),
  staleAfterMs = 300000
} = {}) {
  const input = Array.isArray(nodes) ? nodes : [];
  if (!enabled || input.length < 2) return [...input];

  return input
    .map((node, index) => ({
      node,
      index,
      observation: getLatencyObservation(node, { now, staleAfterMs })
    }))
    .sort((a, b) => {
      const aKnown = Boolean(a.observation);
      const bKnown = Boolean(b.observation);

      // Explore unmeasured/stale nodes first so every configured node can earn
      // a current latency observation. Stable original order breaks ties.
      if (aKnown !== bKnown) return aKnown ? 1 : -1;
      if (!aKnown) return a.index - b.index;

      const diff = Number(a.observation.ewma_ms) - Number(b.observation.ewma_ms);
      return diff || (a.index - b.index);
    })
    .map(entry => entry.node);
}

function latencyRoutingMetadata(node, options = {}) {
  const observation = getLatencyObservation(node, options);
  return {
    enabled: options.enabled === true,
    observed: Boolean(observation),
    ewma_ms: observation?.ewma_ms ?? null,
    last_ms: observation?.last_ms ?? null,
    samples: observation?.samples ?? 0
  };
}

function resetLatencyRoutingState() {
  observations.clear();
}

module.exports = {
  recordLatencyObservation,
  getLatencyObservation,
  rankNodesByLatency,
  latencyRoutingMetadata,
  resetLatencyRoutingState
};
