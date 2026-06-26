/**
 * BONDS Depreciation Engine (BDE)
 *
 * Computes eight depreciation dimensions for any asset class:
 *   1. Accounting depreciation   (straight-line / declining-balance)
 *   2. Economic depreciation     (market-driven loss of value)
 *   3. Operational depreciation  (usage-based wear)
 *   4. Environmental depreciation (climate / exposure damage)
 *   5. Technical depreciation    (technology obsolescence)
 *   6. Functional depreciation   (mismatch to current needs)
 *   7. Maintenance depreciation  (neglect penalty)
 *   8. Misuse depreciation       (abuse / overload penalty)
 *
 * Outputs:
 *   - currentValue      (value after all depreciation)
 *   - futureValue       (projected value after N years)
 *   - replacementValue  (cost to replace with modern equivalent)
 */
(function () {
  'use strict';

  const CURRENT_YEAR = new Date().getFullYear();

  const clamp = (v, min, max) => Math.min(Math.max(Number(v) || 0, min), max);
  const safe = (v) => Number(v) || 0;
  const round2 = (v) => Math.round((Number(v) || 0) * 100) / 100;

  const DEFAULT_METHODS = {
    accounting: 'straight-line',
    economic: 'straight-line',
    operational: 'units-of-production',
    environmental: 'straight-line',
    technical: 'declining-balance',
    functional: 'straight-line',
    maintenance: 'straight-line',
    misuse: 'straight-line'
  };

  class DepreciationEngine {
    constructor(standards = null) {
      this.standards = standards;
      this.preloadedStandards = {};
    }

    /* ---------- Factors client helpers ---------- */
    _factorsClient() {
      return (typeof depreciationFactorsClient !== 'undefined' && depreciationFactorsClient) || null;
    }

    async preload(assetClass) {
      const client = this._factorsClient();
      if (!client) return;
      const std = await client.getStandard(assetClass);
      if (std) this.preloadedStandards[assetClass] = std;
    }

    /* ---------- Standard helpers ---------- */
    _standard(assetClass) {
      if (this.preloadedStandards[assetClass]) {
        return this.preloadedStandards[assetClass];
      }
      if (this.standards && this.standards.getStandard) {
        return this.standards.getStandard(assetClass) || {};
      }
      if (typeof BDS_STANDARDS !== 'undefined' && BDS_STANDARDS[assetClass]) {
        return BDS_STANDARDS[assetClass];
      }
      return {};
    }

    _factor(assetClass, key, fallback = 1) {
      const std = this._standard(assetClass);
      return safe(std.factors && std.factors[key]) || fallback;
    }

    _method(assetClass, type) {
      const std = this._standard(assetClass);
      return (std.methods && std.methods[type]) || DEFAULT_METHODS[type] || 'straight-line';
    }

    /* ---------- Depreciation formulas ---------- */
    _straightLine(cost, salvage, age, life) {
      if (life <= 0) return { accumulated: 0, rate: 0 };
      const depreciable = Math.max(0, cost - salvage);
      const annual = depreciable / life;
      const accumulated = Math.min(depreciable, annual * Math.max(0, age));
      return { accumulated: round2(accumulated), rate: round2(annual) };
    }

    _decliningBalance(cost, age, life, factor = 2) {
      if (life <= 0 || cost <= 0) return { accumulated: 0, rate: 0, remaining: cost };
      const rate = factor / life;
      let book = cost;
      for (let y = 0; y < Math.floor(age); y++) {
        book = Math.max(0, book * (1 - rate));
      }
      // partial year
      const fraction = age - Math.floor(age);
      if (fraction > 0) book = Math.max(0, book * (1 - rate * fraction));
      const accumulated = Math.max(0, cost - book);
      return { accumulated: round2(accumulated), rate: round2(rate * cost), remaining: round2(book) };
    }

    _sumOfYearsDigits(cost, salvage, age, life) {
      if (life <= 0) return { accumulated: 0, rate: 0 };
      const n = Math.ceil(life);
      const sum = (n * (n + 1)) / 2;
      const depreciable = Math.max(0, cost - salvage);
      const fullYears = Math.floor(age);
      const fraction = age - fullYears;
      let accumulated = 0;
      for (let y = 0; y < fullYears && y < n; y++) {
        accumulated += depreciable * ((n - y) / sum);
      }
      if (fullYears < n && fraction > 0) {
        accumulated += depreciable * ((n - fullYears) / sum) * fraction;
      }
      accumulated = Math.min(depreciable, accumulated);
      return { accumulated: round2(accumulated), rate: round2(depreciable * (n / sum)) };
    }

    _unitsOfProduction(cost, salvage, actualUnits, totalUnits) {
      if (totalUnits <= 0) return { accumulated: 0, rate: 0 };
      const depreciable = Math.max(0, cost - salvage);
      const accumulated = Math.min(depreciable, depreciable * (actualUnits / totalUnits));
      return { accumulated: round2(accumulated), rate: round2(depreciable / totalUnits) };
    }

    _applyMethod(type, cost, salvage, age, life, assetClass, inputs) {
      const method = this._method(assetClass, type);
      switch (method) {
        case 'declining-balance': {
          const factor = type === 'technical' ? 2.5 : 2;
          return this._decliningBalance(cost, age, life, factor);
        }
        case 'sum-of-years-digits':
          return this._sumOfYearsDigits(cost, salvage, age, life);
        case 'units-of-production': {
          const actual = safe(inputs.operatingHours) || safe(inputs.unitsProduced) || safe(inputs.kilometersDriven) || age;
          const capacity = safe(inputs.totalOperatingHours) || safe(inputs.totalUnitsCapacity) || safe(inputs.totalKilometersCapacity) || life;
          return this._unitsOfProduction(cost, salvage, actual, capacity);
        }
        case 'straight-line':
        default:
          return this._straightLine(cost, salvage, age, life);
      }
    }

    /* ---------- Inputs normalization ---------- */
    _normalizeInputs(assetClass, inputs, lifeData) {
      const i = { ...inputs };
      const year = safe(i.yearAcquired) || safe(i.yearBuilt) || safe(i.constructionYear) || CURRENT_YEAR;
      const age = safe(i.ageYears) || Math.max(0, CURRENT_YEAR - year);
      const economicLife = safe(i.usefulLifeYears) || safe(lifeData && lifeData.economic) || 15;
      const accountingLife = safe(i.accountingLifeYears) || safe(lifeData && lifeData.accounting) || economicLife;
      const technicalLife = safe(i.technicalLifeYears) || safe(lifeData && lifeData.technical) || economicLife;
      const operationalLife = safe(i.operationalLifeYears) || safe(lifeData && lifeData.operational) || economicLife;
      const designLife = safe(i.designLifeYears) || safe(lifeData && lifeData.design) || economicLife;
      const replacementCost = safe(i.replacementCost) || safe(i.currentReplacementCost) || safe(i.purchasePrice) || 0;
      const salvageValue = safe(i.salvageValue) || safe(i.scrapValue) || 0;
      const projectionYears = clamp(i.projectionYears, 0, 100) || 5;
      const inflationRate = clamp(i.inflationRate, -0.1, 0.5) || 0.03;

      return {
        age,
        economicLife,
        accountingLife,
        technicalLife,
        operationalLife,
        designLife,
        replacementCost,
        salvageValue,
        projectionYears,
        inflationRate,
        conditionScore: clamp(i.conditionScore, 1, 10) || 5,
        maintenanceLevel: clamp(i.maintenanceLevel, 1, 10) || 5,
        utilizationRate: clamp(i.utilizationRate, 0, 1) || 0.5,
        environmentalExposure: clamp(i.environmentalExposure, 0, 1),
        techObsolescenceRate: clamp(i.techObsolescenceRate, 0, 1),
        functionalObsolescence: clamp(i.functionalObsolescence, 0, 1),
        maintenanceNeglect: clamp(i.maintenanceNeglect, 0, 1),
        misuseFactor: clamp(i.misuseFactor, 0, 1),
        operatingHours: safe(i.operatingHours),
        totalOperatingHours: safe(i.totalOperatingHours),
        unitsProduced: safe(i.unitsProduced),
        totalUnitsCapacity: safe(i.totalUnitsCapacity),
        kilometersDriven: safe(i.kilometersDriven),
        totalKilometersCapacity: safe(i.totalKilometersCapacity)
      };
    }

    /* ---------- Core calculation ---------- */
    calculate(assetClass, inputs = {}, lifeData = null) {
      const i = this._normalizeInputs(assetClass, inputs, lifeData);
      const cost = i.replacementCost;
      const salvage = i.salvageValue;

      // 1. Accounting depreciation
      const accounting = this._applyMethod('accounting', cost, salvage, i.age, i.accountingLife, assetClass, inputs);

      // 2. Economic depreciation (market-driven, accelerates with poor conditions)
      const economicFactor = this._factor(assetClass, 'economic', 1);
      const economicAdjAge = i.age * economicFactor * (1 + (10 - i.conditionScore) * 0.05);
      const economic = this._applyMethod('economic', cost, salvage, economicAdjAge, i.economicLife, assetClass, inputs);

      // 3. Operational depreciation (usage / utilization)
      const operationalFactor = this._factor(assetClass, 'operational', 1);
      const operationalAdjAge = i.age * operationalFactor * (0.5 + 0.5 * i.utilizationRate);
      const operational = this._applyMethod('operational', cost, salvage, operationalAdjAge, i.operationalLife, assetClass, inputs);

      // 4. Environmental depreciation
      const environmentalFactor = this._factor(assetClass, 'environmental', 1);
      const environmentalAdjAge = i.age * environmentalFactor * (1 + i.environmentalExposure);
      const environmental = this._applyMethod('environmental', cost, 0, environmentalAdjAge, i.designLife, assetClass, inputs);

      // 5. Technical depreciation (obsolescence)
      const technicalFactor = this._factor(assetClass, 'technical', 1);
      const technicalAdjAge = i.age * technicalFactor * (1 + i.techObsolescenceRate * 2);
      const technical = this._applyMethod('technical', cost, salvage, technicalAdjAge, i.technicalLife, assetClass, inputs);

      // 6. Functional depreciation (mismatch to needs)
      const functionalFactor = this._factor(assetClass, 'functional', 1);
      const functionalDep = cost * i.functionalObsolescence * functionalFactor;
      const functional = { accumulated: round2(Math.min(cost, functionalDep)), rate: round2(functionalDep / Math.max(1, i.economicLife)) };

      // 7. Maintenance depreciation (neglect penalty)
      const maintenanceFactor = this._factor(assetClass, 'maintenance', 1);
      const neglectPenalty = (1 - i.maintenanceLevel / 10) * i.maintenanceNeglect * maintenanceFactor;
      const maintenanceDep = cost * neglectPenalty;
      const maintenance = { accumulated: round2(Math.min(cost, maintenanceDep)), rate: round2(maintenanceDep / Math.max(1, i.economicLife)) };

      // 8. Misuse depreciation (abuse / overload)
      const misuseFactor = this._factor(assetClass, 'misuse', 1);
      const misuseDep = cost * i.misuseFactor * misuseFactor;
      const misuse = { accumulated: round2(Math.min(cost, misuseDep)), rate: round2(misuseDep / Math.max(1, i.economicLife)) };

      // Combine depreciation dimensions multiplicatively so survival never goes below 0.
      // Each dimension produces an accumulated loss as if it acted alone; we convert
      // those losses to survival factors and multiply them.
      const depreciableBase = Math.max(1, cost - salvage);
      const ratios = [
        accounting.accumulated / depreciableBase,
        economic.accumulated / depreciableBase,
        operational.accumulated / depreciableBase,
        environmental.accumulated / depreciableBase,
        technical.accumulated / depreciableBase,
        functional.accumulated / depreciableBase,
        maintenance.accumulated / depreciableBase,
        misuse.accumulated / depreciableBase
      ].map(r => Math.min(1, Math.max(0, r)));

      const survivalFactor = ratios.reduce((acc, r) => acc * (1 - r), 1);
      const totalAccumulated = depreciableBase * (1 - survivalFactor);
      const currentValue = Math.max(salvage, cost - totalAccumulated);

      // Future value projection
      const remainingLife = Math.max(0, i.economicLife - i.age);
      const annualDecline = remainingLife > 0 ? (currentValue - salvage) / remainingLife : 0;
      const projectedYears = Math.min(i.projectionYears, remainingLife);
      const futureValueNoInflation = Math.max(salvage, currentValue - annualDecline * projectedYears);
      const futureValue = futureValueNoInflation * Math.pow(1 + i.inflationRate, i.projectionYears);

      // Replacement value (modern equivalent, inflated)
      const replacementValue = cost * Math.pow(1 + i.inflationRate, i.age);

      return {
        assetClass,
        age: round2(i.age),
        accountingDepreciation: accounting.accumulated,
        economicDepreciation: economic.accumulated,
        operationalDepreciation: operational.accumulated,
        environmentalDepreciation: environmental.accumulated,
        technicalDepreciation: technical.accumulated,
        functionalDepreciation: functional.accumulated,
        maintenanceDepreciation: maintenance.accumulated,
        misuseDepreciation: misuse.accumulated,
        totalDepreciation: round2(totalAccumulated),
        currentValue: round2(currentValue),
        futureValue: round2(futureValue),
        replacementValue: round2(replacementValue),
        salvageValue: round2(salvage),
        projectionYears: i.projectionYears,
        inflationRate: round2(i.inflationRate),
        depreciationRates: {
          accounting: accounting.rate,
          economic: economic.rate,
          operational: operational.rate,
          environmental: environmental.rate,
          technical: technical.rate,
          functional: functional.rate,
          maintenance: maintenance.rate,
          misuse: misuse.rate
        }
      };
    }
  }

  // Expose
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DepreciationEngine };
  }
  if (typeof window !== 'undefined') {
    window.DepreciationEngine = DepreciationEngine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.DepreciationEngine = DepreciationEngine;
  }
})();
