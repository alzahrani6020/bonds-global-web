/**
 * LLMEstimationAdapter — محول لتقدير الفجوات باستخدام LLM (OpenAI).
 * يُستخدم فقط عندما لا تتوفر بيانات كافية من مصادر أخرى.
 */
const BaseAdapter = require('../BaseAdapter');

class LLMEstimationAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      sourceId: 'llm_estimation',
      sourceName: 'تقدير ذكي (LLM)',
      ...config
    });
    this.openaiApiKey = config.openaiApiKey || process.env.OPENAI_API_KEY;
    this.model = config.model || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    this.inferenceEngine = config.inferenceEngine;
    this.hasValidOpenAIKey = this._isValidOpenAIKey(this.openaiApiKey);
  }

  _isValidOpenAIKey(key) {
    if (!key) return false;
    const normalized = String(key).trim().toLowerCase();
    if (normalized === 'ollama' || normalized === 'none' || normalized === 'null' || normalized === 'test') return false;
    return true;
  }

  supportedMetrics() {
    return [
      'market_size', 'competitors_count', 'competition_level', 'expected_demand',
      'specialists_count', 'avg_salary', 'labor_availability_score', 'saudization_rate',
      'market_saturation_score'
    ];
  }

  async fetch(options = {}) {
    const { cityCode, activityCode, year = new Date().getFullYear(), metricCodes = [], population } = options;

    const availableMetrics = {};
    if (population) availableMetrics.population = { value: population };

    // إذا لم يكن هناك Inference Engine أو OpenAI key، نستخدم Inference Engine المحلي
    if (this.inferenceEngine) {
      const results = [];
      for (const metricCode of metricCodes) {
        const inferred = this.inferenceEngine.infer(metricCode, {
          cityCode,
          activityCode,
          year,
          availableMetrics
        });
        if (inferred.value !== null || inferred.valueText !== null) {
          results.push({
            cityCode,
            activityCode,
            year,
            metricCode,
            ...inferred,
            source: this.config.sourceId
          });
        }
      }
      return results;
    }

    // TODO: في الإنتاج، استدعاء OpenAI API للحصول على تقديرات أكثر ذكاءً
    return [];
  }

  async validate(rawItem) {
    const errors = [];
    if (!rawItem.metricCode) errors.push('metricCode is required');
    if (rawItem.value === undefined && rawItem.valueText === undefined) {
      errors.push('value or valueText is required');
    }
    return { valid: errors.length === 0, errors };
  }

  async transform(rawItem) {
    return [{
      metricCode: rawItem.metricCode,
      value: rawItem.value !== undefined ? rawItem.value : null,
      valueText: rawItem.valueText !== undefined ? rawItem.valueText : null,
      year: rawItem.year,
      confidence: rawItem.confidence || this.getConfidence(rawItem.metricCode, 'llm'),
      confidenceReason: rawItem.confidenceReason || 'Estimated by inference engine',
      metadata: {
        cityCode: rawItem.cityCode,
        activityCode: rawItem.activityCode,
        model: this.model
      }
    }];
  }

  getConfidence() {
    return 40;
  }
}

module.exports = LLMEstimationAdapter;
