'use strict';

const EVIDENCE_GRAPH_VERSION = 'BONDS_EVIDENCE_GRAPH_V2';

function safeId(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.:-]+/g, '_');
}

function valueSignature(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'object') {
    try { return JSON.stringify(value); } catch (_) { return String(value); }
  }
  return String(value);
}

class EvidenceGraphEngine {
  build(context = {}) {
    const nodes = [];
    const edges = [];
    const seen = new Set();
    const provenanceGaps = [];

    const addNode = (node) => {
      if (!node || !node.id || seen.has(node.id)) return;
      seen.add(node.id);
      nodes.push(node);
    };

    const addEdge = (from, to, type, metadata = null) => {
      if (!from || !to) return;
      edges.push({ from, to, type, metadata });
    };

    const decisionLabel = context.decision?.primary || context.recommendation || 'Decision';
    addNode({
      id: 'decision',
      type: 'decision',
      label: decisionLabel,
      metadata: {
        request_id: context.requestId || null,
        workflow_id: context.workflowId || null
      }
    });

    const addEvidenceLineage = ({
      item,
      evidenceId,
      targetId,
      relation = 'supports',
      engineCode = null,
      evidenceType = 'evidence'
    }) => {
      const sourceName = item?.source || item?.source_name || item?.metadata?.source || null;
      const sourceId = sourceName ? `source:${safeId(sourceName)}` : null;
      const observedAt =
        item?.observation_at ||
        item?.observed_at ||
        item?.period ||
        item?.metadata?.observed_at ||
        item?.metadata?.sourcePeriod ||
        null;

      if (!sourceName) provenanceGaps.push({ evidenceId, field: 'source' });
      if (!observedAt) provenanceGaps.push({ evidenceId, field: 'observation_time' });

      if (sourceId) {
        addNode({
          id: sourceId,
          type: 'source',
          label: sourceName,
          source_type: item?.source_type || item?.metadata?.source_type || null,
          source_url: item?.source_url || item?.metadata?.source_url || null
        });
      }

      const observationId = `observation:${safeId(evidenceId)}`;
      addNode({
        id: observationId,
        type: 'observation',
        label: item?.evidence_code || item?.code || item?.field || 'observation',
        observed_at: observedAt,
        period: item?.period || item?.metadata?.sourcePeriod || null,
        confidence: item?.confidence ?? null,
        metadata: item?.metadata || null
      });

      if (sourceId) addEdge(sourceId, observationId, 'provides');

      addNode({
        id: evidenceId,
        type: evidenceType,
        label: item?.evidence_code || item?.code || item?.field || 'evidence',
        value: item?.value,
        unit: item?.unit || null,
        confidence: item?.confidence ?? null,
        source: sourceName,
        timestamp: item?.timestamp || item?.created_at || null,
        validation_status: item?.validation_status || null,
        truth_contract_version: item?.truth_contract_version || null,
        metadata: item?.metadata || null
      });
      addEdge(observationId, evidenceId, 'materializes');

      const transformation = item?.transformation || item?.metadata?.transformation || null;
      if (transformation) {
        const transformationId = `transformation:${safeId(evidenceId)}`;
        addNode({
          id: transformationId,
          type: 'transformation',
          label: typeof transformation === 'string' ? transformation : (transformation.name || 'transformation'),
          metadata: typeof transformation === 'object' ? transformation : null
        });
        addEdge(evidenceId, transformationId, 'transformed_by');
        addEdge(transformationId, targetId, relation);
      } else {
        addEdge(evidenceId, targetId, relation);
      }

      return { sourceId, observationId, evidenceId, engineCode };
    };

    for (const [engineCode, result] of Object.entries(context.engineResults || {})) {
      const engineId = `engine:${safeId(engineCode)}`;
      addNode({
        id: engineId,
        type: 'engine',
        label: engineCode,
        confidence: result?.confidence ?? null,
        status: result?.status || null,
        executed: result?.executed === true,
        decision_eligible: result?.decisionEligible !== false
      });

      const claimValue =
        result?.output?.primary ??
        result?.recommendation ??
        result?.decision ??
        result?.value ??
        null;
      const claimId = `claim:${safeId(engineCode)}`;
      addNode({
        id: claimId,
        type: 'claim',
        label: `${engineCode}_claim`,
        value: claimValue,
        confidence: result?.confidence ?? null,
        status: result?.status || null
      });

      const calculation = result?.calculation || result?.calculationTrace || result?.formula || null;
      if (calculation) {
        const calculationId = `calculation:${safeId(engineCode)}`;
        addNode({
          id: calculationId,
          type: 'calculation',
          label: `${engineCode}_calculation`,
          metadata: typeof calculation === 'object' ? calculation : { expression: calculation }
        });
        addEdge(engineId, calculationId, 'calculates');
        addEdge(calculationId, claimId, 'supports_claim');
      } else {
        addEdge(engineId, claimId, 'produces_claim');
      }
      addEdge(claimId, 'decision', 'supports');

      for (const item of result?.evidence || []) {
        const evidenceId = `evidence:${safeId(engineCode)}:${safeId(item.evidence_code || item.code || nodes.length)}`;
        addEvidenceLineage({
          item,
          evidenceId,
          targetId: engineId,
          relation: 'supports',
          engineCode,
          evidenceType: 'evidence'
        });
      }
    }

    for (const item of context.inputEvidence || []) {
      const evidenceId = `input:${safeId(item.evidence_code || item.field || item.source || nodes.length)}`;
      const target = item.targetEngine ? `engine:${safeId(item.targetEngine)}` : 'decision';
      addEvidenceLineage({
        item,
        evidenceId,
        targetId: target,
        relation: 'feeds',
        evidenceType: 'input_evidence'
      });
    }

    const evidenceNodes = nodes.filter(node => node.type === 'evidence' || node.type === 'input_evidence');
    const orphanEvidence = evidenceNodes.filter(node =>
      !edges.some(edge => edge.from === node.id || edge.to === node.id)
    );

    const evidenceGroups = new Map();
    for (const node of evidenceNodes) {
      const key = node.label || node.id;
      if (!evidenceGroups.has(key)) evidenceGroups.set(key, []);
      evidenceGroups.get(key).push(node);
    }

    const conflicts = [];
    for (const [claim, group] of evidenceGroups.entries()) {
      const signatures = new Set(group.map(node => valueSignature(node.value)));
      const sources = new Set(group.map(node => node.source).filter(Boolean));
      if (group.length > 1 && signatures.size > 1 && sources.size > 1) {
        conflicts.push({
          claim,
          evidence_ids: group.map(node => node.id),
          sources: [...sources],
          values: [...signatures]
        });
      }
    }

    const nodeCountsByType = {};
    for (const node of nodes) nodeCountsByType[node.type] = (nodeCountsByType[node.type] || 0) + 1;

    const integrityScore = Math.max(
      0,
      100 - (orphanEvidence.length * 30) - (provenanceGaps.length * 5) - (conflicts.length * 10)
    );

    return {
      output: {
        graphVersion: EVIDENCE_GRAPH_VERSION,
        nodes,
        edges,
        orphanEvidence: orphanEvidence.map(node => node.id),
        provenanceGaps,
        conflicts,
        nodeCountsByType,
        nodeCount: nodes.length,
        edgeCount: edges.length,
        integrityScore
      },
      confidence: integrityScore,
      evidence: [{
        source: 'evidence_graph_engine',
        evidence_type: 'graph_integrity',
        evidence_code: 'evidence_graph',
        value: {
          graphVersion: EVIDENCE_GRAPH_VERSION,
          nodeCount: nodes.length,
          edgeCount: edges.length,
          orphanCount: orphanEvidence.length,
          provenanceGapCount: provenanceGaps.length,
          conflictCount: conflicts.length,
          integrityScore
        },
        confidence: integrityScore,
        timestamp: new Date().toISOString()
      }],
      engine: 'evidence_graph',
      status: conflicts.length ? 'conflicted' : 'computed',
      executed: true,
      decisionEligible: orphanEvidence.length === 0 && conflicts.length === 0
    };
  }
}

module.exports = { EVIDENCE_GRAPH_VERSION, EvidenceGraphEngine };
