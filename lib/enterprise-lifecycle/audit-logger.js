/**
 * Enterprise Lifecycle Audit Logger
 *
 * Builds an immutable decision checkpoint for every transition.
 */

class AuditLogger {
  buildCheckpoint({ decision, reason, evidence, confidence, approver, aiExplanation, metadata }) {
    return {
      decision,
      reason,
      evidence: evidence || [],
      confidence: confidence !== undefined ? confidence : null,
      approver: approver || null,
      ai_explanation: aiExplanation || null,
      metadata: metadata || {},
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { AuditLogger };
