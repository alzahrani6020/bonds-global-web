/**
 * In-memory Lifecycle Store
 *
 * Used for unit tests and offline runs.
 */

class MemoryLifecycleStore {
  constructor() {
    this.instances = new Map();
    this.transitions = [];
    this.gateEvaluations = [];
    this.approvals = [];
    this.tasks = [];
    this.events = [];
    this.timeline = [];
  }

  _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  async createInstance(record) {
    const id = this._uuid();
    const instance = { id, ...record, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.instances.set(id, instance);
    return instance;
  }

  async getInstance(id) {
    return this.instances.get(id) || null;
  }

  async updateInstance(id, updates) {
    const instance = this.instances.get(id);
    if (!instance) return null;
    Object.assign(instance, updates, { updated_at: new Date().toISOString() });
    return instance;
  }

  async createTransition(record) {
    const id = this._uuid();
    const transition = { id, ...record, created_at: new Date().toISOString() };
    this.transitions.push(transition);
    return transition;
  }

  async listTransitions(instanceId) {
    return this.transitions.filter(t => t.instance_id === instanceId);
  }

  async updateTransition(id, updates) {
    const transition = this.transitions.find(t => t.id === id);
    if (!transition) return null;
    Object.assign(transition, updates);
    return transition;
  }

  async createGateEvaluation(record) {
    const id = this._uuid();
    const evaluation = { id, ...record, evaluated_at: new Date().toISOString() };
    this.gateEvaluations.push(evaluation);
    return evaluation;
  }

  async createApproval(record) {
    const id = this._uuid();
    const approval = { id, ...record, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.approvals.push(approval);
    return approval;
  }

  async getApproval(id) {
    return this.approvals.find(a => a.id === id) || null;
  }

  async updateApproval(id, updates) {
    const approval = this.approvals.find(a => a.id === id);
    if (!approval) return null;
    Object.assign(approval, updates, { updated_at: new Date().toISOString() });
    return approval;
  }

  async listApprovals(instanceId) {
    return this.approvals.filter(a => a.instance_id === instanceId);
  }

  async createTask(record) {
    const id = this._uuid();
    const task = { id, ...record, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    this.tasks.push(task);
    return task;
  }

  async getTask(id) {
    return this.tasks.find(t => t.id === id) || null;
  }

  async updateTask(id, updates) {
    const task = this.tasks.find(t => t.id === id);
    if (!task) return null;
    Object.assign(task, updates, { updated_at: new Date().toISOString() });
    return task;
  }

  async listTasks(instanceId, filters = {}) {
    let tasks = this.tasks.filter(t => t.instance_id === instanceId);
    if (filters.status) tasks = tasks.filter(t => t.status === filters.status);
    if (filters.stage_id) tasks = tasks.filter(t => t.stage_id === filters.stage_id);
    return tasks;
  }

  async createEvent(record) {
    const id = this._uuid();
    const event = { id, ...record, created_at: new Date().toISOString() };
    this.events.push(event);
    return event;
  }

  async listEvents(instanceId) {
    return this.events.filter(e => e.instance_id === instanceId);
  }

  async createTimelineEntry(record) {
    const id = this._uuid();
    const entry = { id, ...record, occurred_at: new Date().toISOString() };
    this.timeline.push(entry);
    return entry;
  }

  async listTimeline(instanceId) {
    return this.timeline.filter(e => e.instance_id === instanceId);
  }
}

module.exports = { MemoryLifecycleStore };
