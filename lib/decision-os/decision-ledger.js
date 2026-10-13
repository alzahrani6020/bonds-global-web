'use strict';

const crypto = require('crypto');

const LEDGER_VERSION = 'BONDS_DECISION_LEDGER_V2';

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((out, key) => {
      out[key] = stable(value[key]);
      return out;
    }, {});
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256')
    .update(JSON.stringify(stable(value)))
    .digest('hex');
}

function createLedgerEntry({
  decision,
  requestId = null,
  workflowId = null,
  evidenceGraph = null,
  policyEvaluations = null,
  calculationVersion = null,
  model = null,
  previousHash = null,
  createdAt = null,
  actorId = null
} = {}) {
  const timestamp = createdAt || new Date().toISOString();
  const payload = {
    ledger_version: LEDGER_VERSION,
    request_id: requestId,
    workflow_id: workflowId,
    decision,
    evidence_graph_digest: evidenceGraph ? sha256(evidenceGraph) : null,
    policy_digest: policyEvaluations ? sha256(policyEvaluations) : null,
    calculation_version: calculationVersion,
    model: model ? {
      backend: model.backend || null,
      model_sha256: model.model_sha256 || model.modelSha256 || null,
      model_id: model.model_id || model.model || null,
      provider: model.provider || null
    } : null,
    previous_hash: previousHash,
    created_at: timestamp,
    actor_id: actorId
  };

  return {
    ...payload,
    entry_hash: sha256(payload)
  };
}

function verifyLedgerEntry(entry = {}) {
  if (!entry || entry.ledger_version !== LEDGER_VERSION || !entry.entry_hash) return false;
  const { entry_hash, ...payload } = entry;
  return sha256(payload) === entry_hash;
}

module.exports = {
  LEDGER_VERSION,
  stable,
  sha256,
  createLedgerEntry,
  verifyLedgerEntry
};
