/**
 * BONDS UCP Calculation Graph (DAG)
 *
 * Builds a directed acyclic graph from formulas, business formulas, outputs
 * and explicit dependencies. Computes topological order, parallel execution
 * levels, and supports failure/retry/caching policies.
 */

const { getVariables } = require('./expression-evaluator');

class CalculationNode {
  constructor({ id, type, code, expression, value, inputs = [], outputs = [], policy = {} }) {
    this.id = id;
    this.type = type; // input, formula, business_formula, output, rule, weight, policy
    this.code = code;
    this.expression = expression;
    this.value = value;
    this.inputs = inputs; // codes this node depends on
    this.outputs = outputs;
    this.policy = policy;
    this.status = 'pending'; // pending | running | success | error
    this.error = null;
    this.cacheKey = null;
  }
}

class CalculationGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = new Map(); // nodeId -> Set(dependsOnNodeId)
    this.reverseEdges = new Map(); // nodeId -> Set(dependentNodeId)
  }

  addNode(node) {
    this.nodes.set(node.id, node);
    if (!this.edges.has(node.id)) this.edges.set(node.id, new Set());
    if (!this.reverseEdges.has(node.id)) this.reverseEdges.set(node.id, new Set());
  }

  addEdge(fromId, toId) {
    // fromId depends on toId
    this.edges.get(fromId).add(toId);
    this.reverseEdges.get(toId).add(fromId);
  }

  /**
   * Build graph from template and registries.
   */
  static build({
    inputs = {},
    formulas = [],
    businessFormulas = [],
    outputs = [],
    rules = [],
    weights = [],
    policies = []
  }) {
    const graph = new CalculationGraph();
    const codeToId = {};

    // Input nodes
    for (const code of Object.keys(inputs)) {
      const id = `input:${code}`;
      codeToId[code] = id;
      graph.addNode(new CalculationNode({ id, type: 'input', code, value: inputs[code] }));
    }

    // Formula nodes
    for (const f of formulas) {
      const id = `formula:${f.code}`;
      codeToId[f.code] = id;
      const vars = getVariables(f.expression);
      graph.addNode(new CalculationNode({ id, type: 'formula', code: f.code, expression: f.expression, inputs: vars }));
    }

    // Business formula nodes
    for (const f of businessFormulas) {
      const id = `business_formula:${f.code}`;
      codeToId[f.code] = id;
      const vars = f.expression ? getVariables(f.expression) : [];
      graph.addNode(new CalculationNode({ id, type: 'business_formula', code: f.code, expression: f.expression, inputs: vars }));
    }

    // Output nodes depend on formula codes
    for (const o of outputs) {
      const id = `output:${o.code}`;
      graph.addNode(new CalculationNode({ id, type: 'output', code: o.code, inputs: o.formula_codes || [] }));
    }

    // Rule/weight/policy nodes as pass-through logical nodes
    for (const r of rules) {
      const id = `rule:${r.code}`;
      graph.addNode(new CalculationNode({ id, type: 'rule', code: r.code }));
    }
    for (const w of weights) {
      const id = `weight:${w.code}`;
      graph.addNode(new CalculationNode({ id, type: 'weight', code: w.code }));
    }
    for (const p of policies) {
      const id = `policy:${p.code}`;
      graph.addNode(new CalculationNode({ id, type: 'policy', code: p.code }));
    }

    // Connect edges based on inputs arrays
    for (const node of graph.nodes.values()) {
      for (const depCode of node.inputs) {
        const depId = codeToId[depCode];
        if (depId && depId !== node.id) {
          graph.addEdge(node.id, depId);
        }
      }
    }

    return graph;
  }

  topologicalOrder() {
    const visited = new Set();
    const temp = new Set();
    const order = [];

    const visit = (id) => {
      if (temp.has(id)) throw new Error(`Circular dependency detected at ${id}`);
      if (visited.has(id)) return;
      temp.add(id);
      for (const depId of this.edges.get(id) || []) visit(depId);
      temp.delete(id);
      visited.add(id);
      order.push(id);
    };

    for (const id of this.nodes.keys()) visit(id);
    return order;
  }

  /**
   * Group nodes into levels that can run in parallel.
   */
  parallelLevels() {
    const order = this.topologicalOrder();
    const levels = [];
    const completed = new Set();

    for (const id of order) {
      const deps = this.edges.get(id) || new Set();
      const maxLevel = Math.max(-1, ...Array.from(deps).map(d => {
        for (let i = 0; i < levels.length; i++) {
          if (levels[i].includes(d)) return i;
        }
        return -1;
      }));
      const level = maxLevel + 1;
      if (!levels[level]) levels[level] = [];
      levels[level].push(id);
      completed.add(id);
    }
    return levels;
  }

  /**
   * Execute graph with provided executor function.
   * Executor receives node and context, returns value.
   */
  async execute(executor, context = {}) {
    const order = this.topologicalOrder();
    for (const id of order) {
      const node = this.nodes.get(id);
      node.status = 'running';
      try {
        node.value = await executor(node, context);
        context[node.code || id] = node.value;
        node.status = 'success';
      } catch (err) {
        node.status = 'error';
        node.error = err.message;
        context[node.code || id] = undefined;
        if (node.policy.failureStrategy === 'throw') throw err;
      }
    }
    return { context, order, nodes: Array.from(this.nodes.values()) };
  }

  impactedNodes(changedCode) {
    const changedId = `input:${changedCode}`;
    if (!this.nodes.has(changedId)) return [];
    const result = new Set();
    const walk = (id) => {
      for (const dependent of this.reverseEdges.get(id) || []) {
        if (!result.has(dependent)) {
          result.add(dependent);
          walk(dependent);
        }
      }
    };
    walk(changedId);
    return Array.from(result).map(id => this.nodes.get(id));
  }
}

module.exports = { CalculationGraph, CalculationNode };
