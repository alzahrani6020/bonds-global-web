'use strict';

const crypto = require('crypto');

const STATES = Object.freeze({
  CANDIDATE: 'CANDIDATE',
  VALIDATED: 'VALIDATED',
  REVIEWED: 'INDEPENDENTLY_REVIEWED',
  EVALUATED: 'EVALUATED',
  CERTIFIED: 'CERTIFIED',
  ACTIVE: 'ACTIVE',
  ROLLED_BACK: 'ROLLED_BACK'
});

function hash(value) {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function assertSeparatedRoles(roles = {}) {
  const required = ['reviewer_id', 'evaluator_id', 'certifier_id', 'operator_id'];
  const values = required.map(key => String(roles[key] || '').trim());
  if (values.some(v => !v)) throw new Error('all governance roles are required');
  const lowered = values.map(v => v.toLowerCase());
  if (new Set(lowered).size !== required.length) {
    throw new Error('promotion roles must be independently separated');
  }
  const forbidden = new Set(['bonds-ai', 'generator', 'learner', 'planner']);
  if (lowered.some(v => forbidden.has(v))) {
    throw new Error('AI/generator/planner identities cannot certify or promote themselves');
  }
  return Object.fromEntries(required.map((key, i) => [key, values[i]]));
}

class CapabilityGovernance {
  constructor({ store = null } = {}) {
    this.store = store;
  }

  async validateCandidate(candidate = {}) {
    if (!candidate.id || !candidate.action || typeof candidate.execute !== 'function') {
      return { status: 'SANDBOX_FAILED', validated: false, errors: ['id, action and execute function are required'] };
    }
    const manifest = {
      id: candidate.id,
      action: candidate.action,
      version: candidate.version || '0.0.0-candidate',
      input_schema: candidate.input_schema || null,
      output_schema: candidate.output_schema || null
    };
    return {
      status: STATES.VALIDATED,
      validated: true,
      candidate_hash: hash(manifest),
      manifest
    };
  }

  async promote(candidate = {}, roles = {}, evidence = {}) {
    if (!this.store || typeof this.store.put !== 'function' || typeof this.store.get !== 'function') {
      return { status: 'PERSISTENCE_REQUIRED', promoted: false };
    }
    let separated;
    try { separated = assertSeparatedRoles(roles); }
    catch (err) { return { status: 'GOVERNANCE_REJECTED', promoted: false, error: err.message }; }

    const validation = await this.validateCandidate(candidate);
    if (!validation.validated) return { ...validation, promoted: false };

    const evaluation = evidence.evaluation || {};
    const certification = evidence.certification || {};
    if (evaluation.passed !== true) return { status: 'EVALUATION_FAILED', promoted: false };
    if (certification.certified !== true) return { status: 'CERTIFICATION_FAILED', promoted: false };

    const previous = await this.store.get(candidate.id);
    const record = {
      capability_id: candidate.id,
      action: candidate.action,
      version: candidate.version || '0.0.0-candidate',
      state: STATES.ACTIVE,
      candidate_hash: validation.candidate_hash,
      roles: separated,
      evidence: {
        sandbox: validation,
        review: evidence.review || null,
        evaluation,
        certification
      },
      previous_version: previous?.version || null,
      promoted_at: new Date().toISOString()
    };
    await this.store.put(candidate.id, record);
    return { status: STATES.ACTIVE, promoted: true, record };
  }

  async rollback(capabilityId, operatorId) {
    if (!this.store || typeof this.store.rollback !== 'function') {
      return { status: 'PERSISTENCE_REQUIRED', rolled_back: false };
    }
    const operator = String(operatorId || '').trim();
    if (!operator || ['bonds-ai', 'generator', 'learner', 'planner'].includes(operator.toLowerCase())) {
      return { status: 'GOVERNANCE_REJECTED', rolled_back: false };
    }
    const result = await this.store.rollback(capabilityId, operator);
    return { status: result ? STATES.ROLLED_BACK : 'ROLLBACK_UNAVAILABLE', rolled_back: Boolean(result), record: result || null };
  }
}

module.exports = { STATES, assertSeparatedRoles, CapabilityGovernance };
