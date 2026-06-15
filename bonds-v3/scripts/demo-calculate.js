/**
 * Bonds V3 — Calculation Engine Demo
 *
 * Runs the calculator against a hard-coded sample project model.
 * No database required.
 */

const { calculate, recommend } = require('../engine/calculator');
const { generateInsights } = require('../engine/ai');

const sampleModel = {
  projectModel: {
    id: 'model-burger-001',
    code: 'burger_restaurant_small',
    name_ar: 'مطعم برجر صغير',
    name_en: 'Small Burger Restaurant',
    revenue_min: 400000,
    revenue_max: 800000,
    capex_min: 300000,
    capex_max: 600000
  },
  assumptions: [
    { code: 'vat_rate', value: 15, unit_type: 'percentage' },
    { code: 'corporate_tax_rate', value: 20, unit_type: 'percentage' },
    { code: 'annual_depreciation_rate', value: 10, unit_type: 'percentage' },
    { code: 'cogs_ratio', value: 35, unit_type: 'percentage' },
    { code: 'rent_ratio', value: 10, unit_type: 'percentage' },
    { code: 'salaries_ratio', value: 20, unit_type: 'percentage' },
    { code: 'marketing_ratio', value: 3, unit_type: 'percentage' },
    { code: 'utilities_ratio', value: 2, unit_type: 'percentage' },
    { code: 'working_capital_days', value: 30, unit_type: 'days' },
    { code: 'revenue_growth_rate', value: 5, unit_type: 'percentage' },
    { code: 'discount_rate', value: 10, unit_type: 'percentage' },
    { code: 'loan_ratio', value: 50, unit_type: 'percentage' },
    { code: 'interest_rate', value: 8, unit_type: 'percentage' },
    { code: 'loan_term_years', value: 5, unit_type: 'count' }
  ],
  risks: [
    { risk_factor_id: 'rf-1', code: 'market_saturation', weight: 1.2, score: 70 },
    { risk_factor_id: 'rf-2', code: 'financing_risk', weight: 1.0, score: 40 },
    { risk_factor_id: 'rf-3', code: 'operational_complexity', weight: 1.0, score: 50 },
    { risk_factor_id: 'rf-4', code: 'licensing_complexity', weight: 0.9, score: 35 },
    { risk_factor_id: 'rf-5', code: 'labor_availability', weight: 1.1, score: 60 },
    { risk_factor_id: 'rf-6', code: 'environmental_risk', weight: 0.8, score: 20 }
  ],
  cityRiskAdjustments: []
};

const marketData = {
  market_saturation_score: 75,
  purchasing_power_index: 100
};

console.log('======================================');
console.log('Bonds V3 — Calculation Engine Demo');
console.log('======================================\n');

const result = calculate(sampleModel, {
  revenue: 600000,
  capex: 450000,
  projectionYears: 5
});

console.log('Model:', result.model.name_ar);
console.log('Investment:', result.investment);
console.log('Summary:', result.summary);
console.log('Risk:', result.risk);
console.log('Basic Recommendation:', recommend(result, marketData));
(async () => {
  console.log('\nAI Insights:', await generateInsights(result, marketData, 'الرياض'));
})();
console.log('\nProjections:');
console.table(result.projections);

if (result.loan.loanAmount > 0) {
  console.log('\nLoan Schedule:');
  console.table(result.loan.schedule);
}
