/**
 * BONDS Enterprise Intelligence — Decision Graph Engine
 *
 * Builds a graph of the decision pipeline (intent → fabric → UCP → engines
 * → synthesis → decision) and identifies the critical path, bottlenecks,
 * and the next best action to improve confidence.
 */

class DecisionGraphEngine {
  constructor(context = {}) {
    this.context = context;
  }

  build() {
    const intent = this.context.intent || 'unknown';
    const engineResults = this.context.engineResults || {};
    const ucpConfidence = this.context.ucpResult
      ? Math.round((this.context.ucpResult.confidence || 0) * 100)
      : 0;
    const fabricConfidence = this._fabricConfidence();

    const nodes = [
      { id: 'start', label: 'User Request', type: 'input', confidence: 100 },
      { id: 'intent', label: 'Intent Detection', type: 'intent', confidence: 95 },
      { id: 'fabric', label: 'Trusted Data Fabric', type: 'fabric', confidence: fabricConfidence },
      { id: 'ucp', label: 'Universal Calculation Platform', type: 'ucp', confidence: ucpConfidence }
    ];

    const edges = [
      { from: 'start', to: 'intent', confidence: 100 },
      { from: 'intent', to: 'fabric', confidence: fabricConfidence || 60 },
      { from: 'fabric', to: 'ucp', confidence: ucpConfidence || 50 }
    ];

    for (const [code, result] of Object.entries(engineResults)) {
      if (['decision_graph', 'blind_spot', 'recommendation_synthesizer'].includes(code)) continue;
      nodes.push({ id: code, label: code, type: 'engine', confidence: result?.confidence || 50 });
      edges.push({ from: 'ucp', to: code, confidence: result?.confidence || 50 });
    }

    nodes.push({ id: 'synthesis', label: 'Recommendation Synthesis', type: 'synthesis', confidence: this._synthesisConfidence(engineResults) });
    nodes.push({ id: 'decision', label: 'Decision', type: 'decision', confidence: this._decisionConfidence(engineResults) });

    for (const code of Object.keys(engineResults)) {
      if (['decision_graph', 'blind_spot', 'recommendation_synthesizer'].includes(code)) continue;
      edges.push({ from: code, to: 'synthesis', confidence: engineResults[code]?.confidence || 50 });
    }
    edges.push({ from: 'synthesis', to: 'decision', confidence: nodes.find(n => n.id === 'synthesis').confidence });

    const { criticalPath, bottleneck } = this._findCriticalPath(nodes, edges);

    return {
      output: {
        nodes,
        edges,
        criticalPath,
        bottleneck,
        nextAction: this._nextAction(nodes, edges, bottleneck)
      },
      confidence: Math.round(this._graphConfidence(nodes)),
      evidence: [
        {
          source: 'decision_graph_engine',
          evidence_type: 'insight',
          evidence_code: 'critical_path',
          value: criticalPath.join(' → '),
          confidence: 80,
          reason: 'Critical path computed from lowest-confidence bottleneck',
          timestamp: new Date().toISOString()
        }
      ],
      engine: 'decision_graph',
      status: 'ok'
    };
  }

  _fabricConfidence() {
    const autoPop = this.context.autoPopulate;
    if (!autoPop || !Array.isArray(autoPop.populated)) return 0;
    if (autoPop.populated.length === 0) return 0;
    const sum = autoPop.populated.reduce((acc, p) => acc + (p.confidence || 0), 0);
    return Math.round(sum / autoPop.populated.length);
  }

  _synthesisConfidence(engineResults) {
    const values = Object.values(engineResults)
      .filter(r => r && typeof r.confidence === 'number')
      .map(r => r.confidence);
    if (values.length === 0) return 50;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  _decisionConfidence(engineResults) {
    const values = Object.values(engineResults)
      .filter(r => r && typeof r.confidence === 'number')
      .map(r => r.confidence);
    if (values.length === 0) return 50;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  _findCriticalPath(nodes, edges) {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const adj = new Map();
    for (const e of edges) {
      if (!adj.has(e.from)) adj.set(e.from, []);
      adj.get(e.from).push(e);
    }

    const paths = [];
    const walk = (id, path, minConf) => {
      path.push(id);
      const next = adj.get(id) || [];
      if (next.length === 0) {
        paths.push({ path: [...path], bottleneck: minConf });
      } else {
        for (const e of next) {
          const conf = Math.min(minConf, e.confidence);
          walk(e.to, path, conf);
        }
      }
      path.pop();
    };
    walk('start', [], 100);

    if (paths.length === 0) return { criticalPath: ['start'], bottleneck: null };
    const best = paths.sort((a, b) => b.bottleneck - a.bottleneck)[0];
    const bottleneckNode = best.path.find(id => nodeMap.get(id)?.confidence === best.bottleneck) || best.path[best.path.length - 1];
    return { criticalPath: best.path, bottleneck: { node: bottleneckNode, confidence: best.bottleneck } };
  }

  _graphConfidence(nodes) {
    const confidences = nodes.map(n => n.confidence).filter(c => typeof c === 'number');
    if (confidences.length === 0) return 50;
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  _nextAction(nodes, edges, bottleneck) {
    if (!bottleneck) return 'Add more inputs to establish a decision path.';
    const node = nodes.find(n => n.id === bottleneck.node);
    if (!node) return 'Review low-confidence inputs.';
    if (node.type === 'fabric') return 'Improve data quality or add manual overrides to raise fabric confidence.';
    if (node.type === 'ucp') return 'Provide complete sector/country/inputs for a reliable UCP calculation.';
    if (node.type === 'engine') return `Review ${node.label} inputs and evidence; consider adding higher-trust sources.`;
    return `Increase confidence at ${node.label}.`;
  }
}

module.exports = { DecisionGraphEngine };
