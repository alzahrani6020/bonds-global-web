/**
 * BaseAdapter —统一的数据源适配器接口。
 * 所有具体适配器（Gastat、Sama、Manual、LLM...）必须继承此类。
 */
class BaseAdapter {
  constructor(config = {}) {
    this.config = {
      sourceId: config.sourceId || this.constructor.name,
      sourceName: config.sourceName || this.constructor.name,
      timeoutMs: config.timeoutMs || 30000,
      ...config
    };
  }

  /**
   * 从数据源获取原始数据。
   * @param {Object} options — { cityId, cityCode, activityId, activityCode, year, ... }
   * @returns {Promise<Array>} — 原始数据对象数组
   */
  async fetch(options) {
    throw new Error('fetch() must be implemented by subclass');
  }

  /**
   * 验证原始数据项是否有效。
   * @param {Object} rawItem
   * @returns {Promise<{valid: boolean, errors: string[]}>}
   */
  async validate(rawItem) {
    const errors = [];
    if (rawItem === null || rawItem === undefined) {
      errors.push('rawItem is null or undefined');
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * 将原始数据转换为统一的 normalized metric 格式。
   * @param {Object} rawItem
   * @returns {Promise<Array<Object>>} — [{ metricCode, value, valueText, year, confidence, ... }]
   */
  async transform(rawItem) {
    throw new Error('transform() must be implemented by subclass');
  }

  /**
   * 根据指标和来源质量计算置信度（0-100）。
   * @param {string} metricCode
   * @param {string} sourceQuality — 'official' | 'estimated' | 'manual' | 'scraped'
   * @returns {number}
   */
  getConfidence(metricCode, sourceQuality = 'estimated') {
    const baseConfidence = {
      official: 95,
      open_data: 80,
      google_places: 85,
      manual: 85,
      scraped: 60,
      mixed: 55,
      estimated: 50,
      fallback: 45,
      llm: 40
    };
    return baseConfidence[sourceQuality] ?? 50;
  }

  /**
   * 适配器支持的指标列表（子类可覆盖）。
   * @returns {Array<string>}
   */
  supportedMetrics() {
    return [];
  }

  /**
   * 是否为该指标的推荐来源（子类可覆盖）。
   * @param {string} metricCode
   * @returns {boolean}
   */
  isPreferredFor(metricCode) {
    return this.supportedMetrics().includes(metricCode);
  }
}

module.exports = BaseAdapter;
