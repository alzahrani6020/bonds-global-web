/**
 * FusionCore — 融合来自多个来源的同一指标，输出单一可信值。
 * 规则：
 * 1. 过滤过期数据
 * 2. 根据置信度和时间赋予权重
 * 3. 计算加权平均值（数值型）或选择最佳文本值
 * 4. 若无可信来源，返回 null 并标记为需推断
 */
class FusionCore {
  constructor(options = {}) {
    this.maxAgeDays = options.maxAgeDays || 730; // 默认2年
    this.confidenceDecayPerYear = options.confidenceDecayPerYear || 10; // 每年衰减10分
  }

  /**
   * 融合多个同一指标的测量值。
   * @param {Array} metrics — [{ value, valueText, sourceId, confidence, fetchedAt, isOverride }, ...]
   * @param {string} dataType — 'number' | 'percent' | 'currency' | 'index' | 'text'
   * @returns {Object} — { value, valueText, confidence, sources, method, isEstimated }
   */
  fuse(metrics, dataType = 'number') {
    if (!Array.isArray(metrics) || metrics.length === 0) {
      return { value: null, valueText: null, confidence: 0, sources: [], method: 'none', isEstimated: true };
    }

    // 优先使用手动覆盖值
    const override = metrics.find(m => m.isOverride);
    if (override) {
      const overrideConfidence = Number.isFinite(Number(override.confidence))
        ? Math.max(0, Math.min(100, Number(override.confidence)))
        : 95;
      return {
        value: override.value,
        valueText: override.valueText,
        confidence: overrideConfidence,
        sources: [{ sourceId: override.sourceId, confidence: overrideConfidence }],
        method: 'override',
        isEstimated: false
      };
    }

    // 过滤过期数据
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.maxAgeDays * 24 * 60 * 60 * 1000);
    const freshMetrics = metrics.filter(m => {
      if (!m.fetchedAt) return true;
      const fetched = new Date(m.fetchedAt);
      if (Number.isNaN(fetched.getTime())) return true;
      return fetched >= cutoff;
    });

    if (freshMetrics.length === 0) {
      return { value: null, valueText: null, confidence: 0, sources: [], method: 'stale', isEstimated: true };
    }

    if (dataType === 'text') {
      return this._fuseText(freshMetrics);
    }

    return this._fuseNumber(freshMetrics);
  }

  _fuseNumber(metrics) {
    let totalWeight = 0;
    let weightedSum = 0;
    const sources = [];

    let validCount = 0;
    for (const m of metrics) {
      const statedConfidence = Number.isFinite(Number(m.confidence)) ? Number(m.confidence) : 50;
      let timeDecay = 0;
      let freshnessKnown = false;

      if (m.fetchedAt) {
        const fetched = new Date(m.fetchedAt);
        if (!Number.isNaN(fetched.getTime())) {
          freshnessKnown = true;
          const ageYears = Math.max(0, (new Date() - fetched) / (365 * 24 * 60 * 60 * 1000));
          timeDecay = ageYears * this.confidenceDecayPerYear;
        }
      }

      // Unknown observation time is not treated as fresh. Keep the measurement
      // available, but reduce its evidence weight explicitly.
      const unknownFreshnessPenalty = freshnessKnown ? 0 : 25;
      const confidence = Math.max(0, statedConfidence - timeDecay - unknownFreshnessPenalty);
      const weight = confidence;

      const value = typeof m.value === 'number' ? m.value : parseFloat(m.value);
      if (Number.isNaN(value)) continue;

      weightedSum += value * weight;
      totalWeight += weight;
      validCount++;
      sources.push({
        sourceId: m.sourceId,
        confidence: Math.round(confidence),
        freshnessKnown
      });
    }

    if (totalWeight === 0) {
      return { value: null, valueText: null, confidence: 0, sources, method: 'unweighted', isEstimated: true };
    }

    const fusedValue = weightedSum / totalWeight;
    const avgConfidence = validCount ? Math.round(totalWeight / validCount) : 0;

    return {
      value: fusedValue,
      valueText: null,
      confidence: avgConfidence,
      sources,
      method: 'weighted_average',
      isEstimated: avgConfidence < 70
    };
  }

  _fuseText(metrics) {
    // 选择置信度最高的文本值
    const score = m => Number.isFinite(Number(m.confidence)) ? Number(m.confidence) : 50;
    const sorted = [...metrics].sort((a, b) => score(b) - score(a));
    const best = sorted[0];
    const bestConfidence = score(best);
    return {
      value: null,
      valueText: best.valueText || best.value,
      confidence: bestConfidence,
      sources: sorted.map(m => ({ sourceId: m.sourceId, confidence: score(m) })),
      method: 'best_confidence',
      isEstimated: bestConfidence < 70
    };
  }
}

module.exports = FusionCore;
