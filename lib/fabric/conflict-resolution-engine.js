/**
 * BONDS Conflict Resolution Engine
 *
 * Explains conflicts, picks the strongest evidence/source, computes confidence,
 * and supports manual override with full audit.
 */

class ConflictResolutionEngine {
  constructor(options = {}) {
    this.defaultPolicy = options.defaultPolicy || 'highest_confidence';
  }

  /**
   * Resolve a conflict among metric records.
   * policy: 'highest_confidence' | 'highest_ranked' | 'most_recent' | 'manual'
   */
  resolve(records, policy = this.defaultPolicy, overrideSourceId) {
    if (!records || records.length === 0) {
      throw new Error('Cannot resolve conflict with no records');
    }

    let selected;
    let method = policy;

    switch (policy) {
      case 'highest_confidence':
        selected = [...records].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
        break;
      case 'most_recent':
        selected = [...records].sort((a, b) => new Date(b.collectedAt || 0) - new Date(a.collectedAt || 0))[0];
        break;
      case 'highest_ranked':
        selected = [...records].sort((a, b) => (b.rankScore || 0) - (a.rankScore || 0))[0];
        break;
      case 'manual':
        selected = records.find(r => r.sourceId === overrideSourceId);
        if (!selected) throw new Error(`Manual override source ${overrideSourceId} not found in conflict`);
        method = 'manual_override';
        break;
      default:
        selected = [...records].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
    }

    const explanation = this._explain(records, selected, method);

    return {
      metricCode: records[0].metricCode,
      sourceValues: records.map(r => ({
        sourceId: r.sourceId,
        sourceCode: r.sourceCode,
        value: r.value,
        confidence: r.confidence,
        collectedAt: r.collectedAt
      })),
      selectedSourceId: selected.sourceId,
      selectedValue: selected.value,
      confidence: selected.confidence,
      resolutionMethod: method,
      explanation,
      resolvedAt: new Date().toISOString()
    };
  }

  _explain(records, selected, method) {
    const others = records.filter(r => r.sourceId !== selected.sourceId);
    const reason = method === 'manual_override'
      ? `Selected manually from ${records.length} conflicting sources.`
      : `Selected by ${method} from ${records.length} conflicting sources.`;
    return {
      summary: `${reason} Winning source: ${selected.sourceCode || selected.sourceId} (confidence ${selected.confidence}).`,
      alternatives: others.map(r => `${r.sourceCode || r.sourceId}: ${JSON.stringify(r.value)} (confidence ${r.confidence})`),
      evidence: selected.evidence || null
    };
  }
}

module.exports = { ConflictResolutionEngine };
