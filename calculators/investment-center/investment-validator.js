/**
 * Investment Center — Validation Engine
 * Validates raw inputs per sector and returns warnings for illogical values.
 */

(function () {
  const AR = {
    negativeValue: (field) => `قيمة ${field} لا يمكن أن تكون سالبة.`,
    exceeds100: (field) => `نسبة ${field} لا يمكن أن تتجاوز 100%.`,
    profitMarginTooHigh: (field) => `نسبة ${field} مرتفعة جداً (أكثر من 90%). يرجى التحقق.`,
    revenueTooLow: 'الإيرادات الشهرية أقل من إجمالي التكاليف، مما يعني خسارة شهرية.',
    investmentTooLow: (field, min) => `قيمة ${field} منخفضة جداً مقارنة بمتوسط السوق (الحد الأدنى المقترح: ${min.toLocaleString('ar-SA')} ر.س).`,
    employeesTooFew: (field, min) => `عدد ${field} أقل من الحد الأدنى المقترح (${min}).`,
    revenueExceedsCapacity: 'الإيرادات المتوقعة تتجاوز الطاقة التشغيلية القصوى. يرجى مراجعة المدخلات.',
    paybackExceedsDuration: 'فترة الاسترداد أطول من مدة المشروع، مما يعني أن المشروع لا يحقق عائداً ضمن الفترة المخططة.',
    roiTooHigh: 'العائد على الاستثمار غير واقعي (أكثر من 1000%). يرجى مراجعة الإيرادات أو الاستثمار.',
    fixBeforeReport: 'يرجى تصحيح التحذيرات أعلاه قبل إصدار التقرير.',
    title: 'تحذيرات التحقق من البيانات'
  };

  const EN = {
    negativeValue: (field) => `${field} cannot be negative.`,
    exceeds100: (field) => `${field} cannot exceed 100%.`,
    profitMarginTooHigh: (field) => `${field} is very high (over 90%). Please verify.`,
    revenueTooLow: 'Monthly revenue is lower than total costs, indicating a monthly loss.',
    investmentTooLow: (field, min) => `${field} is too low compared to market average (suggested minimum: ${min.toLocaleString('en-US')} SAR).`,
    employeesTooFew: (field, min) => `${field} is below the suggested minimum (${min}).`,
    revenueExceedsCapacity: 'Expected revenue exceeds maximum operating capacity. Please review inputs.',
    paybackExceedsDuration: 'Payback period exceeds project duration, meaning the project does not return within the planned period.',
    roiTooHigh: 'Return on investment is unrealistic (over 1000%). Please review revenue or investment.',
    fixBeforeReport: 'Please fix the warnings above before generating the report.',
    title: 'Data Validation Warnings'
  };

  // Field name patterns that are percentages
  const percentagePatterns = [
    /Rate$/,
    /^occupancy/,
    /^enrollment/,
    /^vacancy/,
    /^financing/,
    /^holding/,
    /^commission/,
    /^contentCost/,
    /^platformCommission/,
    /^operatingCost/,
    /^materialCost/,
    /^foodCost/,
    /^lensCost/,
    /^reagent/,
    /^contrast/,
    /^disposable/,
    /^medicalSupplies/,
    /^overhead/,
    /^laborCost/,
    /^indirectCost/,
    /^contingency/,
    /^advancePayment/,
    /^retention/
  ];

  function isPercentageField(name) {
    return percentagePatterns.some(pattern => pattern.test(name));
  }

  function labelFor(name, lang) {
    // Simplified labels for warnings
    const labels = {
      ar: {
        occupancyRate: 'نسبة الإشغال',
        enrollmentRate: 'نسبة التسجيل',
        vacancyRate: 'نسبة الشواغر',
        financingRate: 'نسبة التمويل',
        profitMargin: 'هامش الربح',
        foodCostRate: 'نسبة تكلفة الطعام',
        materialCostRate: 'نسبة تكلفة المواد',
        operatingCostRate: 'نسبة التشغيل',
        commissionCostRate: 'نسبة العمولة',
        contentCostRate: 'نسبة تكلفة المحتوى',
        platformCommissionRate: 'نسبة عمولة المنصات',
        lensCostRate: 'نسبة تكلفة العدسات',
        reagentCostRate: 'نسبة الكواشف',
        contrastMaterialRate: 'نسبة مواد التباين',
        disposableCostRate: 'نسبة المستهلكات',
        medicalSuppliesRate: 'نسبة المواد الطبية',
        overheadRate: 'نسبة المصاريف العمومية',
        laborCostRate: 'نسبة تكلفة العمالة',
        indirectCostRate: 'نسبة التكاليف غير المباشرة',
        contingencyRate: 'نسبة الاحتياطي',
        advancePaymentRate: 'نسبة الدفعة المقدمة',
        retentionRate: 'نسبة الاستقطاع',
        holdingCostRate: 'نسبة تكلفة الاحتفاظ'
      },
      en: {
        occupancyRate: 'Occupancy rate',
        enrollmentRate: 'Enrollment rate',
        vacancyRate: 'Vacancy rate',
        financingRate: 'Financing ratio',
        profitMargin: 'Profit margin',
        foodCostRate: 'Food cost ratio',
        materialCostRate: 'Material cost ratio',
        operatingCostRate: 'Operating cost ratio',
        commissionCostRate: 'Commission ratio',
        contentCostRate: 'Content cost ratio',
        platformCommissionRate: 'Platform commission ratio',
        lensCostRate: 'Lens cost ratio',
        reagentCostRate: 'Reagent cost ratio',
        contrastMaterialRate: 'Contrast material ratio',
        disposableCostRate: 'Disposable supplies ratio',
        medicalSuppliesRate: 'Medical supplies ratio',
        overheadRate: 'Overhead ratio',
        laborCostRate: 'Labor cost ratio',
        indirectCostRate: 'Indirect cost ratio',
        contingencyRate: 'Contingency ratio',
        advancePaymentRate: 'Advance payment ratio',
        retentionRate: 'Retention ratio',
        holdingCostRate: 'Holding cost ratio'
      }
    };
    return (labels[lang] && labels[lang][name]) || name;
  }

  // Sector-specific validation configs
  const sectorConfigs = {
    // Hospitality
    hotel: { occupancyFields: ['occupancyRate'], minEmployees: { field: 'numberOfEmployees', min: 8 }, minInvestment: { field: 'setupCost', min: 2000000 } },
    'tourist-resort': { occupancyFields: ['occupancyRate'], minEmployees: { field: 'numberOfEmployees', min: 15 }, minInvestment: { field: 'setupCost', min: 5000000 } },
    'tourist-camp': { occupancyFields: ['occupancyRate'], minEmployees: { field: 'numberOfEmployees', min: 3 }, minInvestment: { field: 'setupCost', min: 150000 } },
    'hotel-apartments': { occupancyFields: ['occupancyRate'], minEmployees: { field: 'numberOfEmployees', min: 5 }, minInvestment: { field: 'setupCost', min: 500000 } },

    // Medical
    hospital: { minEmployees: { field: 'numberOfEmployees', min: 50 }, minInvestment: { field: 'constructionAndEquipmentCost', min: 10000000 } },
    'medical-complex': { minEmployees: { field: 'numberOfEmployees', min: 10 }, minInvestment: { field: 'setupCost', min: 1000000 } },
    'dental-clinic': { minEmployees: { field: 'numberOfEmployees', min: 3 }, minInvestment: { field: 'equipmentCost', min: 300000 } },
    'radiology-center': { minEmployees: { field: 'numberOfEmployees', min: 5 }, minInvestment: { field: 'equipmentCost', min: 1500000 } },
    'medical-lab': { minEmployees: { field: 'numberOfEmployees', min: 4 }, minInvestment: { field: 'equipmentCost', min: 600000 } },
    'physiotherapy-center': { minEmployees: { field: 'numberOfEmployees', min: 3 }, minInvestment: { field: 'equipmentCost', min: 200000 } },
    pharmacy: { minEmployees: { field: 'numberOfEmployees', min: 2 }, minInvestment: { field: 'inventoryCost', min: 150000 } },
    'optical-center': { minEmployees: { field: 'numberOfEmployees', min: 2 }, minInvestment: { field: 'inventoryCost', min: 100000 } },

    // Education
    'private-school': { minEmployees: { field: 'numberOfEmployees', min: 15 }, minInvestment: { field: 'setupCost', min: 1000000 } },
    nursery: { minEmployees: { field: 'numberOfEmployees', min: 4 }, minInvestment: { field: 'setupCost', min: 150000 } },
    'private-university': { minEmployees: { field: 'numberOfEmployees', min: 80 }, minInvestment: { field: 'setupCost', min: 20000000 } },
    'training-center': { minEmployees: { field: 'numberOfEmployees', min: 3 }, minInvestment: { field: 'setupCost', min: 250000 } },
    'e-learning-platform': { minInvestment: { field: 'developmentCost', min: 150000 } },

    // Restaurants
    restaurant: { minEmployees: { field: 'numberOfEmployees', min: 5 }, minInvestment: { field: 'setupCost', min: 250000 } },
    'coffee-shop': { minEmployees: { field: 'numberOfEmployees', min: 3 }, minInvestment: { field: 'setupCost', min: 150000 } },
    'cloud-kitchen': { minEmployees: { field: 'numberOfEmployees', min: 4 }, minInvestment: { field: 'setupCost', min: 120000 } },
    'food-truck': { minEmployees: { field: 'numberOfEmployees', min: 2 }, minInvestment: { field: 'truckCost', min: 100000 } },
    'fast-food-restaurant': { minEmployees: { field: 'numberOfEmployees', min: 8 }, minInvestment: { field: 'setupCost', min: 400000 } },
    'fine-dining-restaurant': { minEmployees: { field: 'numberOfEmployees', min: 10 }, minInvestment: { field: 'setupCost', min: 800000 } },

    // Factories
    'food-factory': { minEmployees: { field: 'numberOfEmployees', min: 10 }, minInvestment: { field: 'factoryCost', min: 1500000 } },
    'water-factory': { minEmployees: { field: 'numberOfEmployees', min: 8 }, minInvestment: { field: 'factoryCost', min: 1000000 } },
    'plastic-factory': { minEmployees: { field: 'numberOfEmployees', min: 12 }, minInvestment: { field: 'factoryCost', min: 2000000 } },
    'building-materials-factory': { minEmployees: { field: 'numberOfEmployees', min: 15 }, minInvestment: { field: 'factoryCost', min: 3000000 } },
    'furniture-factory': { minEmployees: { field: 'numberOfEmployees', min: 10 }, minInvestment: { field: 'factoryCost', min: 1200000 } },
    'textiles-factory': { minEmployees: { field: 'numberOfEmployees', min: 12 }, minInvestment: { field: 'factoryCost', min: 2000000 } },
    'chemicals-factory': { minEmployees: { field: 'numberOfEmployees', min: 15 }, minInvestment: { field: 'factoryCost', min: 4000000 } },
    'packaging-factory': { minEmployees: { field: 'numberOfEmployees', min: 8 }, minInvestment: { field: 'factoryCost', min: 1500000 } },
    industrial: { minInvestment: { field: 'factoryCost', min: 1000000 } },

    // Logistics
    'shipping-company': { minInvestment: { field: 'setupCost', min: 300000 } },
    'transport-fleet': { minInvestment: { field: 'vehicleCost', min: 500000 } },
    'distribution-center': { minEmployees: { field: 'numberOfEmployees', min: 8 }, minInvestment: { field: 'setupCost', min: 1000000 } },
    'last-mile-delivery': { minEmployees: { field: 'numberOfEmployees', min: 5 }, minInvestment: { field: 'vehicleCost', min: 100000 } },
    warehouses: { minInvestment: { field: 'landCost', min: 500000 } },

    // Real estate
    'land-development': { minInvestment: { field: 'landArea', min: 100 } },
    'villa-construction': { minInvestment: { field: 'landCost', min: 500000 } },
    'residential-building': { minInvestment: { field: 'landCost', min: 1000000 } },
    'commercial-complex': { minInvestment: { field: 'landCost', min: 2000000 } },
    'commercial-mall': { minInvestment: { field: 'landCost', min: 5000000 } },
    'property-rehabilitation': { minInvestment: { field: 'purchasePrice', min: 200000 } },
    'buy-to-rent': { minInvestment: { field: 'propertyPrice', min: 200000 } },
    'quick-real-estate': { minInvestment: { field: 'propertyPrice', min: 100000 } },
    'real-estate': { minInvestment: { field: 'landValue', min: 200000 } },

    // Construction
    'construction-profitability': { minInvestment: { field: 'projectValue', min: 100000 } },
    'tender-pricing': { minInvestment: { field: 'directMaterialCost', min: 10000 } },
    'contractor-cashflow': { minInvestment: { field: 'projectValue', min: 100000 } },
    'concrete-structure-cost': { minInvestment: { field: 'builtUpArea', min: 50 } },
    'finishing-cost': { minInvestment: { field: 'finishingArea', min: 30 } },
    'distressed-project-evaluation': { minInvestment: { field: 'purchasePrice', min: 100000 } },
    construction: { minInvestment: { field: 'projectValue', min: 100000 } },

    // Tourism company
    'tourism-company': { minEmployees: { field: 'numberOfEmployees', min: 3 }, minInvestment: { field: 'setupCost', min: 100000 } },

    // Retail & commercial
    retail: { minEmployees: { field: 'numberOfEmployees', min: 2 }, minInvestment: { field: 'inventoryCost', min: 100000 } },
    commercial: { minInvestment: { field: 'inventoryCost', min: 100000 } },
    technology: { minInvestment: { field: 'developmentCost', min: 100000 } },
    agriculture: { minInvestment: { field: 'landSetupCost', min: 50000 } },
    logistics: { minInvestment: { field: 'vehicleCost', min: 300000 } },
    tourism: { minInvestment: { field: 'setupCost', min: 300000 } },
    education: { minInvestment: { field: 'setupCost', min: 150000 } },
    restaurants: { minInvestment: { field: 'setupCost', min: 200000 } }
  };

  function validate(sectorId, inputs, lang = 'ar') {
    const t = lang === 'en' ? EN : AR;
    const warnings = [];
    const config = sectorConfigs[sectorId] || {};

    // 1. Negative values
    Object.entries(inputs).forEach(([key, value]) => {
      if (typeof value === 'number' && value < 0) {
        warnings.push(t.negativeValue(labelFor(key, lang)));
      }
    });

    // 2. Percentage fields > 100
    Object.entries(inputs).forEach(([key, value]) => {
      if (isPercentageField(key) && typeof value === 'number' && value > 100) {
        warnings.push(t.exceeds100(labelFor(key, lang)));
      }
    });

    // 3. Profit margin / cost rates too high (>90)
    ['profitMargin', 'foodCostRate', 'materialCostRate', 'operatingCostRate', 'commissionCostRate', 'contentCostRate', 'platformCommissionRate', 'lensCostRate', 'reagentCostRate', 'contrastMaterialRate', 'disposableCostRate', 'medicalSuppliesRate'].forEach(field => {
      if (typeof inputs[field] === 'number' && inputs[field] > 90) {
        warnings.push(t.profitMarginTooHigh(labelFor(field, lang)));
      }
    });

    // 4. Occupancy-like fields > 100 (explicit)
    const occupancyFields = config.occupancyFields || [];
    occupancyFields.forEach(field => {
      if (typeof inputs[field] === 'number' && inputs[field] > 100) {
        warnings.push(t.exceeds100(labelFor(field, lang)));
      }
    });

    // 5. Minimum employees
    if (config.minEmployees) {
      const value = inputs[config.minEmployees.field];
      if (typeof value === 'number' && value > 0 && value < config.minEmployees.min) {
        warnings.push(t.employeesTooFew(config.minEmployees.field, config.minEmployees.min));
      }
    }

    // 6. Minimum investment / cost
    if (config.minInvestment) {
      const value = inputs[config.minInvestment.field];
      if (typeof value === 'number' && value > 0 && value < config.minInvestment.min) {
        warnings.push(t.investmentTooLow(labelFor(config.minInvestment.field, lang), config.minInvestment.min));
      }
    }

    // 7. Revenue vs capacity checks for selected sectors
    const revenueCapacityChecks = {
      hotel: { capacity: inputs.numberOfRooms, price: inputs.avgDailyRate, days: 30, occupancy: inputs.occupancyRate },
      'tourist-resort': { capacity: inputs.numberOfUnits, price: inputs.avgDailyRate, days: 30, occupancy: inputs.occupancyRate },
      'tourist-camp': { capacity: inputs.numberOfTents, price: inputs.avgDailyRate, days: 30, occupancy: inputs.occupancyRate },
      'hotel-apartments': { capacity: inputs.numberOfApartments, price: inputs.avgDailyRate, days: 30, occupancy: inputs.occupancyRate },
      restaurant: { capacity: inputs.numberOfTables, price: inputs.avgTicketValue, days: 30, multiplier: inputs.avgDailyCustomers / (inputs.numberOfTables || 1) },
      'fast-food-restaurant': { capacity: inputs.dailyCustomers, price: inputs.avgTicketValue, days: 30 },
      'fine-dining-restaurant': { capacity: inputs.numberOfTables, price: inputs.avgTicketValue, days: 30, multiplier: inputs.avgDailyCustomers / (inputs.numberOfTables || 1) },
      'coffee-shop': { capacity: inputs.numberOfSeats, price: inputs.avgTicketValue, days: 30, multiplier: inputs.avgDailyCustomers / (inputs.numberOfSeats || 1) },
      'food-truck': { capacity: inputs.dailyCustomers, price: inputs.avgTicketValue, days: 30 },
      'cloud-kitchen': { capacity: inputs.dailyOrders, price: inputs.avgTicketValue, days: 30 },
      'medical-lab': { capacity: inputs.avgDailyTests, price: inputs.avgRevenuePerTest, days: 30 },
      'radiology-center': { capacity: inputs.numberOfMachines, price: inputs.avgDailyRevenuePerMachine, days: 30 },
      'dental-clinic': { capacity: inputs.numberOfChairs, price: inputs.avgDailyRevenuePerChair, days: 30 },
      'physiotherapy-center': { capacity: inputs.numberOfSessionsPerDay, price: inputs.avgRevenuePerSession, days: 30 },
      pharmacy: { capacity: inputs.avgDailySales, price: 1, days: 30 },
      'optical-center': { capacity: inputs.avgDailySales, price: inputs.avgTicketValue, days: 30 },
      retail: { capacity: inputs.dailySales, price: 1, days: 30 },
      'water-factory': { capacity: inputs.dailyProduction, price: inputs.bottlePrice, days: 30 },
      'tourism-company': { capacity: inputs.monthlyPackages, price: inputs.avgPackagePrice, days: 1 }
    };

    const check = revenueCapacityChecks[sectorId];
    if (check && typeof inputs.monthlyRevenue === 'number' && inputs.monthlyRevenue > 0) {
      let maxRevenue = (check.capacity || 0) * (check.price || 0) * (check.days || 1);
      if (check.occupancy) maxRevenue *= (check.occupancy / 100);
      if (check.multiplier) maxRevenue *= check.multiplier;
      if (maxRevenue > 0 && inputs.monthlyRevenue > maxRevenue * 1.15) {
        warnings.push(t.revenueExceedsCapacity);
      }
    }

    // 8. ROI too high
    if (typeof inputs.roi === 'number' && inputs.roi > 1000) {
      warnings.push(t.roiTooHigh);
    }

    return {
      valid: warnings.length === 0,
      warnings,
      title: t.title,
      fixBeforeReport: t.fixBeforeReport
    };
  }

  window.InvestmentValidator = { validate };
})();
