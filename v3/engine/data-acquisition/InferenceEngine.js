/**
 * InferenceEngine — 当没有可信数据源时，使用算法和基准数据推断指标。
 * 这不是机器学习模型，而是一组基于已知关系的启发式规则。
 */
class InferenceEngine {
  constructor(baseData = {}) {
    this.baseData = baseData;
    this.cityBenchmarks = baseData.cityBenchmarks || {};
    this.activityBenchmarks = baseData.activityBenchmarks || {};
  }

  /**
   * 推断缺失指标。
   * @param {string} metricCode
   * @param {Object} context — { cityId, cityCode, activityId, activityCode, year, availableMetrics }
   * @param {Object} corrections — { metricCode: { factor, feedbackCount, confidence } }
   * @returns {Object} — { value, valueText, confidence, confidenceReason }
   */
  infer(metricCode, context = {}, corrections = {}) {
    const { cityCode, activityCode, availableMetrics = {} } = context;

    let result;
    switch (metricCode) {
      case 'gdp_city':
        result = this._inferCityGdp(cityCode, availableMetrics);
        break;
      case 'purchasing_power_index':
        result = this._inferPurchasingPower(cityCode, availableMetrics);
        break;
      case 'business_ease_index':
        result = this._inferBusinessEase(cityCode, availableMetrics);
        break;
      case 'avg_rent_per_sqm':
        result = this._inferRentPerSqm(cityCode, activityCode, availableMetrics);
        break;
      case 'market_size':
        result = this._inferMarketSizeWithML(cityCode, activityCode, availableMetrics) ||
                 this._inferMarketSize(cityCode, activityCode, availableMetrics);
        break;
      case 'competitors_count':
        result = this._inferCompetitorsWithML(cityCode, activityCode, availableMetrics) ||
                 this._inferCompetitors(cityCode, activityCode, availableMetrics);
        break;
      case 'specialists_count':
        result = this._inferSpecialists(cityCode, activityCode, availableMetrics);
        break;
      case 'avg_salary':
        result = this._inferAvgSalary(cityCode, activityCode, availableMetrics);
        break;
      case 'labor_availability_score':
        result = this._inferLaborAvailability(cityCode, activityCode, availableMetrics);
        break;
      case 'saudization_rate':
        result = this._inferSaudizationRate(cityCode, activityCode, availableMetrics);
        break;
      case 'market_saturation_score':
        result = this._inferMarketSaturation(cityCode, activityCode, availableMetrics);
        break;
      case 'expected_demand':
        result = this._inferDemand(cityCode, activityCode, availableMetrics);
        break;
      case 'competition_level':
        result = this._inferCompetitionLevel(cityCode, activityCode, availableMetrics);
        break;
      default:
        result = { value: null, valueText: null, confidence: 0, confidenceReason: 'No inference rule for this metric' };
    }

    // Apply feedback-based correction if available
    const correction = corrections[metricCode];
    if (correction && correction.factor && correction.factor !== 1 && result.value !== null) {
      result.value = Math.round(result.value * correction.factor);
      result.confidence = Math.min(100, result.confidence + Math.min(20, correction.confidence / 5));
      result.confidenceReason += ` (مصحح بمعلومات المستخدمين: ${correction.feedbackCount} ملاحظات)`;
    }

    return result;
  }

  _inferCityGdp(cityCode, availableMetrics) {
    const population = availableMetrics.population?.value || 1000000;
    const baseIncome = this._getBenchmark('avg_salary', 8000) * 12;
    const gdpPerCapita = baseIncome * 1.2; // rough GDP per capita from income
    const cityMultiplier = this._citySizeMultiplier(cityCode);
    const maxGdp = 999999999999.99; // numeric(14,2) max integer digits = 12
    const value = Math.min(maxGdp, Math.round(population * gdpPerCapita * cityMultiplier));
    return {
      value,
      valueText: null,
      confidence: 45,
      confidenceReason: 'Estimated from population and national income benchmark'
    };
  }

  _inferPurchasingPower(cityCode, availableMetrics) {
    const householdIncome = availableMetrics.household_income?.value || 150000;
    const baseIncome = this._getBenchmark('avg_salary', 8000) * 12;
    const value = Math.round((householdIncome / Math.max(baseIncome, 1)) * 100);
    return {
      value,
      valueText: null,
      confidence: 55,
      confidenceReason: 'Estimated from household income benchmark'
    };
  }

  _inferBusinessEase(cityCode, availableMetrics) {
    const base = this._getBenchmark('business_ease_index', 70);
    const value = Math.round(base / this._citySizeMultiplier(cityCode));
    return {
      value,
      valueText: null,
      confidence: 40,
      confidenceReason: 'Estimated from city size and regulatory complexity assumptions'
    };
  }

