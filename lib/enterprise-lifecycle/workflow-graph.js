/**
 * Enterprise Lifecycle Workflow Graph
 *
 * Builds a navigable graph from workflow transitions.
 */

class WorkflowGraph {
  constructor(workflow) {
    this.workflow = workflow;
    this.adj = new Map();
    this.rev = new Map();
    this.edges = new Map();
    this._build();
  }

  _build() {
    const addNode = (s) => {
      if (!this.adj.has(s)) this.adj.set(s, new Set());
      if (!this.rev.has(s)) this.rev.set(s, new Set());
    };

    for (const stage of this.workflow.stages || []) {
      addNode(stage);
    }

    for (const t of this.workflow.transitions || []) {
      addNode(t.from);
      addNode(t.to);
      this.adj.get(t.from).add(t.to);
      this.rev.get(t.to).add(t.from);
      const key = `${t.from}->${t.to}`;
      this.edges.set(key, { ...t, optional: !!t.optional });
    }
  }

  previousStages(stage) {
    return Array.from(this.rev.get(stage) || []);
  }

  nextStages(stage) {
    return Array.from(this.adj.get(stage) || []);
  }

  optionalBranches(stage) {
    const out = this.nextStages(stage);
    return out.filter(to => {
      const edge = this.edges.get(`${stage}->${to}`);
      return edge && edge.optional;
    });
  }

  parallelBranches(stage) {
    // Reserved for future parallel workflow support.
    return [];
  }

  rollbackPath(stage, previousStage) {
    if (!previousStage) return null;
    const edge = this.edges.get(`${stage}->${previousStage}`);
    if (edge) return { from: stage, to: previousStage, isRollback: false, ...edge };
    return { from: stage, to: previousStage, isRollback: true };
  }

  isReachable(from, to) {
    const visited = new Set();
    const queue = [from];
    while (queue.length) {
      const cur = queue.shift();
      if (cur === to) return true;
      if (visited.has(cur)) continue;
      visited.add(cur);
      for (const nxt of this.nextStages(cur)) queue.push(nxt);
    }
    return false;
  }

  criticalPath() {
    // Longest path in a DAG; returns stage sequence.
    const memo = new Map();
    const stages = this.workflow.stages || [];
    const dfs = (stage) => {
      if (memo.has(stage)) return memo.get(stage);
      const next = this.nextStages(stage);
      let best = [stage];
      for (const nxt of next) {
        const path = dfs(nxt);
        if (path.length + 1 > best.length) best = [stage, ...path];
      }
      memo.set(stage, best);
      return best;
    };

    let longest = [];
    for (const stage of stages) {
      const path = dfs(stage);
      if (path.length > longest.length) longest = path;
    }
    return longest;
  }

  blockedPaths(stage) {
    // Returns stages that are not reachable from current stage.
    const reachable = new Set();
    const queue = [stage];
    while (queue.length) {
      const cur = queue.shift();
      if (reachable.has(cur)) continue;
      reachable.add(cur);
      for (const nxt of this.nextStages(cur)) queue.push(nxt);
    }
    return (this.workflow.stages || []).filter(s => !reachable.has(s));
  }
}

module.exports = { WorkflowGraph };
