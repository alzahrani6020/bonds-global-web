/**
 * BenchmarkAdapter — مصدر بيانات مرجعية من Bonds V3.
 * يقدّر المؤشرات حسب المدينة والنشاط من جداول benchmark JSON داخلية.
 * يُستخدم كمصدر أساسي عند عدم توفر بيانات رسمية، وكاحتياطي عند فشل المصادر الأخرى.
 */
const fs = require('fs');
const path = require('path');
const BaseAdapter = require('../BaseAdapter');

const BENCHMARK_DIR = path.join(__dirname, '..', 'benchmarks');

function loadJson(name) {
  const file = path.join(BENCHMARK_DIR, `${name}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.warn(`[BenchmarkAdapter] Failed to load ${name}.json:`, err.message);
    return {};
  }
}

const ACTIVITY_CATEGORY_MAP = [
  // Food & beverage
  { test: /restaurant|food_beverage_restaurants|food_industries_restaurants/, category: 'restaurant' },
  { test: /cafe|coffee_shop|food_beverage_cafes|food_industries_cafes/, category: 'cafe' },
  { test: /fast_food|food_truck|catering/, category: 'fast_food' },
  // Retail & commerce
  { test: /retail|commerce_retail|ecommerce_retail|small_supermarket|supermarket|grocery/, category: 'retail' },
  { test: /wholesale|import_export/, category: 'wholesale' },
  { test: /ecommerce|online_store/, category: 'ecommerce' },
  // Health
  { test: /dental_clinics/, category: 'dental_clinics' },
  { test: /pharmacy/, category: 'pharmacy' },
  { test: /clinic|medical|dermatology|ophthalmology|pediatric/, category: 'medical_clinic' },
  { test: /hospital/, category: 'hospital' },
  // Beauty & wellness
  { test: /beauty/, category: 'beauty' },
  { test: /gym|fitness|sports/, category: 'gym' },
  // Education
  { test: /school|education_schools|training|elearning|university/, category: 'education' },
  // Industrial
  { test: /factory|industrial|manufacturing|workshop|packaging|assembly/, category: 'industrial' },
  { test: /warehouse|cold_warehouses|dry_warehouses|logistics|transport|shipping|last_mile/, category: 'logistics' },
  // Real estate
  { test: /real_estate|brokerage|residential|commercial_property/, category: 'real_estate' },
  // Technology
  { test: /software|it_services|technology|cybersecurity|artificial_intelligence|hospitality_software|facilities_management_software|furniture_software|environment_sustainability_software|security_safety_software/, category: 'technology' },
  { test: /hardware|telecom/, category: 'technology_hardware' },
  // Professional services
  { test: /consulting|advertising_consulting|consulting_consulting|human_resources_consulting|commercial_brokerage_consulting|automotive_consulting|aviation_consulting|awqaf_consulting|creative_economy_consulting|culture_consulting|fisheries_consulting|geology_consulting|hajj_umrah_consulting|heavy_equipment_consulting|laboratories_consulting|mining_consulting|poultry_consulting|private_aviation_consulting|water_consulting|well_drilling_consulting|public_services_consulting/, category: 'consulting' },
  { test: /cleaning|maintenance|security|advertising_cleaning|advertising_maintenance|advertising_security/, category: 'facility_services' },
  // Agriculture
  { test: /agriculture|farming|livestock|fisheries|poultry|agricultural_inputs/, category: 'agriculture' },
  // Energy
  { test: /energy|oil_gas|renewable|utilities|efficiency/, category: 'energy' },
  // Financial
  { test: /banking|fintech|insurance|investment|financial/, category: 'financial' },
  // Tourism & entertainment
  { test: /tourism|entertainment|events|media|sports_economy|hospitality/, category: 'tourism' },
  // Public services
  { test: /public_services|awqaf|culture|research_development|desertification_control|ports|mining|geology|water|well_drilling|metal_refineries|oil_refineries|pharmaceutical_industries|chemical_industries/, category: 'public_industrial' }
];

function getActivityCategory(activityCode) {
  if (!activityCode) return 'default';
  const code = String(activityCode).toLowerCase();
  for (const rule of ACTIVITY_CATEGORY_MAP) {
    if (rule.test.test(code)) return rule.category;
  }
  return 'default';
}

class BenchmarkAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      sourceId: config.sourceId || 'bonds_benchmark',
      sourceName: config.sourceName || 'بيانات Bonds المرجعية',
      ...config
    });
    this.benchmarks = {
      realEstate: loadJson('real-estate'),
      labor: loadJson('labor'),
      market: loadJson('market'),
      pricing: loadJson('pricing')
    };
  }

  supportedMetrics() {
    return [
      'avg_rent_per_sqm', 'avg_land_price_per_sqm', 'warehouse_rent_per_sqm', 'factory_rent_per_sqm',
      'specialists_count', 'avg_salary', 'labor_availability_score', 'saudization_rate',
      'market_size', 'annual_growth_rate', 'per_capita_spending', 'expected_demand',
      'profit_margin_min', 'profit_margin_avg', 'profit_margin_max', 'risk_score',
      'construction_cost_per_sqm', 'equipment_cost_min', 'equipment_cost_avg', 'equipment_cost_max',
      'monthly_operation_cost_min', 'monthly_operation_cost_avg', 'monthly_operation_cost_max'
    ];
  }

  async fetch(options = {}) {
    const { cityCode, activityCode, population = 1000000, year = new Date().getFullYear() } = options;
    const category = getActivityCategory(activityCode);
    const results = [];

    for (const metricCode of this.supportedMetrics()) {
      const value = this._getMetric(metricCode, cityCode, activityCode, category, population);
      if (value !== null && value !== undefined) {
        results.push({
          cityCode,
          activityCode,
          year,
          metricCode,
          value,
          source: this.config.sourceId,
          quality: 'benchmark'
        });
      }
    }

    return results;
  }

  async validate(rawItem) {
    const errors = [];
    if (!rawItem.metricCode) errors.push('metricCode is required');
    if (rawItem.value === undefined || rawItem.value === null) errors.push('value is required');
    return { valid: errors.length === 0, errors };
  }

  async transform(rawItem) {
    const isText = typeof rawItem.value === 'string';
    return [{
      metricCode: rawItem.metricCode,
      value: isText ? null : rawItem.value,
      valueText: isText ? rawItem.value : (rawItem.valueText || null),
      year: rawItem.year,
      sourceUrl: 'https://bonds-global.com/methodology',
      confidence: this.getConfidence(rawItem.metricCode, 'benchmark'),
      confidenceReason: `Source: ${this.config.sourceName} (activity category: ${getActivityCategory(rawItem.activityCode)})`,
      metadata: {
        cityCode: rawItem.cityCode,
        activityCode: rawItem.activityCode,
        quality: rawItem.quality
      }
    }];
  }

  getConfidence(metricCode, sourceQuality) {
    // Benchmark data is considered more reliable than pure LLM estimation.
    if (sourceQuality === 'benchmark') return 65;
    return super.getConfidence(metricCode, sourceQuality);
  }

  _getMetric(metricCode, cityCode, activityCode, category, population) {
    if (metricCode.startsWith('avg_rent') || metricCode.startsWith('avg_land') || metricCode === 'warehouse_rent_per_sqm' || metricCode === 'factory_rent_per_sqm') {
      return this._realEstateMetric(metricCode, cityCode, category);
    }
    if (metricCode === 'specialists_count' || metricCode === 'avg_salary' || metricCode === 'labor_availability_score' || metricCode === 'saudization_rate') {
      return this._laborMetric(metricCode, cityCode, category, population);
    }
    if (metricCode === 'market_size' || metricCode === 'annual_growth_rate' || metricCode === 'per_capita_spending' || metricCode === 'expected_demand' || metricCode.startsWith('profit_margin_') || metricCode === 'risk_score') {
      return this._marketMetric(metricCode, cityCode, category, population);
    }
    if (metricCode.startsWith('construction') || metricCode.startsWith('equipment') || metricCode.startsWith('monthly_operation')) {
      return this._pricingMetric(metricCode, cityCode, category);
    }
    return null;
  }

  _realEstateMetric(metricCode, cityCode, category) {
    const b = this.benchmarks.realEstate;
    const base = b?.base?.[metricCode];
    if (base === undefined) return null;
    const activity = b?.activities?.[category] || b?.activities?.default || {};
    const factorKey = metricCode.includes('rent') ? 'rent_factor' : 'land_factor';
    const activityFactor = activity[factorKey] ?? activity.multiplier ?? 1;

    // City table may contain absolute values or a multiplier.
    const cityEntry = b?.cities?.[cityCode];
    if (cityEntry && cityEntry[metricCode] !== undefined) {
      return Math.round(cityEntry[metricCode] * activityFactor);
    }

    const cityMultiplier = cityEntry?.multiplier ?? 1;
    return Math.round(base * cityMultiplier * activityFactor);
  }

  _laborMetric(metricCode, cityCode, category, population) {
    const b = this.benchmarks.labor;
    if (metricCode === 'specialists_count') {
      const density = b?.activities?.[category]?.specialists_per_10k ?? b?.activities?.default?.specialists_per_10k ?? 2;
      return Math.round((population / 10000) * density);
    }
    if (metricCode === 'avg_salary') {
      const base = b?.base?.avg_salary ?? 6000;
      const cityFactor = b?.cities?.[cityCode]?.salary_factor ?? b?.cities?.[cityCode]?.multiplier ?? 1;
      const activityFactor = b?.activities?.[category]?.salary_factor ?? b?.activities?.default?.salary_factor ?? 1;
      return Math.round(base * cityFactor * activityFactor);
    }
    if (metricCode === 'labor_availability_score') {
      return b?.activities?.[category]?.labor_availability_score ?? b?.activities?.default?.labor_availability_score ?? 70;
    }
    if (metricCode === 'saudization_rate') {
      return b?.activities?.[category]?.saudization_rate ?? b?.activities?.default?.saudization_rate ?? 30;
    }
    return null;
  }

  _marketMetric(metricCode, cityCode, category, population) {
    const b = this.benchmarks.market;
    const activity = b?.activities?.[category] || b?.activities?.default || {};
    const cityMultiplier = b?.cities?.[cityCode]?.multiplier ?? 1;

    if (metricCode === 'annual_growth_rate') {
      return activity.annual_growth_rate ?? 4.0;
    }
    if (metricCode === 'per_capita_spending') {
      const base = activity.per_capita_spending ?? 1200;
      return Math.round(base * cityMultiplier);
    }
    if (metricCode === 'market_size') {
      const perCapita = activity.per_capita_spending ?? 1200;
      const penetration = activity.penetration_rate ?? 1.0;
      return Math.round(population * perCapita * penetration * cityMultiplier);
    }
    if (metricCode === 'expected_demand') {
      const marketSize = this._marketMetric('market_size', cityCode, category, population);
      if (marketSize > 5000000) return 'high';
      if (marketSize > 1500000) return 'medium';
      return 'low';
    }
    if (metricCode === 'profit_margin_min') return activity.profit_margin_avg ? activity.profit_margin_avg * 0.5 : 10;
    if (metricCode === 'profit_margin_avg') return activity.profit_margin_avg ?? 18;
    if (metricCode === 'profit_margin_max') return activity.profit_margin_avg ? Math.min(50, activity.profit_margin_avg * 1.4) : 35;
    if (metricCode === 'risk_score') {
      // Simple heuristic: higher growth and lower saturation = lower risk
      const growth = activity.annual_growth_rate ?? 4;
      const saturation = 50;
      let risk = 50;
      risk += Math.max(-15, Math.min(15, (saturation - 50) / 2));
      risk -= Math.max(-10, Math.min(10, (growth - 5)));
      // Activity volatility adjustment
      const volatile = ['restaurant', 'cafe', 'retail', 'tourism'];
      if (volatile.includes(category)) risk += 5;
      return Math.max(10, Math.min(90, Math.round(risk)));
    }
    return null;
  }

  _pricingMetric(metricCode, cityCode, category) {
    const b = this.benchmarks.pricing;
    const activity = b?.activities?.[category] || b?.activities?.default || {};
    const cityMultiplier = b?.cities?.[cityCode]?.multiplier ?? 1;

    if (metricCode === 'construction_cost_per_sqm') {
      return Math.round((activity.construction_cost_per_sqm ?? 2000) * cityMultiplier);
    }
    if (metricCode.startsWith('equipment_cost_')) {
      const suffix = metricCode.replace('equipment_cost_', '');
      return Math.round((activity[`equipment_cost_${suffix}`] ?? 100000) * cityMultiplier);
    }
    if (metricCode.startsWith('monthly_operation_cost_')) {
      const suffix = metricCode.replace('monthly_operation_cost_', '');
      return Math.round((activity[`monthly_operation_cost_${suffix}`] ?? 20000) * cityMultiplier);
    }
    return null;
  }
}

module.exports = BenchmarkAdapter;
module.exports.getActivityCategory = getActivityCategory;