  _inferRentPerSqm(cityCode, activityCode, availableMetrics) {
    const baseRent = this._getBenchmark('avg_rent_per_sqm', 1200);
    const cityMultiplier = this._citySizeMultiplier(cityCode);
    const activityMultiplier = this._activityRentMultiplier(activityCode);
    const value = Math.round(baseRent * cityMultiplier * activityMultiplier);
    return {
      value,
      valueText: null,
      confidence: 50,
      confidenceReason: 'Estimated from city size and activity type benchmarks'
    };
  }

  _inferWithML(metricCode, availableMetrics, featureKeys) {
    const models = this.baseData?.regressionModels;
    if (!models || !models.length) return null;

    const estimator = new (require('../ml/RegressionEstimator'))(models);
    const features = {};
    for (const key of featureKeys) {
      features[key] = availableMetrics[key]?.value;
    }
    const prediction = estimator.predict(metricCode, features, { maxMape: 60, minSamples: 5, allowMissing: true });
    if (!prediction) return null;

    return {
      value: Math.round(prediction.value),
      valueText: null,
      confidence: prediction.confidence,
      confidenceReason: `ML estimate (${prediction.model.featureKeys.join(', ')}) — R²=${prediction.model.rSquared.toFixed(2)}, MAPE=${prediction.model.mape.toFixed(1)}%, n=${prediction.model.sampleCount}`
    };
  }

  _inferMarketSizeWithML(cityCode, activityCode, availableMetrics) {
    return this._inferWithML('market_size', availableMetrics, [
      'population', 'household_income', 'purchasing_power_index', 'growth_rate', 'unemployment_rate'
    ]);
  }

  _inferCompetitorsWithML(cityCode, activityCode, availableMetrics) {
    return this._inferWithML('competitors_count', availableMetrics, [
      'population', 'market_size', 'avg_salary', 'market_saturation_score'
    ]);
  }

  _inferMarketSize(cityCode, activityCode, availableMetrics) {
    const population = availableMetrics.population?.value || 1000000;
    const income = availableMetrics.household_income?.value || (this._getBenchmark('avg_salary', 8000) * 12);
    // 市场规模 = 人口 × 目标渗透率 × 人均年消费
    const penetration = this._activityPenetration(activityCode);
    const spending = (income / 12) * 0.05; // 假设5%月收入用于该活动
    const maxMarketSize = 999999999999.99; // numeric(14,2) max integer digits = 12
    const value = Math.min(maxMarketSize, Math.round(population * penetration * spending));
    return {
      value,
      valueText: null,
      confidence: 40,
      confidenceReason: 'Estimated from population, income, and assumed penetration rate'
    };
  }

  _inferCompetitors(cityCode, activityCode, availableMetrics) {
    const population = availableMetrics.population?.value || 1000000;
    // Use country-specific benchmark if available, otherwise activity default
    const defaultDensity = this._activityCompetitorDensity(activityCode);
    const benchmarkKey = activityCode ? `competitors_per_10k_${activityCode}` : null;
    const density = benchmarkKey
      ? this._getBenchmark(benchmarkKey, defaultDensity)
      : defaultDensity;
    const value = Math.round((population / 10000) * density);
    return {
      value,
      valueText: null,
      confidence: 45,
      confidenceReason: 'Estimated from population and activity competitor density benchmark'
    };
  }

  _inferSpecialists(cityCode, activityCode, availableMetrics) {
    const population = availableMetrics.population?.value || 1000000;
    const density = this._activitySpecialistDensity(activityCode);
    const value = Math.round((population / 10000) * density);
    return {
      value,
      valueText: null,
      confidence: 45,
      confidenceReason: 'Estimated from population and activity specialist density benchmark'
    };
  }

  _inferAvgSalary(cityCode, activityCode, availableMetrics) {
    const base = this._getBenchmark('avg_salary', 8000);
    const cityMultiplier = this._citySizeMultiplier(cityCode);
    const activityMultiplier = this._activitySalaryMultiplier(activityCode);
    const value = Math.round(base * cityMultiplier * activityMultiplier);
    return {
      value,
      valueText: null,
      confidence: 45,
      confidenceReason: 'Estimated from national salary benchmark, city size and activity'
    };
  }

  _inferLaborAvailability(cityCode, activityCode, availableMetrics) {
    const unemployment = availableMetrics.unemployment_rate?.value || this._getBenchmark('unemployment_rate', 6);
    // Higher unemployment = lower availability
    const value = Math.max(10, Math.min(95, Math.round(100 - unemployment * 5)));
    return {
      value,
      valueText: null,
      confidence: 40,
      confidenceReason: 'Estimated from unemployment rate'
    };
  }

  _inferSaudizationRate(cityCode, activityCode, availableMetrics) {
    const code = (activityCode || '').toLowerCase();
    let rate = 30;
    if (code.includes('medical') || code.includes('dental') || code.includes('pharmacy')) rate = 45;
    if (code.includes('restaurant') || code.includes('cafe') || code.includes('retail')) rate = 20;
    if (code.includes('factory') || code.includes('manufacturing')) rate = 35;
    return {
      value: rate,
      valueText: null,
      confidence: 35,
      confidenceReason: 'Estimated from activity type benchmark'
    };
  }

