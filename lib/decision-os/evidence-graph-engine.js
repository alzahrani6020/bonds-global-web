'use strict';

function safeId(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.:-]+/g, '_');
}

class EvidenceGraphEngine {
  build(context = {}) {
    const nodes = [];
    const edges = [];
    const seen = new Set();

    const addNode = (node) => {
      if (!node || !node.id || seen.has(node.id)) return;
      seen.add(node.id);
      nodes.push(node);
    };
    const addEdge = (from, to, type, metadata = null) => {
      edges.push({ from, to, type, metadata });
    };

    addNode({ id: 'decision', type: 'decision', label: context.decision?.primary || context.recommendation || 'Decision' });

    for (const [engineCode, result] of Object.entries(context.engineResults || {})) {
      const engineId = `engine:${safeId(engineCode)}`;
      addNode({
        id: engineId,
        type: 'engine',
        label: engineCode,
        confidence: result?.confidence ?? null,
        status: result?.status || null
      });
      addEdge(engineId, 'decision', 'supports');

      for (const item of result?.evidence || []) {
        const evidenceId = `evidence:${safeId(engineCode)}:${safeId(item.evidence_code || item.code || nodes.length)}`;
        addNode({
          id: evidenceId,
          type: 'evidence',
          label: item.evidence_code || item.code || 'evidence',
          value: item.value,
          confidence: item.confidence ?? null,
          source: item.source || engineCode,
          timestamp: item.timestamp || null,
          metadata: item.metadata || null
        });
        addEdge(evidenceId, engineId, 'supports');
      }
    }

    for (const item of context.inputEvidence || []) {
      const evidenceId = `input:${safeId(item.evidence_code || item.field || item.source || nodes.length)}`;
      addNode({
        id: evidenceId,
        type: 'input_evidence',
        label: item.evidence_code || item.field || 'input',
        value: item.value,
        confidence: item.confidence ?? null,
        source: item.source || 'input',
        timestamp: item.timestamp || null,
        metadata: item.metadata || null
      });
      const target = item.targetEngine ? `engine:${safeId(item.targetEngine)}` : 'decision';
      addEdge(evidenceId, target, 'feeds');
    }

    const orphanEvidence = nodes
      .filter(node => node.type === 'evidence' || node.type === 'input_evidence')
      .filter(node => !edges.some(edge => edge.from === node.id || edge.to === node.id));

    return {
      output: {
        nodes,
        edges,
        orphanEvidence: orphanEvidence.map(node => node.id),
        nodeCount: nodes.length,
        edgeCount: edges.length
      },
      confidence: orphanEvidence.length ? 60 : 90,
      evidence: [{
        source: 'evidence_graph_engine',
        evidence_type: 'graph_integrity',
        evidence_code: 'evidence_graph',
        value: { nodeCount: nodes.length, edgeCount: edges.length, orphanCount: orphanEvidence.length },
        confidence: orphanEvidence.length ? 60 : 90,
        timestamp: new Date().toISOString()
      }],
      engine: 'evidence_graph',
      status: 'computed',
      executed: true,
      decisionEligible: orphanEvidence.length === 0
    };
  }
}

module.exports = { EvidenceGraphEngine };
