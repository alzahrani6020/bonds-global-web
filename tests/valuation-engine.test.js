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
  });

  describe('Scoring', () => {
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

  describe('AssetClass metadata', () => {
    it('has 7 active classes plus existing 3', () => {
      const active = AssetClass.list().filter(s => AssetClass.isActive(s));
      expect(active).toContain('realEstate');
      expect(active).toContain('business');
      expect(active).toContain('factory');
      expect(active).toContain('machineryEquipment');
      expect(active).toContain('vehiclesFleet');
      expect(active).toContain('medicalEquipment');
      expect(active).toContain('educationalEquipment');
      expect(active).toContain('jewelryPreciousMetals');
      expect(active).toContain('commodities');
      expect(active).toContain('distressedAsset');
      expect(active.length).toBe(10);
    });
  });
});
