/**
 * BONDS Executive Command Center — Smart Notification Engine (Phase E.1)
 *
 * Generates a prioritized, deduplicated notification feed for a user
 * by scanning all projects they own. Reuses aggregateProjectStatus.
 */

const { aggregateProjectStatus, listUserProjects } = require('./portfolio-status-aggregator');

const PRIORITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

function normalizeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function makeId(projectId, type, key) {
  const safeKey = String(key).replace(/[^a-zA-Z0-9_\-.]/g, '_').slice(0, 80);
  return `${projectId}:${type}:${safeKey}`;
}

function notificationFromAlert(projectId, projectName, alert) {
  return {
    id: makeId(projectId, 'critical_alert', alert.title),
    projectId,
    projectName,
    type: 'critical_alert',
    title: alert.title,
    message: alert.message,
    priority: alert.priority || 'medium',
    actionUrl: `/v3/project?id=${encodeURIComponent(projectId)}`,
    actionLabel_ar: 'عرض المشروع',
    actionLabel_en: 'View Project',
    createdAt: new Date().toISOString()
  };
}

function notificationFromAction(projectId, projectName, action) {
  return {
    id: makeId(projectId, 'next_action', action.action || action.action_ar || 'next'),
    projectId,
    projectName,
    type: 'next_action',
    title: action.action_ar || action.action || 'Next action',
    message: action.reason_ar || action.reason || '',
    priority: action.priority || 'medium',
    actionUrl: `/v3/project?id=${encodeURIComponent(projectId)}`,
    actionLabel_ar: 'تنفيذ',
    actionLabel_en: 'Act',
    createdAt: new Date().toISOString()
  };
}

function notificationFromApproval(projectId, projectName, approval) {
  const transition = approval.transition_id || approval.stage_id || 'unknown';
  return {
    id: makeId(projectId, 'approval_pending', approval.id || transition),
    projectId,
    projectName,
    type: 'approval_pending',
    title: 'موافقة معلقة',
    title_en: 'Pending Approval',
    message: `الانتقال إلى "${transition}" في انتظار قرار الموافقة.`,
    message_en: `Transition to "${transition}" is awaiting approval.`,
    priority: 'high',
    actionUrl: `/v3/project?id=${encodeURIComponent(projectId)}`,
    actionLabel_ar: 'اتخاذ القرار',
    actionLabel_en: 'Decide',
    createdAt: approval.created_at || approval.requested_at || new Date().toISOString()
  };
}

function notificationFromTask(projectId, projectName, task) {
  return {
    id: makeId(projectId, 'task_pending', task.id || task.title),
    projectId,
    projectName,
    type: 'task_pending',
    title: 'مهمة مطلوبة',
    title_en: 'Task Required',
    message: task.title || 'مهمة في دورة الحياة تحتاج إكمالها.',
    message_en: task.title_en || task.title || 'A lifecycle task needs completion.',
    priority: task.priority || 'medium',
    actionUrl: `/v3/project?id=${encodeURIComponent(projectId)}`,
    actionLabel_ar: 'إكمال',
    actionLabel_en: 'Complete',
    createdAt: task.created_at || new Date().toISOString()
  };
}

function notificationFromReadinessGap(projectId, projectName, readinessScore, missingItems) {
  return {
    id: makeId(projectId, 'readiness_gap', readinessScore),
    projectId,
    projectName,
    type: 'readiness_gap',
    title: 'فجوة جاهزية',
    title_en: 'Readiness Gap',
    message: missingItems.length
      ? `درجة الجاهزية ${readinessScore}. ناقص: ${missingItems.join('، ')}`
      : `درجة الجاهزية ${readinessScore} أقل من الحد المطلوب.`,
    message_en: missingItems.length
      ? `Readiness score is ${readinessScore}. Missing: ${missingItems.join(', ')}`
      : `Readiness score ${readinessScore} is below the required threshold.`,
    priority: readinessScore < 60 ? 'critical' : 'high',
    actionUrl: `/v3/project?id=${encodeURIComponent(projectId)}`,
    actionLabel_ar: 'تحسين الجاهزية',
    actionLabel_en: 'Improve Readiness',
    createdAt: new Date().toISOString()
  };
}

async function generateNotifications({ userId, supabase, options = {} }) {
  if (!supabase) throw new Error('Supabase client is required');
  if (!userId) throw new Error('userId is required');

  const projectList = await listUserProjects(supabase, userId, options);
  const notifications = [];

  for (const project of projectList) {
    try {
      const status = await aggregateProjectStatus({
        projectId: project.id,
        supabase,
        userId,
        options: { skipAi: true }
      });

      const projectName = status.project.name;
      const readinessScore = normalizeNumber(status.health.readinessScore);
      const missingItems = status.health.readinessMissingItems || [];

      // Critical alerts
      (status.mission?.criticalAlerts || []).forEach(alert => {
        notifications.push(notificationFromAlert(project.id, projectName, alert));
      });

      // Next best action
      if (status.mission?.nextBestAction) {
        notifications.push(notificationFromAction(project.id, projectName, status.mission.nextBestAction));
      }

      // Pending approvals
      (status.approvals || []).forEach(approval => {
        if (approval.status === 'pending') {
          notifications.push(notificationFromApproval(project.id, projectName, approval));
        }
      });

      // Pending tasks
      (status.tasks || []).forEach(task => {
        if (task.status !== 'completed' && task.status !== 'cancelled') {
          notifications.push(notificationFromTask(project.id, projectName, task));
        }
      });

      // Readiness gap
      if (readinessScore > 0 && readinessScore < 70) {
        notifications.push(notificationFromReadinessGap(project.id, projectName, readinessScore, missingItems));
      }
    } catch (err) {
      console.warn('[ECC Notifications] failed for project', project.id, err.message);
    }
  }

  // Deduplicate by id (first wins, highest priority will be first after sort)
  const seen = new Set();
  const unique = [];
  notifications
    .sort((a, b) => {
      const rankDiff = (PRIORITY_RANK[a.priority] || 4) - (PRIORITY_RANK[b.priority] || 4);
      if (rankDiff !== 0) return rankDiff;
      return new Date(b.createdAt) - new Date(a.createdAt);
    })
    .forEach(n => {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        unique.push(n);
      }
    });

  return {
    notifications: unique,
    unreadCount: unique.length, // caller compares with local read state
    meta: {
      generatedAt: new Date().toISOString(),
      projectCount: projectList.length,
      enginesUsed: ['investment-intelligence', 'enterprise-intelligence', 'enterprise-lifecycle', 'digital-twin', 'confidence']
    }
  };
}

module.exports = { generateNotifications };
