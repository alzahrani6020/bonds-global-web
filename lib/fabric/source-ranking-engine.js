/**
 * BONDS Source Ranking Engine
 *
 * Computes dynamic trust scores for every data source.
 */

const DEFAULT_WEIGHTS = {
  trust: 0.20,
  reliability: 0.15,
  availability: 0.15,
  freshness: 0.15,
  coverage: 0.10,
  accuracy: 0.10,
  consistency: 0.05,
  historicalSuccess: 0.05,
  responseTime: 0.05
};

class SourceRankingEngine {
  constructor(weights = {}) {
    this.weights = { ...DEFAULT_WEIGHTS, ...weights };
  }

  /**
   * Compute a full ranking for a source.
   * Input is a source record plus optional runtime signals.
   */
  rank(source, signals = {}) {
    const scores = {
      trust: this._trustScore(source, signals),
      reliability: this._reliabilityScore(source, signals),
      availability: this._availabilityScore(source, signals),
      freshness: this._freshnessScore(source, signals),
      coverage: this._coverageScore(source, signals),
      accuracy: this._accuracyScore(source, signals),
      consistency: this._consistencyScore(source, signals),
      historicalSuccess: this._historicalSuccessScore(source, signals),
      responseTime: this._responseTimeScore(source, signals)
    };

    const overall = Math.round(
      Object.entries(this.weights).reduce((sum, [key, weight]) => {
        return sum + (scores[key] || 0) * weight;
      }, 0)
    );

    return {
      sourceId: source.id,
      sourceCode: source.source_code,
      scores,
      overallScore: Math.min(100, Math.max(0, overall)),
      weights: this.weights,
      scoredAt: new Date().toISOString()
    };
  }

  _trustScore(source) {
    const anchor = source.trust_anchor || source.confidence_default || 'estimated';
    const map = { official: 95, open_data: 80, manual: 85, scraped: 60, mixed: 55, estimated: 50, fallback: 45, llm: 40 };
    return map[anchor] || 50;
  }

  _reliabilityScore(source, signals) {
    if (signals.reliability !== undefined) return this._clamp(signals.reliability);
    if (source.status === 'active') return 80;
    if (source.status === 'deprecated') return 50;
    return 30;
  }

  _availabilityScore(source, signals) {
    if (signals.uptime !== undefined) return this._clamp(signals.uptime);
    if (source.status === 'active') return 90;
    return 40;
  }

  _freshnessScore(source, signals) {
    if (signals.freshness !== undefined) return this._clamp(signals.freshness);
    const last = source.last_run_at;
    if (!last) return 50;
    const days = (Date.now() - new Date(last).getTime()) / (24 * 60 * 60 * 1000);
    return this._clamp(100 - days * 5);
  }

  _coverageScore(source) {
    const countries = source.supported_countries?.length || 0;
    const industries = source.supported_industries?.length || 0;
    return this._clamp(50 + countries * 2 + industries * 2);
  }

  _accuracyScore(source, signals) {
    if (signals.accuracy !== undefined) return this._clamp(signals.accuracy);
    return source.metadata?.accuracyScore || 70;
  }

  _consistencyScore(source, signals) {
    if (signals.consistency !== undefined) return this._clamp(signals.consistency);
    return source.metadata?.consistencyScore || 70;
  }

  _historicalSuccessScore(source, signals) {
    if (signals.historicalSuccess !== undefined) return this._clamp(signals.historicalSuccess);
    return source.metadata?.historicalSuccessScore || 70;
  }

  _responseTimeScore(source, signals) {
    if (signals.latencyMs !== undefined) {
      return this._clamp(Math.max(0, 100 - signals.latencyMs / 10));
    }
    return 70;
  }

  _clamp(n) {
    return Math.min(100, Math.max(0, Math.round(Number(n) || 0)));
  }
}

module.exports = { SourceRankingEngine, DEFAULT_WEIGHTS };
