/**
 * ManualAdapter — محول للبيانات المدخلة يدوياً من فريق بوندز أو المستخدم.
 */
const BaseAdapter = require('../BaseAdapter');

class ManualAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      sourceId: 'manual',
      sourceName: 'إدخال يدوي',
      ...config
    });
  }

  supportedMetrics() {
    return [
      'population', 'household_income', 'purchasing_power_index', 'gdp_city',
      'growth_rate', 'unemployment_rate', 'establishments_count', 'inflation_rate',
      'business_ease_index', 'avg_rent_per_sqm', 'avg_land_price_per_sqm',
      'warehouse_rent_per_sqm', 'factory_rent_per_sqm', 'specialists_count',
      'avg_salary', 'labor_availability_score', 'saudization_rate',
      'competitors_count', 'competition_level', 'market_saturation_score',
      'market_size', 'annual_growth_rate', 'per_capita_spending', 'expected_demand',
      'construction_cost_per_sqm', 'equipment_cost_min', 'equipment_cost_avg',
      'equipment_cost_max'
    ];
  }

  async fetch(options = {}) {
    // البيانات اليدوية لا تجلب، بل تُمرر مباشرة في options.manualData
    const { manualData = [] } = options;
    return manualData.map(item => ({
      ...item,
      source: this.config.sourceId,
      isManual: true
    }));
  }

  async validate(rawItem) {
    const errors = [];
    if (!rawItem.metricCode) errors.push('metricCode is required');
    if (rawItem.value === undefined && rawItem.valueText === undefined) {
      errors.push('value or valueText is required');
    }
    if (!rawItem.year) errors.push('year is required');
    return { valid: errors.length === 0, errors };
  }

  async transform(rawItem) {
    return [{
      metricCode: rawItem.metricCode,
      value: rawItem.value !== undefined ? rawItem.value : null,
      valueText: rawItem.valueText !== undefined ? rawItem.valueText : null,
      year: rawItem.year,
      sourceUrl: rawItem.sourceUrl,
      confidence: this.getConfidence(rawItem.metricCode, 'manual'),
      confidenceReason: rawItem.confidenceReason || 'Manually entered by admin',
      isOverride: rawItem.isOverride !== false,
      metadata: {
        enteredBy: rawItem.enteredBy,
        notes: rawItem.notes
      }
    }];
  }

  getConfidence() {
    return 85;
  }
}

module.exports = ManualAdapter;
