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
      return {
        value: override.value,
        valueText: override.valueText,
        confidence: Math.min(override.confidence || 95, 100),
        sources: [{ sourceId: override.sourceId, confidence: override.confidence }],
        method: 'override',
        isEstimated: false
      };
    }

    // 过滤过期数据
    const now = new Date();
    const cutoff = new Date(now.getTime() - this.maxAgeDays * 24 * 60 * 60 * 1000);
    const freshMetrics = metrics.filter(m => {
      const fetched = m.fetchedAt ? new Date(m.fetchedAt) : now;
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

    for (const m of metrics) {
      const fetched = m.fetchedAt ? new Date(m.fetchedAt) : new Date();
      const ageYears = (new Date() - fetched) / (365 * 24 * 60 * 60 * 1000);
      const timeDecay = Math.max(0, ageYears * this.confidenceDecayPerYear);
      const confidence = Math.max(0, (m.confidence || 50) - timeDecay);
      const weight = confidence;

      const value = typeof m.value === 'number' ? m.value : parseFloat(m.value);
      if (isNaN(value)) continue;

      weightedSum += value * weight;
      totalWeight += weight;
      sources.push({ sourceId: m.sourceId, confidence: Math.round(confidence) });
    }

    if (totalWeight === 0) {
      return { value: null, valueText: null, confidence: 0, sources, method: 'unweighted', isEstimated: true };
    }

    const fusedValue = weightedSum / totalWeight;
    const avgConfidence = Math.round(totalWeight / metrics.length);

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
    const sorted = [...metrics].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
    const best = sorted[0];
    return {
      value: null,
      valueText: best.valueText || best.value,
      confidence: best.confidence || 50,
      sources: sorted.map(m => ({ sourceId: m.sourceId, confidence: m.confidence })),
      method: 'best_confidence',
      isEstimated: (best.confidence || 0) < 70
    };
  }
}

module.exports = FusionCore;
