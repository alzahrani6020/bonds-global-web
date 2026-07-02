/**
 * Enterprise Lifecycle State Machine
 *
 * Enforces a single current state and valid transitions from a registry.
 */

class StateMachine {
  constructor({ instance, workflow }) {
    this.instance = instance;
    this.workflow = workflow;
  }

  currentState() {
    return this.instance.current_stage;
  }

  previousState() {
    return this.instance.previous_stage || null;
  }

  isFinal() {
    if (!this.workflow.finalStages || !this.workflow.finalStages.length) return false;
    return this.workflow.finalStages.includes(this.currentState());
  }

  allowedTransitions(registry) {
    const from = this.currentState();
    const direct = (this.workflow.transitions || [])
      .filter(t => t.from === from)
      .map(t => ({
        id: t.id,
        from: t.from,
        to: t.to,
        optional: !!t.optional,
        requiresApproval: !!t.requiresApproval,
        guards: t.guards || []
      }));

    const rollbackRules = registry.getRollbackRules(this.workflow.id);
    if (rollbackRules.enabled && this.previousState()) {
      const prev = this.previousState();
      const allowed = rollbackRules.allowedFrom || this.workflow.stages || [];
      if (allowed.includes(from)) {
        direct.push({
          id: 'rollback_to_previous',
          from,
          to: prev,
          isRollback: true,
          requiresApproval: false,
          guards: rollbackRules.guards || []
        });
      }
    }
    return direct;
  }

  canTransition(toStage, registry) {
    const candidates = this.allowedTransitions(registry);
    const match = candidates.find(t => t.to === toStage);
    if (!match) {
      return { allowed: false, reason: `No valid transition from '${this.currentState()}' to '${toStage}'` };
    }
    if (this.isFinal() && !match.isRollback) {
      return { allowed: false, reason: 'Entity is already in a final stage' };
    }
    return { allowed: true, transition: match };
  }

  move(toStage, { transitionId, reason, triggeredBy } = {}) {
    const from = this.currentState();
    this.instance.previous_stage = from;
    this.instance.current_stage = toStage;
    this.instance.updated_at = new Date().toISOString();
    if (this.workflow.finalStages && this.workflow.finalStages.includes(toStage)) {
      this.instance.status = 'completed';
      this.instance.completed_at = this.instance.updated_at;
    }
    return {
      transition_id: transitionId,
      from_stage: from,
      to_stage: toStage,
      reason,
      triggered_by: triggeredBy,
      created_at: new Date().toISOString()
    };
  }
}

module.exports = { StateMachine };
