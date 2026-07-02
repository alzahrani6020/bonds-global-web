/**
 * Enterprise Lifecycle Task Engine
 *
 * Auto-generates tasks when an entity enters a stage and manages stage-exit cleanup.
 */

class TaskEngine {
  constructor(registry) {
    this.registry = registry;
  }

  async generateTasks({ instanceId, stageCode, workflowCode, store, createdBy }) {
    const definitions = this.registry.getStageTasks(workflowCode, stageCode);
    const tasks = [];
    for (const def of definitions) {
      const deadline = def.deadlineDays
        ? new Date(Date.now() + def.deadlineDays * 24 * 60 * 60 * 1000).toISOString()
        : null;
      const task = await store.createTask({
        instance_id: instanceId,
        stage_id: stageCode,
        task_code: def.code,
        title: def.title && typeof def.title === 'object' ? def.title.en || def.title.ar || def.code : def.title,
        title_ar: def.title && typeof def.title === 'object' ? def.title.ar : null,
        title_en: def.title && typeof def.title === 'object' ? def.title.en : null,
        owner_role: def.ownerRole || 'owner',
        priority: def.priority || 'medium',
        deadline,
        dependencies: def.dependencies || [],
        completion_rules: def.completionRules || {},
        status: 'pending',
        evidence: []
      });
      tasks.push(task);
    }
    return tasks;
  }

  async completeStageTasks({ instanceId, stageCode, store, completedBy }) {
    const tasks = await store.listTasks(instanceId, { stage_id: stageCode, status: 'pending' });
    const results = [];
    for (const task of tasks) {
      const updated = await store.updateTask(task.id, {
        status: 'completed',
        completed_by: completedBy,
        completed_at: new Date().toISOString()
      });
      results.push(updated);
    }
    return results;
  }

  async cancelStageTasks({ instanceId, stageCode, store }) {
    const tasks = await store.listTasks(instanceId, { stage_id: stageCode, status: 'pending' });
    const results = [];
    for (const task of tasks) {
      const updated = await store.updateTask(task.id, { status: 'cancelled' });
      results.push(updated);
    }
    return results;
  }
}

module.exports = { TaskEngine };
