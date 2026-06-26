/**
 * BONDS Valuation Intelligence Platform — Frontend Valuation Engine
 *
 * Multi-asset, multi-approach valuation model.  Not a simple calculator.
 * Combines cost, market, income, replacement, liquidation and risk-adjusted
 * factors to produce Book, Market, Fair, Investment and Liquidation values,
 * plus eight 0-100 quality / risk / attractiveness scores.
 */
(function () {
  'use strict';

  const CURRENT_YEAR = new Date().getFullYear();

  const clamp = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);
  const safe = (v) => Number(v) || 0;
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  const AssetClass = Object.freeze({
    REAL_ESTATE: 'realEstate',
    BUSINESS: 'business',
    FACTORY: 'factory',
    MACHINERY_EQUIPMENT: 'machineryEquipment',
    VEHICLES_FLEET: 'vehiclesFleet',
    AGRICULTURE_FARMS: 'agricultureFarms',
    LIVESTOCK: 'livestock',
    NATURAL_RESOURCES_MINING: 'naturalResourcesMining',
    OIL_GAS: 'oilGas',
    INFRASTRUCTURE: 'infrastructure',
    INTELLECTUAL_PROPERTY: 'intellectualProperty',
    BRANDS_TRADEMARKS: 'brandsTrademarks',
    PATENTS: 'patents',
    COPYRIGHTS_CONTENT: 'copyrightsContent',
    FRANCHISES: 'franchises',
    LICENSES_PERMITS: 'licensesPermits',
    FINANCIAL_ASSETS: 'financialAssets',
    CRYPTO_DIGITAL: 'cryptoDigital',
    COMMODITIES: 'commodities',
    ART_COLLECTIBLES: 'artCollectibles',
    JEWELRY_PRECIOUS_METALS: 'jewelryPreciousMetals',
    SOFTWARE_TECHNOLOGY: 'softwareTechnology',
    MEDICAL_EQUIPMENT: 'medicalEquipment',
    EDUCATIONAL_EQUIPMENT: 'educationalEquipment',
    DISTRESSED_ASSET: 'distressedAsset',
    TOURISM_ASSET: 'tourismAsset',
    PERSONAL_WEALTH: 'personalWealth',
    SCRAP_SALVAGE: 'scrapSalvage',
    MARITIME_ASSET: 'maritimeAsset',
    LOGISTICS_ASSET: 'logisticsAsset',
    FUEL_STATION: 'fuelStation',
    BEAUTY_WELLNESS: 'beautyWellness',
    GIFTS_STATIONERY: 'giftsStationery',
    FURNITURE_ASSET: 'furnitureAsset',
    RETAIL_BUSINESS: 'retailBusiness',

    _labels: {
      realEstate: { ar: 'العقارات', en: 'Real Estate', active: true },
      business: { ar: 'الشركات', en: 'Businesses', active: true },
      factory: { ar: 'المصانع', en: 'Factories', active: true },
      machineryEquipment: { ar: 'الآلات والمعدات', en: 'Machinery & Equipment', active: true },
      vehiclesFleet: { ar: 'المركبات والأساطيل', en: 'Vehicles & Fleet', active: true },
      agricultureFarms: { ar: 'الزراعة والمزارع', en: 'Agriculture & Farms', active: true },
      livestock: { ar: 'الثروة الحيوانية', en: 'Livestock', active: true },
      naturalResourcesMining: { ar: 'الموارد الطبيعية والتعدين', en: 'Natural Resources & Mining', active: true },
      oilGas: { ar: 'النفط والغاز', en: 'Oil & Gas Assets', active: true },
      infrastructure: { ar: 'البنية التحتية', en: 'Infrastructure', active: true },
      intellectualProperty: { ar: 'الملكية الفكرية', en: 'Intellectual Property', active: true },
      brandsTrademarks: { ar: 'العلامات التجارية', en: 'Brands & Trademarks', active: true },
      patents: { ar: 'براءات الاختراع', en: 'Patents', active: true },
      copyrightsContent: { ar: 'حقوق المؤلف والمحتوى', en: 'Copyrights & Content', active: true },
      franchises: { ar: 'الامتيازات التجارية', en: 'Franchises', active: true },
      licensesPermits: { ar: 'التراخيص والتصاريح', en: 'Licenses & Permits', active: true },
      financialAssets: { ar: 'الأصول المالية', en: 'Financial Assets', active: true },
      cryptoDigital: { ar: 'العملات الرقمية والأصول الرقمية', en: 'Crypto & Digital Assets', active: true },
      commodities: { ar: 'السلع', en: 'Commodities', active: true },
      artCollectibles: { ar: 'الفنون والمقتنيات', en: 'Art & Collectibles', active: true },
      jewelryPreciousMetals: { ar: 'المجوهرات والمعادن الثمينة', en: 'Jewelry & Precious Metals', active: true },
      softwareTechnology: { ar: 'البرمجيات والتقنية', en: 'Software & Technology', active: true },
      medicalEquipment: { ar: 'الأجهزة والمعدات الطبية', en: 'Medical Equipment', active: true },
      educationalEquipment: { ar: 'التجهيزات التعليمية', en: 'Educational Equipment', active: true },
      distressedAsset: { ar: 'الأصول المتعثرة', en: 'Distressed Assets', active: true },
      tourismAsset: { ar: 'الأصول السياحية', en: 'Tourism Assets', active: true },
      personalWealth: { ar: 'الثروة الشخصية', en: 'Personal Wealth', active: true },
      scrapSalvage: { ar: 'السكراب والخردة', en: 'Scrap & Salvage', active: true },
      maritimeAsset: { ar: 'الأصول البحرية', en: 'Maritime Assets', active: true },
      logisticsAsset: { ar: 'الأصول اللوجستية', en: 'Logistics Assets', active: true },
      fuelStation: { ar: 'محطات الوقود', en: 'Fuel Stations', active: true },
      beautyWellness: { ar: 'التجميل والصحة', en: 'Beauty & Wellness', active: true },
      giftsStationery: { ar: 'الهدايا والماليات', en: 'Gifts & Stationery', active: true },
      furnitureAsset: { ar: 'الأثاث المنزلي والمكتبي', en: 'Furniture Assets', active: true },
      retailBusiness: { ar: 'نشاط تجاري عام', en: 'Retail Business', active: true },
    },

    getLabel(slug, lang) {
      const meta = this._labels[slug];
      return meta ? meta[lang === 'en' ? 'en' : 'ar'] : slug;
    },

    isActive(slug) {
      return !!(this._labels[slug] && this._labels[slug].active);
    },

    list() {
      return Object.keys(this._labels);
    }
  });

  class ValuationModel {
    constructor(assetClass, inputs = {}) {
      this.assetClass = assetClass;
      this.inputs = { ...inputs };
    }

    set(values) {
      Object.assign(this.inputs, values);
      return this;
    }

    setAxis(axisIndex, values) {
      this.inputs[`_axis_${axisIndex}`] = true;
      return this.set(values);
    }

    toJSON() {
      return { assetClass: this.assetClass, inputs: this.inputs };
    }

    static fromJSON(json) {
      return new ValuationModel(json.assetClass, json.inputs);
    }
  }

  class ValuationEngine {
    /* ---------- Economic Life Database helpers ---------- */
    _economicLifeClient() {
      return (typeof economicLifeClient !== 'undefined' && economicLifeClient) || null;
    }

    /* ---------- Depreciation Engine helpers ---------- */
    _depreciationEngine() {
      if (typeof DepreciationEngine !== 'undefined' && DepreciationEngine) {
        const standards = (typeof DepreciationStandards !== 'undefined' && DepreciationStandards)
          ? new DepreciationStandards()
          : null;
        return new DepreciationEngine(standards);
      }
      return null;
    }

    async preloadDepreciationFactors(assetClass) {
      const engine = this._depreciationEngine();
      if (engine && engine.preload) {
        await engine.preload(assetClass);
      }
    }

    /* ---------- Market Intelligence helpers ---------- */
    _marketIntelligenceClient() {
      return (typeof marketIntelligenceClient !== 'undefined' && marketIntelligenceClient) || null;
    }

    async preloadMarketIntelligence(assetClass, inputs = {}) {
      const client = this._marketIntelligenceClient();
      if (client && client.getData) {
        this._preloadedMarketData = this._preloadedMarketData || {};
        const country = inputs.country || '';
        const region = inputs.region || '';
        const city = inputs.city || '';
        const sector = inputs.sector || '';
        const key = [assetClass, country, region, city, sector].join('|');
        this._preloadedMarketData[key] = await client.getData(assetClass, country, region, city, sector);
      }
    }

    _getMarketData(assetClass, inputs = {}) {
      const key = [assetClass, inputs.country || '', inputs.region || '', inputs.city || '', inputs.sector || ''].join('|');
      if (this._preloadedMarketData && this._preloadedMarketData[key]) {
        return this._preloadedMarketData[key];
      }
      return null;
    }

    _getEconomicLife(assetClass, inputs = {}) {
      const client = this._economicLifeClient();
      const year = safe(inputs.yearAcquired) || safe(inputs.yearBuilt) || safe(inputs.constructionYear) || CURRENT_YEAR;
      if (client) {
        return client.computeRemainingLife(assetClass, year, CURRENT_YEAR);
      }
      const fallback = {
        economic: 15, accounting: 10, technical: 18, design: 20, operational: 15
      };
      const age = Math.max(0, CURRENT_YEAR - year);
      return {
        ...fallback,
        age,
        remaining: {
          economic: Math.max(0, fallback.economic - age),
          accounting: Math.max(0, fallback.accounting - age),
          technical: Math.max(0, fallback.technical - age),
          design: Math.max(0, fallback.design - age),
          operational: Math.max(0, fallback.operational - age)
        }
      };
    }

    _usefulLifeFromEconomic(assetClass, inputs) {
      const life = this._getEconomicLife(assetClass, inputs);
      return safe(inputs.usefulLifeYears) || life.economic || 15;
    }

    /* ---------- Risk helper ---------- */
    _avgRisk(inputs) {
      const keys = [
        'regulatoryRisk', 'environmentalRisk', 'marketVolatility', 'concentrationRisk',
        'currencyRisk', 'successionRisk', 'geopoliticalRisk', 'rawMaterialRisk',
        'demandRisk', 'energyRisk'
      ];
      const vals = keys.map(k => clamp(inputs[k], 0, 10)).filter(v => v > 0);
      if (!vals.length) return 5;
      return vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    /* ---------- Real Estate ---------- */
    _calcRealEstate(i) {
      const historicalCost = safe(i.purchasePrice) + safe(i.improvementCosts) +
        safe(i.acquisitionCosts) + safe(i.legalCosts);
      const age = Math.max(0, CURRENT_YEAR - safe(i.yearBuilt));
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 50);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        (historicalCost / usefulLife * Math.min(age, usefulLife));
      const obsolescence = clamp(i.obsolescenceFactor, 0, 1);
      const bookValue = Math.max(0, historicalCost - accumulatedDep - obsolescence * historicalCost * 0.5);

      const area = Math.max(1, safe(i.areaSqm));
      const conditionScore = clamp(i.conditionScore, 1, 10) || 5;
      const conditionAdj = 0.55 + 0.045 * conditionScore;
      const locationPremium = clamp(i.locationPremium, 0, 1);
      const demand = clamp(i.demandIndex, 1, 10) || 5;
      const supply = clamp(i.supplyIndex, 1, 10) || 5;
      const demandSupplyFactor = (demand / 5) / (supply / 5);
      const growth = clamp(i.marketGrowthRate, -0.2, 0.5);
      const holding = clamp(i.holdingYears, 0, 30) || age;
      const marketValue = Math.max(0,
        area * safe(i.comparablePricePerSqm) * conditionAdj * (1 + locationPremium) *
        demandSupplyFactor * Math.pow(1 + growth, Math.min(holding, 5))
      );

      const monthlyRent = safe(i.monthlyRent);
      const occupancy = clamp(i.occupancyRate, 0, 1) || 0.8;
      const opexRate = clamp(i.operatingExpensesRate, 0, 1) || 0.25;
      const capRate = clamp(i.capRate, 0.01, 0.5) || 0.07;
      const noi = monthlyRent * 12 * occupancy * (1 - opexRate);
      const incomeValue = noi / capRate;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.25 + marketValue * 0.35 + incomeValue * 0.4) * riskAdj;

      const permits = safe(i.permitsValue);
      const infra = clamp(i.infrastructurePlans, 0, 1);
      const esg = clamp(i.esgScore, 0, 100) / 100;
      const investmentValue = fairValue * (1 + infra * 0.05 + esg * 0.02) + permits;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.05;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const marketVol = clamp(i.marketVolatility, 0, 10) || 5;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.15 / buyerPool) * (1 - marketVol / 30)
      );

      return { bookValue, marketValue, fairValue, investmentValue, liquidationValue };
    }

    /* ---------- Business ---------- */
    _calcBusiness(i) {
      const bookEquity = safe(i.equityBookValue);
      const intangibleBook = safe(i.intangibleAssetsBook);
      const goodwillImp = safe(i.goodwillImpairment);
      const adjustedBook = Math.max(0, bookEquity - intangibleBook * 0.7 - goodwillImp);

      const revenue = safe(i.annualRevenue);
      const ebitdaMargin = clamp(i.ebitdaMargin, 0, 1) || 0.15;
      const ebitda = revenue * ebitdaMargin;
      const evRev = safe(i.evRevenueMultiple) || 1;
      const evEbitda = safe(i.evEbitdaMultiple) || 6;
      const sectorMult = safe(i.sectorMultiple) || 1;
      const premium = clamp(i.transactionPremium, 0, 1);
      const marketValue = ((revenue * evRev + ebitda * evEbitda) / 2) * sectorMult * (1 + premium);

      const taxRate = clamp(i.taxRate, 0, 1) || 0.2;
      const annualCapex = safe(i.annualCapex);
      const amortization = safe(i.amortizationExpense);
      const fcf = ebitda * (1 - taxRate) - annualCapex - amortization;
      const discountRate = clamp(i.discountRate, 0.01, 1) || 0.12;
      const projYears = Math.max(1, Math.min(20, safe(i.projectionYears) || 5));
      const terminalGrowth = Math.min(clamp(i.marketGrowth, 0, 0.1), discountRate * 0.8) || 0.02;

      let pv = 0;
      for (let t = 1; t <= projYears; t++) {
        pv += fcf * Math.pow(1 + terminalGrowth, t - 1) / Math.pow(1 + discountRate, t);
      }
      const terminal = fcf * Math.pow(1 + terminalGrowth, projYears) * (1 + terminalGrowth) /
        Math.max(0.005, discountRate - terminalGrowth);
      const pvTerminal = terminal / Math.pow(1 + discountRate, projYears);
      const enterpriseValue = pv + pvTerminal;
      const debt = safe(i.totalDebt);
      const cash = safe(i.cashAndEquiv);
      const incomeValue = Math.max(0, enterpriseValue - debt + cash);

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (adjustedBook * 0.2 + marketValue * 0.3 + incomeValue * 0.5) * riskAdj;

      const strategicPremium = clamp(i.strategicBuyerPremium, 0, 1);
      const brand = clamp(i.brandStrength, 0, 100) / 100;
      const tech = clamp(i.proprietaryTechnology, 0, 100) / 100;
      const custRel = clamp(i.customerRelationships, 0, 100) / 100;
      const patents = safe(i.patentsValue);
      const investmentValue = fairValue * (1 + strategicPremium + brand * 0.05 + tech * 0.05) +
        patents + custRel * revenue * 0.1;

      const marketability = clamp(i.marketabilityDiscount, 0, 1) || 0.2;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) / 10 || 0.5;
      const liquidationValue = Math.max(0, adjustedBook * (1 - marketability) * buyerPool);

      const tangibleAssets = safe(i.tangibleAssets);
      const identifiedIntangibles = safe(i.identifiedIntangibles) || intangibleBook;
      const totalLiabilities = safe(i.totalLiabilities) || debt;
      const identifiableNetAssets = Math.max(0, tangibleAssets + identifiedIntangibles - totalLiabilities);
      const goodwillValue = Math.max(0, round2(enterpriseValue - identifiableNetAssets));
      const goodwillImpairmentFlag = safe(i.projectedDecline) > goodwillValue;

      return {
        bookValue: adjustedBook,
        marketValue,
        fairValue,
        investmentValue,
        liquidationValue,
        enterpriseValue: round2(enterpriseValue),
        goodwillValue,
        goodwillImpairmentFlag
      };
    }

    /* ---------- Factory ---------- */
    _calcFactory(i) {
      const historical = safe(i.landCost) + safe(i.buildingCost) + safe(i.machineryCost) +
        safe(i.installationCost) + safe(i.workingCapital);
      const accumulated = safe(i.accumulatedDepreciation);
      const obsolescence = clamp(i.functionalObsolescence, 0, 1);
      const bookValue = Math.max(0,
        historical - accumulated - obsolescence * (safe(i.machineryCost) + safe(i.buildingCost)) * 0.5
      );

      const replacementNew = safe(i.replacementCostNew);
      const costIndex = clamp(i.costIndex, 0.5, 2) || 1;
      const replacementValue = replacementNew * costIndex * (1 - obsolescence);
      const comparableSales = safe(i.comparableSalesValue);
      const marketValue = (replacementValue + comparableSales) / 2;

      const capacity = Math.max(1, safe(i.annualCapacityUnits));
      const utilization = clamp(i.capacityUtilization, 0, 1) || 0.7;
      const production = capacity * utilization;
      const revenue = production * safe(i.unitPrice);
      const cost = production * safe(i.variableCostPerUnit) + safe(i.annualFixedCosts);
      const tax = clamp(i.taxRate, 0, 1) || 0.2;
      const operatingIncome = Math.max(0, (revenue - cost) * (1 - tax));
      const discountRate = clamp(i.discountRate, 0.01, 1) || 0.12;
      const incomeValue = operatingIncome / discountRate;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.3 + marketValue * 0.3 + incomeValue * 0.4) * riskAdj;

      const patents = safe(i.patentsValue);
      const licenses = safe(i.licensesValue);
      const workforce = clamp(i.workforceSkill, 1, 10) / 10 || 0.5;
      const automation = clamp(i.automationPlan, 0, 1);
      const investmentValue = fairValue + patents + licenses +
        workforce * operatingIncome * 0.5 + automation * 0.05 * fairValue;

      const scrapRate = clamp(i.scrapValueRate, 0, 1) || 0.2;
      const dismantle = safe(i.dismantlingCost);
      const salvage = safe(i.salvageValue);
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 12;
      const liquidationValue = Math.max(0,
        (replacementValue * scrapRate - dismantle + salvage) * (1 - liquidationTime / 36)
      );

      return { bookValue, marketValue, fairValue, investmentValue, liquidationValue };
    }

    /* ---------- Depreciable Tangible Engine (machinery, vehicles, medical, educational) ---------- */
    _calcDepreciableTangible(i, config = {}) {
      const historicalCost = safe(i.purchasePrice) + safe(i.installationCost) +
        safe(i.transportCost) + safe(i.improvementCosts);
      const age = Math.max(0, CURRENT_YEAR - safe(i.yearAcquired));
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 15);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        (historicalCost / usefulLife * Math.min(age, usefulLife));
      const obsolescence = clamp(i.obsolescenceFactor, 0, 1);
      const residualRate = clamp(i.residualValueRate, 0, 1) || 0.2;
      const bookValue = Math.max(0,
        historicalCost - accumulatedDep - obsolescence * historicalCost * 0.5
      );

      const replacementNew = safe(i.replacementCostNew) || historicalCost;
      const conditionScore = clamp(i.conditionScore, 1, 10) || 5;
      const conditionAdj = 0.55 + 0.045 * conditionScore;
      const replacementValue = replacementNew * conditionAdj * (1 - obsolescence) *
        (1 + residualRate * 0.1);
      const comparableSales = safe(i.comparableSalesValue);
      const demand = clamp(i.demandIndex, 1, 10) || 5;
      const supply = clamp(i.supplyIndex, 1, 10) || 5;
      const demandSupplyFactor = (demand / 5) / (supply / 5);
      const marketGrowth = clamp(i.marketGrowthRate, -0.2, 0.5);
      const marketValue = Math.max(0,
        (replacementValue + comparableSales) / 2 * demandSupplyFactor * (1 + marketGrowth)
      );

      const monthlyRevenue = safe(i.monthlyOperatingRevenue);
      const utilization = clamp(i.utilizationRate, 0, 1) || 0.7;
      const opexRate = clamp(i.operatingExpensesRate, 0, 1) || 0.3;
      const operatingValue = monthlyRevenue * 12 * utilization * (1 - opexRate);
      const capRate = config.capRate || 0.12;
      const incomeValue = operatingValue / capRate;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const weights = config.weights || { book: 0.3, market: 0.35, income: 0.35 };
      const fairValue = (bookValue * weights.book + marketValue * weights.market +
        incomeValue * weights.income) * riskAdj;

      const certs = safe(i.certificationValue) + safe(i.maintenanceContractValue);
      const accreditation = safe(i.accreditationValue);
      const brandPrem = clamp(i.brandPremium, 0, 1);
      const regulatoryBoost = config.regulatoryBoost || 0;
      const esg = clamp(i.esgScore, 0, 100) / 100;
      const automation = clamp(i.automationPlan, 0, 1);
      const investmentValue = fairValue * (1 + brandPrem + automation * 0.05 + esg * 0.02) +
        certs + accreditation + regulatoryBoost;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.05;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 12;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.15 / buyerPool) *
        (1 - liquidationTime / 36) * (1 - avgRisk / 30)
      );

      const insuranceValue = replacementValue * 1.1;

      return {
        bookValue,
        replacementValue,
        marketValue,
        operatingValue,
        incomeValue,
        fairValue,
        investmentValue,
        liquidationValue,
        insuranceValue
      };
    }

    /* ---------- Commodity-like Engine (jewelry, precious metals, commodities) ---------- */
    _calcCommodityLike(i) {
      const quantity = safe(i.quantityUnits);
      const spot = safe(i.spotPricePerUnit);
      const purity = clamp(i.purityFactor, 0, 1) || 1;
      const premium = clamp(i.premiumRate, 0, 1);
      const brandPrem = clamp(i.brandPremium, 0, 1);
      const bookValue = safe(i.purchasePrice);
      const marketValue = quantity * spot * purity * (1 + premium + brandPrem);

      const demand = clamp(i.demandIndex, 1, 10) || 5;
      const supply = clamp(i.supplyIndex, 1, 10) || 5;
      const demandSupplyFactor = (demand / 5) / (supply / 5);
      const marketGrowth = clamp(i.marketGrowthRate, -0.2, 0.5);
      const adjustedMarket = marketValue * demandSupplyFactor * (1 + marketGrowth);

      const volatility = clamp(i.marketVolatility, 0, 10);
      const volatilityDiscount = volatility / 40;
      const fairValue = adjustedMarket * (1 - volatilityDiscount);

      const rarity = clamp(i.rarityPremium, 0, 1);
      const brandValue = safe(i.brandValue);
      const investmentValue = fairValue * (1 + rarity) + brandValue;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.04;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 6;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.1 / buyerPool) * (1 - volatilityDiscount)
      );

      const storage = safe(i.storageCost);
      const insurance = safe(i.insuranceCost);
      const operatingValue = Math.max(0, marketValue - storage - insurance);
      const insuranceValue = marketValue * 1.1;

      return {
        bookValue,
        marketValue: adjustedMarket,
        operatingValue,
        fairValue,
        investmentValue,
        liquidationValue,
        insuranceValue
      };
    }

    /* ---------- Distressed Asset Engine ---------- */
    _calcDistressed(i) {
      const bookValue = Math.max(0, safe(i.bookValue));
      const debt = safe(i.accumulatedDebt);
      const legalHold = safe(i.legalHoldCost);
      const adjustedBook = Math.max(0, bookValue - debt - legalHold);

      const distressSeverity = clamp(i.distressSeverity, 0, 10);
      const forcedDiscount = clamp(i.forcedSaleDiscount, 0, 1) || 0.3;
      const recoveryRate = clamp(i.recoveryRate, 0, 1) || 0.55;
      const marketValueNoDistress = safe(i.marketValue) || safe(i.comparableSalesValue);
      const marketValue = marketValueNoDistress * (1 - forcedDiscount) * recoveryRate;

      const stabilizedNOI = safe(i.stabilizedNOI);
      const capRate = clamp(i.stabilizedCapRate, 0.01, 0.5) || 0.08;
      const discountRate = clamp(i.discountRate, 0.01, 1) || 0.15;
      const timeToStabilize = Math.max(1, Math.min(60, safe(i.timeToStabilizeMonths) || 18));
      const incomeValue = stabilizedNOI / capRate / Math.pow(1 + discountRate, timeToStabilize / 12);

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.4, 1 - avgRisk / 20);
      const fairValue = (adjustedBook * 0.25 + marketValue * 0.35 + incomeValue * 0.4) * riskAdj;

      const restructuring = safe(i.restructuringCost);
      const planValue = safe(i.restructuringPlanValue);
      const strategic = safe(i.strategicValue);
      const restructuredValue = Math.max(0, fairValue - restructuring + planValue + strategic);

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.07;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 4;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 6;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.2 / buyerPool) * (1 - liquidationTime / 36)
      );
      const quickExitValue = marketValue * (1 - forcedDiscount * 1.3) * (1 - transactionCosts);

      const operatingValue = Math.max(0, stabilizedNOI - restructuring / 12);
      const insuranceValue = marketValueNoDistress * 0.85;

      return {
        bookValue: adjustedBook,
        marketValue,
        operatingValue,
        incomeValue,
        fairValue,
        investmentValue: restructuredValue,
        restructuredValue,
        liquidationValue,
        quickExitValue,
        insuranceValue
      };
    }

    /* ---------- Biological & Natural Engine (agriculture, livestock) ---------- */
    _calcBiologicalNatural(i, config = {}) {
      const historicalCost = safe(i.purchasePrice) + safe(i.installationCost) +
        safe(i.transportCost) + safe(i.improvementCosts);
      const biologicalAge = Math.max(0, safe(i.biologicalAgeYears) || 0);
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 15);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        (historicalCost / usefulLife * Math.min(biologicalAge, usefulLife));
      const mortality = clamp(i.mortalityRate, 0, 1) || 0;
      const biologicalFactor = config.isLivestock ? (1 - mortality) : 1;
      const bookValue = Math.max(0,
        (historicalCost - accumulatedDep) * biologicalFactor
      );

      const units = Math.max(0, safe(i.quantityUnits));
      const marketPrice = safe(i.marketPricePerUnit);
      const yieldPerUnit = safe(i.yieldPerUnit) || 1;
      const quality = clamp(i.qualityScore, 0, 10) / 10 || 0.8;
      const conditionScore = clamp(i.conditionScore, 1, 10) || 7;
      const conditionAdj = 0.55 + 0.045 * conditionScore;
      const marketValue = Math.max(0,
        units * marketPrice * yieldPerUnit * quality * conditionAdj
      );

      const revenue = units * yieldPerUnit * marketPrice * 12;
      const feedCost = safe(i.feedCost) || 0;
      const veterinaryCost = safe(i.veterinaryCost) || 0;
      const storageCost = safe(i.storageCost) || 0;
      const otherCosts = safe(i.otherOperatingCosts) || 0;
      const operatingValue = Math.max(0, revenue - feedCost - veterinaryCost - storageCost - otherCosts);
      const capRate = config.capRate || 0.12;
      const incomeValue = operatingValue / capRate;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const weights = config.weights || { book: 0.25, market: 0.35, income: 0.4 };
      const fairValue = (bookValue * weights.book + marketValue * weights.market +
        incomeValue * weights.income) * riskAdj;

      const certs = safe(i.certificationValue);
      const landQuality = clamp(i.landQualityScore, 0, 10) / 10 || 0.5;
      const water = clamp(i.waterAvailabilityScore, 0, 10) / 10 || 0.5;
      const esg = clamp(i.esgScore, 0, 100) / 100;
      const investmentValue = fairValue * (1 + landQuality * 0.05 + water * 0.05 + esg * 0.02) + certs;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.06;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 12;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.15 / buyerPool) *
        (1 - liquidationTime / 36) * (1 - mortality * 0.5)
      );

      const insuranceValue = marketValue * 0.9;

      return {
        bookValue,
        marketValue,
        operatingValue,
        incomeValue,
        fairValue,
        investmentValue,
        liquidationValue,
        insuranceValue
      };
    }

    /* ---------- Resource & Infrastructure Engine (mining, oil & gas, infrastructure) ---------- */
    _calcResourceInfrastructure(i, config = {}) {
      const historicalCost = safe(i.landCost) + safe(i.developmentCost) +
        safe(i.equipmentCost) + safe(i.acquisitionCost);
      const depletionRate = clamp(i.depletionRate, 0, 1) || 0.05;
      const accumulatedDepletion = safe(i.accumulatedDepletion) ||
        (historicalCost * depletionRate * Math.min(safe(i.operatingYears) || 5, 30));
      const bookValue = Math.max(0, historicalCost - accumulatedDepletion);

      const reserveUnits = Math.max(0, safe(i.reserveUnits) || safe(i.capacityUnits));
      const commodityPrice = safe(i.commodityPricePerUnit) || safe(i.tariffRevenuePerUnit);
      const extractionCost = safe(i.extractionCostPerUnit) || safe(i.opexPerUnit);
      const reserveGrade = clamp(i.reserveGrade, 0, 1) || 1;
      const marketValue = Math.max(0,
        reserveUnits * (commodityPrice - extractionCost) * reserveGrade
      );

      const annualProduction = reserveUnits * clamp(i.utilizationRate, 0, 1) || (reserveUnits * 0.1);
      const annualRevenue = annualProduction * commodityPrice;
      const annualCost = annualProduction * extractionCost + safe(i.annualFixedCosts);
      const taxRate = clamp(i.taxRate, 0, 1) || 0.2;
      const annualNOI = Math.max(0, (annualRevenue - annualCost) * (1 - taxRate));
      const discountRate = clamp(i.discountRate, 0.01, 1) || 0.1;
      const remainingLife = Math.max(1, Math.min(50, safe(i.licenseExpiryYears) || safe(i.remainingLifeYears) || 10));

      let pv = 0;
      for (let t = 1; t <= remainingLife; t++) {
        pv += annualNOI * Math.pow(1 + (config.growthRate || 0.02), t - 1) / Math.pow(1 + discountRate, t);
      }
      const incomeValue = pv;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const weights = config.weights || { book: 0.2, market: 0.3, income: 0.5 };
      const fairValue = (bookValue * weights.book + marketValue * weights.market +
        incomeValue * weights.income) * riskAdj;

      const licenses = safe(i.licensesValue);
      const strategic = safe(i.strategicValue);
      const esg = clamp(i.esgScore, 0, 100) / 100;
      const investmentValue = fairValue * (1 + esg * 0.03) + licenses + strategic;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.07;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 4;
      const liquidationValue = Math.max(0,
        (bookValue * 0.7 + marketValue * 0.3) * (1 - transactionCosts - 0.2 / buyerPool)
      );

      const insuranceValue = (historicalCost + marketValue) / 2;

      return {
        bookValue,
        marketValue,
        operatingValue: annualNOI,
        incomeValue,
        fairValue,
        investmentValue,
        liquidationValue,
        insuranceValue
      };
    }

    /* ---------- Intangible Income Engine (IP, brands, patents) ---------- */
    _calcIntangibleIncome(i, config = {}) {
      const bookValue = Math.max(0, safe(i.purchasePrice) - safe(i.accumulatedAmortization));

      const comparableValue = safe(i.comparableTransactionValue);
      const marketValue = Math.max(0, comparableValue);

      const revenue = safe(i.annualRevenue) || safe(i.licenseFeeAnnual) || safe(i.royaltyIncome);
      const royaltyRate = clamp(i.royaltyRate, 0, 1) || config.defaultRoyaltyRate || 0.05;
      const notionalRoyalty = revenue * royaltyRate;
      const taxRate = clamp(i.taxRate, 0, 1) || 0.2;
      const remainingLife = Math.max(1, Math.min(30, safe(i.remainingLifeYears) || 10));
      const discountRate = clamp(i.discountRate, 0.01, 1) || 0.12;
      const growthRate = Math.min(clamp(i.growthRate, -0.1, 0.2), discountRate * 0.8) || 0.03;

      let pv = 0;
      for (let t = 1; t <= remainingLife; t++) {
        pv += notionalRoyalty * Math.pow(1 + growthRate, t - 1) * (1 - taxRate) / Math.pow(1 + discountRate, t);
      }
      const incomeValue = pv;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const weights = config.weights || { book: 0.15, market: 0.25, income: 0.6 };
      const fairValue = (bookValue * weights.book + marketValue * weights.market +
        incomeValue * weights.income) * riskAdj;

      const brandStrength = clamp(i.brandStrength || i.intangibleStrength, 0, 100) / 100;
      const legalProtection = clamp(i.legalProtectionScore, 0, 10) / 10 || 0.5;
      const marketShare = clamp(i.marketShare, 0, 1);
      const investmentValue = fairValue * (1 + brandStrength * 0.1 + legalProtection * 0.05 + marketShare * 0.05);

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.08;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const liquidationValue = Math.max(0,
        fairValue * (1 - transactionCosts - 0.15 / buyerPool)
      );

      const operatingValue = Math.max(0, notionalRoyalty * 12);
      const insuranceValue = fairValue * 0.9;

      return {
        bookValue,
        marketValue,
        operatingValue,
        incomeValue,
        fairValue,
        investmentValue,
        liquidationValue,
        insuranceValue
      };
    }

    /* ---------- Marketable Securities Engine (financial assets, crypto) ---------- */
    _calcMarketableSecurities(i, config = {}) {
      const quantity = safe(i.quantityUnits);
      const marketPrice = safe(i.marketPricePerUnit);
      const costBasis = safe(i.purchasePrice) || (quantity * marketPrice);
      const bookValue = costBasis;
      const marketValue = quantity * marketPrice;

      const demand = clamp(i.demandIndex, 1, 10) || 5;
      const supply = clamp(i.supplyIndex, 1, 10) || 5;
      const demandSupplyFactor = (demand / 5) / (supply / 5);
      const adjustedMarket = marketValue * demandSupplyFactor;

      const volatility = clamp(i.volatilityIndex, 0, 100) / 100 || clamp(i.marketVolatility, 0, 10) / 10 || 0.3;
      const liquidityScore = clamp(i.liquidityScore, 0, 10) / 10 || 0.7;
      const fairValue = adjustedMarket * (1 - volatility * 0.2) * (0.7 + liquidityScore * 0.3);

      const yieldIncome = safe(i.dividendYield) || safe(i.stakingYield) || 0;
      const investmentValue = fairValue * (1 + yieldIncome);

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || config.defaultTxCost || 0.02;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 6;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.05 / buyerPool) * liquidityScore
      );

      const operatingValue = Math.max(0, marketValue * yieldIncome);
      const insuranceValue = marketValue * (config.isCrypto ? 0.85 : 0.95);

      return {
        bookValue,
        marketValue: adjustedMarket,
        operatingValue,
        fairValue,
        investmentValue,
        liquidationValue,
        insuranceValue
      };
    }

    /* ---------- SaaS & Technology Engine ---------- */
    _calcSaaSTechnology(i) {
      const arr = safe(i.annualRecurringRevenue) || safe(i.annualRevenue);
      const grossMargin = clamp(i.grossMargin, 0, 1) || 0.75;
      const opex = safe(i.annualOpex) || arr * 0.6;
      const customerCount = safe(i.customerCount) || 100;
      const arpu = safe(i.averageRevenuePerUser) || (customerCount > 0 ? arr / customerCount : 0);
      const churnRate = clamp(i.churnRate, 0, 1) || 0.05;
      const growthRate = clamp(i.growthRate, -0.2, 0.5) || 0.2;
      const discountRate = clamp(i.discountRate, 0.01, 1) || 0.15;
      const terminalGrowth = Math.min(clamp(i.terminalGrowth, 0, 0.1), discountRate * 0.8) || 0.03;
      const projYears = Math.max(1, Math.min(10, safe(i.projectionYears) || 5));

      const bookValue = Math.max(0, safe(i.developmentCost) - safe(i.accumulatedAmortization));

      const revenueMultiple = safe(i.revenueMultiple) || 8;
      const marketValue = arr * revenueMultiple;

      let fcf = (arr * grossMargin - opex);
      let pv = 0;
      for (let t = 1; t <= projYears; t++) {
        fcf = fcf * (1 + growthRate * Math.pow(1 - t / projYears, 0.5));
        pv += fcf / Math.pow(1 + discountRate, t);
      }
      const terminalValue = fcf * (1 + terminalGrowth) / Math.max(0.005, discountRate - terminalGrowth);
      const pvTerminal = terminalValue / Math.pow(1 + discountRate, projYears);
      const incomeValue = pv + pvTerminal;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.1 + marketValue * 0.35 + incomeValue * 0.55) * riskAdj;

      const techMoat = clamp(i.techMoatScore, 0, 10) / 10 || 0.5;
      const retention = 1 - churnRate;
      const ltvCacRatio = safe(i.lifetimeValue) / Math.max(1, safe(i.customerAcquisitionCost));
      const investmentValue = fairValue * (1 + techMoat * 0.1 + (retention - 0.9) * 0.2 + Math.min(ltvCacRatio, 5) * 0.02);

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.05;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 6;
      const liquidationValue = Math.max(0,
        (bookValue + marketValue * 0.5) * (1 - transactionCosts - 0.1 / buyerPool)
      );

      const operatingValue = Math.max(0, arr * grossMargin - opex);
      const insuranceValue = marketValue * 0.8;

      return {
        bookValue,
        marketValue,
        operatingValue,
        incomeValue,
        fairValue,
        investmentValue,
        liquidationValue,
        insuranceValue
      };
    }

    /* ---------- Tourism Asset Engine ---------- */
    _calcTourismAsset(i) {
      const dailyVisitors = Math.max(0, safe(i.dailyVisitors));
      const avgSpend = Math.max(0, safe(i.avgSpendPerVisitor));
      const occupancy = clamp(i.occupancyRate, 0, 1) || 0.6;
      const seasonality = clamp(i.seasonalityFactor, 0, 1) || 0.8;
      const annualRevenue = dailyVisitors * avgSpend * 365 * occupancy * seasonality;

      const staffCost = safe(i.staffCost);
      const maintenanceCost = safe(i.maintenanceCost);
      const utilitiesCost = safe(i.utilitiesCost);
      const marketingCost = safe(i.marketingCost);
      const operatingCosts = staffCost + maintenanceCost + utilitiesCost + marketingCost;
      const noi = Math.max(0, annualRevenue - operatingCosts);

      const historicalCost = safe(i.purchasePrice) + safe(i.improvementCosts) + safe(i.acquisitionCosts);
      const age = Math.max(0, CURRENT_YEAR - safe(i.yearBuilt));
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 30);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        (historicalCost / usefulLife * Math.min(age, usefulLife));
      const obsolescence = clamp(i.obsolescenceFactor, 0, 1);
      const bookValue = Math.max(0, historicalCost - accumulatedDep - obsolescence * historicalCost * 0.5);

      const capRate = clamp(i.capRate, 0.01, 0.5) || 0.08;
      const qualityMultiplier = clamp(i.qualityMultiplier, 0.5, 2) || 1;
      const incomeValue = (noi / capRate) * qualityMultiplier;

      const marketValue = Math.max(0, safe(i.comparableTransactionValue) || incomeValue * 0.9);

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.2 + marketValue * 0.3 + incomeValue * 0.5) * riskAdj;

      const locationQuality = clamp(i.locationQualityScore, 0, 10) / 10 || 0.6;
      const tourismGrowth = clamp(i.tourismGrowthRate, -0.2, 0.5) || 0.04;
      const permits = safe(i.permitsValue);
      const investmentValue = fairValue * (1 + locationQuality * 0.05 + tourismGrowth * 0.5) + permits;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.06;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.15 / buyerPool) * (1 - avgRisk / 30)
      );

      return {
        bookValue,
        marketValue,
        operatingValue: round2(noi),
        incomeValue,
        fairValue,
        investmentValue,
        liquidationValue
      };
    }

    /* ---------- Personal Wealth Engine ---------- */
    _calcPersonalWealth(i) {
      const realEstateValue = safe(i.realEstateValue);
      const securitiesValue = safe(i.securitiesValue);
      const cashValue = safe(i.cashValue);
      const personalAssetsValue = safe(i.personalAssetsValue);
      const vehicleValue = safe(i.vehicleValue);
      const portfolioValue = realEstateValue + securitiesValue + cashValue + personalAssetsValue + vehicleValue;

      const mortgageBalance = safe(i.mortgageBalance);
      const loansBalance = safe(i.loansBalance);
      const creditBalance = safe(i.creditBalance);
      const otherLiabilities = safe(i.otherLiabilities);
      const totalLiabilities = mortgageBalance + loansBalance + creditBalance + otherLiabilities;

      const netWorth = Math.max(0, portfolioValue - totalLiabilities);
      const liquidityRatio = portfolioValue > 0 ? (cashValue + securitiesValue) / portfolioValue : 0;

      const marketVolatility = clamp(i.marketVolatility, 0, 10) || 4;
      const volatilityDiscount = marketVolatility / 40;
      const fairValue = netWorth * (1 - volatilityDiscount);

      const passiveIncome = safe(i.passiveIncome);
      const annualIncome = safe(i.annualIncome);
      const operatingValue = Math.max(0, passiveIncome + annualIncome * 0.1);

      const investmentValue = fairValue * (1 + clamp(i.innovationPipeline, 0, 1) * 0.02);

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.03;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 6;
      const liquidationValue = Math.max(0,
        fairValue * (1 - transactionCosts - 0.1 / buyerPool) * liquidityRatio
      );

      return {
        bookValue: round2(portfolioValue),
        marketValue: round2(portfolioValue),
        operatingValue: round2(operatingValue),
        fairValue: round2(fairValue),
        investmentValue: round2(investmentValue),
        liquidationValue: round2(liquidationValue),
        netWorth: round2(netWorth),
        liquidityRatio: round2(liquidityRatio)
      };
    }

    /* ---------- Scrap & Salvage Engine ---------- */
    _calcScrapSalvage(i) {
      const weightKg = Math.max(0, safe(i.weightKg));
      const marketPricePerKg = Math.max(0, safe(i.marketPricePerKg));
      const purityRate = clamp(i.purityRate, 0, 1) || 1;
      const grossScrapValue = weightKg * marketPricePerKg * purityRate;

      const dismantlingCost = safe(i.dismantlingCost);
      const transportCost = safe(i.transportCost);
      const storageCost = safe(i.storageCost);
      const netScrapValue = Math.max(0, grossScrapValue - dismantlingCost - transportCost - storageCost);

      const recoveryRate = clamp(i.recoveryRate, 0, 1) || 0.85;
      const recoverableValue = netScrapValue * recoveryRate;

      const bookValue = safe(i.purchasePrice) || recoverableValue * 0.7;

      const demand = clamp(i.demandIndex, 1, 10) || 5;
      const supply = clamp(i.supplyIndex, 1, 10) || 5;
      const demandSupplyFactor = (demand / 5) / (supply / 5);
      const marketGrowth = clamp(i.marketGrowthRate, -0.2, 0.5);
      const marketValue = recoverableValue * demandSupplyFactor * (1 + marketGrowth);

      const priceVolatility = clamp(i.priceVolatility, 0, 10) || 4;
      const volatilityDiscount = priceVolatility / 40;
      const fairValue = marketValue * (1 - volatilityDiscount);

      const investmentValue = fairValue * (1 + clamp(i.infrastructurePlans, 0, 1) * 0.02);

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.04;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 3;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.1 / buyerPool) * (1 - liquidationTime / 36)
      );

      return {
        bookValue: round2(bookValue),
        marketValue: round2(marketValue),
        operatingValue: round2(recoverableValue),
        fairValue: round2(fairValue),
        investmentValue: round2(investmentValue),
        liquidationValue: round2(liquidationValue),
        recoverableValue: round2(recoverableValue)
      };
    }

    /* ---------- Maritime Asset Engine (vessels, ships, boats) ---------- */
    _calcMaritimeAsset(i) {
      const historicalCost = safe(i.purchasePrice) + safe(i.refitCosts) +
        safe(i.regulatoryCertificationValue) + safe(i.acquisitionCosts);
      const age = Math.max(0, CURRENT_YEAR - safe(i.yearBuilt));
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 25);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        (historicalCost / usefulLife * Math.min(age, usefulLife));
      const obsolescence = clamp(i.obsolescenceFactor, 0, 1);
      const bookValue = Math.max(0, historicalCost - accumulatedDep - obsolescence * historicalCost * 0.5);

      const replacementNew = safe(i.replacementCostNew) || historicalCost;
      const conditionScore = clamp(i.conditionScore, 1, 10) || 5;
      const conditionAdj = 0.55 + 0.045 * conditionScore;
      const replacementValue = replacementNew * conditionAdj * (1 - obsolescence);
      const comparableSales = safe(i.comparableSalesValue);
      const demand = clamp(i.demandIndex, 1, 10) || 5;
      const supply = clamp(i.supplyIndex, 1, 10) || 5;
      const demandSupplyFactor = (demand / 5) / (supply / 5);
      const marketValue = Math.max(0, (replacementValue + comparableSales) / 2 * demandSupplyFactor);

      const dailyCharterRate = safe(i.dailyCharterRate);
      const operatingDays = Math.max(0, Math.min(365, safe(i.operatingDaysPerYear) || 200));
      const utilization = clamp(i.utilizationRate, 0, 1) || 0.6;
      const annualRevenue = dailyCharterRate * operatingDays * utilization;
      const operatingCost = safe(i.annualOperatingCost) || annualRevenue * 0.5;
      const noi = Math.max(0, annualRevenue - operatingCost);
      const capRate = clamp(i.capRate, 0.01, 0.5) || 0.1;
      const incomeValue = noi / capRate;
      const operatingValue = noi;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.25 + marketValue * 0.35 + incomeValue * 0.4) * riskAdj;

      const licenses = safe(i.licensesValue);
      const routeValue = safe(i.routeValue);
      const esg = clamp(i.esgScore, 0, 100) / 100;
      const investmentValue = fairValue * (1 + esg * 0.02) + licenses + routeValue;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.06;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 12;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.15 / buyerPool) * (1 - liquidationTime / 36) * (1 - avgRisk / 30)
      );

      const insuranceValue = replacementValue * 1.1;

      return { bookValue, marketValue, operatingValue, incomeValue, fairValue, investmentValue, liquidationValue, insuranceValue };
    }

    /* ---------- Logistics Asset Engine (warehouses, distribution centers, fleets) ---------- */
    _calcLogisticsAsset(i) {
      const historicalCost = safe(i.landCost) + safe(i.buildingCost) + safe(i.equipmentCost) +
        safe(i.rackingCost) + safe(i.improvementCosts);
      const age = Math.max(0, CURRENT_YEAR - safe(i.yearBuilt));
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 40);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        (historicalCost / usefulLife * Math.min(age, usefulLife));
      const obsolescence = clamp(i.obsolescenceFactor, 0, 1);
      const bookValue = Math.max(0, historicalCost - accumulatedDep - obsolescence * historicalCost * 0.5);

      const area = Math.max(1, safe(i.areaSqm));
      const pricePerSqm = safe(i.comparablePricePerSqm) || 1500;
      const comparableSales = safe(i.comparableSalesValue);
      const conditionScore = clamp(i.conditionScore, 1, 10) || 6;
      const conditionAdj = 0.55 + 0.045 * conditionScore;
      const replacementValue = historicalCost * conditionAdj * (1 - obsolescence);
      const marketValue = Math.max(0, comparableSales || (area * pricePerSqm * conditionAdj));

      const occupancy = clamp(i.occupancyRate, 0, 1) || 0.75;
      const annualRevenue = safe(i.annualRentalRevenue) || (area * pricePerSqm * 0.08 * occupancy);
      const opexRate = clamp(i.operatingExpensesRate, 0, 1) || 0.25;
      const noi = annualRevenue * (1 - opexRate);
      const capRate = clamp(i.capRate, 0.01, 0.5) || 0.08;
      const incomeValue = noi / capRate;
      const operatingValue = noi;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.3 + marketValue * 0.3 + incomeValue * 0.4) * riskAdj;

      const automation = clamp(i.automationPlan, 0, 1);
      const locationPremium = clamp(i.locationPremium, 0, 1);
      const permits = safe(i.permitsValue);
      const investmentValue = fairValue * (1 + locationPremium * 0.05 + automation * 0.05) + permits;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.05;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 6;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 12;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.1 / buyerPool) * (1 - liquidationTime / 36)
      );

      const insuranceValue = replacementValue * 1.1;

      return { bookValue, marketValue, operatingValue, incomeValue, fairValue, investmentValue, liquidationValue, insuranceValue };
    }

    /* ---------- Fuel Station Engine ---------- */
    _calcFuelStation(i) {
      const historicalCost = safe(i.landCost) + safe(i.constructionCost) + safe(i.equipmentCost) +
        safe(i.tanksPumpsCost) + safe(i.improvementCosts);
      const age = Math.max(0, CURRENT_YEAR - safe(i.yearBuilt));
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 30);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        (historicalCost / usefulLife * Math.min(age, usefulLife));
      const obsolescence = clamp(i.obsolescenceFactor, 0, 1);
      const bookValue = Math.max(0, historicalCost - accumulatedDep - obsolescence * historicalCost * 0.5);

      const conditionScore = clamp(i.conditionScore, 1, 10) || 6;
      const conditionAdj = 0.55 + 0.045 * conditionScore;
      const replacementValue = historicalCost * conditionAdj * (1 - obsolescence);
      const comparableSales = safe(i.comparableSalesValue);
      const marketValue = Math.max(0, comparableSales || replacementValue);

      const dailyFuelVolume = Math.max(0, safe(i.dailyFuelVolume) || 5000);
      const marginPerLiter = safe(i.marginPerLiter) || 0.2;
      const convenienceRevenue = safe(i.annualConvenienceRevenue) || 0;
      const occupancy = clamp(i.occupancyRate, 0, 1) || 0.9;
      const annualRevenue = dailyFuelVolume * 365 * marginPerLiter * occupancy + convenienceRevenue;
      const opexRate = clamp(i.operatingExpensesRate, 0, 1) || 0.3;
      const noi = annualRevenue * (1 - opexRate);
      const capRate = clamp(i.capRate, 0.01, 0.5) || 0.1;
      const incomeValue = noi / capRate;
      const operatingValue = noi;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.25 + marketValue * 0.35 + incomeValue * 0.4) * riskAdj;

      const permits = safe(i.permitsValue);
      const trafficGrowth = clamp(i.trafficGrowthRate, 0, 0.5) || 0.03;
      const brand = clamp(i.brandStrength, 0, 100) / 100;
      const investmentValue = fairValue * (1 + trafficGrowth * 0.5 + brand * 0.05) + permits;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.05;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 9;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.12 / buyerPool) * (1 - liquidationTime / 36)
      );

      const insuranceValue = replacementValue * 1.1;

      return { bookValue, marketValue, operatingValue, incomeValue, fairValue, investmentValue, liquidationValue, insuranceValue };
    }

    /* ---------- Beauty & Wellness Engine (salons, spas, wellness centers) ---------- */
    _calcBeautyWellness(i) {
      const historicalCost = safe(i.equipmentCost) + safe(i.leaseholdImprovements) +
        safe(i.inventoryCost) + safe(i.furnitureCost);
      const age = Math.max(0, CURRENT_YEAR - safe(i.yearAcquired));
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 10);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        (historicalCost / usefulLife * Math.min(age, usefulLife));
      const obsolescence = clamp(i.obsolescenceFactor, 0, 1);
      const bookValue = Math.max(0, historicalCost - accumulatedDep - obsolescence * historicalCost * 0.5);

      const dailyCustomers = Math.max(0, safe(i.dailyCustomers) || 30);
      const avgSpend = safe(i.avgSpendPerCustomer) || 200;
      const occupancy = clamp(i.occupancyRate, 0, 1) || 0.7;
      const annualRevenue = dailyCustomers * avgSpend * 365 * occupancy;
      const cogsRate = clamp(i.cogsRate, 0, 1) || 0.35;
      const opexRate = clamp(i.operatingExpensesRate, 0, 1) || 0.35;
      const noi = Math.max(0, annualRevenue * (1 - cogsRate - opexRate));
      const capRate = clamp(i.capRate, 0.01, 0.5) || 0.12;
      const incomeValue = noi / capRate;
      const operatingValue = noi;

      const revenueMultiple = safe(i.revenueMultiple) || 1.2;
      const comparableSales = safe(i.comparableSalesValue);
      const marketValue = Math.max(0, comparableSales || (annualRevenue * revenueMultiple));

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.2 + marketValue * 0.35 + incomeValue * 0.45) * riskAdj;

      const brand = clamp(i.brandStrength, 0, 100) / 100;
      const recurring = clamp(i.recurringRevenueShare, 0, 1);
      const memberships = safe(i.membershipsValue);
      const investmentValue = fairValue * (1 + brand * 0.08 + recurring * 0.05) + memberships;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.06;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 6;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.15 / buyerPool) * (1 - liquidationTime / 36)
      );

      const insuranceValue = historicalCost * 1.1;

      return { bookValue, marketValue, operatingValue, incomeValue, fairValue, investmentValue, liquidationValue, insuranceValue };
    }

    /* ---------- Gifts & Stationery Engine ---------- */
    _calcGiftsStationery(i) {
      const inventory = safe(i.inventoryCost);
      const fixtures = safe(i.fixturesCost);
      const leasehold = safe(i.leaseholdImprovements);
      const historicalCost = inventory + fixtures + leasehold;
      const age = Math.max(0, CURRENT_YEAR - safe(i.yearAcquired));
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 10);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        ((fixtures + leasehold) / usefulLife * Math.min(age, usefulLife));
      const obsolescence = clamp(i.obsolescenceFactor, 0, 1);
      const bookValue = Math.max(0, historicalCost - accumulatedDep - obsolescence * historicalCost * 0.5);

      const monthlyRevenue = safe(i.monthlyRevenue) || 50000;
      const annualRevenue = monthlyRevenue * 12;
      const cogsRate = clamp(i.cogsRate, 0, 1) || 0.5;
      const opexRate = clamp(i.operatingExpensesRate, 0, 1) || 0.3;
      const noi = Math.max(0, annualRevenue * (1 - cogsRate - opexRate));
      const capRate = clamp(i.capRate, 0.01, 0.5) || 0.12;
      const incomeValue = noi / capRate;
      const operatingValue = noi;

      const revenueMultiple = safe(i.revenueMultiple) || 0.8;
      const comparableSales = safe(i.comparableSalesValue);
      const marketValue = Math.max(0, comparableSales || (annualRevenue * revenueMultiple));

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.25 + marketValue * 0.35 + incomeValue * 0.4) * riskAdj;

      const brand = clamp(i.brandStrength, 0, 100) / 100;
      const locationPremium = clamp(i.locationPremium, 0, 1);
      const investmentValue = fairValue * (1 + brand * 0.06 + locationPremium * 0.04);

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.05;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 6;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 4;
      const liquidationValue = Math.max(0,
        (inventory * 0.7 + fixtures * 0.5 + marketValue * 0.3) * (1 - transactionCosts - 0.1 / buyerPool) * (1 - liquidationTime / 36)
      );

      const insuranceValue = historicalCost * 1.05;

      return { bookValue, marketValue, operatingValue, incomeValue, fairValue, investmentValue, liquidationValue, insuranceValue };
    }

    /* ---------- Furniture Asset Engine (home & office furniture inventory) ---------- */
    _calcFurnitureAsset(i) {
      const historicalCost = safe(i.inventoryValue) + safe(i.showroomCost) + safe(i.warehouseCost) +
        safe(i.deliveryFleetValue);
      const age = Math.max(0, CURRENT_YEAR - safe(i.yearAcquired));
      const usefulLife = Math.max(1, safe(i.usefulLifeYears) || 15);
      const accumulatedDep = safe(i.accumulatedDepreciation) ||
        (historicalCost / usefulLife * Math.min(age, usefulLife));
      const obsolescence = clamp(i.obsolescenceFactor, 0, 1);
      const bookValue = Math.max(0, historicalCost - accumulatedDep - obsolescence * historicalCost * 0.5);

      const conditionScore = clamp(i.conditionScore, 1, 10) || 6;
      const conditionAdj = 0.55 + 0.045 * conditionScore;
      const replacementValue = historicalCost * conditionAdj * (1 - obsolescence);
      const comparableSales = safe(i.comparableSalesValue);
      const marketValue = Math.max(0, comparableSales || replacementValue);

      const monthlyRevenue = safe(i.monthlyRevenue) || 80000;
      const annualRevenue = monthlyRevenue * 12;
      const cogsRate = clamp(i.cogsRate, 0, 1) || 0.55;
      const opexRate = clamp(i.operatingExpensesRate, 0, 1) || 0.25;
      const noi = Math.max(0, annualRevenue * (1 - cogsRate - opexRate));
      const capRate = clamp(i.capRate, 0.01, 0.5) || 0.12;
      const incomeValue = noi / capRate;
      const operatingValue = noi;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.3 + marketValue * 0.3 + incomeValue * 0.4) * riskAdj;

      const brand = clamp(i.brandStrength, 0, 100) / 100;
      const warranty = safe(i.warrantyValue);
      const marketGrowth = clamp(i.marketGrowthRate, -0.2, 0.5);
      const investmentValue = fairValue * (1 + brand * 0.06 + marketGrowth) + warranty;

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.05;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 5;
      const liquidationTime = clamp(i.liquidationTimeMonths, 1, 36) || 6;
      const liquidationValue = Math.max(0,
        marketValue * (1 - transactionCosts - 0.12 / buyerPool) * (1 - liquidationTime / 36)
      );

      const insuranceValue = replacementValue * 1.1;

      return { bookValue, marketValue, operatingValue, incomeValue, fairValue, investmentValue, liquidationValue, insuranceValue };
    }

    /* ---------- Retail Business Engine (general retail activity) ---------- */
    _calcRetailBusiness(i) {
      const bookEquity = safe(i.equityBookValue);
      const inventory = safe(i.inventoryValue);
      const fixedAssets = safe(i.fixedAssetsValue);
      const totalLiabilities = safe(i.totalLiabilities);
      const bookValue = Math.max(0, bookEquity || (inventory + fixedAssets - totalLiabilities));

      const annualRevenue = safe(i.annualRevenue);
      const ebitdaMargin = clamp(i.ebitdaMargin, 0, 1) || 0.12;
      const ebitda = annualRevenue * ebitdaMargin;
      const revenueMultiple = safe(i.revenueMultiple) || 0.6;
      const ebitdaMultiple = safe(i.ebitdaMultiple) || 5;
      const marketValue = Math.max(0, (annualRevenue * revenueMultiple + ebitda * ebitdaMultiple) / 2);

      const taxRate = clamp(i.taxRate, 0, 1) || 0.2;
      const annualCapex = safe(i.annualCapex) || 0;
      const fcf = ebitda * (1 - taxRate) - annualCapex;
      const discountRate = clamp(i.discountRate, 0.01, 1) || 0.12;
      const projYears = Math.max(1, Math.min(10, safe(i.projectionYears) || 5));
      const terminalGrowth = Math.min(clamp(i.marketGrowthRate, 0, 0.1), discountRate * 0.8) || 0.02;

      let pv = 0;
      for (let t = 1; t <= projYears; t++) {
        pv += fcf * Math.pow(1 + terminalGrowth, t - 1) / Math.pow(1 + discountRate, t);
      }
      const terminal = fcf * Math.pow(1 + terminalGrowth, projYears) * (1 + terminalGrowth) /
        Math.max(0.005, discountRate - terminalGrowth);
      const pvTerminal = terminal / Math.pow(1 + discountRate, projYears);
      const incomeValue = pv + pvTerminal;
      const operatingValue = fcf;

      const avgRisk = this._avgRisk(i);
      const riskAdj = Math.max(0.5, 1 - avgRisk / 20);
      const fairValue = (bookValue * 0.2 + marketValue * 0.3 + incomeValue * 0.5) * riskAdj;

      const brand = clamp(i.brandStrength, 0, 100) / 100;
      const locationPremium = clamp(i.locationPremium, 0, 1);
      const investmentValue = fairValue * (1 + brand * 0.06 + locationPremium * 0.04);

      const transactionCosts = clamp(i.transactionCostsRate, 0, 1) || 0.05;
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10) || 6;
      const liquidationValue = Math.max(0,
        bookValue * (1 - transactionCosts - 0.1 / buyerPool)
      );

      return { bookValue, marketValue, operatingValue, incomeValue, fairValue, investmentValue, liquidationValue };
    }

    /* ---------- BVS integration helpers ---------- */
    _bvs() {
      return (typeof BVS !== 'undefined' && BVS) || null;
    }

    _bvsOutputWeights(assetClass) {
      const bvs = this._bvs();
      if (bvs && bvs.hasStandard(assetClass)) {
        return bvs.getOutputWeights(assetClass);
      }
      return { book: 0.25, market: 0.35, income: 0.35, liquidation: 0.05 };
    }

    _applyBVSWeights(values, weights) {
      const book = safe(values.bookValue);
      const market = safe(values.marketValue);
      const income = safe(values.incomeValue);
      const liquidation = safe(values.liquidationValue);
      const hasIncome = income > 0;
      const w = { ...weights };
      const total = (w.book || 0) + (w.market || 0) + (hasIncome ? (w.income || 0) : 0) + (w.liquidation || 0);
      if (total <= 0) return values;
      let fair = 0;
      fair += book * (w.book || 0);
      fair += market * (w.market || 0);
      if (hasIncome) fair += income * (w.income || 0);
      fair += liquidation * (w.liquidation || 0);
      fair = fair / total;
      return { ...values, fairValue: round2(fair) };
    }

    validateInputs(assetClass, inputs) {
      const bvs = this._bvs();
      if (!bvs) return { valid: true, issues: ['BVS not loaded'] };
      return bvs.validateInputs(assetClass, inputs);
    }

    getConfidenceScore(assetClass, inputs) {
      const bvs = this._bvs();
      if (!bvs) return 0;
      return bvs.getConfidenceScore(assetClass, inputs);
    }

    /* ---------- Market Intelligence adjustments ---------- */
    _applyMarketIntelligence(values, assetClass, inputs) {
      const market = this._getMarketData(assetClass, inputs);
      if (!market) return values;

      const result = { ...values, marketIntelligence: market };
      const marketValue = safe(values.marketValue);
      const fairValue = safe(values.fairValue);
      const investmentValue = safe(values.investmentValue);

      const confidence = clamp(market.confidence, 0, 1) || 0.5;
      const risk = clamp(market.riskScore, 0, 10);
      const riskAdj = 1 - (risk / 10) * 0.1;
      const outlook = market.outlook || 'neutral';
      const outlookAdj = outlook === 'positive' ? 0.025 : outlook === 'negative' ? -0.025 : 0;

      function applyInsightFactor(baseValue) {
        if (!baseValue || baseValue <= 0) return baseValue;
        const adjusted = baseValue * riskAdj * (1 + outlookAdj);
        return baseValue + (adjusted - baseValue) * confidence;
      }

      // Blend market value with average selling price if available
      if (market.averageSellingPrice > 0 && marketValue > 0) {
        const volumeWeight = Math.min(1, market.transactionCount / 100);
        const blended = marketValue * (1 - volumeWeight) + market.averageSellingPrice * volumeWeight;
        result.marketValue = round2(applyInsightFactor(blended));
      } else if (marketValue > 0) {
        result.marketValue = round2(applyInsightFactor(marketValue));
      }

      // Adjust fair value by demand/supply ratio
      if (fairValue > 0) {
        const demand = clamp(market.demandIndex, 1, 10);
        const supply = clamp(market.supplyIndex, 1, 10);
        const ratio = (demand / 5) / (supply / 5);
        result.fairValue = round2(applyInsightFactor(fairValue * ratio));
      }

      // Adjust investment value by inflation/interest/growth
      if (investmentValue > 0) {
        const growth = clamp(market.economicGrowthRate, -0.1, 0.5);
        const inflation = clamp(market.inflationRate, -0.1, 0.5);
        const interest = clamp(market.interestRate, 0, 0.5);
        const interestDiscount = 1 - (interest - 0.05) * 0.5;
        const growthPremium = 1 + growth + inflation;
        result.investmentValue = round2(applyInsightFactor(investmentValue * growthPremium * interestDiscount));
      }

      return result;
    }

    /* ---------- Condition Assessment Engine integration ---------- */
    _applyConditionAssessment(assetClass, inputs) {
      if (!inputs || !inputs.conditionAssessment || typeof BondsConditionAssessmentEngine === 'undefined') {
        return inputs;
      }
      try {
        const ca = BondsConditionAssessmentEngine.calculate(assetClass, inputs.conditionAssessment, {
          standards: inputs._conditionAssessmentStandards
        });
        if (ca && ca.valuationInputs) {
          Object.assign(inputs, ca.valuationInputs);
          inputs._conditionAssessmentResult = ca;
        }
      } catch (err) {
        console.warn('[ValuationEngine] Condition Assessment failed:', err);
      }
      return inputs;
    }

    /* ---------- Generic fallback (for completeness / future classes) ---------- */
    _calcGeneric(i) {
      const base = safe(i.purchasePrice) || safe(i.equityBookValue) ||
        safe(i.replacementCostNew) || 0;
      const riskAdj = Math.max(0.5, 1 - this._avgRisk(i) / 20);
      const market = base * (1 + clamp(i.marketGrowthRate, -0.2, 0.5)) * riskAdj;
      return {
        bookValue: round2(base),
        replacementValue: round2(base * 1.05),
        marketValue: round2(market),
        operatingValue: round2(market * 0.06),
        fairValue: round2(market * 0.95),
        investmentValue: round2(market * 1.05),
        liquidationValue: round2(market * 0.7),
        insuranceValue: round2(base * 1.1)
      };
    }

    calculate(assetClass, inputs) {
      const bvs = this._bvs();
      if (bvs && !bvs.hasStandard(assetClass)) {
        throw new Error(`BVS standard missing for asset class: ${assetClass}. Valuation blocked by BONDS Valuation Standards.`);
      }

      // Enrich inputs with Economic Life Database defaults if usefulLifeYears is missing
      const enrichedInputs = { ...inputs };
      if (!enrichedInputs.usefulLifeYears) {
        enrichedInputs.usefulLifeYears = this._usefulLifeFromEconomic(assetClass, enrichedInputs);
      }

      // Condition Assessment Engine enrichment (overrides conditionScore etc. when provided)
      this._applyConditionAssessment(assetClass, enrichedInputs);

      const outputWeights = this._bvsOutputWeights(assetClass);
      const rawValues = (() => {
        switch (assetClass) {
          case AssetClass.REAL_ESTATE: return this._calcRealEstate(enrichedInputs);
          case AssetClass.BUSINESS: return this._calcBusiness(enrichedInputs);
          case AssetClass.FACTORY: return this._calcFactory(enrichedInputs);
          case AssetClass.MACHINERY_EQUIPMENT:
            return this._calcDepreciableTangible(enrichedInputs, { weights: outputWeights, regulatoryBoost: 0, capRate: 0.12 });
          case AssetClass.VEHICLES_FLEET:
            return this._calcDepreciableTangible(enrichedInputs, { weights: outputWeights, regulatoryBoost: 0, capRate: 0.12 });
          case AssetClass.MEDICAL_EQUIPMENT:
            return this._calcDepreciableTangible(enrichedInputs, {
              weights: outputWeights,
              regulatoryBoost: 50000,
              capRate: 0.1
            });
          case AssetClass.EDUCATIONAL_EQUIPMENT:
            return this._calcDepreciableTangible(enrichedInputs, {
              weights: outputWeights,
              capRate: 0.1
            });
          case AssetClass.JEWELRY_PRECIOUS_METALS:
          case AssetClass.COMMODITIES:
            return this._calcCommodityLike(inputs);
          case AssetClass.DISTRESSED_ASSET:
            return this._calcDistressed(inputs);
          case AssetClass.AGRICULTURE_FARMS:
            return this._calcBiologicalNatural(enrichedInputs, { weights: outputWeights, capRate: 0.12 });
          case AssetClass.LIVESTOCK:
            return this._calcBiologicalNatural(enrichedInputs, { isLivestock: true, weights: outputWeights, capRate: 0.15 });
          case AssetClass.NATURAL_RESOURCES_MINING:
          case AssetClass.OIL_GAS:
            return this._calcResourceInfrastructure(enrichedInputs, { weights: outputWeights });
          case AssetClass.INFRASTRUCTURE:
            return this._calcResourceInfrastructure(enrichedInputs, { weights: outputWeights, growthRate: 0.03 });
          case AssetClass.INTELLECTUAL_PROPERTY:
            return this._calcIntangibleIncome(enrichedInputs, { defaultRoyaltyRate: 0.05, weights: outputWeights });
          case AssetClass.BRANDS_TRADEMARKS:
            return this._calcIntangibleIncome(enrichedInputs, { defaultRoyaltyRate: 0.04, weights: outputWeights });
          case AssetClass.PATENTS:
            return this._calcIntangibleIncome(enrichedInputs, { defaultRoyaltyRate: 0.06, weights: outputWeights });
          case AssetClass.COPYRIGHTS_CONTENT:
            return this._calcIntangibleIncome(enrichedInputs, { defaultRoyaltyRate: 0.07, weights: outputWeights });
          case AssetClass.FRANCHISES:
            return this._calcIntangibleIncome(enrichedInputs, { defaultRoyaltyRate: 0.06, weights: outputWeights });
          case AssetClass.LICENSES_PERMITS:
            return this._calcIntangibleIncome(enrichedInputs, { defaultRoyaltyRate: 0.03, weights: outputWeights });
          case AssetClass.FINANCIAL_ASSETS:
            return this._calcMarketableSecurities(enrichedInputs, { defaultTxCost: 0.015 });
          case AssetClass.CRYPTO_DIGITAL:
            return this._calcMarketableSecurities(enrichedInputs, { defaultTxCost: 0.025, isCrypto: true });
          case AssetClass.SOFTWARE_TECHNOLOGY:
            return this._calcSaaSTechnology(enrichedInputs);
          case AssetClass.ART_COLLECTIBLES:
            return this._calcGeneric(enrichedInputs);
          case AssetClass.TOURISM_ASSET:
            return this._calcTourismAsset(enrichedInputs);
          case AssetClass.PERSONAL_WEALTH:
            return this._calcPersonalWealth(enrichedInputs);
          case AssetClass.SCRAP_SALVAGE:
            return this._calcScrapSalvage(enrichedInputs);
          case AssetClass.MARITIME_ASSET:
            return this._calcMaritimeAsset(enrichedInputs);
          case AssetClass.LOGISTICS_ASSET:
            return this._calcLogisticsAsset(enrichedInputs);
          case AssetClass.FUEL_STATION:
            return this._calcFuelStation(enrichedInputs);
          case AssetClass.BEAUTY_WELLNESS:
            return this._calcBeautyWellness(enrichedInputs);
          case AssetClass.GIFTS_STATIONERY:
            return this._calcGiftsStationery(enrichedInputs);
          case AssetClass.FURNITURE_ASSET:
            return this._calcFurnitureAsset(enrichedInputs);
          case AssetClass.RETAIL_BUSINESS:
            return this._calcRetailBusiness(enrichedInputs);
          default: return this._calcGeneric(enrichedInputs);
        }
      })();

      // Apply BVS-mandated output weights to fair value combination
      const values = this._applyBVSWeights(rawValues, outputWeights);

      // BVS validation and confidence
      const validation = this.validateInputs(assetClass, enrichedInputs);
      const confidenceScore = this.getConfidenceScore(assetClass, enrichedInputs);

      const rounded = Object.fromEntries(Object.entries(values).map(([k, v]) => [
        k,
        typeof v === 'boolean' ? v : round2(v)
      ]));

      // Economic Life Database integration
      const lifeData = this._getEconomicLife(assetClass, enrichedInputs);

      // Depreciation Engine integration
      const depEngine = this._depreciationEngine();
      const depreciation = depEngine
        ? depEngine.calculate(assetClass, enrichedInputs, lifeData)
        : null;

      // Market Intelligence integration
      const marketAdjusted = this._applyMarketIntelligence(rounded, assetClass, enrichedInputs);

      return {
        ...marketAdjusted,
        confidenceScore: round2(confidenceScore),
        bvsValidation: validation,
        bvsVersion: bvs ? bvs.version : null,
        bvsCompliant: validation.valid,
        economicLife: round2(lifeData.economic),
        accountingLife: round2(lifeData.accounting),
        technicalLife: round2(lifeData.technical),
        designLife: round2(lifeData.design),
        operationalLife: round2(lifeData.operational),
        assetAge: round2(lifeData.age),
        remainingEconomicLife: round2(lifeData.remaining.economic),
        remainingAccountingLife: round2(lifeData.remaining.accounting),
        remainingTechnicalLife: round2(lifeData.remaining.technical),
        remainingDesignLife: round2(lifeData.remaining.design),
        remainingOperationalLife: round2(lifeData.remaining.operational),
        ...(depreciation && {
          accountingDepreciation: depreciation.accountingDepreciation,
          economicDepreciation: depreciation.economicDepreciation,
          operationalDepreciation: depreciation.operationalDepreciation,
          environmentalDepreciation: depreciation.environmentalDepreciation,
          technicalDepreciation: depreciation.technicalDepreciation,
          functionalDepreciation: depreciation.functionalDepreciation,
          maintenanceDepreciation: depreciation.maintenanceDepreciation,
          misuseDepreciation: depreciation.misuseDepreciation,
          totalDepreciation: depreciation.totalDepreciation,
          depreciationCurrentValue: depreciation.currentValue,
          depreciationFutureValue: depreciation.futureValue,
          depreciationReplacementValue: depreciation.replacementValue
        })
      };
    }

    /* ---------- Scoring ---------- */
    _assetQuality(assetClass, i) {
      let score = 50;
      if (assetClass === AssetClass.REAL_ESTATE) {
        const age = Math.max(0, CURRENT_YEAR - safe(i.yearBuilt));
        score = (
          clamp(i.conditionScore, 1, 10) * 8 +
          clamp(i.maintenanceLevel, 1, 10) * 6 +
          (10 - Math.min(age, 50) / 5) * 3 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 20
        );
      } else if (assetClass === AssetClass.BUSINESS) {
        const statusScore = { operating: 10, partial: 6, distressed: 3 }[(i.operationalStatus || '').toLowerCase()] || 5;
        score = (
          statusScore * 4 +
          clamp(i.managementQuality, 1, 10) * 6 +
          clamp(i.governanceScore, 1, 10) * 4 +
          clamp(i.techMaturity, 1, 10) * 3 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 10
        );
      } else if (assetClass === AssetClass.FACTORY) {
        const age = clamp(i.equipmentAgeYears, 0, 50);
        score = (
          (10 - age / 5) * 4 +
          clamp(i.conditionScore, 1, 10) * 6 +
          clamp(i.utilizationRate, 0, 1) * 20 +
          clamp(i.safetyCertificationScore, 1, 10) * 3 +
          clamp(i.digitalMaturity, 1, 10) * 3 +
          (1 - clamp(i.functionalObsolescence, 0, 1)) * 10
        );
      } else if ([
        AssetClass.MACHINERY_EQUIPMENT,
        AssetClass.VEHICLES_FLEET,
        AssetClass.MEDICAL_EQUIPMENT,
        AssetClass.EDUCATIONAL_EQUIPMENT
      ].includes(assetClass)) {
        const age = Math.max(0, CURRENT_YEAR - safe(i.yearAcquired));
        score = (
          clamp(i.conditionScore, 1, 10) * 7 +
          clamp(i.maintenanceLevel, 1, 10) * 5 +
          clamp(i.inspectionScore, 1, 10) * 4 +
          (10 - Math.min(age, 30) / 3) * 4 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 15 +
          clamp(i.utilizationRate, 0, 1) * 10
        );
      } else if ([AssetClass.JEWELRY_PRECIOUS_METALS, AssetClass.COMMODITIES].includes(assetClass)) {
        score = (
          clamp(i.conditionScore, 1, 10) * 5 +
          clamp(i.purityFactor, 0, 1) * 30 +
          clamp(i.authenticationScore, 1, 10) * 4 +
          (1 - clamp(i.marketVolatility, 0, 10) / 20) * 10
        );
      } else if (assetClass === AssetClass.DISTRESSED_ASSET) {
        score = (
          clamp(i.conditionScore, 1, 10) * 5 +
          (10 - clamp(i.distressSeverity, 0, 10)) * 6 +
          clamp(i.recoveryRate, 0, 1) * 20 +
          (1 - clamp(i.forcedSaleDiscount, 0, 1)) * 15
        );
      } else if ([AssetClass.AGRICULTURE_FARMS, AssetClass.LIVESTOCK].includes(assetClass)) {
        const age = clamp(i.biologicalAgeYears, 0, 30);
        score = (
          clamp(i.conditionScore, 1, 10) * 6 +
          clamp(i.qualityScore, 0, 10) * 5 +
          clamp(i.landQualityScore || i.healthScore, 0, 10) * 4 +
          (10 - age / 3) * 3 +
          (1 - clamp(i.mortalityRate || 0, 0, 1)) * 15
        );
      } else if ([AssetClass.NATURAL_RESOURCES_MINING, AssetClass.OIL_GAS, AssetClass.INFRASTRUCTURE].includes(assetClass)) {
        score = (
          clamp(i.reserveGrade || i.utilizationRate, 0, 1) * 30 +
          clamp(i.conditionScore, 1, 10) * 4 +
          clamp(i.environmentalComplianceScore || 5, 1, 10) * 4 +
          (clamp(i.licenseExpiryYears, 1, 50) / 5) * 2
        );
      } else if ([AssetClass.INTELLECTUAL_PROPERTY, AssetClass.BRANDS_TRADEMARKS, AssetClass.PATENTS, AssetClass.COPYRIGHTS_CONTENT, AssetClass.FRANCHISES, AssetClass.LICENSES_PERMITS].includes(assetClass)) {
        score = (
          clamp(i.brandStrength || i.intangibleStrength, 0, 100) * 0.25 +
          clamp(i.legalProtectionScore, 0, 10) * 5 +
          clamp(i.marketShare, 0, 1) * 20 +
          (clamp(i.remainingLifeYears, 1, 30) / 30) * 15
        );
      } else if ([AssetClass.JEWELRY_PRECIOUS_METALS, AssetClass.COMMODITIES, AssetClass.ART_COLLECTIBLES].includes(assetClass)) {
        score = (
          clamp(i.conditionScore, 1, 10) * 5 +
          clamp(i.purityFactor || i.rarityScore / 100, 0, 1) * 30 +
          clamp(i.authenticationScore, 1, 10) * 4 +
          (1 - clamp(i.marketVolatility, 0, 10) / 20) * 10
        );
      } else if ([AssetClass.FINANCIAL_ASSETS, AssetClass.CRYPTO_DIGITAL].includes(assetClass)) {
        score = (
          clamp(i.authenticationScore || i.custodyScore, 1, 10) * 5 +
          clamp(i.liquidityScore, 0, 10) * 6 +
          (1 - clamp(i.volatilityIndex, 0, 100) / 150) * 20 +
          clamp(i.conditionScore, 1, 10) * 3
        );
      } else if (assetClass === AssetClass.SOFTWARE_TECHNOLOGY) {
        score = (
          clamp(i.techMoatScore, 0, 10) * 5 +
          (1 - clamp(i.churnRate, 0, 1)) * 25 +
          clamp(i.grossMargin, 0, 1) * 15 +
          Math.min(safe(i.lifetimeValue) / Math.max(1, safe(i.customerAcquisitionCost)), 5) * 5 +
          clamp(i.conditionScore, 1, 10) * 2
        );
      } else if (assetClass === AssetClass.TOURISM_ASSET) {
        score = (
          clamp(i.conditionScore, 1, 10) * 5 +
          clamp(i.qualityMultiplier, 0.5, 2) * 25 +
          clamp(i.locationQualityScore, 0, 10) * 4 +
          clamp(i.occupancyRate, 0, 1) * 20 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 10
        );
      } else if (assetClass === AssetClass.PERSONAL_WEALTH) {
        score = (
          clamp(i.creditScore, 0, 10) * 5 +
          clamp(i.liquidityRatio, 0, 1) * 40 +
          clamp(i.authenticationScore || 5, 1, 10) * 3 +
          (1 - clamp(i.marketVolatility, 0, 10) / 20) * 10
        );
      } else if (assetClass === AssetClass.SCRAP_SALVAGE) {
        score = (
          clamp(i.conditionScore, 1, 10) * 5 +
          clamp(i.purityRate, 0, 1) * 30 +
          clamp(i.recoveryRate, 0, 1) * 20 +
          clamp(i.demandIndex, 1, 10) * 3 +
          (1 - clamp(i.priceVolatility, 0, 10) / 20) * 10
        );
      } else if (assetClass === AssetClass.MARITIME_ASSET) {
        const age = Math.max(0, CURRENT_YEAR - safe(i.yearBuilt));
        score = (
          clamp(i.conditionScore, 1, 10) * 6 +
          clamp(i.maintenanceLevel, 1, 10) * 5 +
          (10 - Math.min(age, 40) / 4) * 4 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 15 +
          clamp(i.utilizationRate, 0, 1) * 10
        );
      } else if (assetClass === AssetClass.LOGISTICS_ASSET) {
        const age = Math.max(0, CURRENT_YEAR - safe(i.yearBuilt));
        score = (
          clamp(i.conditionScore, 1, 10) * 6 +
          clamp(i.occupancyRate, 0, 1) * 25 +
          (10 - Math.min(age, 50) / 5) * 3 +
          clamp(i.automationPlan, 0, 1) * 10 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 10
        );
      } else if (assetClass === AssetClass.FUEL_STATION) {
        score = (
          clamp(i.conditionScore, 1, 10) * 6 +
          clamp(i.occupancyRate, 0, 1) * 25 +
          clamp(i.trafficGrowthRate || 0, 0, 0.5) * 40 +
          clamp(i.brandStrength, 0, 100) * 0.1 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 10
        );
      } else if (assetClass === AssetClass.BEAUTY_WELLNESS) {
        score = (
          clamp(i.conditionScore, 1, 10) * 6 +
          clamp(i.occupancyRate, 0, 1) * 25 +
          clamp(i.brandStrength, 0, 100) * 0.15 +
          clamp(i.recurringRevenueShare || 0, 0, 1) * 15 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 10
        );
      } else if (assetClass === AssetClass.GIFTS_STATIONERY) {
        score = (
          clamp(i.conditionScore, 1, 10) * 6 +
          clamp(i.brandStrength, 0, 100) * 0.15 +
          clamp(i.locationPremium, 0, 1) * 25 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 10 +
          clamp(i.inventoryTurnover || 5, 1, 10) * 4
        );
      } else if (assetClass === AssetClass.FURNITURE_ASSET) {
        score = (
          clamp(i.conditionScore, 1, 10) * 6 +
          clamp(i.brandStrength, 0, 100) * 0.15 +
          (1 - clamp(i.obsolescenceFactor, 0, 1)) * 15 +
          clamp(i.marketGrowthRate, -0.2, 0.5) * 30 +
          clamp(i.inventoryTurnover || 5, 1, 10) * 4
        );
      } else if (assetClass === AssetClass.RETAIL_BUSINESS) {
        score = (
          clamp(i.managementQuality, 1, 10) * 6 +
          clamp(i.brandStrength, 0, 100) * 0.15 +
          clamp(i.locationPremium, 0, 1) * 25 +
          (1 - clamp(i.obsolescenceFactor || 0, 0, 1)) * 10 +
          clamp(i.ebitdaMargin, 0, 1) * 15
        );
      }
      return clamp(score, 0, 100);
    }

    _marketStrength(i) {
      const demand = clamp(i.demandIndex, 1, 10);
      const supply = clamp(i.supplyIndex, 1, 10);
      const growth = clamp(i.marketGrowthRate, -0.2, 0.5);
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10);
      const liquidity = clamp(i.marketLiquidity, 1, 10) || 5;
      const activity = clamp(i.transactionVolume, 1, 10) || 5;
      const score = (
        demand * 6 +
        (11 - supply) * 3 +
        buyerPool * 5 +
        liquidity * 3 +
        activity * 3 +
        growth * 40
      );
      return clamp(score, 0, 100);
    }

    _riskScore(i) {
      return clamp(100 - this._avgRisk(i) * 10, 0, 100);
    }

    _liquidity(assetClass, i) {
      const buyerPool = clamp(i.buyerPoolDepth, 1, 10);
      const marketability = 1 - clamp(i.marketabilityDiscount, 0, 1);
      const transactionCost = 1 - clamp(i.transactionCostsRate, 0, 1);
      const classFactor = {
        [AssetClass.REAL_ESTATE]: 0.75,
        [AssetClass.BUSINESS]: 0.65,
        [AssetClass.FACTORY]: 0.55,
        [AssetClass.MACHINERY_EQUIPMENT]: 0.5,
        [AssetClass.VEHICLES_FLEET]: 0.6,
        [AssetClass.MEDICAL_EQUIPMENT]: 0.45,
        [AssetClass.EDUCATIONAL_EQUIPMENT]: 0.45,
        [AssetClass.JEWELRY_PRECIOUS_METALS]: 0.85,
        [AssetClass.COMMODITIES]: 0.75,
        [AssetClass.DISTRESSED_ASSET]: 0.35,
        [AssetClass.FINANCIAL_ASSETS]: 1.0,
        [AssetClass.CRYPTO_DIGITAL]: 0.85,
        [AssetClass.AGRICULTURE_FARMS]: 0.55,
        [AssetClass.LIVESTOCK]: 0.5,
        [AssetClass.NATURAL_RESOURCES_MINING]: 0.45,
        [AssetClass.OIL_GAS]: 0.5,
        [AssetClass.INFRASTRUCTURE]: 0.6,
        [AssetClass.INTELLECTUAL_PROPERTY]: 0.55,
        [AssetClass.BRANDS_TRADEMARKS]: 0.6,
        [AssetClass.PATENTS]: 0.5,
        [AssetClass.COPYRIGHTS_CONTENT]: 0.55,
        [AssetClass.FRANCHISES]: 0.6,
        [AssetClass.LICENSES_PERMITS]: 0.65,
        [AssetClass.ART_COLLECTIBLES]: 0.5,
        [AssetClass.SOFTWARE_TECHNOLOGY]: 0.75,
        [AssetClass.TOURISM_ASSET]: 0.55,
        [AssetClass.PERSONAL_WEALTH]: 0.85,
        [AssetClass.SCRAP_SALVAGE]: 0.6,
        [AssetClass.MARITIME_ASSET]: 0.45,
        [AssetClass.LOGISTICS_ASSET]: 0.65,
        [AssetClass.FUEL_STATION]: 0.7,
        [AssetClass.BEAUTY_WELLNESS]: 0.6,
        [AssetClass.GIFTS_STATIONERY]: 0.7,
        [AssetClass.FURNITURE_ASSET]: 0.55,
        [AssetClass.RETAIL_BUSINESS]: 0.65
      }[assetClass] || 0.6;
      const score = (buyerPool * 5 + marketability * 25 + transactionCost * 20) * classFactor;
      return clamp(score, 0, 100);
    }

    _growth(i) {
      const gdp = clamp(i.gdpGrowth, 0, 0.2);
      const pop = clamp(i.populationGrowth, 0, 0.1);
      const market = clamp(i.marketGrowth || i.marketGrowthRate, 0, 0.2);
      const innovation = clamp(i.innovationPipeline, 0, 1);
      const infra = clamp(i.infrastructurePlans, 0, 1);
      const automation = clamp(i.automationPlan, 0, 1);
      const revGrowth = clamp(i.revenueGrowthRate, -0.1, 0.5);
      const score = gdp * 200 + pop * 200 + market * 250 + innovation * 10 +
        infra * 10 + automation * 10 + revGrowth * 30;
      return clamp(score, 0, 100);
    }

    _management(i) {
      const score = (
        clamp(i.managementQuality, 1, 10) * 7 +
        clamp(i.governanceScore, 1, 10) * 5 +
        clamp(i.techMaturity, 1, 10) * 4 +
        clamp(i.workforceSkill, 1, 10) * 4
      );
      return clamp(score, 0, 100);
    }

    _brand(i) {
      const score = (
        clamp(i.brandStrength, 0, 100) * 0.25 +
        clamp(i.proprietaryTechnology, 0, 100) * 0.2 +
        (safe(i.patentsValue) / 1000000) * 2 +
        (safe(i.licensesValue) / 1000000) * 2 +
        clamp(i.customerRelationships, 0, 100) * 0.2 +
        clamp(i.locationPremium, 0, 1) * 15
      );
      return clamp(score, 0, 100);
    }

    calculateScores(inputs) {
      const assetClass = inputs.assetClass || AssetClass.REAL_ESTATE;
      const assetQuality = this._assetQuality(assetClass, inputs);
      const marketStrength = this._marketStrength(inputs);
      const risk = this._riskScore(inputs);
      const liquidity = this._liquidity(assetClass, inputs);
      const growth = this._growth(inputs);
      const management = this._management(inputs);
      const brandStrength = this._brand(inputs);
      const investmentAttractiveness = clamp(
        assetQuality * 0.20 + marketStrength * 0.20 + growth * 0.20 +
        brandStrength * 0.15 + liquidity * 0.10 + risk * 0.15,
        0, 100
      );
      return {
        assetQuality: round2(assetQuality),
        marketStrength: round2(marketStrength),
        risk: round2(risk),
        liquidity: round2(liquidity),
        growth: round2(growth),
        management: round2(management),
        brandStrength: round2(brandStrength),
        investmentAttractiveness: round2(investmentAttractiveness)
      };
    }

    /* ---------- AI Decision Engine helpers ---------- */
    _buildSwot(inputs, lang = 'ar') {
      const isEn = lang === 'en';
      const strengths = [];
      const weaknesses = [];
      const opportunities = [];
      const threats = [];

      if (clamp(inputs.conditionScore, 1, 10) >= 8) {
        strengths.push(isEn ? 'Excellent physical/technical condition' : 'حالة فنية/بدنية ممتازة');
      } else if (clamp(inputs.conditionScore, 1, 10) <= 4) {
        weaknesses.push(isEn ? 'Poor physical/technical condition' : 'حالة فنية/بدنية ضعيفة');
      }

      if (clamp(inputs.buyerPoolDepth, 1, 10) >= 7) {
        strengths.push(isEn ? 'Deep buyer pool supports liquidity' : 'سوق مشترين عميق يدعم السيولة');
      } else if (clamp(inputs.buyerPoolDepth, 1, 10) <= 3) {
        weaknesses.push(isEn ? 'Limited buyer pool' : 'سوق مشترين محدود');
      }

      if (clamp(inputs.brandStrength || 0, 0, 100) >= 70) {
        strengths.push(isEn ? 'Strong brand or strategic position' : 'علامة تجارية أو مكانة استراتيجية قوية');
      }

      const riskScore = this._riskScore(inputs);
      if (riskScore >= 70) {
        strengths.push(isEn ? 'Low overall risk profile' : 'ملف مخاطر منخفض بشكل عام');
      } else if (riskScore <= 40) {
        weaknesses.push(isEn ? 'Elevated risk profile' : 'ملف مخاطر مرتفع');
      }

      if (clamp(inputs.marketGrowthRate, -0.2, 0.5) >= 0.05) {
        opportunities.push(isEn ? 'Favorable market growth trajectory' : 'مسار نمو سوقي مواتٍ');
      }
      if (clamp(inputs.automationPlan || 0, 0, 1) >= 0.5) {
        opportunities.push(isEn ? 'Automation/digital upgrade potential' : 'إمكانات التحسين بالأتمتة/الرقمنة');
      }
      if (clamp(inputs.infrastructurePlans || 0, 0, 1) >= 0.5) {
        opportunities.push(isEn ? 'Infrastructure catalysts nearby' : 'محفزات بنية تحتية قريبة');
      }

      if (clamp(inputs.marketVolatility, 0, 10) >= 7) {
        threats.push(isEn ? 'High market volatility' : 'تقلب سوقي مرتفع');
      }
      if (clamp(inputs.regulatoryRisk, 0, 10) >= 7) {
        threats.push(isEn ? 'Significant regulatory risk' : 'مخاطر تنظيمية كبيرة');
      }
      if (clamp(inputs.obsolescenceFactor || 0, 0, 1) >= 0.5) {
        threats.push(isEn ? 'Technology obsolescence risk' : 'مخاطر عطل التقنية');
      }

      return { strengths, weaknesses, opportunities, threats };
    }

    _projectValue(fairValue, growthRate, riskScore, years) {
      const g = clamp(growthRate, -0.2, 0.5);
      const riskDecay = 1 - (100 - riskScore) / 200; // risk reduces long-term value
      return years.map(t => round2(fairValue * Math.pow(1 + g, t) * Math.pow(riskDecay, t / 5)));
    }

    /* ---------- Executive Report ---------- */
    generateReport(result, lang = 'ar') {
      const v = result.valuations;
      const s = result.scores;
      const i = result.inputs || {};
      const isEn = lang === 'en';

      let rec = 'keep';
      if (i.distressSeverity !== undefined && clamp(i.distressSeverity, 0, 10) >= 7 && s.investmentAttractiveness < 50) {
        rec = 'restructure';
      } else if (s.investmentAttractiveness >= 75 && s.growth >= 60 && v.fairValue >= v.marketValue * 0.95) {
        rec = 'keep';
      } else if (s.marketStrength >= 65 && v.marketValue > v.fairValue * 1.1 && s.liquidity >= 50) {
        rec = 'sell';
      } else if (s.growth >= 65 && (s.assetQuality >= 60 || s.brandStrength >= 60)) {
        rec = 'develop';
      } else {
        rec = 'restructure';
      }

      const recMeta = {
        keep: {
          ar: { label: 'احتفظ', desc: 'الأصول ذات جودة عالية وتوقعات نمو إيجابية؛ يُنصح بالاستمرار في الاحتفاظ وتحسين الإدارة.' },
          en: { label: 'Keep', desc: 'High-quality asset with positive growth outlook; continue holding and fine-tune management.' }
        },
        sell: {
          ar: { label: 'بيع', desc: 'السوق يُقدّم قيمة أعلى من القيمة العادلة والسيولة جيدة؛ نافذة البيع مُحفّزة.' },
          en: { label: 'Sell', desc: 'Market value exceeds fair value and liquidity is adequate; a favorable sale window exists.' }
        },
        develop: {
          ar: { label: 'تطوير', desc: 'إمكانات النمو قوية والأصل قابل للترقية؛ يُنصح باستثمارات تطويرية لرفع القيمة.' },
          en: { label: 'Develop', desc: 'Strong growth potential and the asset is upgradeable; prioritize value-add investments.' }
        },
        restructure: {
          ar: { label: 'إعادة هيكلة', desc: 'المخاطر مرتفعة أو الجودة ضعيفة نسبياً؛ يحتاج الأصل إلى إعادة هيكلة تشغيلية أو مالية.' },
          en: { label: 'Restructure', desc: 'Elevated risk or weak quality signals; the asset needs operational or financial restructuring.' }
        }
      }[rec][isEn ? 'en' : 'ar'];

      const fmt = (n) => (Number(n) || 0).toLocaleString(isEn ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 });
      const growthRate = clamp(i.marketGrowthRate || i.marketGrowth || 0.03, -0.2, 0.5);
      const avgRisk = 10 - s.risk / 10;

      const scenarios = {
        base: v.fairValue,
        optimistic: round2(v.fairValue * (1 + growthRate) * 1.05),
        pessimistic: round2(v.fairValue * (1 - avgRisk / 20) * (1 - (100 - s.liquidity) / 200))
      };
      const projections = this._projectValue(v.fairValue, growthRate, s.risk, [1, 3, 5]);
      const swot = this._buildSwot(i, lang);

      const t = isEn ? {
        summary: 'Executive Summary — BONDS Valuation Intelligence',
        values: 'Core Values',
        scores: 'Scores',
        scenarios: 'Value Scenarios',
        projections: 'Projections',
        swot: 'SWOT Analysis',
        rec: 'Recommendation',
        base: 'Base',
        optimistic: 'Optimistic',
        pessimistic: 'Pessimistic',
        year: 'Year',
        none: 'None identified',
        depreciation: 'Depreciation Analysis',
        depreciatedValue: 'Depreciated current value',
        remainingValue: 'Remaining after total depreciation'
      } : {
        summary: 'الملخص التنفيذي — منصة بوندز الذكية للتقييم',
        values: 'القيم الأساسية',
        scores: 'المؤشرات',
        scenarios: 'سيناريوهات القيمة',
        projections: 'التوقعات',
        swot: 'تحليل SWOT',
        rec: 'التوصية',
        base: 'الأساسي',
        optimistic: 'الإيجابي',
        pessimistic: 'السلبي',
        year: 'سنة',
        none: 'لا يوجد',
        depreciation: 'تحليل الاستهلاك',
        depreciatedValue: 'القيمة الحالية بعد الاستهلاك',
        remainingValue: 'المتبقي بعد إجمالي الاستهلاك'
      };

      const valueLines = [
        `${t.values}:`,
        `  Book: ${fmt(v.bookValue)} | Market: ${fmt(v.marketValue)} | Fair: ${fmt(v.fairValue)}`,
        `  Investment: ${fmt(v.investmentValue)} | Liquidation: ${fmt(v.liquidationValue)}`
      ];
      if (v.insuranceValue !== undefined) valueLines.push(`  Insurance: ${fmt(v.insuranceValue)}`);
      if (v.operatingValue !== undefined) valueLines.push(`  Operating: ${fmt(v.operatingValue)}`);
      if (v.quickExitValue !== undefined) valueLines.push(`  Quick Exit: ${fmt(v.quickExitValue)}`);
      if (v.restructuredValue !== undefined) valueLines.push(`  Restructured: ${fmt(v.restructuredValue)}`);

      const swotSection = [
        `${t.swot}:`,
        `  S: ${swot.strengths.length ? swot.strengths.join(' · ') : t.none}`,
        `  W: ${swot.weaknesses.length ? swot.weaknesses.join(' · ') : t.none}`,
        `  O: ${swot.opportunities.length ? swot.opportunities.join(' · ') : t.none}`,
        `  T: ${swot.threats.length ? swot.threats.join(' · ') : t.none}`
      ];

      const depreciationLines = v.totalDepreciation !== undefined ? [
        `${t.depreciation}:`,
        `  ${t.remainingValue}: ${fmt(v.totalDepreciation)} → ${t.depreciatedValue}: ${fmt(v.depreciationCurrentValue)}`
      ] : [];

      const lines = [
        t.summary,
        ...valueLines,
        ...depreciationLines,
        `${t.scores}: Quality ${s.assetQuality}/100 · Market ${s.marketStrength}/100 · Risk ${s.risk}/100 · Liquidity ${s.liquidity}/100`,
        `  Growth ${s.growth}/100 · Management ${s.management}/100 · Brand ${s.brandStrength}/100 · Attractiveness ${s.investmentAttractiveness}/100`,
        `${t.scenarios}: ${t.base} ${fmt(scenarios.base)} · ${t.optimistic} ${fmt(scenarios.optimistic)} · ${t.pessimistic} ${fmt(scenarios.pessimistic)}`,
        `${t.projections}: ${t.year} 1: ${fmt(projections[0])} · ${t.year} 3: ${fmt(projections[1])} · ${t.year} 5: ${fmt(projections[2])}`,
        ...swotSection,
        `${t.rec}: ${recMeta.label} — ${recMeta.desc}`
      ];
      return lines.join('\n');
    }
  }

  // Expose globals
  if (typeof window !== 'undefined') {
    window.AssetClass = AssetClass;
    window.ValuationModel = ValuationModel;
    window.ValuationEngine = ValuationEngine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.AssetClass = AssetClass;
    globalThis.ValuationModel = ValuationModel;
    globalThis.ValuationEngine = ValuationEngine;
  }
})();
