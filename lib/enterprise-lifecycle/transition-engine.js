/**
 * Enterprise Lifecycle Transition Engine
 *
 * Evaluates and executes stage transitions using registry-driven guards,
 * approvals, tasks, events, and audit checkpoints.
 */

const { StateMachine } = require('./state-machine');
const { AuditLogger } = require('./audit-logger');

class TransitionEngine {
  constructor({ registry, gateEngine, approvalEngine, taskEngine, eventBus, timelineEngine }) {
    this.registry = registry;
    this.gateEngine = gateEngine;
    this.approvalEngine = approvalEngine;
    this.taskEngine = taskEngine;
    this.eventBus = eventBus;
    this.timelineEngine = timelineEngine;
    this.auditLogger = new AuditLogger();
  }

  async evaluateTransition({ instance, toStage, context = {}, userId, reason }) {
    const workflow = this.registry.getWorkflow(instance.workflow_code);
    if (!workflow) return { allowed: false, errors: ['Workflow not found'] };

    const stateMachine = new StateMachine({ instance, workflow });
    const check = stateMachine.canTransition(toStage, this.registry);
    if (!check.allowed) return { allowed: false, errors: [check.reason] };

    const transition = check.transition;
    const guardDefs = (transition.guards || [])
      .map(gid => this.registry.getGuardDefinition(workflow.id, gid))
      .filter(Boolean);

    const gateResult = this.gateEngine.evaluateAll(guardDefs, context);
    if (!gateResult.passed) {
      return {
        allowed: false,
        transition,
        gateResult,
        errors: gateResult.results.filter(r => !r.passed).map(r => r.reason)
      };
    }

    const approvalRule = this.registry.getApprovalRule(workflow.id, `${transition.from}->${transition.to}`);
    let approval = null;
    let requiresApproval = false;
    if (approvalRule) {
      // Check existing approved approval for this transition on the instance.
      // ApprovalEngine/Store lookup would happen during execute; here we can only signal requirement.
      requiresApproval = true;
    }

    return {
      allowed: !requiresApproval,
      transition,
      gateResult,
      approvalRule,
      requiresApproval,
      approval,
      errors: requiresApproval ? ['Transition requires approval'] : []
    };
  }

