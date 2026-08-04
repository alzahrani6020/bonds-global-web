/**
 * Bonds Sector Data Fallback
 * Local fallback market data for all investment-center calculators.
 * Used when the API (/api/v3/sector-data) is unavailable or has no record.
 *
 * Structure:
 *   - countryBaseParams: economic benchmarks per country.
 *   - sectorFieldMap: which fields exist per sector.
 *   - sectorCategories: maps each sector to a template category.
 *   - categoryTemplates: small/medium/large presets per category.
 *   - sectorOverrides: sector-specific values that override category templates.
 */
(function (global) {
  'use strict';

  const countryBaseParams = {
    SA: { nameAr: 'السعودية', nameEn: 'Saudi Arabia', electricityRate: 0.18, waterRate: 6, wagePerDay: 180, buildingCostPerM2: 1600, logisticsFactor: 1.0, marketGrowth: 5.5, confidence: 'medium' },
    AE: { nameAr: 'الإمارات', nameEn: 'United Arab Emirates', electricityRate: 0.22, waterRate: 4.5, wagePerDay: 220, buildingCostPerM2: 2200, logisticsFactor: 1.15, marketGrowth: 5.0, confidence: 'medium' },
    EG: { nameAr: 'مصر', nameEn: 'Egypt', electricityRate: 0.20, waterRate: 1.8, wagePerDay: 90, buildingCostPerM2: 900, logisticsFactor: 0.75, marketGrowth: 4.5, confidence: 'medium-low' },
    JO: { nameAr: 'الأردن', nameEn: 'Jordan', electricityRate: 0.22, waterRate: 2.2, wagePerDay: 110, buildingCostPerM2: 1100, logisticsFactor: 0.9, marketGrowth: 3.5, confidence: 'medium-low' },
    KW: { nameAr: 'الكويت', nameEn: 'Kuwait', electricityRate: 0.10, waterRate: 4.0, wagePerDay: 250, buildingCostPerM2: 2000, logisticsFactor: 1.2, marketGrowth: 4.0, confidence: 'medium' },
    BH: { nameAr: 'البحرين', nameEn: 'Bahrain', electricityRate: 0.16, waterRate: 3.2, wagePerDay: 200, buildingCostPerM2: 1900, logisticsFactor: 1.05, marketGrowth: 3.8, confidence: 'medium' },
    OM: { nameAr: 'عمان', nameEn: 'Oman', electricityRate: 0.14, waterRate: 2.4, wagePerDay: 160, buildingCostPerM2: 1400, logisticsFactor: 0.95, marketGrowth: 3.5, confidence: 'medium' },
    QA: { nameAr: 'قطر', nameEn: 'Qatar', electricityRate: 0.16, waterRate: 4.2, wagePerDay: 280, buildingCostPerM2: 2400, logisticsFactor: 1.25, marketGrowth: 4.2, confidence: 'medium' },
    IQ: { nameAr: 'العراق', nameEn: 'Iraq', electricityRate: 0.15, waterRate: 1.4, wagePerDay: 70, buildingCostPerM2: 700, logisticsFactor: 0.65, marketGrowth: 3.0, confidence: 'low' },
    MA: { nameAr: 'المغرب', nameEn: 'Morocco', electricityRate: 0.15, waterRate: 2.0, wagePerDay: 80, buildingCostPerM2: 850, logisticsFactor: 0.8, marketGrowth: 3.5, confidence: 'medium-low' },
    SY: { nameAr: 'سوريا', nameEn: 'Syria', electricityRate: 0.06, waterRate: 0.7, wagePerDay: 40, buildingCostPerM2: 400, logisticsFactor: 0.45, marketGrowth: 1.5, confidence: 'low' },
    LB: { nameAr: 'لبنان', nameEn: 'Lebanon', electricityRate: 0.30, waterRate: 2.8, wagePerDay: 100, buildingCostPerM2: 1200, logisticsFactor: 0.85, marketGrowth: 2.0, confidence: 'low' },
    TN: { nameAr: 'تونس', nameEn: 'Tunisia', electricityRate: 0.14, waterRate: 1.7, wagePerDay: 75, buildingCostPerM2: 800, logisticsFactor: 0.75, marketGrowth: 3.0, confidence: 'medium-low' },
    DZ: { nameAr: 'الجزائر', nameEn: 'Algeria', electricityRate: 0.13, waterRate: 1.5, wagePerDay: 70, buildingCostPerM2: 750, logisticsFactor: 0.7, marketGrowth: 3.0, confidence: 'medium-low' },
    LY: { nameAr: 'ليبيا', nameEn: 'Libya', electricityRate: 0.09, waterRate: 1.1, wagePerDay: 65, buildingCostPerM2: 650, logisticsFactor: 0.6, marketGrowth: 2.5, confidence: 'low' },
    SD: { nameAr: 'السودان', nameEn: 'Sudan', electricityRate: 0.07, waterRate: 0.8, wagePerDay: 45, buildingCostPerM2: 500, logisticsFactor: 0.5, marketGrowth: 2.0, confidence: 'low' },
    YE: { nameAr: 'اليمن', nameEn: 'Yemen', electricityRate: 0.10, waterRate: 0.9, wagePerDay: 35, buildingCostPerM2: 350, logisticsFactor: 0.4, marketGrowth: 1.0, confidence: 'low' },
    PS: { nameAr: 'فلسطين', nameEn: 'Palestine', electricityRate: 0.18, waterRate: 2.0, wagePerDay: 85, buildingCostPerM2: 1000, logisticsFactor: 0.75, marketGrowth: 2.5, confidence: 'low' },
    MR: { nameAr: 'موريتانيا', nameEn: 'Mauritania', electricityRate: 0.12, waterRate: 1.2, wagePerDay: 50, buildingCostPerM2: 550, logisticsFactor: 0.55, marketGrowth: 2.5, confidence: 'low' },
    SO: { nameAr: 'الصومال', nameEn: 'Somalia', electricityRate: 0.10, waterRate: 0.6, wagePerDay: 30, buildingCostPerM2: 300, logisticsFactor: 0.35, marketGrowth: 1.5, confidence: 'low' },
    DJ: { nameAr: 'جيبوتي', nameEn: 'Djibouti', electricityRate: 0.20, waterRate: 2.0, wagePerDay: 60, buildingCostPerM2: 900, logisticsFactor: 0.7, marketGrowth: 3.0, confidence: 'low' },
    KM: { nameAr: 'جزر القمر', nameEn: 'Comoros', electricityRate: 0.18, waterRate: 1.0, wagePerDay: 40, buildingCostPerM2: 450, logisticsFactor: 0.45, marketGrowth: 2.0, confidence: 'low' }
  };

  const sectorCategories = {
    'water-factory': 'manufacturing',
    'food-factory': 'manufacturing',
    'chemicals-factory': 'manufacturing',
    'plastic-factory': 'manufacturing',
    'furniture-factory': 'manufacturing',
    'textiles-factory': 'manufacturing',
    'packaging-factory': 'manufacturing',
    'building-materials-factory': 'manufacturing',
    'cloud-kitchen': 'food_service',
    'restaurant': 'food_service',
    'restaurants': 'food_service',
    'fast-food-restaurant': 'food_service',
    'fine-dining-restaurant': 'food_service',
    'coffee-shop': 'food_service',
    'food-truck': 'food_service',
    'hotel': 'hospitality',
    'hotel-apartments': 'hospitality',
    'tourist-resort': 'hospitality',
    'tourist-camp': 'hospitality',
    'pharmacy': 'retail_healthcare',
    'medical-lab': 'healthcare_service',
    'dental-clinic': 'healthcare_service',
    'radiology-center': 'healthcare_service',
    'physiotherapy-center': 'healthcare_service',
    'optical-center': 'retail_healthcare',
    'medical-complex': 'healthcare_service',
    'hospital': 'healthcare_service',
    'medical': 'healthcare_service',
    'real-estate': 'real_estate',
    'buy-to-rent': 'real_estate',
    'residential-building': 'real_estate',
    'commercial': 'real_estate',
    'commercial-complex': 'real_estate',
    'commercial-mall': 'real_estate',
    'warehouses': 'real_estate',
    'land-development': 'real_estate',
    'property-rehabilitation': 'real_estate',
    'quick-real-estate': 'real_estate',
    'construction': 'construction',
    'construction-profitability': 'construction',
    'contractor-cashflow': 'construction',
    'concrete-structure-cost': 'construction',
    'finishing-cost': 'construction',
    'villa-construction': 'construction',
    'tender-pricing': 'construction',
    'logistics': 'logistics',
    'last-mile-delivery': 'logistics',
    'shipping-company': 'logistics',
    'transport-fleet': 'logistics',
    'distribution-center': 'logistics',
    'agriculture': 'agriculture',
    'retail': 'retail',
    'technology': 'technology',
    'e-learning-platform': 'technology',
    'education': 'education',
    'private-school': 'education',
    'private-university': 'education',
    'nursery': 'education',
    'training-center': 'education',
    'tourism': 'tourism',
    'tourism-company': 'tourism',
    'industrial': 'industrial',
    'distressed-project-evaluation': 'distressed',
    'coffee-shop': 'food_service'
  };

  const categoryTemplates = {
    manufacturing: {
      small:  { monthlyCapacity: 8000,  unitPrice: 6, rawMaterialCostPerUnit: 3.0, factoryCost: 1500000, monthlySalaries: 35000, monthlyUtilities: 6000, analysisDuration: 60, discountRate: 10 },
      medium: { monthlyCapacity: 30000, unitPrice: 6, rawMaterialCostPerUnit: 3.0, factoryCost: 3500000, monthlySalaries: 65000, monthlyUtilities: 14000, analysisDuration: 60, discountRate: 10 },
      large:  { monthlyCapacity: 80000, unitPrice: 6, rawMaterialCostPerUnit: 3.0, factoryCost: 8000000, monthlySalaries: 120000, monthlyUtilities: 28000, analysisDuration: 60, discountRate: 10 }
    },
    food_service: {
      small:  { numberOfTables: 8,  avgDailyCustomers: 60,  avgTicketValue: 40, setupCost: 200000,  foodCostRate: 32, monthlyRentSalaries: 18000, analysisDuration: 60, discountRate: 10 },
      medium: { numberOfTables: 18, avgDailyCustomers: 150, avgTicketValue: 45, setupCost: 500000,  foodCostRate: 30, monthlyRentSalaries: 38000, analysisDuration: 60, discountRate: 10 },
      large:  { numberOfTables: 35, avgDailyCustomers: 320, avgTicketValue: 50, setupCost: 1200000, foodCostRate: 28, monthlyRentSalaries: 75000, analysisDuration: 60, discountRate: 10 }
    },
    hospitality: {
      small:  { numberOfRooms: 20, occupancyRate: 55, avgDailyRate: 250, setupCost: 1500000, monthlySalaries: 25000, monthlyUtilities: 8000, analysisDuration: 60, discountRate: 10 },
      medium: { numberOfRooms: 60, occupancyRate: 65, avgDailyRate: 320, setupCost: 4500000, monthlySalaries: 60000, monthlyUtilities: 20000, analysisDuration: 60, discountRate: 10 },
      large:  { numberOfRooms: 150, occupancyRate: 72, avgDailyRate: 400, setupCost: 12000000, monthlySalaries: 140000, monthlyUtilities: 45000, analysisDuration: 60, discountRate: 10 }
    },
    retail_healthcare: {
      small:  { avgDailySales: 1500, profitMargin: 22, inventoryCost: 120000, monthlyRent: 6000, monthlySalaries: 12000, licenseCost: 25000, analysisDuration: 60, discountRate: 10 },
      medium: { avgDailySales: 4000, profitMargin: 25, inventoryCost: 350000, monthlyRent: 14000, monthlySalaries: 28000, licenseCost: 45000, analysisDuration: 60, discountRate: 10 },
      large:  { avgDailySales: 9000, profitMargin: 28, inventoryCost: 800000, monthlyRent: 30000, monthlySalaries: 55000, licenseCost: 80000, analysisDuration: 60, discountRate: 10 }
    },
    healthcare_service: {
      small:  { avgDailyTests: 30,  avgRevenuePerTest: 150, equipmentCost: 300000,  monthlyRent: 7000,  monthlySalaries: 20000, reagentCostRate: 25, analysisDuration: 60, discountRate: 10 },
      medium: { avgDailyTests: 80,  avgRevenuePerTest: 180, equipmentCost: 900000,  monthlyRent: 16000, monthlySalaries: 45000, reagentCostRate: 23, analysisDuration: 60, discountRate: 10 },
      large:  { avgDailyTests: 180, avgRevenuePerTest: 220, equipmentCost: 2200000, monthlyRent: 35000, monthlySalaries: 95000, reagentCostRate: 20, analysisDuration: 60, discountRate: 10 }
    },
    real_estate: {
      small:  { landValue: 500000, constructionCost: 1200000, unitsCount: 6,  unitPrice: 450000, projectMonths: 18, monthlyExpenses: 8000,  analysisDuration: 60, discountRate: 10 },
      medium: { landValue: 1500000, constructionCost: 4500000, unitsCount: 18, unitPrice: 520000, projectMonths: 24, monthlyExpenses: 20000, analysisDuration: 60, discountRate: 10 },
      large:  { landValue: 4000000, constructionCost: 12000000, unitsCount: 40, unitPrice: 600000, projectMonths: 30, monthlyExpenses: 45000, analysisDuration: 60, discountRate: 10 }
    },
    construction: {
      small:  { projectValue: 1500000, projectMonths: 8,  materialCostRate: 42, laborCostRate: 28, overheadRate: 12, initialEquipment: 200000, analysisDuration: 36, discountRate: 10 },
      medium: { projectValue: 5000000, projectMonths: 14, materialCostRate: 40, laborCostRate: 27, overheadRate: 11, initialEquipment: 500000, analysisDuration: 48, discountRate: 10 },
      large:  { projectValue: 15000000, projectMonths: 24, materialCostRate: 38, laborCostRate: 25, overheadRate: 10, initialEquipment: 1200000, analysisDuration: 60, discountRate: 10 }
    },
    logistics: {
      small:  { fleetSize: 4,  monthlyTrips: 120, revenuePerTrip: 250, vehicleCost: 300000,  fuelMaintenance: 8000,  monthlySalaries: 15000, analysisDuration: 60, discountRate: 10 },
      medium: { fleetSize: 12, monthlyTrips: 450, revenuePerTrip: 280, vehicleCost: 900000,  fuelMaintenance: 25000, monthlySalaries: 38000, analysisDuration: 60, discountRate: 10 },
      large:  { fleetSize: 30, monthlyTrips: 1200, revenuePerTrip: 300, vehicleCost: 2400000, fuelMaintenance: 65000, monthlySalaries: 85000, analysisDuration: 60, discountRate: 10 }
    },
    agriculture: {
      small:  { areaSize: 5,  yieldPerHectare: 8000,  pricePerKg: 3,  landSetupCost: 80000,  operationalCostPerKg: 1.2, harvestsPerYear: 2, analysisDuration: 60, discountRate: 10 },
      medium: { areaSize: 20, yieldPerHectare: 9000,  pricePerKg: 3.2, landSetupCost: 300000, operationalCostPerKg: 1.0, harvestsPerYear: 2, analysisDuration: 60, discountRate: 10 },
      large:  { areaSize: 80, yieldPerHectare: 10000, pricePerKg: 3.5, landSetupCost: 1000000, operationalCostPerKg: 0.85, harvestsPerYear: 2, analysisDuration: 60, discountRate: 10 }
    },
    retail: {
      small:  { monthlyRevenue: 30000,  grossMarginRate: 35, setupCost: 150000, monthlyRent: 5000,  monthlySalaries: 10000, monthlyMarketing: 2000,  analysisDuration: 60, discountRate: 10 },
      medium: { monthlyRevenue: 100000, grossMarginRate: 38, setupCost: 450000, monthlyRent: 14000, monthlySalaries: 28000, monthlyMarketing: 6000,  analysisDuration: 60, discountRate: 10 },
      large:  { monthlyRevenue: 300000, grossMarginRate: 40, setupCost: 1200000, monthlyRent: 35000, monthlySalaries: 70000, monthlyMarketing: 15000, analysisDuration: 60, discountRate: 10 }
    },
    technology: {
      small:  { monthlyActiveUsers: 2000,  revenuePerUser: 15, setupCost: 100000,  monthlyMarketing: 8000,  monthlySalaries: 25000, serverCostMonthly: 2000,  analysisDuration: 60, discountRate: 12 },
      medium: { monthlyActiveUsers: 15000, revenuePerUser: 18, setupCost: 400000,  monthlyMarketing: 30000, monthlySalaries: 70000, serverCostMonthly: 8000,  analysisDuration: 60, discountRate: 12 },
      large:  { monthlyActiveUsers: 80000, revenuePerUser: 20, setupCost: 1500000, monthlyMarketing: 100000, monthlySalaries: 180000, serverCostMonthly: 25000, analysisDuration: 60, discountRate: 12 }
    },
    education: {
      small:  { numberOfStudents: 50,  tuitionFeeMonthly: 1200, setupCost: 250000,  monthlySalaries: 25000, monthlyUtilities: 4000,  analysisDuration: 60, discountRate: 10 },
      medium: { numberOfStudents: 200, tuitionFeeMonthly: 1400, setupCost: 900000,  monthlySalaries: 80000, monthlyUtilities: 12000, analysisDuration: 60, discountRate: 10 },
      large:  { numberOfStudents: 600, tuitionFeeMonthly: 1600, setupCost: 2800000, monthlySalaries: 220000, monthlyUtilities: 30000, analysisDuration: 60, discountRate: 10 }
    },
    tourism: {
      small:  { monthlyTourists: 200,  revenuePerTourist: 500, setupCost: 300000,  monthlyMarketing: 5000,  monthlySalaries: 18000, monthlyOperations: 8000,  analysisDuration: 60, discountRate: 10 },
      medium: { monthlyTourists: 800,  revenuePerTourist: 600, setupCost: 1000000, monthlyMarketing: 18000, monthlySalaries: 50000, monthlyOperations: 22000, analysisDuration: 60, discountRate: 10 },
      large:  { monthlyTourists: 2500, revenuePerTourist: 700, setupCost: 3200000, monthlyMarketing: 50000, monthlySalaries: 130000, monthlyOperations: 55000, analysisDuration: 60, discountRate: 10 }
    },
    industrial: {
      small:  { projectValue: 2500000, operatingCostRate: 45, setupCost: 1000000, monthlySalaries: 30000, monthlyUtilities: 8000,  analysisDuration: 60, discountRate: 10 },
      medium: { projectValue: 8000000, operatingCostRate: 42, setupCost: 3000000, monthlySalaries: 75000, monthlyUtilities: 22000, analysisDuration: 60, discountRate: 10 },
      large:  { projectValue: 25000000, operatingCostRate: 40, setupCost: 9000000, monthlySalaries: 180000, monthlyUtilities: 55000, analysisDuration: 60, discountRate: 10 }
    },
    distressed: {
      small:  { projectValue: 1000000, recoveryValue: 700000, setupCost: 150000, monthlySalaries: 15000, monthlyExpenses: 5000,  analysisDuration: 36, discountRate: 12 },
      medium: { projectValue: 3500000, recoveryValue: 2500000, setupCost: 450000, monthlySalaries: 40000, monthlyExpenses: 15000, analysisDuration: 48, discountRate: 12 },
      large:  { projectValue: 10000000, recoveryValue: 7500000, setupCost: 1200000, monthlySalaries: 100000, monthlyExpenses: 40000, analysisDuration: 60, discountRate: 12 }
    }
  };

  const sectorFieldMap = {
    'water-factory': [
      'dailyProduction', 'bottleSize', 'bottlePrice', 'bottleCostPerUnit', 'capCostPerUnit', 'labelCostPerUnit',
      'cartonCostPerBottle', 'shrinkCostPerBottle', 'electricityRatePerKwh', 'waterRatePerM3', 'shiftCostPerWorker',
      'workersPerShift', 'buildingCostPerM2', 'warehouseAreaM2', 'factoryCost', 'maintenanceRate',
      'marketingCostPerCustomer', 'monthlyNewCustomers', 'logisticsCostPerBottle', 'monthlyLicenseInsurance', 'labCostMonthly',
      'monthlyWorkingDays', 'monthlySalaries', 'equityRatio', 'loanInterestRate', 'loanTermYears', 'analysisDuration', 'discountRate'
    ],
    'food-factory': ['monthlyCapacity', 'unitPrice', 'rawMaterialCostPerUnit', 'factoryCost', 'monthlySalaries', 'monthlyUtilities', 'analysisDuration', 'discountRate'],
    'cloud-kitchen': ['dailyOrders', 'avgTicketValue', 'setupCost', 'platformCommissionRate', 'foodCostRate', 'monthlyRentSalaries', 'platformSetupFee', 'vatOnCommissionRate', 'paymentGatewayPct', 'paymentGatewayFixed', 'deliveryFeePerOrder', 'packagingCostPerOrder', 'refundDisputeRate', 'cancelledOrderRate', 'settlementDelayDays', 'analysisDuration', 'discountRate'],
    'restaurant': ['numberOfTables', 'avgDailyCustomers', 'avgTicketValue', 'setupCost', 'foodCostRate', 'monthlyRentSalaries', 'analysisDuration', 'discountRate'],
    'hotel': ['numberOfRooms', 'occupancyRate', 'avgDailyRate', 'setupCost', 'monthlySalaries', 'monthlyUtilities', 'analysisDuration', 'discountRate'],
    'pharmacy': ['avgDailySales', 'profitMargin', 'inventoryCost', 'monthlyRent', 'monthlySalaries', 'licenseCost', 'analysisDuration', 'discountRate'],
    'medical-lab': ['avgDailyTests', 'avgRevenuePerTest', 'equipmentCost', 'monthlyRent', 'monthlySalaries', 'reagentCostRate', 'analysisDuration', 'discountRate'],
    'real-estate': ['landValue', 'constructionCost', 'unitsCount', 'unitPrice', 'projectMonths', 'monthlyExpenses', 'analysisDuration', 'discountRate'],
    'construction': ['projectValue', 'projectMonths', 'materialCostRate', 'laborCostRate', 'overheadRate', 'initialEquipment', 'analysisDuration', 'discountRate'],
    'agriculture': ['areaSize', 'yieldPerHectare', 'pricePerKg', 'landSetupCost', 'operationalCostPerKg', 'harvestsPerYear', 'analysisDuration', 'discountRate'],
    'logistics': ['fleetSize', 'monthlyTrips', 'revenuePerTrip', 'vehicleCost', 'fuelMaintenance', 'monthlySalaries', 'analysisDuration', 'discountRate'],
    'retail': ['monthlyRevenue', 'grossMarginRate', 'setupCost', 'monthlyRent', 'monthlySalaries', 'monthlyMarketing', 'analysisDuration', 'discountRate'],
    'technology': ['monthlyActiveUsers', 'revenuePerUser', 'setupCost', 'monthlyMarketing', 'monthlySalaries', 'serverCostMonthly', 'analysisDuration', 'discountRate'],
    'education': ['numberOfStudents', 'tuitionFeeMonthly', 'setupCost', 'monthlySalaries', 'monthlyUtilities', 'analysisDuration', 'discountRate'],
    'tourism': ['monthlyTourists', 'revenuePerTourist', 'setupCost', 'monthlyMarketing', 'monthlySalaries', 'monthlyOperations', 'analysisDuration', 'discountRate']
  };

  // Provide a sensible default field list for sectors not explicitly mapped
  function getFieldMap(sector) {
    return sectorFieldMap[sector] || Object.keys(categoryTemplates[sectorCategories[sector] || 'retail'].medium);
  }

  function getCategory(sector) {
    return sectorCategories[sector] || 'retail';
  }

  function getTemplate(sector, size) {
    const cat = getCategory(sector);
    const tpl = categoryTemplates[cat] && categoryTemplates[cat][size];
    return tpl ? { ...tpl } : {};
  }

  function toNum(v, fallback) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function adjustForCountry(data, countryCode) {
    const base = countryBaseParams[countryCode] || countryBaseParams.SA;
    const adjusted = { ...data };

    // Adjust salary-related fields
    const wageRatio = base.wagePerDay / countryBaseParams.SA.wagePerDay;
    ['monthlySalaries', 'monthlyRentSalaries'].forEach(k => {
      if (adjusted[k] !== undefined) adjusted[k] = Math.round(toNum(adjusted[k], 0) * wageRatio);
    });

    // Adjust setup/factory/equipment/project costs
    const costRatio = base.buildingCostPerM2 / countryBaseParams.SA.buildingCostPerM2;
    ['setupCost', 'factoryCost', 'equipmentCost', 'initialEquipment', 'landValue', 'constructionCost', 'projectValue', 'vehicleCost', 'landSetupCost', 'inventoryCost', 'licenseCost', 'monthlyRent'].forEach(k => {
      if (adjusted[k] !== undefined) adjusted[k] = Math.round(toNum(adjusted[k], 0) * costRatio);
    });

    // Adjust utilities
    if (adjusted.electricityRatePerKwh !== undefined) adjusted.electricityRatePerKwh = +(toNum(adjusted.electricityRatePerKwh, base.electricityRate)).toFixed(3);
    if (adjusted.waterRatePerM3 !== undefined) adjusted.waterRatePerM3 = +(toNum(adjusted.waterRatePerM3, base.waterRate)).toFixed(2);
    if (adjusted.monthlyUtilities !== undefined) adjusted.monthlyUtilities = Math.round(toNum(adjusted.monthlyUtilities, 0) * (base.electricityRate / countryBaseParams.SA.electricityRate));

    // Adjust logistics / operations
    if (adjusted.logisticsCostPerBottle !== undefined) adjusted.logisticsCostPerBottle = +(toNum(adjusted.logisticsCostPerBottle, 0) * base.logisticsFactor).toFixed(3);
    if (adjusted.fuelMaintenance !== undefined) adjusted.fuelMaintenance = Math.round(toNum(adjusted.fuelMaintenance, 0) * base.logisticsFactor);
    if (adjusted.monthlyOperations !== undefined) adjusted.monthlyOperations = Math.round(toNum(adjusted.monthlyOperations, 0) * base.logisticsFactor);

    // Price levels scale slightly with cost base
    const priceRatio = 0.7 + 0.3 * costRatio;
    ['unitPrice', 'avgTicketValue', 'avgDailyRate', 'avgRevenuePerTest', 'avgRevenuePerProcedure', 'revenuePerTrip', 'pricePerKg', 'revenuePerUser', 'tuitionFeeMonthly', 'revenuePerTourist', 'bottlePrice'].forEach(k => {
      if (adjusted[k] !== undefined) adjusted[k] = +(toNum(adjusted[k], 0) * priceRatio).toFixed(2);
    });

    return adjusted;
  }

  function getData(sector, countryCode, size) {
    const code = (countryCode || 'SA').toUpperCase();
    const useSize = size || 'medium';
    const tpl = getTemplate(sector, useSize);
    const adjusted = adjustForCountry(tpl, code);
    return adjusted;
  }

  function getMeta(sector, countryCode) {
    const code = (countryCode || 'SA').toUpperCase();
    const base = countryBaseParams[code] || countryBaseParams.SA;
    const cat = getCategory(sector);
    return {
      sources: {
        wages: 'Country minimum-wage / expat sector wage benchmarks',
        electricity: 'Industrial electricity tariff estimates',
        water: 'Industrial water tariff estimates',
        construction: 'Local construction cost benchmarks'
      },
      urls: {},
      confidence: base.confidence,
      lastUpdated: '2026-08-01',
      regulations: {
        licenses: ['Commercial registration', 'Municipality / trade license'],
        standards: ['Sector-specific local standards'],
        notes: `Fallback benchmarks for ${cat}. Review against actual quotations.`
      },
      competitors: []
    };
  }

  global.BondsSectorDataFallback = {
    getData,
    getMeta,
    getFieldMap,
    getTemplate,
    getCategory,
    countryBaseParams,
    sectorCategories,
    categoryTemplates
  };
})(window);
