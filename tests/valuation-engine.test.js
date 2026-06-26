/**
 * Tests for BONDS Valuation Intelligence — Frontend Valuation Engine
 */
const fs = require('fs');
const path = require('path');

const engineCode = fs.readFileSync(path.join(__dirname, '../valuation/valuation-engine.js'), 'utf8');
eval(engineCode);

function buildInputs(defaults) {
  return {
    conditionScore: 7,
    maintenanceLevel: 7,
    demandIndex: 6,
    supplyIndex: 5,
    buyerPoolDepth: 5,
    marketGrowthRate: 0.04,
    marketVolatility: 4,
    regulatoryRisk: 4,
    obsolescenceFactor: 0.1,
    utilizationRate: 0.7,
    transactionCostsRate: 0.05,
    ...defaults
  };
}

describe('ValuationEngine', () => {
  const engine = new ValuationEngine();

  describe('Active asset classes', () => {
    it('calculates real estate values', () => {
      const inputs = buildInputs({
        purchasePrice: 2000000,
        yearBuilt: 2015,
        areaSqm: 500,
        comparablePricePerSqm: 4500,
        monthlyRent: 20000,
        capRate: 0.07,
        accumulatedDepreciation: 300000
      });
      const result = engine.calculate('realEstate', inputs);
      expect(result.bookValue).toBeGreaterThan(0);
      expect(result.marketValue).toBeGreaterThan(0);
      expect(result.fairValue).toBeGreaterThan(0);
    });

    it('calculates depreciable tangible values', () => {
      const base = {
        purchasePrice: 800000,
        replacementCostNew: 900000,
        comparableSalesValue: 700000,
        monthlyOperatingRevenue: 30000,
        usefulLifeYears: 15,
        yearAcquired: 2018,
        operatingHours: 8000,
        inspectionScore: 7
      };
      ['machineryEquipment', 'vehiclesFleet', 'medicalEquipment', 'educationalEquipment'].forEach(cls => {
        const inputs = buildInputs({ ...base });
        const result = engine.calculate(cls, inputs);
        expect(result.bookValue).toBeGreaterThanOrEqual(0);
        expect(result.replacementValue).toBeGreaterThan(0);
        expect(result.marketValue).toBeGreaterThan(0);
        expect(result.fairValue).toBeGreaterThan(0);
        expect(result.insuranceValue).toBeGreaterThan(0);
      });
    });

    it('calculates commodity-like values', () => {
      const base = {
        quantityUnits: 1000,
        spotPricePerUnit: 250,
        purityFactor: 0.999,
        purchasePrice: 250000,
        premiumRate: 0.08
      };
      ['jewelryPreciousMetals', 'commodities'].forEach(cls => {
        const inputs = buildInputs({ ...base });
        const result = engine.calculate(cls, inputs);
        expect(result.bookValue).toBeGreaterThanOrEqual(0);
        expect(result.marketValue).toBeGreaterThan(0);
        expect(result.fairValue).toBeGreaterThan(0);
        expect(result.liquidationValue).toBeGreaterThanOrEqual(0);
        expect(result.insuranceValue).toBeGreaterThan(0);
      });
    });

    it('calculates distressed asset values', () => {
      const inputs = buildInputs({
        bookValue: 2000000,
        accumulatedDebt: 800000,
        marketValue: 1800000,
        stabilizedNOI: 200000,
        stabilizedCapRate: 0.08,
        distressSeverity: 7,
        forcedSaleDiscount: 0.3,
        recoveryRate: 0.55,
        restructuringCost: 200000
      });
      const result = engine.calculate('distressedAsset', inputs);
      expect(result.bookValue).toBeGreaterThanOrEqual(0);
      expect(result.marketValue).toBeGreaterThanOrEqual(0);
      expect(result.fairValue).toBeGreaterThanOrEqual(0);
      expect(result.restructuredValue).toBeDefined();
      expect(result.quickExitValue).toBeDefined();
    });

    it('calculates biological and natural resource values', () => {
      const farmInputs = buildInputs({
        purchasePrice: 500000,
        developmentCost: 200000,
        equipmentCost: 100000,
        areaUnits: 10,
        yieldPerUnit: 5,
        marketPricePerUnit: 1000,
        annualRevenue: 100000,
        feedCost: 20000,
        veterinaryCost: 10000,
        otherOperatingCosts: 15000,
        biologicalAgeYears: 5,
        mortalityRate: 0.05,
        landQualityScore: 7,
        waterAvailabilityScore: 6
      });
      ['agricultureFarms', 'livestock'].forEach(cls => {
        const inputs = buildInputs({ ...farmInputs, quantityUnits: 100, marketPricePerUnit: 3500 });
        const result = engine.calculate(cls, inputs);
        expect(result.bookValue).toBeGreaterThanOrEqual(0);
        expect(result.marketValue).toBeGreaterThan(0);
        expect(result.fairValue).toBeGreaterThan(0);
      });
    });

    it('calculates resource and infrastructure values', () => {
      const base = {
        landCost: 1000000,
        developmentCost: 2000000,
        equipmentCost: 1500000,
        reserveUnits: 100000,
        commodityPricePerUnit: 500,
        extractionCostPerUnit: 250,
        utilizationRate: 0.1,
        annualFixedCosts: 500000,
        licenseExpiryYears: 15,
        reserveGrade: 0.8
      };
      ['naturalResourcesMining', 'oilGas', 'infrastructure'].forEach(cls => {
        const inputs = buildInputs({ ...base, capacityUnits: 10, tariffRevenuePerUnit: 50000 });
        const result = engine.calculate(cls, inputs);
        expect(result.bookValue).toBeGreaterThanOrEqual(0);
        expect(result.marketValue).toBeGreaterThan(0);
        expect(result.fairValue).toBeGreaterThan(0);
      });
    });

    it('calculates intangible income-based values', () => {
      const base = {
        purchasePrice: 1000000,
        accumulatedAmortization: 200000,
        comparableTransactionValue: 2500000,
        annualRevenue: 2000000,
        royaltyRate: 0.05,
        growthRate: 0.04,
        discountRate: 0.12,
        remainingLifeYears: 10,
        brandStrength: 60,
        marketShare: 0.1,
        legalProtectionScore: 7
      };
      ['intellectualProperty', 'brandsTrademarks', 'patents', 'copyrightsContent', 'franchises', 'licensesPermits'].forEach(cls => {
        const inputs = buildInputs({ ...base });
        const result = engine.calculate(cls, inputs);
        expect(result.bookValue).toBeGreaterThanOrEqual(0);
        expect(result.marketValue).toBeGreaterThan(0);
        expect(result.fairValue).toBeGreaterThan(0);
      });
    });

    it('calculates marketable securities values', () => {
      const base = {
        purchasePrice: 250000,
        quantityUnits: 1000,
        marketPricePerUnit: 250,
        dividendYield: 0.03,
        liquidityScore: 8,
        custodyScore: 9
      };
      ['financialAssets', 'cryptoDigital'].forEach(cls => {
        const inputs = buildInputs({ ...base });
        const result = engine.calculate(cls, inputs);
        expect(result.bookValue).toBeGreaterThanOrEqual(0);
        expect(result.marketValue).toBeGreaterThan(0);
        expect(result.fairValue).toBeGreaterThan(0);
      });
    });

    it('calculates SaaS and technology values', () => {
      const inputs = buildInputs({
        developmentCost: 800000,
        accumulatedAmortization: 150000,
        annualRecurringRevenue: 1200000,
        annualOpex: 600000,
        growthRate: 0.2,
        discountRate: 0.15,
        grossMargin: 0.75,
        revenueMultiple: 8,
        customerCount: 500,
        lifetimeValue: 1200,
        customerAcquisitionCost: 200,
        techMoatScore: 7,
        churnRate: 0.05
      });
      const result = engine.calculate('softwareTechnology', inputs);
      expect(result.bookValue).toBeGreaterThanOrEqual(0);
      expect(result.marketValue).toBeGreaterThan(0);
      expect(result.fairValue).toBeGreaterThan(0);
    });

    it('calculates art and collectibles values', () => {
      const inputs = buildInputs({
        purchasePrice: 500000,
        comparableTransactionValue: 800000,
        rarityScore: 70,
        provenanceScore: 75,
        authenticationScore: 8,
        buyerPoolDepth: 5,
        transactionCostsRate: 0.1
      });
      const result = engine.calculate('artCollectibles', inputs);
      expect(result.bookValue).toBeGreaterThanOrEqual(0);
      expect(result.marketValue).toBeGreaterThan(0);
      expect(result.fairValue).toBeGreaterThan(0);
    });

    it('calculates tourism asset values', () => {
      const inputs = buildInputs({
        purchasePrice: 5000000,
        improvementCosts: 800000,
        yearBuilt: 2015,
        dailyVisitors: 500,
        avgSpendPerVisitor: 250,
        occupancyRate: 0.7,
        seasonalityFactor: 0.8,
        staffCost: 1200000,
        maintenanceCost: 300000,
        utilitiesCost: 200000,
        marketingCost: 150000,
        capRate: 0.08,
        qualityMultiplier: 1,
        locationQualityScore: 8,
        comparableTransactionValue: 8000000
      });
      const result = engine.calculate('tourismAsset', inputs);
      expect(result.bookValue).toBeGreaterThanOrEqual(0);
      expect(result.marketValue).toBeGreaterThan(0);
      expect(result.fairValue).toBeGreaterThan(0);
      expect(result.operatingValue).toBeGreaterThan(0);
    });

    it('calculates personal wealth values', () => {
      const inputs = buildInputs({
        realEstateValue: 2000000,
        securitiesValue: 800000,
        cashValue: 300000,
        personalAssetsValue: 400000,
        vehicleValue: 200000,
        mortgageBalance: 600000,
        loansBalance: 200000,
        creditBalance: 30000,
        otherLiabilities: 50000,
        annualIncome: 600000,
        passiveIncome: 80000
      });
      const result = engine.calculate('personalWealth', inputs);
      expect(result.bookValue).toBeGreaterThan(0);
      expect(result.netWorth).toBeGreaterThan(0);
      expect(result.liquidityRatio).toBeGreaterThanOrEqual(0);
      expect(result.fairValue).toBeGreaterThan(0);
    });

    it('calculates scrap and salvage values', () => {
      const inputs = buildInputs({
        purchasePrice: 100000,
        weightKg: 10000,
        marketPricePerKg: 25,
        purityRate: 0.9,
        dismantlingCost: 30000,
        transportCost: 15000,
        storageCost: 5000,
        recoveryRate: 0.85,
        demandIndex: 6,
        supplyIndex: 5
      });
      const result = engine.calculate('scrapSalvage', inputs);
      expect(result.bookValue).toBeGreaterThanOrEqual(0);
      expect(result.recoverableValue).toBeGreaterThan(0);
      expect(result.marketValue).toBeGreaterThan(0);
      expect(result.fairValue).toBeGreaterThan(0);
    });
  });

  describe('Scoring', () => {
    it('returns eight scores for tourism, personalWealth and scrapSalvage', () => {
      ['tourismAsset', 'personalWealth', 'scrapSalvage'].forEach(cls => {
        const inputs = buildInputs({ assetClass: cls, dailyVisitors: 500, weightKg: 10000 });
        const scores = engine.calculateScores(inputs);
        expect(Object.keys(scores).length).toBe(8);
        Object.values(scores).forEach(v => {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(100);
        });
      });
    });

    it('returns eight scores for new classes', () => {
      const inputs = buildInputs({
        purchasePrice: 800000,
        replacementCostNew: 900000,
        comparableSalesValue: 700000,
        monthlyOperatingRevenue: 30000,
        usefulLifeYears: 15,
        yearAcquired: 2018,
        operatingHours: 8000,
        inspectionScore: 7,
        managementQuality: 7,
        governanceScore: 7,
        techMaturity: 6,
        workforceSkill: 7,
        brandStrength: 60,
        innovationPipeline: 0.3
      });
      const scores = engine.calculateScores({ assetClass: 'machineryEquipment', ...inputs });
      expect(Object.keys(scores).length).toBe(8);
      Object.values(scores).forEach(v => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      });
    });
  });

  describe('AI Decision Engine / Report', () => {
    it('generates report with SWOT and projections', () => {
      const inputs = buildInputs({
        assetClass: 'machineryEquipment',
        purchasePrice: 800000,
        replacementCostNew: 900000,
        comparableSalesValue: 700000,
        monthlyOperatingRevenue: 30000,
        usefulLifeYears: 15,
        yearAcquired: 2018,
        conditionScore: 8,
        brandStrength: 75,
        managementQuality: 8,
        workforceSkill: 8,
        innovationPipeline: 0.6
      });
      const valuations = engine.calculate('machineryEquipment', inputs);
      const scores = engine.calculateScores(inputs);
      const report = engine.generateReport({ valuations, scores, inputs }, 'en');
      expect(report).toContain('SWOT');
      expect(report).toContain('Projections');
      expect(report).toContain('Year 1');
      expect(report).toContain('Year 3');
      expect(report).toContain('Year 5');
      expect(report).toContain('Scenarios');
    });

    it('generates Arabic report', () => {
      const inputs = buildInputs({ assetClass: 'realEstate', purchasePrice: 2000000 });
      const valuations = engine.calculate('realEstate', inputs);
      const scores = engine.calculateScores(inputs);
      const report = engine.generateReport({ valuations, scores, inputs }, 'ar');
      expect(report).toContain('الملخص التنفيذي');
      expect(report).toContain('التوصية');
    });
  });

  describe('Goodwill Value', () => {
    it('returns explicit goodwillValue for business assets', () => {
      const inputs = buildInputs({
        equityBookValue: 2500000,
        intangibleAssetsBook: 400000,
        tangibleAssets: 2000000,
        identifiedIntangibles: 300000,
        totalLiabilities: 600000,
        totalDebt: 600000,
        cashAndEquiv: 300000,
        annualRevenue: 5000000,
        ebitdaMargin: 0.18,
        evRevenueMultiple: 1.2,
        evEbitdaMultiple: 7,
        discountRate: 0.12,
        taxRate: 0.2,
        marketGrowth: 0.05
      });
      const result = engine.calculate('business', inputs);
      expect(result.goodwillValue).toBeDefined();
      expect(result.goodwillValue).toBeGreaterThanOrEqual(0);
      expect(result.enterpriseValue).toBeDefined();
      expect(result.enterpriseValue).toBeGreaterThan(0);
    });

    it('sets goodwillImpairmentFlag when projected decline exceeds goodwill', () => {
      const inputs = buildInputs({
        equityBookValue: 1000000,
        intangibleAssetsBook: 200000,
        tangibleAssets: 800000,
        identifiedIntangibles: 100000,
        totalLiabilities: 300000,
        totalDebt: 300000,
        cashAndEquiv: 100000,
        annualRevenue: 2000000,
        ebitdaMargin: 0.15,
        evRevenueMultiple: 1,
        evEbitdaMultiple: 6,
        discountRate: 0.12,
        taxRate: 0.2,
        projectedDecline: 5000000
      });
      const result = engine.calculate('business', inputs);
      expect(result.goodwillImpairmentFlag).toBe(true);
    });

    it('does not flag impairment when projected decline is below goodwill', () => {
      const inputs = buildInputs({
        equityBookValue: 2500000,
        intangibleAssetsBook: 400000,
        tangibleAssets: 2000000,
        identifiedIntangibles: 300000,
        totalLiabilities: 600000,
        totalDebt: 600000,
        cashAndEquiv: 300000,
        annualRevenue: 5000000,
        ebitdaMargin: 0.18,
        evRevenueMultiple: 1.2,
        evEbitdaMultiple: 7,
        discountRate: 0.12,
        taxRate: 0.2,
        projectedDecline: 0
      });
      const result = engine.calculate('business', inputs);
      expect(result.goodwillImpairmentFlag).toBe(false);
    });
  });

  describe('AssetClass metadata', () => {
    it('has all 28 classes active', () => {
      const active = AssetClass.list().filter(s => AssetClass.isActive(s));
      const expected = [
        'realEstate', 'business', 'factory', 'machineryEquipment', 'vehiclesFleet',
        'agricultureFarms', 'livestock', 'naturalResourcesMining', 'oilGas', 'infrastructure',
        'intellectualProperty', 'brandsTrademarks', 'patents', 'copyrightsContent', 'franchises',
        'licensesPermits', 'financialAssets', 'cryptoDigital', 'commodities', 'artCollectibles',
        'jewelryPreciousMetals', 'softwareTechnology', 'medicalEquipment', 'educationalEquipment',
        'distressedAsset', 'tourismAsset', 'personalWealth', 'scrapSalvage'
      ];
      expected.forEach(cls => expect(active).toContain(cls));
      expect(active.length).toBe(28);
    });
  });
});