  _inferMarketSaturation(cityCode, activityCode, availableMetrics) {
    const population = availableMetrics.population?.value || 1000000;
    const competitors = availableMetrics.competitors_count?.value;
    if (competitors > 0) {
      // competitors per 10k population
      const density = (competitors / population) * 10000;
      const value = Math.max(10, Math.min(95, Math.round(density * 10)));
      return {
        value,
        valueText: null,
        confidence: 45,
        confidenceReason: 'Estimated from competitors density'
      };
    }
    return {
      value: 50,
      valueText: null,
      confidence: 30,
      confidenceReason: 'Default saturation assumption'
    };
  }

  _inferDemand(cityCode, activityCode, availableMetrics) {
    const saturation = availableMetrics.market_saturation_score?.value || 50;
    const growth = availableMetrics.annual_growth_rate?.value || 5;
    let demand = 'medium';
    if (saturation < 40 && growth > 8) demand = 'high';
    if (saturation > 70 && growth < 3) demand = 'low';
    return {
      value: null,
      valueText: demand,
      confidence: 50,
      confidenceReason: 'Estimated from market saturation and growth rate'
    };
  }

  _inferCompetitionLevel(cityCode, activityCode, availableMetrics) {
    const saturation = availableMetrics.market_saturation_score?.value || 50;
    let level = 'medium';
    if (saturation >= 70) level = 'high';
    if (saturation <= 40) level = 'low';
    return {
      value: null,
      valueText: level,
      confidence: 55,
      confidenceReason: 'Estimated from market saturation score'
    };
  }

  // ===== Helpers =====

  _citySizeMultiplier(cityCode) {
    const tiers = {
      RUH: 1.3, JED: 1.25, DMM: 1.15, MAK: 1.1, MED: 1.05,
      BAH: 1.05, TAB: 0.95, ABH: 0.9, HOF: 0.85, TAQ: 0.8,
      KHU: 0.85, BUR: 0.8, YNB: 0.75, JUB: 0.85, HAI: 0.8,
      DXB: 1.35, AUH: 1.25, DOH: 1.2, CAI: 1.3, ALY: 1.1, AMM: 1.05
    };
    return tiers[cityCode?.toUpperCase()] || 1.0;
  }

  _getBenchmark(metricCode, fallback) {
    const value = this.baseData?.countryBenchmarks?.[metricCode];
    return Number.isFinite(value) ? value : fallback;
  }

  _activityRentMultiplier(activityCode) {
    // 零售/餐饮通常高于仓库/工厂
    const code = (activityCode || '').toLowerCase();
    if (code.includes('restaurant') || code.includes('retail') || code.includes('cafe')) return 1.2;
    if (code.includes('clinic') || code.includes('pharmacy')) return 1.1;
    if (code.includes('warehouse')) return 0.6;
    if (code.includes('factory') || code.includes('manufacturing')) return 0.5;
    return 1.0;
  }

  _activityPenetration(activityCode) {
    const code = (activityCode || '').toLowerCase();
    if (code.includes('restaurant') || code.includes('cafe')) return 0.3;
    if (code.includes('retail') || code.includes('supermarket')) return 0.6;
    if (code.includes('clinic') || code.includes('pharmacy')) return 0.15;
    if (code.includes('gym') || code.includes('beauty')) return 0.1;
    return 0.05;
  }

  _activityCompetitorDensity(activityCode) {
    const code = (activityCode || '').toLowerCase();
    if (code.includes('restaurant') || code.includes('cafe')) return 8;
    if (code.includes('retail') || code.includes('supermarket')) return 5;
    if (code.includes('clinic') || code.includes('pharmacy')) return 3;
    if (code.includes('gym') || code.includes('beauty')) return 2;
    return 1;
  }

  _activitySalaryMultiplier(activityCode) {
    const code = (activityCode || '').toLowerCase();
    if (code.includes('medical') || code.includes('dental') || code.includes('doctor')) return 1.4;
    if (code.includes('engineer') || code.includes('it')) return 1.3;
    if (code.includes('accountant') || code.includes('finance')) return 1.2;
    if (code.includes('restaurant') || code.includes('cafe') || code.includes('retail')) return 0.7;
    return 1.0;
  }

  _activitySpecialistDensity(activityCode) {
    const code = (activityCode || '').toLowerCase();
    if (code.includes('medical') || code.includes('dental') || code.includes('doctor')) return 5;
    if (code.includes('engineer') || code.includes('it')) return 3;
    if (code.includes('accountant') || code.includes('finance')) return 2;
    return 1;
  }
}

module.exports = InferenceEngine;
