/**
 * Enterprise Lifecycle Engine
 *
 * Orchestrates registry-driven state machines, gates, approvals, tasks, events,
 * and timeline for projects, assets, reports, and certificates.
 */

const { LifecycleRegistry } = require('./lifecycle-registry');
const { StateMachine } = require('./state-machine');
const { WorkflowGraph } = require('./workflow-graph');
const { GateEngine } = require('./gate-engine');
const { TransitionEngine } = require('./transition-engine');
const { ApprovalEngine } = require('./approval-engine');
const { TaskEngine } = require('./task-engine');
const { EventBus } = require('./event-bus');
const { TimelineEngine } = require('./timeline-engine');
const { MemoryLifecycleStore } = require('./store/memory-store');
const { SupabaseLifecycleStore } = require('./store');

const { InvestmentIntelligenceAdapter } = require('./integrations/investment-intelligence-adapter');
const { UcpAdapter } = require('./integrations/ucp-adapter');
const { ValuationAdapter } = require('./integrations/valuation-adapter');
const { FabricAdapter } = require('./integrations/fabric-adapter');
const { ConfidenceAdapter } = require('./integrations/confidence-adapter');
const { ExplainabilityAdapter } = require('./integrations/explainability-adapter');
const { DecisionMemoryAdapter } = require('./integrations/decision-memory-adapter');
const { DigitalTwinAdapter } = require('./integrations/digital-twin-adapter');
const { TimelineAdapter } = require('./integrations/timeline-adapter');

function defaultAdapters({ supabase }) {
  return [
    new InvestmentIntelligenceAdapter({ supabase }),
    new UcpAdapter({ supabase }),
    new ValuationAdapter({ supabase }),
    new FabricAdapter({ supabase }),
    new ConfidenceAdapter(),
    new DecisionMemoryAdapter({ supabase }),
    new DigitalTwinAdapter({ supabase }),
    new TimelineAdapter({ supabase })
  ];
}

class LifecycleEngine {
  constructor({ supabase = null, store = null, registry = null, adapters = null } = {}) {
    this.supabase = supabase;
    this.store = store || (supabase ? new SupabaseLifecycleStore(supabase) : new MemoryLifecycleStore());
    this.registry = registry || new LifecycleRegistry({ supabase });
    this.gateEngine = new GateEngine();
    this.approvalEngine = new ApprovalEngine();
    this.taskEngine = new TaskEngine(this.registry);
    this.eventBus = new EventBus();
    this.timelineEngine = new TimelineEngine();
    this.explainabilityAdapter = new ExplainabilityAdapter();
    this.adapters = adapters !== undefined && adapters !== null ? adapters : defaultAdapters({ supabase });
    if (!Array.isArray(this.adapters)) this.adapters = [];
    this.transitionEngine = new TransitionEngine({
      registry: this.registry,
      gateEngine: this.gateEngine,
      approvalEngine: this.approvalEngine,
      taskEngine: this.taskEngine,
      eventBus: this.eventBus,
      timelineEngine: this.timelineEngine
    });
  }

  async initialize() {
    await this.registry.load();
    return this;
  }

  async createInstance({ entityType, entityId, workflowCode, userId, context = {} }) {
    await this.initialize();
    const workflow = workflowCode
      ? this.registry.getWorkflow(workflowCode)
      : this.registry.findWorkflowForEntityType(entityType);
    if (!workflow) throw new Error(`No workflow found for entity type '${entityType}'`);

    const instance = await this.store.createInstance({
      entity_id: entityId,
      entity_type: entityType,
      workflow_code: workflow.id,
      current_stage: workflow.initialStage,
      previous_stage: null,
      context,
      status: 'active',
      created_by: userId
    });

    const initialTasks = await this.taskEngine.generateTasks({
      instanceId: instance.id,
      stageCode: workflow.initialStage,
      workflowCode: workflow.id,
      store: this.store,
      createdBy: userId
    });

    await this.eventBus.emitAndStore({
      instanceId: instance.id,
      eventType: 'LifecycleStarted',
      payload: { entityType, entityId, workflowCode: workflow.id, stage: workflow.initialStage },
      source: 'lifecycle-engine',
      store: this.store
    });

    await this.eventBus.emitAndStore({
      instanceId: instance.id,
      eventType: 'ProjectEnteredStage',
      payload: { stage: workflow.initialStage },
      source: 'lifecycle-engine',
      store: this.store
    });

    await this.timelineEngine.addEntry({
      instanceId: instance.id,
      entryType: 'event',
      title: 'Lifecycle started',
      description: `Workflow: ${workflow.id}`,
      actor: userId,
      store: this.store
    });

    return { instance, tasks: initialTasks };
  }

  async buildContext(instance, baseContext = {}) {
    let context = { ...baseContext };
    if (this.supabase && instance.entity_type === 'project' && !context.project) {
      try {
        const { data: project } = await this.supabase
          .from('bonds_projects')
          .select('*')
          .eq('id', instance.entity_id)
          .single();
        if (project) context.project = project;
      } catch (err) {
        // ignore
      }
    }
    if (Array.isArray(this.adapters)) {
      for (const adapter of this.adapters) {
        if (!adapter || typeof adapter.enrich !== 'function') continue;
        try {
          context = await adapter.enrich({ instance, context, supabase: this.supabase });
        } catch (err) {
          console.warn('[LifecycleEngine] Adapter enrichment failed:', err.message);
        }
      }
    }
    return context;
  }

