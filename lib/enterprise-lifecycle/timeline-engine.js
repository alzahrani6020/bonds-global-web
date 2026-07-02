/**
 * Enterprise Lifecycle Timeline Engine
 *
 * Builds a unified timeline from transitions, events, tasks, approvals, and checkpoints.
 */

class TimelineEngine {
  async buildTimeline(instanceId, store) {
    const [transitions, events, tasks, approvals, instance] = await Promise.all([
      store.listTransitions(instanceId),
      store.listEvents(instanceId),
      store.listTasks(instanceId),
      store.listApprovals(instanceId),
      store.getInstance(instanceId)
    ]);

    const entries = [];

    for (const t of transitions) {
      entries.push({
        entry_type: 'transition',
        reference_table: 'enterprise_lifecycle_transitions',
        reference_id: t.id,
        actor: t.triggered_by,
        title: `Transition: ${t.from_stage} → ${t.to_stage}`,
        description: t.reason || '',
        evidence: t.evidence || [],
        confidence_score: t.confidence_score,
        occurred_at: t.created_at
      });
      if (t.decision_checkpoint && t.decision_checkpoint.timestamp) {
        entries.push({
          entry_type: 'decision',
          reference_table: 'enterprise_lifecycle_transitions',
          reference_id: t.id,
          actor: t.decision_checkpoint.approver,
          title: `Decision: ${t.decision_checkpoint.decision}`,
          description: t.decision_checkpoint.reason || '',
          evidence: t.decision_checkpoint.evidence || [],
          confidence_score: t.decision_checkpoint.confidence,
          occurred_at: t.decision_checkpoint.timestamp
        });
      }
    }

    for (const e of events) {
      entries.push({
        entry_type: 'event',
        reference_table: 'enterprise_lifecycle_events',
        reference_id: e.id,
        title: e.event_type,
        description: '',
        evidence: [],
        occurred_at: e.created_at
      });
    }

    for (const task of tasks) {
      if (task.status === 'completed' || task.status === 'cancelled') {
        entries.push({
          entry_type: 'task',
          reference_table: 'enterprise_lifecycle_tasks',
          reference_id: task.id,
          actor: task.completed_by,
          title: `Task ${task.status}: ${task.title}`,
          description: task.task_code,
          evidence: task.evidence || [],
          occurred_at: task.completed_at || task.updated_at || task.created_at
        });
      }
    }

    for (const approval of approvals) {
      if (approval.status !== 'pending') {
        entries.push({
          entry_type: 'approval',
          reference_table: 'enterprise_lifecycle_approvals',
          reference_id: approval.id,
          title: `Approval ${approval.status}`,
          description: approval.approval_type,
          evidence: approval.decisions || [],
          occurred_at: approval.completed_at || approval.updated_at || approval.created_at
        });
      }
    }

    if (instance) {
      entries.unshift({
        entry_type: 'event',
        title: 'Lifecycle started',
        description: `Workflow: ${instance.workflow_code}`,
        evidence: [],
        occurred_at: instance.started_at || instance.created_at
      });
      entries.push({
        entry_type: 'event',
        title: 'Current stage',
        description: instance.current_stage,
        evidence: [],
        occurred_at: instance.updated_at || new Date().toISOString()
      });
    }

    entries.sort((a, b) => new Date(a.occurred_at) - new Date(b.occurred_at));
    return entries;
  }

  async addEntry({ instanceId, entryType, title, description, evidence, confidenceScore, actor, referenceTable, referenceId, store }) {
    return await store.createTimelineEntry({
      instance_id: instanceId,
      entry_type: entryType,
      reference_table: referenceTable,
      reference_id: referenceId,
      actor,
      title,
      description,
      evidence: evidence || [],
      confidence_score: confidenceScore
    });
  }
}

module.exports = { TimelineEngine };
