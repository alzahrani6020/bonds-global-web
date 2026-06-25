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

    _labels: {
      realEstate: { ar: 'العقارات', en: 'Real Estate', active: true },
      business: { ar: 'الشركات', en: 'Businesses', active: true },
      factory: { ar: 'المصانع', en: 'Factories', active: true },
      machineryEquipment: { ar: 'الآلات والمعدات', en: 'Machinery & Equipment', active: false },
      vehiclesFleet: { ar: 'المركبات والأساطيل', en: 'Vehicles & Fleet', active: false },
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
      commodities: { ar: 'السلع', en: 'Commodities', active: false },
      artCollectibles: { ar: 'الفنون والمقتنيات', en: 'Art & Collectibles', active: false },
      jewelryPreciousMetals: { ar: 'المجوهرات والمعادن الثمينة', en: 'Jewelry & Precious Metals', active: false },
      softwareTechnology: { ar: 'البرمجيات والتقنية', en: 'Software & Technology', active: false },
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

    /* ---------- Generic fallback (for completeness / future classes) ---------- */
    _calcGeneric(i) {
      const base = safe(i.purchasePrice) || safe(i.equityBookValue) ||
        safe(i.replacementCostNew) || 0;
      const riskAdj = Math.max(0.5, 1 - this._avgRisk(i) / 20);
      const market = base * (1 + clamp(i.marketGrowthRate, -0.2, 0.5)) * riskAdj;
      return {
        bookValue: round2(base),
        marketValue: round2(market),
        fairValue: round2(market * 0.95),
        investmentValue: round2(market * 1.05),
        liquidationValue: round2(market * 0.7)
      };
    }

    calculate(assetClass, inputs) {
      const values = (() => {
        switch (assetClass) {
          case AssetClass.REAL_ESTATE: return this._calcRealEstate(inputs);
          case AssetClass.BUSINESS: return this._calcBusiness(inputs);
          case AssetClass.FACTORY: return this._calcFactory(inputs);
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

    /* ---------- Executive Report ---------- */
    generateReport(result, lang = 'ar') {
      const v = result.valuations;
      const s = result.scores;
      const isEn = lang === 'en';

      let rec = 'keep';
      if (s.investmentAttractiveness >= 75 && s.growth >= 60 && v.fairValue >= v.marketValue * 0.95) {
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

      const fmt = (n) => n.toLocaleString(isEn ? 'en-US' : 'ar-SA', { maximumFractionDigits: 2 });
      const lines = isEn ? [
        `Executive Summary — BONDS Valuation Intelligence`,
        `Book Value: ${fmt(v.bookValue)} | Market Value: ${fmt(v.marketValue)} | Fair Value: ${fmt(v.fairValue)}`,
        `Investment Value: ${fmt(v.investmentValue)} | Liquidation Value: ${fmt(v.liquidationValue)}`,
        `Asset Quality: ${s.assetQuality}/100 · Market Strength: ${s.marketStrength}/100 · Risk: ${s.risk}/100 · Liquidity: ${s.liquidity}/100`,
        `Growth: ${s.growth}/100 · Management: ${s.management}/100 · Brand Strength: ${s.brandStrength}/100 · Investment Attractiveness: ${s.investmentAttractiveness}/100`,
        `Recommendation: ${recMeta.label} — ${recMeta.desc}`
      ] : [
        `الملخص التنفيذي — منصة بوندز الذكية للتقييم`,
        `القيمة الدفترية: ${fmt(v.bookValue)} | القيمة السوقية: ${fmt(v.marketValue)} | القيمة العادلة: ${fmt(v.fairValue)}`,
        `قيمة الاستثمار: ${fmt(v.investmentValue)} | قيمة التصفية: ${fmt(v.liquidationValue)}`,
        `جودة الأصل: ${s.assetQuality}/100 · قوة السوق: ${s.marketStrength}/100 · المخاطر: ${s.risk}/100 · السيولة: ${s.liquidity}/100`,
        `النمو: ${s.growth}/100 · الإدارة: ${s.management}/100 · قوة العلامة: ${s.brandStrength}/100 · جاذبية الاستثمار: ${s.investmentAttractiveness}/100`,
        `التوصية: ${recMeta.label} — ${recMeta.desc}`
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
