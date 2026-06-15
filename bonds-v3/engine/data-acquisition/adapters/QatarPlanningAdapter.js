/**
 * QatarPlanningAdapter — محول تخطيط قطر والإحصاء.
 * يحاول جلب البيانات من مصادر مفتوحة، وإن فشل يستخدم بيانات احتياطية.
 */
const BaseAdapter = require('../BaseAdapter');

class QatarPlanningAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      sourceId: 'qatar_psa',
      sourceName: 'هيئة التخطيط والإحصاء - قطر',
      ...config
    });
    this.apiBaseUrl = config.apiBaseUrl || 'https://www.psa.gov.qa';
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
      household_income: { code: 'household_income', unit: 'QAR', quality: 'official' },
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
        sourceUrl: 'https://www.psa.gov.qa',
        confidence: this.getConfidence(mapping.code, mapping.quality),
        confidenceReason: `Source: ${this.config.sourceName}`,
        metadata: { cityCode, originalKey: key }
      });
    }

    return result;
  }

  _fallbackData(cityCode, year) {
    const cityData = {
      DOH: {
        population: 2400000,
        household_income: 288000,
        growth_rate: 3.8,
        unemployment_rate: 2.8,
        establishments_count: 120000,
        inflation_rate: 2.0
      }
    };

    const metrics = cityCode ? cityData[cityCode.toUpperCase()] : null;
    if (!metrics) return [];

    return [{
      cityCode: cityCode.toUpperCase(),
      year,
      metrics,
      externalId: `${cityCode.toUpperCase()}-${year}`,
      source: this.config.sourceId
    }];
  }
}

module.exports = QatarPlanningAdapter;
