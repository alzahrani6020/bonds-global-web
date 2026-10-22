'use strict';

const PRIORITIES = Object.freeze({
  production_user_request: 100,
  critical_production_failure: 100,
  security_incident: 100,
  approved_urgent_repair: 90,
  approved_upgrade: 70,
  learning_analysis: 40,
  benchmark: 30,
  training: 20,
  background_cleanup: 10
});

function priorityOf(task) {
  if (Number.isFinite(task?.priority)) return Number(task.priority);
  return PRIORITIES[task?.kind] ?? 0;
}

function requiresCapacity(task, profile) {
  const req = task?.requirements || {};
  if (req.min_profile) {
    const order = ['MINIMAL','BALANCED','HIGH','MAXIMUM'];
    if (order.indexOf(profile.execution_profile) < order.indexOf(req.min_profile)) return true;
  }
  if (req.min_free_ram_gb && profile.snapshot.free_ram_gb < req.min_free_ram_gb) return true;
  if (req.gpu_required && !profile.snapshot.gpu_available) return true;
  return false;
}

function schedule(tasks, profile) {
  if (!profile?.runnable) {
    return { runnable: [], waiting_for_capacity: tasks.slice(), paused: [] };
  }

  const ordered = tasks.slice().sort((a,b) => priorityOf(b) - priorityOf(a));
  const waiting_for_capacity = ordered.filter(t => requiresCapacity(t, profile));
  const eligible = ordered.filter(t => !requiresCapacity(t, profile));

  const productionActive = eligible.some(t => priorityOf(t) >= 100);
  const slots = Math.max(1, Number(profile.parallel_agents || 1));
  const runnable = [];

  for (const task of eligible) {
    if (runnable.length >= slots) break;
    if (productionActive && task.core === 'self_evolving' && priorityOf(task) < 100) continue;
    runnable.push(task);
  }

  const runnableIds = new Set(runnable.map(t => t.id));
  const waitingIds = new Set(waiting_for_capacity.map(t => t.id));
  const paused = ordered.filter(t => !runnableIds.has(t.id) && !waitingIds.has(t.id));

  return { runnable, waiting_for_capacity, paused };
}

module.exports = { PRIORITIES, priorityOf, requiresCapacity, schedule };