  async executeTransition({ instance, toStage, context = {}, userId, reason, payload = {}, store, approvalId }) {
    const evalResult = await this.evaluateTransition({ instance, toStage, context, userId, reason });
    if (!evalResult.allowed && !evalResult.requiresApproval) {
      return { success: false, ...evalResult };
    }

    const workflow = this.registry.getWorkflow(instance.workflow_code);
    const stateMachine = new StateMachine({ instance, workflow });

    // Handle approval requirement
    let approval = null;
    if (evalResult.requiresApproval) {
      if (!approvalId) {
        approval = await this.approvalEngine.createApproval({
          instanceId: instance.id,
          transitionId: evalResult.transition.id,
          stageId: instance.current_stage,
          rule: evalResult.approvalRule,
          requestedBy: userId,
          store
        });
        return {
          success: false,
          requiresApproval: true,
          approvalId: approval.id,
          transition: evalResult.transition,
          gateResult: evalResult.gateResult,
          message: 'Approval created; transition pending approval'
        };
      }
      approval = await store.getApproval(approvalId);
      if (!approval || !this.approvalEngine.isApproved(approval)) {
        return {
          success: false,
          requiresApproval: true,
          approvalId,
          errors: ['Transition requires an approved approval']
        };
      }
    }

    const fromStage = instance.current_stage;
    const transitionRecord = stateMachine.move(toStage, {
      transitionId: evalResult.transition.id,
      reason,
      triggeredBy: userId
    });

    const updatedInstance = await store.updateInstance(instance.id, {
      current_stage: instance.current_stage,
      previous_stage: instance.previous_stage,
      status: instance.status,
      completed_at: instance.completed_at,
      context: { ...instance.context, ...payload },
      updated_at: instance.updated_at
    });

    const savedTransition = await store.createTransition({
      instance_id: instance.id,
      transition_id: evalResult.transition.id,
      from_stage: fromStage,
      to_stage: toStage,
      triggered_by: userId,
      reason,
      evaluated_gates: evalResult.gateResult.results,
      evidence: evalResult.gateResult.results.flatMap(r => r.evidence || []),
      confidence_score: evalResult.gateResult.confidence
    });

    // Persist gate evaluations
    for (const r of evalResult.gateResult.results) {
      await store.createGateEvaluation({
        transition_id: savedTransition.id,
        gate_id: r.gateId,
        gate_type: r.gateType,
        passed: r.passed,
        score: r.score,
        threshold: r.threshold,
        evidence: r.evidence
      });
    }

    // Audit checkpoint
    const checkpoint = this.auditLogger.buildCheckpoint({
      decision: evalResult.requiresApproval ? 'approved_with_approval' : 'approved_by_gates',
      reason,
      evidence: savedTransition.evidence,
      confidence: evalResult.gateResult.confidence,
      approver: approval ? approval.decisions : null,
      metadata: { transitionId: evalResult.transition.id, approvalId: approval ? approval.id : null }
    });
    await store.updateTransition(savedTransition.id, { decision_checkpoint: checkpoint });

    // Tasks
    await this.taskEngine.completeStageTasks({
      instanceId: instance.id,
      stageCode: fromStage,
      store,
      completedBy: userId
    });
    const newTasks = await this.taskEngine.generateTasks({
      instanceId: instance.id,
      stageCode: toStage,
      workflowCode: workflow.id,
      store,
      createdBy: userId
    });

    // Events
    await this.eventBus.emitAndStore({
      instanceId: instance.id,
      eventType: 'ProjectExitedStage',
      payload: { stage: fromStage, transitionId: evalResult.transition.id },
      source: 'transition-engine',
      store
    });
    await this.eventBus.emitAndStore({
      instanceId: instance.id,
      eventType: 'ProjectEnteredStage',
      payload: { stage: toStage, transitionId: evalResult.transition.id, tasks: newTasks.map(t => t.id) },
      source: 'transition-engine',
      store
    });
    if (approval) {
      await this.eventBus.emitAndStore({
        instanceId: instance.id,
        eventType: 'ApprovalGranted',
        payload: { approvalId: approval.id, transitionId: evalResult.transition.id },
        source: 'transition-engine',
        store
      });
    }

    // Timeline entries
    await this.timelineEngine.addEntry({
      instanceId: instance.id,
      entryType: 'transition',
      title: `Moved to ${toStage}`,
      description: reason || '',
      evidence: savedTransition.evidence,
      confidenceScore: evalResult.gateResult.confidence,
      actor: userId,
      referenceTable: 'enterprise_lifecycle_transitions',
      referenceId: savedTransition.id,
      store
    });

    return {
      success: true,
      instance: updatedInstance,
      transition: savedTransition,
      gateResult: evalResult.gateResult,
      tasks: newTasks,
      approval
    };
  }

  async rollback({ instance, toStage, context = {}, userId, reason, store }) {
    const workflow = this.registry.getWorkflow(instance.workflow_code);
    const rules = this.registry.getRollbackRules(workflow.id);
    if (!rules.enabled) return { success: false, errors: ['Rollback is disabled'] };
    if (!reason) return { success: false, errors: ['Rollback reason is required'] };
    const allowedFrom = rules.allowedFrom || [];
    if (!allowedFrom.includes(instance.current_stage)) {
      return { success: false, errors: [`Rollback not allowed from '${instance.current_stage}'`] };
    }
    if (!toStage) {
      toStage = instance.previous_stage;
    }
    if (!toStage) {
      return { success: false, errors: ['No previous stage to rollback to'] };
    }
    const result = await this.executeTransition({
      instance,
      toStage,
      context,
      userId,
      reason: `[Rollback] ${reason}`,
      store
    });
    if (result.success) {
      await store.updateTransition(result.transition.id, { rolled_back: true, rollback_reason: reason });
      result.transition.rolled_back = true;
      result.transition.rollback_reason = reason;
    }
    return result;
  }
}

module.exports = { TransitionEngine };
