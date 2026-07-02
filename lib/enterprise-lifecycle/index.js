/**
 * Enterprise Lifecycle Suite — Phase D.1.5 Public API
 *
 * Registry-driven lifecycle backbone for projects, assets, reports, and certificates.
 */

const { LifecycleEngine } = require('./lifecycle-engine');
const { LifecycleRegistry } = require('./lifecycle-registry');
const { StateMachine } = require('./state-machine');
const { WorkflowGraph } = require('./workflow-graph');
const { GateEngine } = require('./gate-engine');
const { TransitionEngine } = require('./transition-engine');
const { ApprovalEngine } = require('./approval-engine');
const { TaskEngine } = require('./task-engine');
const { EventBus } = require('./event-bus');
const { TimelineEngine } = require('./timeline-engine');
const { AuditLogger } = require('./audit-logger');
const { MemoryLifecycleStore } = require('./store/memory-store');
const { SupabaseLifecycleStore } = require('./store');

module.exports = {
  LifecycleEngine,
  LifecycleRegistry,
  StateMachine,
  WorkflowGraph,
  GateEngine,
  TransitionEngine,
  ApprovalEngine,
  TaskEngine,
  EventBus,
  TimelineEngine,
  AuditLogger,
  MemoryLifecycleStore,
  SupabaseLifecycleStore
};
