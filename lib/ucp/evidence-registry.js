/**
 * BONDS UCP Evidence Registry
 *
 * Collects explainability evidence for every calculation run.
 */

class EvidenceRegistry {
  constructor({ evidence = [], supabase = null } = {}) {
    this.evidence = evidence;
    this.supabase = supabase;
  }

  add({ evidenceType, evidenceCode, source, value, confidence, metadata = {} }) {
    this.evidence.push({
      evidence_type: evidenceType,
      evidence_code: evidenceCode,
      source,
      value,
      confidence,
      metadata,
      created_at: new Date().toISOString()
    });
  }

  addFormula(code, expression, value) {
    this.add({ evidenceType: 'formula', evidenceCode: code, source: 'formula_registry', value: { expression, result: value }, confidence: 1 });
  }

  addBusinessFormula(code, expression, value) {
    this.add({ evidenceType: 'business_formula', evidenceCode: code, source: 'ucp_business_formula_registry', value: { expression, result: value }, confidence: 1 });
  }

  addRule(code, result) {
    this.add({ evidenceType: 'rule', evidenceCode: code, source: 'business_rules_registry', value: result, confidence: result.pass ? 1 : 0 });
  }

  addPolicy(code, result) {
    this.add({ evidenceType: 'policy', evidenceCode: code, source: 'ucp_policy_registry', value: result, confidence: result.status === 'pass' ? 1 : 0 });
  }

  addInput(code, value, source = 'user') {
    this.add({ evidenceType: 'input', evidenceCode: code, source, value, confidence: value === undefined || value === null ? 0 : 1 });
  }

  addAssumption(code, value, reason) {
    this.add({ evidenceType: 'assumption', evidenceCode: code, source: 'configuration', value, confidence: 0.8, metadata: { reason } });
  }

  list() { return this.evidence; }

  async persist(calculationRunId) {
    if (!this.supabase || !calculationRunId) return;
    const rows = this.evidence.map(e => ({
      calculation_run_id: calculationRunId,
      evidence_type: e.evidence_type,
      evidence_code: e.evidence_code,
      source: e.source,
      value: e.value,
      confidence: e.confidence,
      metadata: e.metadata
    }));
    await this.supabase.from('ucp_evidence').insert(rows);
  }
}

module.exports = { EvidenceRegistry };
