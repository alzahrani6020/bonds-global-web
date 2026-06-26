/**
 * BONDS Valuation Standards (BVS)
 *
 * Central standards layer for all valuation engines.
 * No engine may calculate a valuation without referencing BVS.
 * Every factor has: weight, calculation method, verification method,
 * data source, and confidence level.
 */
(function () {
  'use strict';

  const BVS_VERSION = '1.0.0';

  function factor(name, weight, calc, verify, source, confidence) {
    return {
      name,
      weight: Math.max(0, Math.min(1, weight)),
      calculationMethod: calc,
      verificationMethod: verify,
      dataSource: source,
      confidenceLevel: Math.max(0, Math.min(1, confidence))
    };
  }

  const BVS_STANDARDS = {
    realEstate: {
      id: 'realEstate',
      nameAr: 'العقارات',
      nameEn: 'Real Estate',
      factors: [
        factor('conditionScore', 0.12, 'Physical inspection + market comparables', 'Licensed inspector report', 'Primary: inspection; Secondary: market listings', 0.85),
        factor('locationPremium', 0.18, 'Price differential vs city average', 'Comparable sales within 1km radius', 'Market transaction database', 0.80),
        factor('areaSqm', 0.10, 'Measured area x comparable price/m2', 'Survey report or title deed', 'Land registry / surveyor', 0.95),
        factor('monthlyRent', 0.15, 'Contracted or market rent', 'Lease agreement or rent comparables', 'Rental listings / lease contracts', 0.75),
        factor('occupancyRate', 0.10, 'Actual occupied days / 365', 'Tenant records or utility consumption', 'Property management reports', 0.80),
        factor('demandIndex', 0.08, 'Transaction volume + days on market', 'Market absorption reports', 'Real estate exchanges / brokers', 0.70),
        factor('supplyIndex', 0.06, 'Active competing listings', 'Listing databases', 'Property portals', 0.70),
        factor('infrastructurePlans', 0.07, 'Planned public/transport projects within 5 years', 'Municipal plans / press releases', 'Government sources', 0.65),
        factor('esgScore', 0.05, 'Energy efficiency + sustainability rating', 'Certification (LEAD/Estidama/etc)', 'Certification bodies', 0.60),
        factor('regulatoryRisk', 0.05, 'Zoning and compliance risk', 'Legal due diligence', 'Municipality / legal counsel', 0.70),
        factor('marketGrowthRate', 0.04, 'Historical + forecast price growth', 'Index data', 'Central bank / RE index', 0.65)
      ],
      outputWeights: { book: 0.20, market: 0.35, income: 0.40, liquidation: 0.05 },
      valuationMethods: ['Cost Approach', 'Market Approach', 'Income Approach'],
      minFactorsRequired: 6
    },
    business: {
      id: 'business',
      nameAr: 'الشركات',
      nameEn: 'Business',
      factors: [
        factor('annualRevenue', 0.15, 'Audited trailing 12 months revenue', 'Financial statements', 'Company accounts / auditor', 0.90),
        factor('ebitdaMargin', 0.12, 'EBITDA / Revenue', 'Audited financials', 'Company accounts / auditor', 0.85),
        factor('revenueGrowthRate', 0.10, 'YoY revenue growth', 'Historical financials', 'Company accounts', 0.75),
        factor('discountRate', 0.10, 'WACC or required return', 'Comparable WACC + risk premium', 'Market data / DCF models', 0.70),
        factor('brandStrength', 0.08, 'Brand valuation via royalty relief', 'Brand audits / market share', 'Industry reports', 0.65),
        factor('customerRelationships', 0.08, 'Concentration + retention metrics', 'CRM data / contracts', 'Company systems', 0.70),
        factor('managementQuality', 0.07, 'Governance + track record score', 'Background checks + board review', 'Due diligence', 0.65),
        factor('marketGrowth', 0.07, 'Sector CAGR forecast', 'Industry reports', 'Research firms / government', 0.70),
        factor('proprietaryTechnology', 0.06, 'Patents / IP value', 'IP audit', 'Patent office / IP counsel', 0.75),
        factor('regulatoryRisk', 0.05, 'Sector-specific compliance risk', 'Legal due diligence', 'Regulatory filings', 0.65),
        factor('successionRisk', 0.05, 'Key person dependency', 'Management interviews', 'Due diligence', 0.60),
        factor('esgScore', 0.04, 'ESG maturity', 'ESG assessment', 'ESG rating providers', 0.55),
        factor('goodwillImpairment', 0.03, 'Impairment test vs recoverable amount', 'Audit impairment note', 'Audited financials', 0.80)
      ],
      outputWeights: { book: 0.15, market: 0.30, income: 0.50, liquidation: 0.05 },
      valuationMethods: ['Income Approach (DCF)', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 7
    },
    factory: {
      id: 'factory',
      nameAr: 'المصانع',
      nameEn: 'Factory',
      factors: [
        factor('landCost', 0.10, 'Market value of land', 'Title deed / comparable land sales', 'Land registry', 0.85),
        factor('buildingCost', 0.10, 'Replacement cost of buildings', 'Construction cost index', 'Cost databases', 0.80),
        factor('machineryCost', 0.15, 'Replacement cost of machinery', 'Supplier quotes / cost guides', 'Vendor quotes', 0.80),
        factor('capacityUtilization', 0.12, 'Actual output / capacity', 'Production records', 'ERP / production reports', 0.85),
        factor('annualCapacityUnits', 0.08, 'Nameplate capacity', 'Engineering specs', 'Equipment manuals', 0.90),
        factor('unitPrice', 0.08, 'Average selling price', 'Sales contracts', 'Invoices / contracts', 0.80),
        factor('variableCostPerUnit', 0.08, 'Direct cost per unit', 'Cost accounting', 'ERP / finance', 0.80),
        factor('annualFixedCosts', 0.07, 'Overhead + fixed operating costs', 'Financial statements', 'Company accounts', 0.75),
        factor('functionalObsolescence', 0.07, 'Technology gap penalty', 'Engineering assessment', 'Technical audit', 0.70),
        factor('workforceSkill', 0.06, 'Labor competency index', 'HR records + certifications', 'Company HR', 0.65),
        factor('licensesValue', 0.05, 'Regulatory permits value', 'Permit transfer value', 'Government / market', 0.70),
        factor('patentsValue', 0.04, 'IP associated with production', 'IP valuation', 'IP counsel', 0.70)
      ],
      outputWeights: { book: 0.25, market: 0.30, income: 0.40, liquidation: 0.05 },
      valuationMethods: ['Cost Approach', 'Income Approach', 'Market Approach'],
      minFactorsRequired: 7
    },
    machineryEquipment: {
      id: 'machineryEquipment',
      nameAr: 'الآلات والمعدات',
      nameEn: 'Machinery & Equipment',
      factors: [
        factor('purchasePrice', 0.12, 'Original acquisition cost', 'Invoice / PO', 'Accounting records', 0.90),
        factor('replacementCostNew', 0.15, 'Current new replacement cost', 'Supplier quotes / cost guides', 'Vendor quotes', 0.80),
        factor('conditionScore', 0.12, 'Physical condition 1-10', 'Inspection report', 'Engineer inspection', 0.80),
        factor('yearAcquired', 0.08, 'Age basis for depreciation', 'Asset register', 'Fixed asset register', 0.95),
        factor('usefulLifeYears', 0.08, 'Expected service life', 'Manufacturer specs / industry norms', 'OEM / standards', 0.80),
        factor('obsolescenceFactor', 0.10, 'Technological obsolescence', 'Technology benchmarking', 'Market research', 0.70),
        factor('utilizationRate', 0.10, 'Operating hours / available hours', 'Machine logs', 'IoT / maintenance logs', 0.85),
        factor('monthlyOperatingRevenue', 0.08, 'Income generated by asset', 'Utilization contracts', 'Billing records', 0.70),
        factor('maintenanceLevel', 0.07, 'Preventive maintenance score', 'Maintenance records', 'CMMS', 0.75),
        factor('inspectionScore', 0.06, 'Last inspection result', 'Certified inspection', 'Inspection report', 0.80),
        factor('demandIndex', 0.04, 'Secondary market demand', 'Auction results', 'Equipment marketplaces', 0.65)
      ],
      outputWeights: { book: 0.25, market: 0.35, income: 0.35, liquidation: 0.05 },
      valuationMethods: ['Cost Approach', 'Market Approach', 'Income Approach'],
      minFactorsRequired: 6
    },
    vehiclesFleet: {
      id: 'vehiclesFleet',
      nameAr: 'المركبات والأساطيل',
      nameEn: 'Vehicles & Fleet',
      factors: [
        factor('purchasePrice', 0.12, 'Original cost', 'Invoice', 'Accounting records', 0.90),
        factor('replacementCostNew', 0.15, 'Current new equivalent price', 'Dealer / market listings', 'Market data', 0.80),
        factor('conditionScore', 0.12, 'Mechanical + body condition', 'Inspection report', 'Workshop report', 0.80),
        factor('yearAcquired', 0.10, 'Age for depreciation', 'Registration / invoice', 'Asset register', 0.95),
        factor('mileageKm', 0.10, 'Odometer reading', 'Physical check / telematics', 'Vehicle systems', 0.85),
        factor('utilizationRate', 0.10, 'Usage vs availability', 'Fleet logs', 'Fleet management system', 0.80),
        factor('monthlyOperatingRevenue', 0.08, 'Revenue per vehicle', 'Contracts / billing', 'Operations', 0.70),
        factor('obsolescenceFactor', 0.08, 'Emission/tech obsolescence', 'Regulatory standards', 'Regulatory sources', 0.70),
        factor('maintenanceLevel', 0.07, 'Service history score', 'Service records', 'Workshop / fleet system', 0.80),
        factor('demandIndex', 0.04, 'Resale market demand', 'Used vehicle listings', 'Auto marketplaces', 0.65),
        factor('supplyIndex', 0.04, 'Availability of similar units', 'Listing databases', 'Auto marketplaces', 0.65)
      ],
      outputWeights: { book: 0.20, market: 0.45, income: 0.30, liquidation: 0.05 },
      valuationMethods: ['Cost Approach', 'Market Approach', 'Income Approach'],
      minFactorsRequired: 6
    },
    medicalEquipment: {
      id: 'medicalEquipment',
      nameAr: 'الأجهزة والمعدات الطبية',
      nameEn: 'Medical Equipment',
      factors: [
        factor('purchasePrice', 0.10, 'Acquisition cost', 'Invoice / PO', 'Accounting records', 0.90),
        factor('replacementCostNew', 0.15, 'Current new replacement', 'Vendor quote', 'Medical suppliers', 0.80),
        factor('conditionScore', 0.12, 'Functional + cosmetic condition', 'Biomedical inspection', 'Hospital engineering', 0.80),
        factor('yearAcquired', 0.08, 'Age basis', 'Asset register', 'Fixed asset register', 0.95),
        factor('usefulLifeYears', 0.08, 'Clinical useful life', 'Manufacturer / standards', 'OEM / healthcare standards', 0.80),
        factor('regulatoryCertification', 0.10, 'SFDA/FDA/CE status', 'Certification documents', 'Regulatory bodies', 0.85),
        factor('utilizationRate', 0.10, 'Usage hours / capacity', 'Utilization logs', 'Hospital systems', 0.80),
        factor('maintenanceContractValue', 0.08, 'Service contract value', 'Contract value', 'Vendor contracts', 0.75),
        factor('accreditationValue', 0.07, 'Accreditation-linked value', 'Accreditation body', 'Accreditation reports', 0.70),
        factor('obsolescenceFactor', 0.07, 'Technology obsolescence', 'Technology roadmap', 'Industry research', 0.70),
        factor('monthlyOperatingRevenue', 0.05, 'Revenue generated per device', 'Billing records', 'Hospital billing', 0.65)
      ],
      outputWeights: { book: 0.25, market: 0.30, income: 0.40, liquidation: 0.05 },
      valuationMethods: ['Cost Approach', 'Income Approach', 'Market Approach'],
      minFactorsRequired: 6
    },
    educationalEquipment: {
      id: 'educationalEquipment',
      nameAr: 'التجهيزات التعليمية',
      nameEn: 'Educational Equipment',
      factors: [
        factor('purchasePrice', 0.12, 'Acquisition cost', 'Invoice', 'Accounting records', 0.90),
        factor('replacementCostNew', 0.15, 'Current replacement cost', 'Vendor quotes', 'Suppliers', 0.80),
        factor('conditionScore', 0.12, 'Functional condition', 'Inspection', 'Facilities team', 0.80),
        factor('yearAcquired', 0.09, 'Age basis', 'Asset register', 'Fixed asset register', 0.95),
        factor('usefulLifeYears', 0.09, 'Expected life', 'Manufacturer / standards', 'OEM', 0.80),
        factor('certificationValue', 0.10, 'Curriculum accreditation value', 'Accreditation body', 'Education authorities', 0.70),
        factor('utilizationRate', 0.10, 'Class/lab usage', 'Timetable data', 'School systems', 0.80),
        factor('obsolescenceFactor', 0.08, 'Ed-tech obsolescence', 'Technology review', 'Ed-tech research', 0.70),
        factor('maintenanceLevel', 0.07, 'Maintenance history', 'Service records', 'Facilities', 0.75),
        factor('monthlyOperatingRevenue', 0.05, 'Fee income attributed', 'Billing allocation', 'Finance', 0.60),
        factor('demandIndex', 0.03, 'Secondary market demand', 'Listings', 'Used equipment market', 0.60)
      ],
      outputWeights: { book: 0.30, market: 0.30, income: 0.35, liquidation: 0.05 },
      valuationMethods: ['Cost Approach', 'Income Approach', 'Market Approach'],
      minFactorsRequired: 6
    },
    agricultureFarms: {
      id: 'agricultureFarms',
      nameAr: 'الزراعة والمزارع',
      nameEn: 'Agriculture & Farms',
      factors: [
        factor('purchasePrice', 0.08, 'Land + development cost', 'Title / invoices', 'Land registry', 0.85),
        factor('areaUnits', 0.10, 'Farm area', 'Survey', 'Surveyor', 0.90),
        factor('landQualityScore', 0.10, 'Soil quality + fertility', 'Soil test', 'Agricultural lab', 0.75),
        factor('waterAvailabilityScore', 0.10, 'Water access reliability', 'Water rights / well logs', 'Ministry / well reports', 0.75),
        factor('yieldPerUnit', 0.12, 'Production per hectare', 'Harvest records', 'Farm records', 0.80),
        factor('marketPricePerUnit', 0.10, 'Crop market price', 'Commodity exchange', 'Market data', 0.75),
        factor('feedCost', 0.07, 'Input cost (if livestock)', 'Purchase records', 'Suppliers', 0.75),
        factor('otherOperatingCosts', 0.07, 'Labor + fuel + other', 'Farm accounts', 'Accounting', 0.70),
        factor('certificationValue', 0.08, 'Organic / quality certs', 'Certification body', 'Certifiers', 0.70),
        factor('conditionScore', 0.06, 'Infrastructure condition', 'Inspection', 'Agronomist', 0.75),
        factor('mortalityRate', 0.06, 'Livestock loss rate', 'Veterinary records', 'Farm records', 0.70),
        factor('marketGrowthRate', 0.06, 'Agricultural commodity growth', 'Index data', 'Commodity exchanges', 0.65)
      ],
      outputWeights: { book: 0.25, market: 0.35, income: 0.35, liquidation: 0.05 },
      valuationMethods: ['Income Approach', 'Cost Approach', 'Market Approach'],
      minFactorsRequired: 6
    },
    livestock: {
      id: 'livestock',
      nameAr: 'الثروة الحيوانية',
      nameEn: 'Livestock',
      factors: [
        factor('quantityUnits', 0.15, 'Headcount', 'Physical count', 'Farm records', 0.90),
        factor('marketPricePerUnit', 0.15, 'Market price per head', 'Livestock market', 'Market data', 0.80),
        factor('conditionScore', 0.10, 'Health / condition', 'Veterinary inspection', 'Vet report', 0.80),
        factor('mortalityRate', 0.10, 'Historical mortality', 'Veterinary records', 'Farm records', 0.75),
        factor('feedCost', 0.10, 'Annual feed cost', 'Purchase records', 'Suppliers', 0.75),
        factor('veterinaryCost', 0.08, 'Healthcare cost', 'Vet bills', 'Vet records', 0.75),
        factor('yieldPerUnit', 0.10, 'Milk/egg/meat yield', 'Production records', 'Farm records', 0.80),
        factor('qualityScore', 0.08, 'Breed / quality grade', 'Certification / inspection', 'Breed registry', 0.75),
        factor('biologicalAgeYears', 0.07, 'Age for depreciation', 'Farm records', 'Farm records', 0.85),
        factor('landQualityScore', 0.04, 'Pasture quality', 'Agronomist', 'Farm assessment', 0.70),
        factor('marketGrowthRate', 0.03, 'Livestock price growth', 'Market data', 'Commodity data', 0.65)
      ],
      outputWeights: { book: 0.20, market: 0.45, income: 0.30, liquidation: 0.05 },
      valuationMethods: ['Market Approach', 'Income Approach', 'Cost Approach'],
      minFactorsRequired: 6
    },
    naturalResourcesMining: {
      id: 'naturalResourcesMining',
      nameAr: 'الموارد الطبيعية والتعدين',
      nameEn: 'Natural Resources & Mining',
      factors: [
        factor('reserveUnits', 0.15, 'Proven + probable reserves', 'JORC/NI 43-101 report', 'Geological report', 0.80),
        factor('commodityPricePerUnit', 0.15, 'Spot / forward commodity price', 'Commodity exchange', 'Market data', 0.80),
        factor('extractionCostPerUnit', 0.12, 'All-in sustaining cost', 'Mine plan', 'Technical report', 0.75),
        factor('reserveGrade', 0.10, 'Ore grade / purity', 'Assay reports', 'Lab assays', 0.80),
        factor('licenseExpiryYears', 0.10, 'Remaining license life', 'License document', 'Government', 0.85),
        factor('utilizationRate', 0.08, 'Production / capacity', 'Mine records', 'Operations', 0.80),
        factor('annualFixedCosts', 0.08, 'Fixed operating costs', 'Financial statements', 'Company accounts', 0.75),
        factor('environmentalComplianceScore', 0.08, 'Environmental permits status', 'Regulatory audit', 'Environmental agencies', 0.70),
        factor('discountRate', 0.07, 'Project discount rate', 'WACC + country risk', 'Market data', 0.65),
        factor('marketGrowthRate', 0.04, 'Commodity demand growth', 'Industry forecast', 'Research firms', 0.65),
        factor('geopoliticalRisk', 0.03, 'Country/political risk', 'Risk ratings', 'Risk indices', 0.60)
      ],
      outputWeights: { book: 0.15, market: 0.35, income: 0.45, liquidation: 0.05 },
      valuationMethods: ['Income Approach (DCF)', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 7
    },
    oilGas: {
      id: 'oilGas',
      nameAr: 'النفط والغاز',
      nameEn: 'Oil & Gas Assets',
      factors: [
        factor('reserveUnits', 0.15, 'Proven reserves (boepd or bbl)', 'Reserves report', 'Petroleum engineer', 0.80),
        factor('commodityPricePerUnit', 0.15, 'Oil/gas price forecast', 'Futures curve', 'Commodity exchanges', 0.80),
        factor('extractionCostPerUnit', 0.12, 'Lifting cost', 'Operator reports', 'Company data', 0.75),
        factor('licenseExpiryYears', 0.10, 'Concession remaining life', 'Concession agreement', 'Government', 0.85),
        factor('utilizationRate', 0.08, 'Production / facility capacity', 'Production reports', 'Operations', 0.80),
        factor('annualFixedCosts', 0.08, 'Facility fixed costs', 'Financial statements', 'Company accounts', 0.75),
        factor('environmentalComplianceScore', 0.08, 'Emissions / permits', 'Regulatory audit', 'Environmental agencies', 0.70),
        factor('discountRate', 0.08, 'Project discount rate', 'WACC + country risk', 'Market data', 0.65),
        factor('reserveGrade', 0.06, 'Reservoir quality', 'Petrophysical analysis', 'Technical report', 0.75),
        factor('marketGrowthRate', 0.05, 'Demand growth forecast', 'Industry forecast', 'Research firms', 0.65),
        factor('geopoliticalRisk', 0.03, 'Country risk', 'Risk ratings', 'Risk indices', 0.60)
      ],
      outputWeights: { book: 0.15, market: 0.35, income: 0.45, liquidation: 0.05 },
      valuationMethods: ['Income Approach (DCF)', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 7
    },
    infrastructure: {
      id: 'infrastructure',
      nameAr: 'البنية التحتية',
      nameEn: 'Infrastructure',
      factors: [
        factor('landCost', 0.10, 'Land acquisition cost', 'Title / invoices', 'Land registry', 0.85),
        factor('developmentCost', 0.12, 'Construction cost', 'Cost records', 'Cost databases', 0.80),
        factor('equipmentCost', 0.10, 'Infrastructure equipment', 'Asset register', 'Fixed asset register', 0.85),
        factor('capacityUnits', 0.10, 'Design capacity', 'Engineering specs', 'Engineering report', 0.90),
        factor('tariffRevenuePerUnit', 0.12, 'Tariff or usage fee', 'Concession agreement', 'Contract', 0.80),
        factor('utilizationRate', 0.10, 'Actual usage / capacity', 'Usage data', 'Operations', 0.85),
        factor('licenseExpiryYears', 0.10, 'Concession life', 'Agreement', 'Government / contract', 0.85),
        factor('annualFixedCosts', 0.08, 'O&M fixed costs', 'Financial statements', 'Company accounts', 0.75),
        factor('discountRate', 0.08, 'Project discount rate', 'WACC + project risk', 'Market data', 0.65),
        factor('esgScore', 0.05, 'Sustainability metrics', 'ESG assessment', 'ESG reports', 0.60),
        factor('marketGrowthRate', 0.05, 'Usage growth forecast', 'Traffic / demand studies', 'Consultants', 0.65)
      ],
      outputWeights: { book: 0.20, market: 0.25, income: 0.50, liquidation: 0.05 },
      valuationMethods: ['Income Approach (DCF)', 'Cost Approach', 'Market Approach'],
      minFactorsRequired: 7
    },
    intellectualProperty: {
      id: 'intellectualProperty',
      nameAr: 'الملكية الفكرية',
      nameEn: 'Intellectual Property',
      factors: [
        factor('purchasePrice', 0.08, 'Acquisition cost', 'Invoice', 'Accounting records', 0.80),
        factor('accumulatedAmortization', 0.07, 'Amortization to date', 'Financial statements', 'Company accounts', 0.85),
        factor('comparableTransactionValue', 0.12, 'Comparable IP transactions', 'Market comparables', 'IP broker / databases', 0.70),
        factor('annualRevenue', 0.12, 'Revenue attributable to IP', 'Royalty analysis', 'Company accounts', 0.75),
        factor('royaltyRate', 0.12, 'Notional royalty rate', 'Industry benchmarks', 'Royalty databases', 0.75),
        factor('remainingLifeYears', 0.10, 'Remaining legal/economic life', 'Patent / contract term', 'Patent office', 0.80),
        factor('discountRate', 0.08, 'IP-specific discount rate', 'Risk-adjusted WACC', 'Market data', 0.65),
        factor('brandStrength', 0.08, 'IP strength / market position', 'Market research', 'Industry reports', 0.65),
        factor('legalProtectionScore', 0.10, 'Patent breadth / enforceability', 'IP counsel opinion', 'Legal counsel', 0.75),
        factor('marketShare', 0.08, 'Market share protected by IP', 'Market research', 'Industry reports', 0.70),
        factor('growthRate', 0.05, 'Revenue growth attributable to IP', 'Forecasts', 'Company projections', 0.65)
      ],
      outputWeights: { book: 0.10, market: 0.20, income: 0.65, liquidation: 0.05 },
      valuationMethods: ['Income Approach (Relief from Royalty)', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 6
    },
    brandsTrademarks: {
      id: 'brandsTrademarks',
      nameAr: 'العلامات التجارية',
      nameEn: 'Brands & Trademarks',
      factors: [
        factor('purchasePrice', 0.08, 'Acquisition cost', 'Invoice', 'Accounting records', 0.80),
        factor('accumulatedAmortization', 0.07, 'Amortization', 'Financial statements', 'Company accounts', 0.85),
        factor('annualRevenue', 0.15, 'Brand-attributable revenue', 'Brand revenue split', 'Company analysis', 0.75),
        factor('royaltyRate', 0.15, 'Appropriate royalty rate', 'Industry benchmarks', 'Royalty databases', 0.75),
        factor('brandStrength', 0.12, 'Brand equity score', 'Brand valuation study', 'Research firms', 0.70),
        factor('marketShare', 0.10, 'Market share', 'Market research', 'Industry reports', 0.75),
        factor('remainingLifeYears', 0.08, 'Brand economic life', 'Market research', 'Industry analysis', 0.70),
        factor('discountRate', 0.08, 'Brand-specific discount', 'Risk-adjusted rate', 'Market data', 0.65),
        factor('legalProtectionScore', 0.08, 'Trademark protection', 'Trademark register', 'IP office', 0.80),
        factor('growthRate', 0.05, 'Brand revenue growth', 'Forecasts', 'Company projections', 0.65),
        factor('comparableTransactionValue', 0.04, 'Comparable brand deals', 'Market data', 'M&A databases', 0.60)
      ],
      outputWeights: { book: 0.10, market: 0.30, income: 0.55, liquidation: 0.05 },
      valuationMethods: ['Income Approach (Relief from Royalty)', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 6
    },
    patents: {
      id: 'patents',
      nameAr: 'براءات الاختراع',
      nameEn: 'Patents',
      factors: [
        factor('purchasePrice', 0.08, 'Acquisition / filing cost', 'Invoice / patent office', 'Accounting records', 0.80),
        factor('accumulatedAmortization', 0.07, 'Amortization', 'Financial statements', 'Company accounts', 0.85),
        factor('annualRevenue', 0.12, 'Revenue from patented products', 'Product line P&L', 'Company accounts', 0.75),
        factor('royaltyRate', 0.12, 'Industry royalty rate', 'Benchmarks', 'Royalty databases', 0.75),
        factor('remainingLifeYears', 0.12, 'Patent remaining term', 'Patent office', 'Patent register', 0.90),
        factor('legalProtectionScore', 0.12, 'Patent strength / claims', 'IP counsel', 'Legal counsel', 0.80),
        factor('marketShare', 0.10, 'Protected market share', 'Market research', 'Industry reports', 0.70),
        factor('discountRate', 0.08, 'Technology risk-adjusted rate', 'WACC + tech risk', 'Market data', 0.65),
        factor('brandStrength', 0.06, 'Technology reputation', 'Market research', 'Industry reports', 0.65),
        factor('growthRate', 0.05, 'Revenue growth', 'Forecasts', 'Company projections', 0.65),
        factor('comparableTransactionValue', 0.05, 'Comparable patent deals', 'Market data', 'IP databases', 0.60)
      ],
      outputWeights: { book: 0.15, market: 0.20, income: 0.60, liquidation: 0.05 },
      valuationMethods: ['Income Approach (Relief from Royalty)', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 6
    },
    copyrightsContent: {
      id: 'copyrightsContent',
      nameAr: 'حقوق المؤلف والمحتوى',
      nameEn: 'Copyrights & Content',
      factors: [
        factor('purchasePrice', 0.07, 'Acquisition / creation cost', 'Invoice', 'Accounting records', 0.75),
        factor('accumulatedAmortization', 0.06, 'Amortization', 'Financial statements', 'Company accounts', 0.85),
        factor('annualRevenue', 0.15, 'Content licensing revenue', 'Royalty reports', 'Company accounts', 0.75),
        factor('royaltyRate', 0.14, 'Content royalty rate', 'Industry benchmarks', 'Royalty databases', 0.75),
        factor('remainingLifeYears', 0.10, 'Economic life of content', 'Contract / catalog analysis', 'Legal / market', 0.70),
        factor('brandStrength', 0.10, 'Creator / catalog reputation', 'Market research', 'Streaming data', 0.70),
        factor('marketShare', 0.08, 'Audience share', 'Platform analytics', 'Streaming platforms', 0.75),
        factor('discountRate', 0.08, 'Content-specific discount', 'Risk-adjusted rate', 'Market data', 0.65),
        factor('legalProtectionScore', 0.08, 'Copyright registration / enforcement', 'Copyright office', 'Legal counsel', 0.75),
        factor('growthRate', 0.06, 'Licensing growth', 'Forecasts', 'Company projections', 0.60),
        factor('comparableTransactionValue', 0.04, 'Comparable catalog deals', 'Market data', 'M&A databases', 0.60)
      ],
      outputWeights: { book: 0.10, market: 0.15, income: 0.70, liquidation: 0.05 },
      valuationMethods: ['Income Approach (Relief from Royalty)', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 6
    },
    franchises: {
      id: 'franchises',
      nameAr: 'الامتيازات التجارية',
      nameEn: 'Franchises',
      factors: [
        factor('purchasePrice', 0.08, 'Franchise fee paid', 'Agreement / invoice', 'Accounting records', 0.80),
        factor('accumulatedAmortization', 0.06, 'Amortization', 'Financial statements', 'Company accounts', 0.85),
        factor('annualRevenue', 0.15, 'Franchisee revenue', 'Financial statements', 'Company accounts', 0.80),
        factor('royaltyRate', 0.12, 'Franchise royalty rate', 'Franchise agreement', 'Contract', 0.90),
        factor('brandStrength', 0.12, 'Franchisor brand strength', 'Brand studies', 'Research firms', 0.70),
        factor('remainingLifeYears', 0.10, 'Remaining franchise term', 'Franchise agreement', 'Contract', 0.90),
        factor('marketShare', 0.08, 'Market presence', 'Market research', 'Industry reports', 0.70),
        factor('discountRate', 0.08, 'Franchise risk-adjusted rate', 'WACC + franchise risk', 'Market data', 0.65),
        factor('legalProtectionScore', 0.07, 'Territory protection', 'Franchise agreement', 'Legal counsel', 0.75),
        factor('growthRate', 0.06, 'Revenue growth', 'Forecasts', 'Company projections', 0.65),
        factor('comparableTransactionValue', 0.04, 'Comparable franchise sales', 'Market data', 'Brokers', 0.60)
      ],
      outputWeights: { book: 0.10, market: 0.25, income: 0.60, liquidation: 0.05 },
      valuationMethods: ['Income Approach', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 6
    },
    licensesPermits: {
      id: 'licensesPermits',
      nameAr: 'التراخيص والتصاريح',
      nameEn: 'Licenses & Permits',
      factors: [
        factor('purchasePrice', 0.10, 'Acquisition cost', 'Invoice / agreement', 'Accounting records', 0.80),
        factor('accumulatedAmortization', 0.07, 'Amortization', 'Financial statements', 'Company accounts', 0.85),
        factor('licenseFeeAnnual', 0.15, 'Annual license fee / avoided cost', 'Agreement / market', 'Contract / comparables', 0.80),
        factor('remainingLifeYears', 0.15, 'Remaining license term', 'License document', 'Government / contract', 0.90),
        factor('royaltyRate', 0.10, 'Industry benchmark fee', 'Market comparables', 'Market data', 0.70),
        factor('marketShare', 0.08, 'Market access enabled', 'Market research', 'Industry reports', 0.65),
        factor('regulatoryRisk', 0.10, 'Renewal / cancellation risk', 'Legal due diligence', 'Regulatory sources', 0.70),
        factor('discountRate', 0.08, 'License-specific discount', 'Risk-adjusted rate', 'Market data', 0.65),
        factor('comparableTransactionValue', 0.05, 'Comparable license deals', 'Market data', 'Brokers', 0.60),
        factor('growthRate', 0.05, 'Fee growth', 'Forecasts', 'Company / market', 0.60),
        factor('legalProtectionScore', 0.07, 'Exclusivity / transferability', 'License agreement', 'Legal counsel', 0.75)
      ],
      outputWeights: { book: 0.15, market: 0.25, income: 0.55, liquidation: 0.05 },
      valuationMethods: ['Income Approach', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 6
    },
    financialAssets: {
      id: 'financialAssets',
      nameAr: 'الأصول المالية',
      nameEn: 'Financial Assets',
      factors: [
        factor('quantityUnits', 0.15, 'Number of units', 'Broker statement', 'Custodian', 0.95),
        factor('marketPricePerUnit', 0.20, 'Market price', 'Exchange quote', 'Stock exchange', 0.95),
        factor('purchasePrice', 0.10, 'Cost basis', 'Trade confirmation', 'Broker records', 0.90),
        factor('liquidityScore', 0.10, 'Average daily volume / bid-ask', 'Market data', 'Exchange', 0.85),
        factor('volatilityIndex', 0.10, 'Historical volatility', 'Market data', 'Exchange / Bloomberg', 0.80),
        factor('dividendYield', 0.08, 'Dividend / distribution yield', 'Company distributions', 'Issuer', 0.80),
        factor('custodyScore', 0.07, 'Custody / safekeeping quality', 'Custodian rating', 'Custodian', 0.85),
        factor('demandIndex', 0.06, 'Buy-side demand', 'Market data', 'Exchange', 0.70),
        factor('supplyIndex', 0.05, 'Float / supply', 'Market data', 'Exchange', 0.75),
        factor('marketGrowthRate', 0.05, 'Sector growth', 'Index data', 'Research', 0.65),
        factor('currencyRisk', 0.04, 'FX exposure', 'FX rates', 'Market data', 0.75)
      ],
      outputWeights: { book: 0.20, market: 0.60, income: 0.15, liquidation: 0.05 },
      valuationMethods: ['Market Approach', 'Income Approach', 'Cost Approach'],
      minFactorsRequired: 5
    },
    cryptoDigital: {
      id: 'cryptoDigital',
      nameAr: 'العملات الرقمية والأصول الرقمية',
      nameEn: 'Crypto & Digital Assets',
      factors: [
        factor('quantityUnits', 0.15, 'Token count', 'Wallet / exchange', 'Blockchain / exchange', 0.90),
        factor('marketPricePerUnit', 0.20, 'Spot price', 'Exchange API', 'Crypto exchanges', 0.85),
        factor('purchasePrice', 0.08, 'Cost basis', 'Exchange records', 'Exchange', 0.85),
        factor('volatilityIndex', 0.15, '90-day volatility', 'Market data', 'Crypto data providers', 0.80),
        factor('liquidityScore', 0.12, 'Exchange volume / depth', 'Market data', 'CoinMarketCap / exchanges', 0.75),
        factor('custodyScore', 0.10, 'Wallet security / custody', 'Security audit', 'Custodian / self-custody', 0.75),
        factor('stakingYield', 0.08, 'Annual yield', 'Protocol data', 'On-chain / protocol', 0.70),
        factor('demandIndex', 0.05, 'Network activity / adoption', 'On-chain metrics', 'Blockchain analytics', 0.70),
        factor('regulatoryRisk', 0.04, 'Jurisdiction risk', 'Legal analysis', 'Regulatory news', 0.60),
        factor('marketGrowthRate', 0.03, 'Crypto market growth', 'Index data', 'Market data', 0.55)
      ],
      outputWeights: { book: 0.15, market: 0.60, income: 0.20, liquidation: 0.05 },
      valuationMethods: ['Market Approach', 'Income Approach', 'Cost Approach'],
      minFactorsRequired: 5
    },
    commodities: {
      id: 'commodities',
      nameAr: 'السلع',
      nameEn: 'Commodities',
      factors: [
        factor('quantityUnits', 0.20, 'Quantity held', 'Warehouse receipt', 'Warehouse / inventory', 0.90),
        factor('spotPricePerUnit', 0.25, 'Spot market price', 'Commodity exchange', 'Exchange', 0.90),
        factor('purityFactor', 0.10, 'Quality / grade adjustment', 'Assay / grading', 'Certifiers', 0.80),
        factor('purchasePrice', 0.08, 'Cost basis', 'Invoice', 'Accounting records', 0.85),
        factor('storageCost', 0.07, 'Carrying cost', 'Warehouse invoice', 'Warehouse', 0.80),
        factor('insuranceCost', 0.06, 'Insurance cost', 'Policy', 'Insurer', 0.80),
        factor('demandIndex', 0.07, 'Market demand', 'Exchange data', 'Commodity exchange', 0.75),
        factor('supplyIndex', 0.06, 'Market supply', 'Exchange data', 'Commodity exchange', 0.75),
        factor('marketVolatility', 0.06, 'Price volatility', 'Historical data', 'Exchange', 0.75),
        factor('marketGrowthRate', 0.05, 'Demand growth', 'Forecasts', 'Research', 0.65)
      ],
      outputWeights: { book: 0.15, market: 0.65, income: 0.15, liquidation: 0.05 },
      valuationMethods: ['Market Approach', 'Income Approach', 'Cost Approach'],
      minFactorsRequired: 5
    },
    artCollectibles: {
      id: 'artCollectibles',
      nameAr: 'الفنون والمقتنيات',
      nameEn: 'Art & Collectibles',
      factors: [
        factor('purchasePrice', 0.10, 'Acquisition cost', 'Invoice / auction record', 'Provenance records', 0.80),
        factor('comparableTransactionValue', 0.20, 'Comparable auction results', 'Auction databases', 'Christie\'s / Sotheby\'s / Artnet', 0.75),
        factor('rarityScore', 0.15, 'Rarity / scarcity', 'Expert appraisal', 'Appraiser', 0.70),
        factor('provenanceScore', 0.12, 'Ownership history', 'Provenance documentation', 'Gallery / auction house', 0.75),
        factor('authenticationScore', 0.12, 'Authenticity certainty', 'Certificate / expert opinion', 'Authenticators', 0.80),
        factor('conditionScore', 0.10, 'Physical condition', 'Conservator report', 'Conservator', 0.80),
        factor('demandIndex', 0.08, 'Collector demand', 'Auction results', 'Market data', 0.70),
        factor('marketVolatility', 0.06, 'Price volatility', 'Index data', 'Art market indices', 0.65),
        factor('buyerPoolDepth', 0.04, 'Number of likely buyers', 'Market research', 'Auction houses', 0.65),
        factor('marketGrowthRate', 0.03, 'Category growth', 'Index data', 'Art market reports', 0.60)
      ],
      outputWeights: { book: 0.10, market: 0.60, income: 0.05, liquidation: 0.25 },
      valuationMethods: ['Market Approach', 'Cost Approach'],
      minFactorsRequired: 5
    },
    jewelryPreciousMetals: {
      id: 'jewelryPreciousMetals',
      nameAr: 'المجوهرات والمعادن الثمينة',
      nameEn: 'Jewelry & Precious Metals',
      factors: [
        factor('quantityUnits', 0.15, 'Weight / count', 'Scale / inventory', 'Physical count', 0.95),
        factor('spotPricePerUnit', 0.25, 'Spot metal price', 'Exchange', 'Metal exchange', 0.95),
        factor('purityFactor', 0.15, 'Karat / fineness', 'Assay / hallmark', 'Assayer', 0.90),
        factor('purchasePrice', 0.08, 'Cost basis', 'Invoice', 'Accounting records', 0.85),
        factor('premiumRate', 0.10, 'Fabrication / design premium', 'Market comparables', 'Jeweler / auction', 0.75),
        factor('brandPremium', 0.08, 'Brand / maker premium', 'Market comparables', 'Auction data', 0.70),
        factor('conditionScore', 0.08, 'Physical condition', 'Jeweler inspection', 'Jeweler', 0.80),
        factor('authenticationScore', 0.06, 'Authenticity / certification', 'Certificate', 'Gem lab', 0.85),
        factor('demandIndex', 0.05, 'Market demand', 'Market data', 'Jewelry market', 0.70),
        factor('marketVolatility', 0.05, 'Metal price volatility', 'Historical data', 'Exchange', 0.75),
        factor('marketGrowthRate', 0.05, 'Price growth', 'Index data', 'Exchange', 0.65)
      ],
      outputWeights: { book: 0.10, market: 0.70, income: 0.05, liquidation: 0.15 },
      valuationMethods: ['Market Approach', 'Cost Approach'],
      minFactorsRequired: 5
    },
    softwareTechnology: {
      id: 'softwareTechnology',
      nameAr: 'البرمجيات والتقنية',
      nameEn: 'Software & Technology',
      factors: [
        factor('developmentCost', 0.10, 'Capitalized development cost', 'Timesheets / contracts', 'Accounting records', 0.80),
        factor('accumulatedAmortization', 0.07, 'Amortization', 'Financial statements', 'Company accounts', 0.85),
        factor('annualRecurringRevenue', 0.18, 'ARR / MRR x 12', 'Billing system', 'Company data', 0.90),
        factor('revenueMultiple', 0.12, 'SaaS revenue multiple', 'Comparable companies', 'Public markets / M&A', 0.75),
        factor('grossMargin', 0.10, 'Gross margin', 'Financial statements', 'Company accounts', 0.85),
        factor('churnRate', 0.10, 'Logo / revenue churn', 'CRM / billing', 'Company systems', 0.85),
        factor('growthRate', 0.10, 'Revenue growth', 'Financials', 'Company data', 0.80),
        factor('techMoatScore', 0.08, 'Technology differentiation', 'Technical due diligence', 'Experts', 0.70),
        factor('customerAcquisitionCost', 0.05, 'CAC', 'Marketing / sales data', 'Company data', 0.80),
        factor('lifetimeValue', 0.05, 'LTV', 'Retention analysis', 'Company data', 0.75),
        factor('discountRate', 0.05, 'Discount rate', 'WACC + SaaS risk', 'Market data', 0.65)
      ],
      outputWeights: { book: 0.10, market: 0.35, income: 0.50, liquidation: 0.05 },
      valuationMethods: ['Income Approach (DCF)', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 7
    },
    distressedAsset: {
      id: 'distressedAsset',
      nameAr: 'الأصول المتعثرة',
      nameEn: 'Distressed Assets',
      factors: [
        factor('bookValue', 0.10, 'Latest reported book value', 'Financial statements', 'Company accounts', 0.85),
        factor('accumulatedDebt', 0.12, 'Debt / liens', 'Creditor statements', 'Debt register', 0.85),
        factor('marketValue', 0.15, 'Market value pre-distress', 'Appraisal / comparables', 'Appraiser', 0.70),
        factor('distressSeverity', 0.12, 'Distress severity 0-10', 'Due diligence', 'Advisors', 0.70),
        factor('forcedSaleDiscount', 0.10, 'Discount for forced sale', 'Market evidence', 'Auction data', 0.70),
        factor('recoveryRate', 0.10, 'Expected recovery', 'Comparable restructurings', 'Market data', 0.65),
        factor('stabilizedNOI', 0.10, 'Stabilized net operating income', 'Restructuring plan', 'Advisor', 0.65),
        factor('stabilizedCapRate', 0.06, 'Cap rate post-stabilization', 'Market comparables', 'Market data', 0.65),
        factor('restructuringCost', 0.07, 'Cost to stabilize', 'Restructuring plan', 'Advisor', 0.65),
        factor('buyerPoolDepth', 0.04, 'Distressed buyers available', 'Market research', 'Distressed investors', 0.60),
        factor('timeToStabilizeMonths', 0.04, 'Months to stabilization', 'Restructuring plan', 'Advisor', 0.60)
      ],
      outputWeights: { book: 0.25, market: 0.35, income: 0.30, liquidation: 0.10 },
      valuationMethods: ['Liquidation Value', 'Income Approach', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 6
    },
    tourismAsset: {
      id: 'tourismAsset',
      nameAr: 'الأصول السياحية',
      nameEn: 'Tourism Assets',
      factors: [
        factor('purchasePrice', 0.08, 'Acquisition cost', 'Invoice / SPA', 'Accounting records', 0.85),
        factor('improvementCosts', 0.07, 'Renovation / development cost', 'Invoices', 'Accounting records', 0.80),
        factor('dailyVisitors', 0.15, 'Average daily visitors', 'Guest / visitor records', 'Operations', 0.85),
        factor('avgSpendPerVisitor', 0.12, 'Average visitor spend', 'POS data', 'Operations', 0.80),
        factor('occupancyRate', 0.10, 'Occupancy or utilization rate', 'Booking system', 'Operations', 0.85),
        factor('seasonalityFactor', 0.08, 'Seasonal adjustment', 'Historical data', 'Operations', 0.75),
        factor('staffCost', 0.08, 'Annual staff cost', 'Payroll', 'Company accounts', 0.80),
        factor('maintenanceCost', 0.07, 'Annual maintenance', 'Invoices', 'Company accounts', 0.80),
        factor('locationQualityScore', 0.08, 'Tourism location quality', 'Market research', 'Tourism data', 0.75),
        factor('qualityMultiplier', 0.07, 'Quality / star rating multiplier', 'Rating / inspection', 'Tourism authority', 0.75),
        factor('tourismGrowthRate', 0.05, 'Tourism market growth', 'Government / industry data', 'Tourism reports', 0.70),
        factor('capRate', 0.05, 'Capitalization rate', 'Market comparables', 'Hospitality market', 0.70)
      ],
      outputWeights: { book: 0.20, market: 0.30, income: 0.45, liquidation: 0.05 },
      valuationMethods: ['Income Approach', 'Market Approach', 'Cost Approach'],
      minFactorsRequired: 7
    },
    personalWealth: {
      id: 'personalWealth',
      nameAr: 'الثروة الشخصية',
      nameEn: 'Personal Wealth',
      factors: [
        factor('realEstateValue', 0.18, 'Market value of real estate', 'Appraisal', 'Appraiser / listing', 0.80),
        factor('securitiesValue', 0.18, 'Market value of securities', 'Broker statement', 'Exchange / broker', 0.90),
        factor('cashValue', 0.12, 'Cash and deposits', 'Bank statements', 'Banks', 0.95),
        factor('personalAssetsValue', 0.10, 'Valuables / collectibles', 'Appraisal', 'Appraiser', 0.70),
        factor('vehicleValue', 0.08, 'Vehicle market value', 'Market listings', 'Auto market', 0.80),
        factor('mortgageBalance', 0.10, 'Mortgage liability', 'Loan statement', 'Bank', 0.90),
        factor('loansBalance', 0.08, 'Loan liabilities', 'Loan statement', 'Bank', 0.90),
        factor('creditBalance', 0.04, 'Credit card liabilities', 'Statements', 'Banks', 0.90),
        factor('otherLiabilities', 0.04, 'Other liabilities', 'Documentation', 'Records', 0.75),
        factor('marketVolatility', 0.04, 'Portfolio volatility', 'Historical returns', 'Market data', 0.75),
        factor('liquidityRatio', 0.04, 'Liquid assets / total assets', 'Calculated', 'Derived', 0.85)
      ],
      outputWeights: { book: 0.15, market: 0.70, income: 0.10, liquidation: 0.05 },
      valuationMethods: ['Market Approach', 'Cost Approach', 'Income Approach'],
      minFactorsRequired: 6
    },
    scrapSalvage: {
      id: 'scrapSalvage',
      nameAr: 'السكراب والخردة',
      nameEn: 'Scrap & Salvage',
      factors: [
        factor('weightKg', 0.20, 'Weight of scrap material', 'Weighbridge / scale', 'Physical measurement', 0.90),
        factor('marketPricePerKg', 0.25, 'Spot scrap price', 'Commodity exchange / scrap yard', 'Market data', 0.85),
        factor('purityRate', 0.12, 'Material purity', 'Assay / sorting', 'Lab / yard', 0.80),
        factor('recoveryRate', 0.10, 'Recoverable percentage', 'Processing records', 'Processor', 0.75),
        factor('dismantlingCost', 0.08, 'Cost to dismantle', 'Contractor quote', 'Contractor', 0.75),
        factor('transportCost', 0.07, 'Transport cost', 'Logistics quote', 'Transporter', 0.80),
        factor('storageCost', 0.05, 'Storage cost', 'Warehouse invoice', 'Warehouse', 0.80),
        factor('demandIndex', 0.05, 'Scrap demand', 'Market data', 'Scrap market', 0.70),
        factor('supplyIndex', 0.04, 'Scrap supply', 'Market data', 'Scrap market', 0.70),
        factor('priceVolatility', 0.04, 'Price volatility', 'Historical data', 'Market data', 0.75)
      ],
      outputWeights: { book: 0.10, market: 0.70, income: 0.15, liquidation: 0.05 },
      valuationMethods: ['Market Approach', 'Income Approach', 'Cost Approach'],
      minFactorsRequired: 6
    }
  };

  const BVS = {
    version: BVS_VERSION,
    standards: BVS_STANDARDS,

    getStandard(assetClass) {
      return this.standards[assetClass] || null;
    },

    list() {
      return Object.keys(this.standards);
    },

    hasStandard(assetClass) {
      return !!this.standards[assetClass];
    },

    getFactorWeight(assetClass, factorName) {
      const std = this.getStandard(assetClass);
      if (!std) return 0;
      const f = std.factors.find(x => x.name === factorName);
      return f ? f.weight : 0;
    },

    getFactorDefinition(assetClass, factorName) {
      const std = this.getStandard(assetClass);
      if (!std) return null;
      return std.factors.find(x => x.name === factorName) || null;
    },

    getOutputWeights(assetClass) {
      const std = this.getStandard(assetClass);
      return std ? std.outputWeights : { book: 0.25, market: 0.35, income: 0.35, liquidation: 0.05 };
    },

    getValuationMethods(assetClass) {
      const std = this.getStandard(assetClass);
      return std ? std.valuationMethods : ['Cost Approach', 'Market Approach', 'Income Approach'];
    },

    getMinFactorsRequired(assetClass) {
      const std = this.getStandard(assetClass);
      return std ? std.minFactorsRequired : 5;
    },

    validateInputs(assetClass, inputs) {
      const std = this.getStandard(assetClass);
      const errors = [];
      const warnings = [];
      if (!std) {
        errors.push(`No BVS standard defined for asset class: ${assetClass}`);
        return { valid: false, errors, warnings, issues: errors };
      }
      const present = std.factors.filter(f => inputs && (inputs[f.name] !== undefined && inputs[f.name] !== null && inputs[f.name] !== ''));
      if (present.length < std.minFactorsRequired) {
        errors.push(`Only ${present.length} of ${std.minFactorsRequired} required BVS factors provided for ${assetClass}`);
      }
      const defined = new Set(std.factors.map(f => f.name));
      Object.keys(inputs || {}).forEach(k => {
        if (k.startsWith('_')) return;
        if (!defined.has(k)) {
          warnings.push(`Input "${k}" is not defined in BVS standard for ${assetClass}`);
        }
      });
      const issues = [...errors, ...warnings];
      return { valid: errors.length === 0, errors, warnings, issues, presentCount: present.length, totalFactors: std.factors.length };
    },

    getConfidenceScore(assetClass, inputs) {
      const std = this.getStandard(assetClass);
      if (!std) return 0;
      let weightedConfidence = 0;
      let totalWeight = 0;
      std.factors.forEach(f => {
        const hasValue = inputs && (inputs[f.name] !== undefined && inputs[f.name] !== null && inputs[f.name] !== '');
        totalWeight += f.weight;
        if (hasValue) {
          weightedConfidence += f.weight * f.confidenceLevel;
        }
      });
      return totalWeight > 0 ? Math.min(1, Math.max(0, weightedConfidence / totalWeight)) : 0;
    },

    getInputQualityScore(assetClass, inputs) {
      const std = this.getStandard(assetClass);
      if (!std) return 0;
      let weighted = 0;
      std.factors.forEach(f => {
        const hasValue = inputs && (inputs[f.name] !== undefined && inputs[f.name] !== null && inputs[f.name] !== '');
        if (hasValue) weighted += f.weight;
      });
      return Math.min(1, Math.max(0, weighted));
    }
  };

  if (typeof window !== 'undefined') {
    window.BVS_STANDARDS = BVS_STANDARDS;
    window.BVS = BVS;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.BVS_STANDARDS = BVS_STANDARDS;
    globalThis.BVS = BVS;
  }
})();
