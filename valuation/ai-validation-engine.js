/**
 * BONDS AI Validation Engine
 *
 * Validates valuation inputs and engine outputs BEFORE any AI narrative
 * or official certificate is generated.  Purely deterministic: no AI here.
 *
 * Exposes:
 *   BondsAiValidationEngine.validate(context)
 *
 * context = {
 *   assetClass,           // e.g. 'realEstate'
 *   inputs,               // raw user inputs
 *   result,               // ValuationEngine.calculate() output
 *   marketData,           // MarketIntelligenceClient.getData() output
 *   conditionAssessment,  // BondsConditionAssessmentEngine output
 *   riskAssessment,       // BondsRiskIntelligenceEngine output
 *   economicLife,         // EconomicLifeClient.computeRemainingLife() output
 *   depreciationResult    // DepreciationEngine.calculate() output
 * }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    root.BondsAiValidationEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const CURRENT_YEAR = new Date().getFullYear();

  const clamp = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);
  const safe = (v) => Number(v) || 0;
  const isPresent = (v) => v !== undefined && v !== null && v !== '';
  const isPositiveNumber = (v) => isPresent(v) && Number.isFinite(Number(v)) && Number(v) >= 0;
  const isPositiveNonZero = (v) => isPresent(v) && Number.isFinite(Number(v)) && Number(v) > 0;

  const ASSET_RULES = {
    realEstate: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'city', labelAr: 'المدينة', labelEn: 'City' },
        { key: 'yearBuilt', labelAr: 'سنة البناء', labelEn: 'Year Built' },
        { key: 'areaSqm', labelAr: 'المساحة (م²)', labelEn: 'Area (sqm)' },
        { key: 'purchasePrice', labelAr: 'سعر الشراء', labelEn: 'Purchase Price' },
        { key: 'comparablePricePerSqm', labelAr: 'سعر المتر المقارن', labelEn: 'Comparable Price/sqm' }
      ],
      crossChecks: [
        {
          nameAr: 'سنة البناء منطقية',
          nameEn: 'Year built is reasonable',
          test: (i) => safe(i.yearBuilt) >= 1800 && safe(i.yearBuilt) <= CURRENT_YEAR + 1
        },
        {
          nameAr: 'المساحة أكبر من صفر',
          nameEn: 'Area is positive',
          test: (i) => isPositiveNonZero(i.areaSqm)
        },
        {
          nameAr: 'سعر الشراء غير سالب',
          nameEn: 'Purchase price is non-negative',
          test: (i) => isPositiveNumber(i.purchasePrice)
        }
      ]
    },
    business: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'city', labelAr: 'المدينة', labelEn: 'City' },
        { key: 'annualRevenue', labelAr: 'الإيرادات السنوية', labelEn: 'Annual Revenue' },
        { key: 'ebitdaMargin', labelAr: 'هامش EBITDA', labelEn: 'EBITDA Margin' },
        { key: 'totalDebt', labelAr: 'إجمالي الديون', labelEn: 'Total Debt' },
        { key: 'cashAndEquiv', labelAr: 'النقدية وما يعادلها', labelEn: 'Cash & Equivalents' }
      ],
      crossChecks: [
        {
          nameAr: 'الإيرادات السنوية موجبة',
          nameEn: 'Annual revenue is positive',
          test: (i) => isPositiveNumber(i.annualRevenue)
        },
        {
          nameAr: 'هامش EBITDA بين 0 و 1',
          nameEn: 'EBITDA margin is between 0 and 1',
          test: (i) => clamp(i.ebitdaMargin, 0, 1) === safe(i.ebitdaMargin)
        }
      ]
    },
    factory: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'city', labelAr: 'المدينة', labelEn: 'City' },
        { key: 'landCost', labelAr: 'تكلفة الأرض', labelEn: 'Land Cost' },
        { key: 'buildingCost', labelAr: 'تكلفة المبنى', labelEn: 'Building Cost' },
        { key: 'machineryCost', labelAr: 'تكلفة المعدات', labelEn: 'Machinery Cost' },
        { key: 'annualCapacityUnits', labelAr: 'الطاقة الإنتاجية السنوية', labelEn: 'Annual Capacity' }
      ],
      crossChecks: [
        {
          nameAr: 'تكلفة الأرض غير سالبة',
          nameEn: 'Land cost is non-negative',
          test: (i) => isPositiveNumber(i.landCost)
        },
        {
          nameAr: 'الطاقة الإنتاجية أكبر من صفر',
          nameEn: 'Capacity is positive',
          test: (i) => isPositiveNonZero(i.annualCapacityUnits)
        }
      ]
    },
    machineryEquipment: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'yearAcquired', labelAr: 'سنة الشراء', labelEn: 'Year Acquired' },
        { key: 'purchasePrice', labelAr: 'سعر الشراء', labelEn: 'Purchase Price' },
        { key: 'usefulLifeYears', labelAr: 'العمر الافتراضي', labelEn: 'Useful Life (years)' }
      ],
      crossChecks: [
        {
          nameAr: 'سنة الشراء منطقية',
          nameEn: 'Year acquired is reasonable',
          test: (i) => safe(i.yearAcquired) >= 1950 && safe(i.yearAcquired) <= CURRENT_YEAR + 1
        },
        {
          nameAr: 'العمر الافتراضي أكبر من صفر',
          nameEn: 'Useful life is positive',
          test: (i) => isPositiveNonZero(i.usefulLifeYears)
        }
      ]
    },
    vehiclesFleet: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'yearAcquired', labelAr: 'سنة الشراء', labelEn: 'Year Acquired' },
        { key: 'purchasePrice', labelAr: 'سعر الشراء', labelEn: 'Purchase Price' },
        { key: 'mileageKm', labelAr: 'المسافة المقطوعة', labelEn: 'Mileage (km)' }
      ],
      crossChecks: [
        {
          nameAr: 'سنة الشراء منطقية',
          nameEn: 'Year acquired is reasonable',
          test: (i) => safe(i.yearAcquired) >= 1950 && safe(i.yearAcquired) <= CURRENT_YEAR + 1
        }
      ]
    },
    agricultureFarms: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'city', labelAr: 'المدينة', labelEn: 'City' },
        { key: 'landArea', labelAr: 'مساحة الأرض', labelEn: 'Land Area' },
        { key: 'purchasePrice', labelAr: 'سعر الشراء', labelEn: 'Purchase Price' }
      ],
      crossChecks: [
        {
          nameAr: 'مساحة الأرض أكبر من صفر',
          nameEn: 'Land area is positive',
          test: (i) => isPositiveNonZero(i.landArea)
        }
      ]
    },
    hotels: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'city', labelAr: 'المدينة', labelEn: 'City' },
        { key: 'numberOfRooms', labelAr: 'عدد الغرف', labelEn: 'Number of Rooms' },
        { key: 'annualRevenue', labelAr: 'الإيرادات السنوية', labelEn: 'Annual Revenue' }
      ],
      crossChecks: [
        {
          nameAr: 'عدد الغرف أكبر من صفر',
          nameEn: 'Room count is positive',
          test: (i) => isPositiveNonZero(i.numberOfRooms)
        }
      ]
    },
    restaurants: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'city', labelAr: 'المدينة', labelEn: 'City' },
        { key: 'monthlyRevenue', labelAr: 'الإيرادات الشهرية', labelEn: 'Monthly Revenue' },
        { key: 'monthlyCosts', labelAr: 'التكاليف الشهرية', labelEn: 'Monthly Costs' }
      ],
      crossChecks: [
        {
          nameAr: 'الإيرادات الشهرية غير سالبة',
          nameEn: 'Monthly revenue is non-negative',
          test: (i) => isPositiveNumber(i.monthlyRevenue)
        }
      ]
    },
    hospitals: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'city', labelAr: 'المدينة', labelEn: 'City' },
        { key: 'numberOfBeds', labelAr: 'عدد الأسرة', labelEn: 'Number of Beds' },
        { key: 'annualRevenue', labelAr: 'الإيرادات السنوية', labelEn: 'Annual Revenue' }
      ],
      crossChecks: [
        {
          nameAr: 'عدد الأسرة أكبر من صفر',
          nameEn: 'Bed count is positive',
          test: (i) => isPositiveNonZero(i.numberOfBeds)
        }
      ]
    },
    scrapSalvage: {
      criticalFields: [
        { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
        { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
        { key: 'weightKg', labelAr: 'الوزن (كجم)', labelEn: 'Weight (kg)' },
        { key: 'scrapRatePerKg', labelAr: 'سعر الكيلو', labelEn: 'Rate per kg' }
      ],
      crossChecks: [
        {
          nameAr: 'الوزن أكبر من صفر',
          nameEn: 'Weight is positive',
          test: (i) => isPositiveNonZero(i.weightKg)
        }
      ]
    }
  };

  // Fallback rule for any asset class not explicitly mapped.
  const DEFAULT_RULE = {
    criticalFields: [
      { key: 'assetName', labelAr: 'اسم الأصل', labelEn: 'Asset Name' },
      { key: 'country', labelAr: 'الدولة', labelEn: 'Country' },
      { key: 'city', labelAr: 'المدينة', labelEn: 'City' },
      { key: 'yearAcquired', labelAr: 'سنة الشراء', labelEn: 'Year Acquired' },
      { key: 'purchasePrice', labelAr: 'سعر الشراء', labelEn: 'Purchase Price' }
    ],
    crossChecks: [
      {
        nameAr: 'سنة الشراء منطقية',
        nameEn: 'Year acquired is reasonable',
        test: (i) => !isPresent(i.yearAcquired) || (safe(i.yearAcquired) >= 1950 && safe(i.yearAcquired) <= CURRENT_YEAR + 1)
      },
      {
        nameAr: 'سعر الشراء غير سالب',
        nameEn: 'Purchase price is non-negative',
        test: (i) => isPositiveNumber(i.purchasePrice)
      }
    ]
  };

  function getRule(assetClass) {
    return ASSET_RULES[assetClass] || DEFAULT_RULE;
  }

  function checkCompleteness(rule, inputs) {
    const missing = [];
    let presentCount = 0;
    for (const field of rule.criticalFields) {
      if (isPresent(inputs[field.key])) {
        presentCount++;
      } else {
        missing.push(field);
      }
    }
    const total = rule.criticalFields.length || 1;
    const score = Math.round((presentCount / total) * 100);
    return { score, missing };
  }

  function checkCrossChecks(rule, inputs) {
    const failures = [];
    for (const check of rule.crossChecks || []) {
      try {
        if (!check.test(inputs)) {
          failures.push({ ar: check.nameAr, en: check.nameEn });
        }
      } catch (e) {
        failures.push({ ar: check.nameAr, en: check.nameEn });
      }
    }
    return failures;
  }

  function detectOutliers(result) {
    const outliers = [];
    if (!result) return outliers;

    const fair = safe(result.fairValue);
    const market = safe(result.marketValue);
    const book = safe(result.bookValue);
    const investment = safe(result.investmentValue);
    const liquidation = safe(result.liquidationValue);

    if (fair > 0 && market > 0 && (fair > market * 3 || market > fair * 3)) {
      outliers.push({
        ar: 'القيمة العادلة تختلف كثيرًا عن القيمة السوقية',
        en: 'Fair value differs significantly from market value'
      });
    }
    if (book > 0 && fair > 0 && (fair > book * 5 || book > fair * 5)) {
      outliers.push({
        ar: 'القيمة الدفترية تختلف كثيرًا عن القيمة العادلة',
        en: 'Book value differs significantly from fair value'
      });
    }
    if (investment > 0 && fair > 0 && investment > fair * 2) {
      outliers.push({
        ar: 'القيمة الاستثمارية أعلى بكثير من القيمة العادلة',
        en: 'Investment value is much higher than fair value'
      });
    }
    if (liquidation > 0 && fair > 0 && liquidation > fair) {
      outliers.push({
        ar: 'قيمة التصفية أعلى من القيمة العادلة',
        en: 'Liquidation value is higher than fair value'
      });
    }
    return outliers;
  }

  function compareMarket(result, marketData) {
    if (!marketData || !result) return { deviation: null, note: null };
    const fair = safe(result.fairValue);
    const avgSelling = safe(marketData.averageSellingPrice);
    if (fair > 0 && avgSelling > 0) {
      const deviation = Math.abs(fair - avgSelling) / avgSelling;
      return {
        deviation: Math.round(deviation * 100),
        note: {
          ar: `انحراف القيمة العادلة عن متوسط سعر البيع = ${Math.round(deviation * 100)}%`,
          en: `Fair value deviation from market average = ${Math.round(deviation * 100)}%`
        }
      };
    }
    return { deviation: null, note: null };
  }

  function scoreMarketData(marketData) {
    if (!marketData) return 0;
    let dataQuality = clamp(marketData.dataQualityScore, 0, 100);
    if (dataQuality <= 1 && marketData.dataQualityScore > 0) dataQuality *= 100;
    let confidence = clamp(marketData.confidence, 0, 100);
    if (confidence <= 1 && marketData.confidence > 0) confidence *= 100;
    const transactionCount = safe(marketData.transactionCount);
    const recencyScore = 80; // placeholder; could compare recorded_at to today
    const volumeScore = Math.min(100, transactionCount * 5);
    return Math.round((dataQuality * 0.4) + (confidence * 0.3) + (recencyScore * 0.2) + (volumeScore * 0.1));
  }

  function scoreCondition(conditionAssessment) {
    if (!conditionAssessment) return 50;
    const score = clamp(conditionAssessment.confidenceScore, 0, 100) || clamp(conditionAssessment.score, 0, 100);
    return Math.round(score);
  }

  function scoreRisk(riskAssessment) {
    if (!riskAssessment) return 50;
    // Risk index is 0-100 where higher = riskier.  Validation quality is inverse.
    const riskIndex = clamp(riskAssessment.riskIndex, 0, 100);
    const confidence = clamp(riskAssessment.confidenceScore, 0, 100);
    const quality = Math.round(((100 - riskIndex) * 0.6) + (confidence * 0.4));
    return clamp(quality, 0, 100);
  }

  function scoreMethodology(result) {
    if (!result) return 0;
    const values = [
      result.bookValue,
      result.marketValue,
      result.fairValue,
      result.investmentValue,
      result.liquidationValue,
      result.replacementValue
    ];
    const populated = values.filter(v => Number.isFinite(Number(v)) && Number(v) >= 0).length;
    return Math.round((populated / values.length) * 100);
  }

  function computeConfidence({ completenessScore, marketScore, conditionScore, riskScore, methodologyScore }) {
    return Math.round(
      completenessScore * 0.30 +
      marketScore * 0.25 +
      conditionScore * 0.15 +
      riskScore * 0.15 +
      methodologyScore * 0.15
    );
  }

  function validate(context) {
    const {
      assetClass,
      inputs = {},
      result = null,
      marketData = null,
      conditionAssessment = null,
      riskAssessment = null
    } = context;

    const rule = getRule(assetClass);
    const completeness = checkCompleteness(rule, inputs);
    const crossCheckFailures = checkCrossChecks(rule, inputs);
    const outliers = detectOutliers(result);
    const marketComparison = compareMarket(result, marketData);

    const marketScore = scoreMarketData(marketData);
    const conditionScoreValue = scoreCondition(conditionAssessment);
    const riskScoreValue = scoreRisk(riskAssessment);
    const methodologyScore = scoreMethodology(result);

    const confidenceScore = computeConfidence({
      completenessScore: completeness.score,
      marketScore,
      conditionScore: conditionScoreValue,
      riskScore: riskScoreValue,
      methodologyScore
    });

    // Data quality is a blend of input completeness and market data quality.
    const dataQualityScore = Math.round(completeness.score * 0.5 + marketScore * 0.5);

    const conflicts = [];
    if (crossCheckFailures.length > 0) {
      conflicts.push(...crossCheckFailures);
    }
    if (marketComparison.deviation !== null && marketComparison.deviation > 50) {
      conflicts.push({
        ar: 'القيمة العادلة تختلف بأكثر من 50% عن متوسط السوق',
        en: 'Fair value deviates more than 50% from market average'
      });
    }

    const passed = confidenceScore >= 80 && dataQualityScore >= 80 && completeness.missing.length === 0;

    return {
      passed,
      confidenceScore,
      dataQualityScore,
      completenessScore: completeness.score,
      marketScore,
      conditionScore: conditionScoreValue,
      riskScore: riskScoreValue,
      methodologyScore,
      missingFields: completeness.missing,
      crossCheckFailures,
      conflicts,
      outliers,
      marketComparison,
      threshold: 80
    };
  }

  return { validate };
}));
