/**
 * Tests for BONDS Depreciation Engine
 */
const fs = require('fs');
const path = require('path');

const standardsCode = fs.readFileSync(path.join(__dirname, '../valuation/depreciation-standards.js'), 'utf8');
const engineCode = fs.readFileSync(path.join(__dirname, '../valuation/depreciation-engine.js'), 'utf8');
eval(standardsCode);
eval(engineCode);

describe('DepreciationEngine', () => {
  const standards = new DepreciationStandards();
  const engine = new DepreciationEngine(standards);

  describe('Core depreciation outputs', () => {
    it('returns all 8 depreciation types', () => {
      const result = engine.calculate('machineryEquipment', {
        purchasePrice: 1000000,
        yearAcquired: 2018,
        usefulLifeYears: 15,
        salvageValue: 100000
      });

      expect(result.accountingDepreciation).toBeGreaterThanOrEqual(0);
      expect(result.economicDepreciation).toBeGreaterThanOrEqual(0);
      expect(result.operationalDepreciation).toBeGreaterThanOrEqual(0);
      expect(result.environmentalDepreciation).toBeGreaterThanOrEqual(0);
      expect(result.technicalDepreciation).toBeGreaterThanOrEqual(0);
      expect(result.functionalDepreciation).toBeGreaterThanOrEqual(0);
      expect(result.maintenanceDepreciation).toBeGreaterThanOrEqual(0);
      expect(result.misuseDepreciation).toBeGreaterThanOrEqual(0);
    });

    it('returns current, future and replacement values', () => {
      const result = engine.calculate('realEstate', {
        purchasePrice: 2000000,
        yearBuilt: 2010,
        usefulLifeYears: 50,
        salvageValue: 200000,
        projectionYears: 10,
        inflationRate: 0.03
      });

      expect(result.currentValue).toBeGreaterThan(0);
      expect(result.futureValue).toBeGreaterThan(0);
      expect(result.replacementValue).toBeGreaterThan(result.purchasePrice || 0);
      expect(result.totalDepreciation).toBeGreaterThanOrEqual(0);
    });

    it('caps total depreciation at cost minus salvage', () => {
      const result = engine.calculate('vehiclesFleet', {
        purchasePrice: 500000,
        yearAcquired: 2000,
        usefulLifeYears: 10,
        salvageValue: 50000,
        misuseFactor: 1,
        maintenanceNeglect: 1,
        functionalObsolescence: 1
      });

      const cost = 500000;
      const salvage = 50000;
      expect(result.totalDepreciation).toBeLessThanOrEqual(cost - salvage);
      expect(result.currentValue).toBeGreaterThanOrEqual(salvage);
    });

    it('uses straight-line accounting depreciation by default', () => {
      const result = engine.calculate('factory', {
        purchasePrice: 1000000,
        yearAcquired: 2020,
        usefulLifeYears: 20,
        salvageValue: 100000
      });

      const age = new Date().getFullYear() - 2020;
      const expectedAnnual = (1000000 - 100000) / 20;
      expect(result.accountingDepreciation).toBeCloseTo(Math.min(expectedAnnual * age, 900000), 0);
    });
  });

  describe('Asset class standards coverage', () => {
    const assetClasses = new DepreciationStandards().list();

    it('covers all 35 valuation asset classes', () => {
      const engineClasses = [
        'realEstate', 'business', 'factory', 'machineryEquipment', 'vehiclesFleet',
        'agricultureFarms', 'livestock', 'naturalResourcesMining', 'oilGas', 'infrastructure',
        'intellectualProperty', 'brandsTrademarks', 'patents', 'copyrightsContent', 'franchises',
        'licensesPermits', 'financialAssets', 'cryptoDigital', 'commodities', 'artCollectibles',
        'jewelryPreciousMetals', 'softwareTechnology', 'medicalEquipment', 'educationalEquipment',
        'distressedAsset', 'tourismAsset', 'personalWealth', 'scrapSalvage', 'maritimeAsset',
        'logisticsAsset', 'fuelStation', 'beautyWellness', 'giftsStationery', 'furnitureAsset',
        'retailBusiness'
      ];

      assetClasses.forEach(cls => {
        expect(engineClasses).toContain(cls);
      });
    });

    it('calculates depreciation for every active asset class', () => {
      assetClasses.forEach(cls => {
        const result = engine.calculate(cls, {
          purchasePrice: 1000000,
          yearAcquired: 2019,
          usefulLifeYears: 15,
          salvageValue: 50000
        });

        expect(result.totalDepreciation).toBeGreaterThanOrEqual(0);
        expect(result.currentValue).toBeGreaterThanOrEqual(0);
        expect(result.futureValue).toBeGreaterThanOrEqual(0);
        expect(result.replacementValue).toBeGreaterThan(0);
      });
    });
  });

  describe('Operational depreciation', () => {
    it('increases with higher utilization', () => {
      const low = engine.calculate('machineryEquipment', {
        purchasePrice: 1000000,
        yearAcquired: 2020,
        usefulLifeYears: 15,
        utilizationRate: 0.2
      });

      const high = engine.calculate('machineryEquipment', {
        purchasePrice: 1000000,
        yearAcquired: 2020,
        usefulLifeYears: 15,
        utilizationRate: 0.9
      });

      expect(high.operationalDepreciation).toBeGreaterThan(low.operationalDepreciation);
    });
  });

  describe('Maintenance and misuse penalties', () => {
    it('increases depreciation with neglect and misuse', () => {
      const clean = engine.calculate('vehiclesFleet', {
        purchasePrice: 500000,
        yearAcquired: 2025,
        usefulLifeYears: 10,
        salvageValue: 50000,
        maintenanceLevel: 9,
        maintenanceNeglect: 0,
        misuseFactor: 0
      });

      const abused = engine.calculate('vehiclesFleet', {
        purchasePrice: 500000,
        yearAcquired: 2025,
        usefulLifeYears: 10,
        salvageValue: 50000,
        maintenanceLevel: 3,
        maintenanceNeglect: 1,
        misuseFactor: 1
      });

      expect(abused.maintenanceDepreciation).toBeGreaterThan(clean.maintenanceDepreciation);
      expect(abused.misuseDepreciation).toBeGreaterThan(clean.misuseDepreciation);
      expect(abused.currentValue).toBeLessThan(clean.currentValue);
    });
  });

  describe('Functional and technical obsolescence', () => {
    it('reduces value when obsolescence is high', () => {
      const modern = engine.calculate('machineryEquipment', {
        purchasePrice: 1000000,
        yearAcquired: 2025,
        usefulLifeYears: 15,
        salvageValue: 100000,
        techObsolescenceRate: 0,
        functionalObsolescence: 0
      });

      const obsolete = engine.calculate('machineryEquipment', {
        purchasePrice: 1000000,
        yearAcquired: 2025,
        usefulLifeYears: 15,
        salvageValue: 100000,
        techObsolescenceRate: 1,
        functionalObsolescence: 1
      });

      expect(modern.currentValue).toBeGreaterThan(0);
      expect(obsolete.technicalDepreciation).toBeGreaterThan(modern.technicalDepreciation);
      expect(obsolete.functionalDepreciation).toBeGreaterThan(modern.functionalDepreciation);
      expect(obsolete.currentValue).toBeLessThan(modern.currentValue);
    });
  });

  describe('Environmental depreciation', () => {
    it('increases with environmental exposure', () => {
      const sheltered = engine.calculate('maritimeAsset', {
        purchasePrice: 2000000,
        yearBuilt: 2020,
        usefulLifeYears: 25,
        environmentalExposure: 0
      });

      const exposed = engine.calculate('maritimeAsset', {
        purchasePrice: 2000000,
        yearBuilt: 2020,
        usefulLifeYears: 25,
        environmentalExposure: 1
      });

      expect(exposed.environmentalDepreciation).toBeGreaterThan(sheltered.environmentalDepreciation);
    });
  });

  describe('DepreciationStandards', () => {
    it('returns standard for known asset class', () => {
      expect(standards.hasStandard('realEstate')).toBe(true);
      expect(standards.getStandard('realEstate').factors.economic).toBe(1.0);
    });

    it('returns null for unknown asset class', () => {
      expect(standards.hasStandard('unknown')).toBe(false);
      expect(standards.getStandard('unknown')).toBeNull();
    });
  });

  describe('No standards fallback', () => {
    it('works without standards provider', () => {
      const bareEngine = new DepreciationEngine();
      const result = bareEngine.calculate('factory', {
        purchasePrice: 1000000,
        yearAcquired: 2020,
        usefulLifeYears: 20,
        salvageValue: 100000
      });

      expect(result.currentValue).toBeGreaterThan(0);
      expect(result.totalDepreciation).toBeGreaterThanOrEqual(0);
    });
  });
});
