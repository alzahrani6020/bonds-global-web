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

    _labels: {
      realEstate: { ar: 'العقارات', en: 'Real Estate', active: true },
      business: { ar: 'الشركات', en: 'Businesses', active: true },
      factory: { ar: 'المصانع', en: 'Factories', active: true },
      machineryEquipment: { ar: 'الآلات والمعدات', en: 'Machinery & Equipment', active: true },
      vehiclesFleet: { ar: 'المركبات والأساطيل', en: 'Vehicles & Fleet', active: true },
      agricultureFarms: { ar: 'الزراعة والمزارع', en: 'Agriculture & Farms', active: false },
      livestock: { ar: 'الثروة الحيوانية', en: 'Livestock', active: false },
      naturalResourcesMining: { ar: 'الموارد الطبيعية والتعدين', en: 'Natural Resources & Mining', active: false },
      oilGas: { ar: 'النفط والغاز', en: 'Oil & Gas Assets', active: false },
      infrastructure: { ar: 'البنية التحتية', en: 'Infrastructure', active: false },
      intellectualProperty: { ar: 'الملكية الفكرية', en: 'Intellectual Property', active: false },
      brandsTrademarks: { ar: 'العلامات التجارية', en: 'Brands & Trademarks', active: false },
      patents: { ar: 'براءات الاختراع', en: 'Patents', active: false },
      copyrightsContent: { ar: 'حقوق المؤلف والمحتوى', en: 'Copyrights & Content', active: false },
      franchises: { ar: 'الامتيازات التجارية', en: 'Franchises', active: false },
      licensesPermits: { ar: 'التراخيص والتصاريح', en: 'Licenses & Permits', active: false },
      financialAssets: { ar: 'الأصول المالية', en: 'Financial Assets', active: false },
      cryptoDigital: { ar: 'العملات الرقمية والأصول الرقمية', en: 'Crypto & Digital Assets', active: false },
      commodities: { ar: 'السلع', en: 'Commodities', active: true },
      artCollectibles: { ar: 'الفنون والمقتنيات', en: 'Art & Collectibles', active: false },
      jewelryPreciousMetals: { ar: 'المجوهرات والمعادن الثمينة', en: 'Jewelry & Precious Metals', active: true },
      softwareTechnology: { ar: 'البرمجيات والتقنية', en: 'Software & Technology', active: false },
      medicalEquipment: { ar: 'الأجهزة والمعدات الطبية', en: 'Medical Equipment', active: true },
      educationalEquipment: { ar: 'التجهيزات التعليمية', en: 'Educational Equipment', active: true },
      distressedAsset: { ar: 'الأصول المتعثرة', en: 'Distressed Assets', active: true },
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

      return { bookValue: adjustedBook, marketValue, fairValue, investmentValue, liquidationValue };
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
      const values = (() => {
        switch (assetClass) {
          case AssetClass.REAL_ESTATE: return this._calcRealEstate(inputs);
          case AssetClass.BUSINESS: return this._calcBusiness(inputs);
          case AssetClass.FACTORY: return this._calcFactory(inputs);
          case AssetClass.MACHINERY_EQUIPMENT:
            return this._calcDepreciableTangible(inputs, { weights: { book: 0.25, market: 0.35, income: 0.4 } });
          case AssetClass.VEHICLES_FLEET:
            return this._calcDepreciableTangible(inputs, { weights: { book: 0.2, market: 0.45, income: 0.35 } });
          case AssetClass.MEDICAL_EQUIPMENT:
            return this._calcDepreciableTangible(inputs, {
              weights: { book: 0.25, market: 0.3, income: 0.45 },
              regulatoryBoost: 50000,
              capRate: 0.1
            });
          case AssetClass.EDUCATIONAL_EQUIPMENT:
            return this._calcDepreciableTangible(inputs, {
              weights: { book: 0.3, market: 0.3, income: 0.4 },
              capRate: 0.1
            });
          case AssetClass.JEWELRY_PRECIOUS_METALS:
          case AssetClass.COMMODITIES:
            return this._calcCommodityLike(inputs);
          case AssetClass.DISTRESSED_ASSET:
            return this._calcDistressed(inputs);
          default: return this._calcGeneric(inputs);
        }
      })();
      return Object.fromEntries(Object.entries(values).map(([k, v]) => [k, round2(v)]));
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
        [AssetClass.CRYPTO_DIGITAL]: 0.85
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
        none: 'None identified'
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
        none: 'لا يوجد'
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

      const lines = [
        t.summary,
        ...valueLines,
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
