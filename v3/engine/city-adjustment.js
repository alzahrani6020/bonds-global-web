/**
 * City Adjustment Engine
 * Adjusts project assumptions based on city economic indicators.
 */

const NATIONAL_BENCHMARKS = {
  avg_rent_per_sqm: 1200,        // SAR per year
  avg_salary: 8000,              // SAR per month
  purchasing_power_index: 100,
  inflation_rate: 2.5,
  growth_rate: 3.0,
  business_ease_index: 70,
  unemployment_rate: 6.0
};

function round(num, decimals = 4) {
  return Number.isFinite(num) ? Number(num.toFixed(decimals)) : num;
}

/**
 * Adjust assumptions based on city indicators and market data.
 * @param {Array} assumptions — project model assumptions
 * @param {Object} cityIndicators — from city_indicators table
 * @param {Object} marketData — from city_market_data table
 * @returns {Object} — { assumptions: adjustedAssumptions, adjustments: [] }
 */
function getBenchmark(benchmarks, code, fallback) {
  const value = benchmarks && benchmarks[code];
  return Number.isFinite(value) ? value : fallback;
}

function adjustAssumptions(assumptions, cityIndicators = {}, marketData = {}, countryBenchmarks = NATIONAL_BENCHMARKS) {
  const adjusted = assumptions.map(a => ({ ...a }));
  const adjustments = [];

  function updateAssumption(code, newValue, reason) {
    const idx = adjusted.findIndex(a => a.code === code);
    if (idx >= 0) {
      const isPercentage = adjusted[idx].unit_type === 'percentage';
      const oldValue = Number(adjusted[idx].value);
      // newValue is in decimal ratio (e.g. 0.14). Convert back to storage format.
      const storageValue = isPercentage ? newValue * 100 : newValue;
      adjusted[idx].value = round(storageValue, isPercentage ? 2 : 4);
      adjustments.push({
        code,
        oldValue,
        newValue: adjusted[idx].value,
        reason,
        source: 'city_indicator'
      });
    }
  }

  // 1. Adjust rent ratio based on city rent per sqm
  if (cityIndicators.avg_rent_per_sqm > 0) {
    const rentRatio = getAssumptionValue(adjusted, 'rent_ratio', 0.10);
    const rentFactor = cityIndicators.avg_rent_per_sqm / getBenchmark(countryBenchmarks, 'avg_rent_per_sqm', NATIONAL_BENCHMARKS.avg_rent_per_sqm);
    const newRentRatio = Math.min(0.30, rentRatio * rentFactor);
    updateAssumption('rent_ratio', newRentRatio, `متوسط الإيجار في المدينة ${cityIndicators.avg_rent_per_sqm} ر.س/م²`);
  }

  // 2. Adjust salaries ratio based on city average salary
  if (cityIndicators.avg_salary > 0 || marketData.avg_salary > 0) {
    const salaryRef = marketData.avg_salary || cityIndicators.avg_salary;
    const salariesRatio = getAssumptionValue(adjusted, 'salaries_ratio', 0.20);
    const salaryFactor = salaryRef / getBenchmark(countryBenchmarks, 'avg_salary', NATIONAL_BENCHMARKS.avg_salary);
    const newSalariesRatio = Math.min(0.50, salariesRatio * salaryFactor);
    updateAssumption('salaries_ratio', newSalariesRatio, `متوسط الراتب في المدينة ${salaryRef.toLocaleString('ar-SA')} ر.س/شهر`);
  }

  // 3. Adjust revenue growth based on city economic growth
  if (cityIndicators.growth_rate > 0) {
    const revenueGrowth = getAssumptionValue(adjusted, 'revenue_growth_rate', 0.05);
    const growthDelta = (cityIndicators.growth_rate - getBenchmark(countryBenchmarks, 'growth_rate', NATIONAL_BENCHMARKS.growth_rate)) * 0.5;
    const newGrowth = Math.max(0.01, Math.min(0.20, revenueGrowth + growthDelta / 100));
    updateAssumption('revenue_growth_rate', newGrowth, `معدل نمو المدينة ${cityIndicators.growth_rate}%`);
  }

  // 4. Adjust discount rate based on inflation
  if (cityIndicators.inflation_rate > 0) {
    const discountRate = getAssumptionValue(adjusted, 'discount_rate', 0.10);
    const inflationDelta = (cityIndicators.inflation_rate - getBenchmark(countryBenchmarks, 'inflation_rate', NATIONAL_BENCHMARKS.inflation_rate)) * 0.3;
    const newDiscount = Math.max(0.05, Math.min(0.20, discountRate + inflationDelta / 100));
    updateAssumption('discount_rate', newDiscount, `معدل التضخم في المدينة ${cityIndicators.inflation_rate}%`);
  }

  // 5. Adjust utilities ratio based on purchasing power (proxy for cost of living)
  if (cityIndicators.purchasing_power_index > 0) {
    const utilitiesRatio = getAssumptionValue(adjusted, 'utilities_ratio', 0.02);
    const ppiFactor = cityIndicators.purchasing_power_index / getBenchmark(countryBenchmarks, 'purchasing_power_index', NATIONAL_BENCHMARKS.purchasing_power_index);
    const newUtilities = Math.min(0.10, utilitiesRatio * ppiFactor);
    updateAssumption('utilities_ratio', newUtilities, `مؤشر القوة الشرائية ${cityIndicators.purchasing_power_index}`);
  }

  return { assumptions: adjusted, adjustments };
}

/**
 * Adjust risk score based on city business environment.
 * @param {number} baseScore
 * @param {Object} cityIndicators
 * @returns {number} adjusted score
 */
function adjustRiskScore(baseScore, cityIndicators = {}, countryBenchmarks = NATIONAL_BENCHMARKS) {
  let adjustment = 0;

  if (cityIndicators.business_ease_index > 0) {
    const easeDelta = cityIndicators.business_ease_index - getBenchmark(countryBenchmarks, 'business_ease_index', NATIONAL_BENCHMARKS.business_ease_index);
    adjustment -= easeDelta * 0.2; // Higher ease = lower risk
  }

  if (cityIndicators.unemployment_rate > 0) {
    const unemploymentDelta = cityIndicators.unemployment_rate - getBenchmark(countryBenchmarks, 'unemployment_rate', NATIONAL_BENCHMARKS.unemployment_rate);
    adjustment += unemploymentDelta * 1.5; // Higher unemployment = higher risk
  }

  return round(Math.min(100, Math.max(0, baseScore + adjustment)), 1);
}

function getAssumptionValue(assumptions, code, fallback = 0) {
  const found = assumptions.find(a => a.code === code);
  if (!found) return fallback;
  const value = Number(found.value);
  if (Number.isNaN(value)) return fallback;
  if (found.unit_type === 'percentage') return value / 100;
  return value;
}

module.exports = {
  adjustAssumptions,
  adjustRiskScore,
  NATIONAL_BENCHMARKS
};
