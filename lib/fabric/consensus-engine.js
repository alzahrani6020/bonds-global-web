/**
 * BONDS Consensus Engine
 *
 * Merges multiple sources for the same metric, detects outliers, and produces
 * a single consensus value with confidence and stored alternatives.
 */

class ConsensusEngine {
  constructor(options = {}) {
    this.outlierThreshold = options.outlierThreshold || 2.0; // std-dev multiplier
  }

  /**
   * Build consensus from an array of metric records.
   * Each record: { sourceId, sourceCode, value, confidence, collectedAt, evidence }
   */
  merge(records, dataType = 'number') {
    if (!Array.isArray(records) || records.length === 0) {
      return {
        value: null,
        confidence: 0,
        method: 'none',
        sources: [],
        alternatives: [],
        isEstimated: true
      };
    }

    if (records.length === 1) {
      const r = records[0];
      return {
        value: r.value,
        confidence: r.confidence || 50,
        method: 'single_source',
        sources: [{ sourceId: r.sourceId, sourceCode: r.sourceCode, confidence: r.confidence }],
        alternatives: [],
        isEstimated: (r.confidence || 0) < 70
      };
    }

    if (dataType === 'text') {
      return this._mergeText(records);
    }

    return this._mergeNumber(records);
  }

  _mergeNumber(records) {
    const numeric = records
      .map(r => ({ ...r, num: Number(r.value) }))
      .filter(r => !isNaN(r.num));

    if (numeric.length === 0) {
      return { value: null, confidence: 0, method: 'no_numeric_values', sources: [], alternatives: records, isEstimated: true };
    }

    const values = numeric.map(r => r.num);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const stdDev = Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);

    const outliers = numeric.filter(r => stdDev > 0 && Math.abs(r.num - mean) > this.outlierThreshold * stdDev);
    const inliers = numeric.filter(r => !outliers.includes(r));

    if (inliers.length === 0) {
      // All values are outliers relative to each other; fall back to best confidence.
      const best = [...numeric].sort((a, b) => (b.confidence || 0) - (a.confidence || 0))[0];
      return {
        value: best.num,
        confidence: Math.round((best.confidence || 50) / 2),
        method: 'high_dispersion_best_confidence',
        sources: [{ sourceId: best.sourceId, sourceCode: best.sourceCode, confidence: best.confidence }],
        alternatives: numeric.filter(r => r !== best).map(r => ({ sourceId: r.sourceId, sourceCode: r.sourceCode, value: r.num, confidence: r.confidence })),
        isEstimated: true
      };
    }

    let totalWeight = 0;
    let weightedSum = 0;
    const sources = [];
    for (const r of inliers) {
      const weight = r.confidence || 50;
      totalWeight += weight;
      weightedSum += r.num * weight;
      sources.push({ sourceId: r.sourceId, sourceCode: r.sourceCode, confidence: r.confidence });
    }

    const value = weightedSum / totalWeight;
    const confidence = Math.round(totalWeight / inliers.length);

    return {
      value,
      confidence: Math.min(100, confidence),
      method: 'weighted_consensus',
      sources,
      alternatives: outliers.map(r => ({ sourceId: r.sourceId, sourceCode: r.sourceCode, value: r.num, confidence: r.confidence, outlier: true })),
      isEstimated: confidence < 70 || inliers.length < 2
    };
  }

  _mergeText(records) {
    const sorted = [...records].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const best = sorted[0];
    return {
      value: best.value,
      confidence: best.confidence || 50,
      method: 'best_confidence_text',
      sources: sorted.map(r => ({ sourceId: r.sourceId, sourceCode: r.sourceCode, confidence: r.confidence })),
      alternatives: sorted.slice(1).map(r => ({ sourceId: r.sourceId, sourceCode: r.sourceCode, value: r.value, confidence: r.confidence })),
      isEstimated: (best.confidence || 0) < 70
    };
  }

  /**
   * Detect if a group of records contains a conflict worth escalating.
   */
  detectConflict(records, threshold = 0.2) {
    if (!records || records.length < 2) return null;
    const numeric = records.map(r => Number(r.value)).filter(n => !isNaN(n));
    if (numeric.length < 2) return null;
    const min = Math.min(...numeric);
    const max = Math.max(...numeric);
    const avg = numeric.reduce((a, b) => a + b, 0) / numeric.length;
    const spread = avg === 0 ? 0 : (max - min) / Math.abs(avg);
    if (spread <= threshold) return null;
    return {
      metricCode: records[0].metricCode,
      spread,
      min,
      max,
      recordCount: numeric.length
    };
  }
}

module.exports = { ConsensusEngine };
