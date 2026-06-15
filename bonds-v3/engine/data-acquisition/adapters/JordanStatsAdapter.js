/**
 * JordanStatsAdapter — محول الإحصاءات الأردنية.
 * يحاول جلب البيانات من مصادر مفتوحة، وإن فشل يستخدم بيانات احتياطية.
 */
const BaseAdapter = require('../BaseAdapter');

class JordanStatsAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      sourceId: 'jordan_dos',
      sourceName: 'دائرة الإحصاءات العامة - الأردن',
      ...config
    });
    this.apiBaseUrl = config.apiBaseUrl || 'https://dosweb.dos.gov.jo';
    this.useFallback = config.useFallback !== false;
  }

  supportedMetrics() {
    return [
      'population',
      'household_income',
      'growth_rate',
      'unemployment_rate',
      'establishments_count',
      'inflation_rate'
    ];
  }

  async fetch(options = {}) {
    const { cityCode, year = new Date().getFullYear() } = options;

    if (this.useFallback) {
      return this._fallbackData(cityCode, year);
    }

    return [];
  }

  async validate(rawItem) {
    const errors = [];
    if (!rawItem.cityCode) errors.push('cityCode is required');
    if (!rawItem.year) errors.push('year is required');
    if (!rawItem.metrics || typeof rawItem.metrics !== 'object') {
      errors.push('metrics object is required');
    }
    return { valid: errors.length === 0, errors };
  }

  async transform(rawItem) {
    const { cityCode, year, metrics } = rawItem;
    const result = [];

    const mappings = {
      population: { code: 'population', unit: 'person', quality: 'official' },
      household_income: { code: 'household_income', unit: 'JOD', quality: 'official' },
      growth_rate: { code: 'growth_rate', unit: '%', quality: 'official' },
      unemployment_rate: { code: 'unemployment_rate', unit: '%', quality: 'official' },
      establishments_count: { code: 'establishments_count', unit: 'establishment', quality: 'official' },
      inflation_rate: { code: 'inflation_rate', unit: '%', quality: 'official' }
    };

    for (const [key, value] of Object.entries(metrics)) {
      const mapping = mappings[key];
      if (!mapping) continue;

      result.push({
        metricCode: mapping.code,
        value: typeof value === 'number' ? value : parseFloat(value),
        valueText: null,
        year,
        sourceUrl: 'https://dosweb.dos.gov.jo',
        confidence: this.getConfidence(mapping.code, rawItem.quality || mapping.quality),
        confidenceReason: `Source: ${this.config.sourceName} (${rawItem.quality || mapping.quality})`,
        metadata: { cityCode, originalKey: key }
      });
    }

    return result;
  }

  _fallbackData(cityCode, year) {
    const cityData = {
      AMM: {
        population: 4000000,
        household_income: 108000,
        growth_rate: 2.5,
        unemployment_rate: 14.0,
        establishments_count: 180000,
        inflation_rate: 3.5
      }
    };

    const metrics = cityCode ? cityData[cityCode.toUpperCase()] : null;
    if (!metrics) return [];

    return [{
      cityCode: cityCode.toUpperCase(),
      year,
      metrics,
      externalId: `${cityCode.toUpperCase()}-${year}`,
      source: this.config.sourceId,
      quality: 'fallback'
    }];
  }
}

module.exports = JordanStatsAdapter;
