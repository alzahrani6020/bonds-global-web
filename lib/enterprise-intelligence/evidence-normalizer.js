/**
 * BONDS Enterprise Intelligence Evidence Normalizer
 *
 * Converts heterogeneous engine outputs into a single canonical evidence schema.
 */

function normalizeEvidence(items, { engine, runId, provenanceId }) {
  if (!Array.isArray(items)) items = [items];
  return items
    .filter(Boolean)
    .map(item => ({
      run_id: runId,
      engine,
      evidence_type: item.evidence_type || item.type || 'observation',
      evidence_code: item.evidence_code || item.code || item.field || null,
      source: item.source || engine,
      source_id: item.source_id || null,
      value: item.value !== undefined ? item.value : null,
      confidence: item.confidence !== undefined ? Math.round(item.confidence) : null,
      provenance_id: item.provenance_id || provenanceId || null,
      metadata: item.metadata || item.evidence || null
    }));
}

function normalizeBlindSpot(spot, runId) {
  return {
    run_id: runId,
    project_id: spot.projectId || null,
    field: spot.field,
    category: spot.category,
    severity: spot.severity,
    expected_value: spot.expectedValue !== undefined ? spot.expectedValue : null,
    actual_value: spot.actualValue !== undefined ? spot.actualValue : null,
    benchmark_source: spot.benchmarkSource || null,
    recommendation: spot.recommendation || null,
    confidence: spot.confidence !== undefined ? Math.round(spot.confidence) : null
  };
}

function normalizeRecommendation(rec, runId) {
  return {
    run_id: runId,
    project_id: rec.projectId || null,
    rank: rec.rank || 0,
    title: rec.title,
    description: rec.description || null,
    rationale: rec.rationale || null,
    action_type: rec.actionType || rec.action_type || null,
    expected_impact: rec.expectedImpact || rec.expected_impact || {},
    confidence: rec.confidence !== undefined ? Math.round(rec.confidence) : null,
    evidence_ids: rec.evidenceIds || rec.evidence_ids || []
  };
}

module.exports = {
  normalizeEvidence,
  normalizeBlindSpot,
  normalizeRecommendation
};