  async evaluateTransition(instanceId, toStage, { userId, reason, context = {} } = {}) {
    await this.initialize();
    const instance = await this.store.getInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    const enriched = await this.buildContext(instance, context);
    return this.transitionEngine.evaluateTransition({
      instance,
      toStage,
      context: enriched,
      userId,
      reason
    });
  }

  async transition(instanceId, toStage, { userId, reason, context = {}, approvalId } = {}) {
    await this.initialize();
    const instance = await this.store.getInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    const enriched = await this.buildContext(instance, context);

    const beforeSnapshot = await this._snapshot(instance, `before-${instance.current_stage}`);
    const result = await this.transitionEngine.executeTransition({
      instance,
      toStage,
      context: enriched,
      userId,
      reason,
      store: this.store,
      approvalId
    });
    if (result.success) {
      const afterSnapshot = await this._snapshot(result.instance, `after-${toStage}`);
      await this._recordDecisionMemory(result);
      await this._mirrorTimelineEvent(result.instance, 'ProjectEnteredStage', { stage: toStage });
      result.beforeSnapshot = beforeSnapshot;
      result.afterSnapshot = afterSnapshot;
      result.explanation = this.explainabilityAdapter.explain({
        fromStage: result.transition.from_stage,
        toStage: result.transition.to_stage,
        gateResult: result.gateResult,
        language: context.language || 'ar'
      });
    }
    return result;
  }

  async rollback(instanceId, { toStage, userId, reason, context = {} } = {}) {
    await this.initialize();
    const instance = await this.store.getInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    const enriched = await this.buildContext(instance, context);
    return this.transitionEngine.rollback({
      instance,
      toStage,
      context: enriched,
      userId,
      reason,
      store: this.store
    });
  }

  async evaluateGate(instanceId, gateId, { context = {} } = {}) {
    await this.initialize();
    const instance = await this.store.getInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    const workflow = this.registry.getWorkflow(instance.workflow_code);
    const guard = this.registry.getGuardDefinition(workflow.id, gateId);
    if (!guard) throw new Error('Gate not found');
    const enriched = await this.buildContext(instance, context);
    return this.gateEngine.evaluate(guard, enriched);
  }

  async requestApproval(instanceId, { transitionKey, requestedBy }) {
    await this.initialize();
    const instance = await this.store.getInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    const workflow = this.registry.getWorkflow(instance.workflow_code);
    const [from, to] = transitionKey.split('->');
    const rule = this.registry.getApprovalRule(workflow.id, transitionKey);
    if (!rule) throw new Error('No approval rule for this transition');
    return this.approvalEngine.createApproval({
      instanceId,
      transitionId: `${from}-${to}`,
      stageId: from,
      rule,
      requestedBy,
      store: this.store
    });
  }

  async submitApproval(approvalId, { userId, role, decision, reason }) {
    return this.approvalEngine.submitDecision({
      approvalId,
      userId,
      role,
      decision,
      reason,
      store: this.store
    });
  }

  async getState(instanceId) {
    await this.initialize();
    const instance = await this.store.getInstance(instanceId);
    if (!instance) throw new Error('Instance not found');
    const workflow = this.registry.getWorkflow(instance.workflow_code);
    const stateMachine = new StateMachine({ instance, workflow });
    const graph = new WorkflowGraph(workflow);
    return {
      instance,
      currentStage: stateMachine.currentState(),
      previousStage: stateMachine.previousState(),
      isFinal: stateMachine.isFinal(),
      allowedTransitions: stateMachine.allowedTransitions(this.registry),
      blockedPaths: graph.blockedPaths(stateMachine.currentState()),
      criticalPath: graph.criticalPath()
    };
  }

  async getHistory(instanceId) {
    return this.store.listTransitions(instanceId);
  }

  async getTimeline(instanceId) {
    return this.timelineEngine.buildTimeline(instanceId, this.store);
  }

  async getTasks(instanceId, filters = {}) {
    return this.store.listTasks(instanceId, filters);
  }

  async emitEvent(instanceId, eventType, payload, source = 'external') {
    return this.eventBus.emitAndStore({ instanceId, eventType, payload, source, store: this.store });
  }

  async _snapshot(instance, label) {
    if (!Array.isArray(this.adapters)) return null;
    const adapter = this.adapters.find(a => a && typeof a.snapshot === 'function');
    if (!adapter) return null;
    try {
      return await adapter.snapshot({ instance, label });
    } catch (err) {
      return null;
    }
  }

  async _recordDecisionMemory(result) {
    if (!Array.isArray(this.adapters)) return null;
    const adapter = this.adapters.find(a => a && typeof a.record === 'function');
    if (!adapter) return null;
    try {
      return await adapter.record({
        instance: result.instance,
        transition: result.transition,
        gateResult: result.gateResult,
        userId: result.transition.triggered_by
      });
    } catch (err) {
      return null;
    }
  }

  async _mirrorTimelineEvent(instance, eventType, payload) {
    if (!Array.isArray(this.adapters)) return null;
    const adapter = this.adapters.find(a => a && typeof a.emit === 'function');
    if (!adapter) return null;
    try {
      return await adapter.emit({ instance, eventType, payload });
    } catch (err) {
      return null;
    }
  }
}

module.exports = { LifecycleEngine };
