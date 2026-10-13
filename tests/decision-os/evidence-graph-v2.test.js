'use strict';

const {
  EVIDENCE_GRAPH_VERSION,
  EvidenceGraphEngine
} = require('../../lib/decision-os');

describe('EvidenceGraphEngine V2', () => {
  test('builds source -> observation -> evidence -> engine -> claim -> decision lineage', () => {
    const result = new EvidenceGraphEngine().build({
      requestId: 'req-1',
      workflowId: 'wf-1',
      decision: { primary: 'Proceed' },
      engineResults: {
        feasibility: {
          status: 'computed',
          executed: true,
          decisionEligible: true,
          confidence: 88,
          value: 120,
          evidence: [{
            evidence_code: 'npv',
            value: 120,
            unit: 'SAR',
            source: 'Normalized Metrics DB',
            source_url: 'https://example.test/source',
            observed_at: '2025-12-31',
            confidence: 95,
            truth_contract_version: 'BONDS_TRUTH_V2'
          }]
        }
      }
    });

    expect(result.output.graphVersion).toBe(EVIDENCE_GRAPH_VERSION);
    expect(result.output.nodeCountsByType.source).toBe(1);
    expect(result.output.nodeCountsByType.observation).toBe(1);
    expect(result.output.nodeCountsByType.evidence).toBe(1);
    expect(result.output.nodeCountsByType.engine).toBe(1);
    expect(result.output.nodeCountsByType.claim).toBe(1);
    expect(result.output.nodeCountsByType.decision).toBe(1);

    expect(result.output.edges).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'provides' }),
      expect.objectContaining({ type: 'materializes' }),
      expect.objectContaining({ type: 'supports' }),
      expect.objectContaining({ type: 'produces_claim' }),
      expect.objectContaining({ type: 'supports' })
    ]));

    const decisionNode = result.output.nodes.find(node => node.id === 'decision');
    expect(decisionNode.metadata).toEqual({
      request_id: 'req-1',
      workflow_id: 'wf-1'
    });
    expect(result.decisionEligible).toBe(true);
  });

  test('does not treat generic retrieval timestamp as observation time', () => {
    const result = new EvidenceGraphEngine().build({
      decision: { primary: 'Review' },
      inputEvidence: [{
        evidence_code: 'population',
        value: 1000000,
        source: 'Legacy DB',
        timestamp: '2026-10-13T00:00:00.000Z'
      }]
    });

    const observation = result.output.nodes.find(node => node.type === 'observation');
    expect(observation.observed_at).toBeNull();
    expect(result.output.provenanceGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'observation_time' })
      ])
    );
  });

  test('detects conflicting multi-source evidence for the same claim', () => {
    const result = new EvidenceGraphEngine().build({
      decision: { primary: 'Review' },
      inputEvidence: [
        {
          evidence_code: 'population',
          value: 100,
          source: 'Source A',
          observed_at: '2025-12-31'
        },
        {
          evidence_code: 'population',
          value: 200,
          source: 'Source B',
          observed_at: '2025-12-31'
        }
      ]
    });

    expect(result.output.conflicts).toHaveLength(1);
    expect(result.output.conflicts[0].claim).toBe('population');
    expect(result.status).toBe('conflicted');
    expect(result.decisionEligible).toBe(false);
  });

  test('records provenance gaps without manufacturing source nodes', () => {
    const result = new EvidenceGraphEngine().build({
      decision: { primary: 'Review' },
      inputEvidence: [{
        evidence_code: 'unknown_metric',
        value: 1,
        observed_at: '2025-12-31'
      }]
    });

    expect(result.output.provenanceGaps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'source' })
      ])
    );
    expect(result.output.nodes.some(node => node.type === 'source')).toBe(false);
    expect(result.output.integrityScore).toBeLessThan(100);
  });
});
