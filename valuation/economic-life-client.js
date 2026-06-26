/**
 * Economic Life Database — Frontend Client
 *
 * Loads asset life data from the central Economic Life Database.
 * Falls back to embedded defaults if the API is unavailable.
 */
(function () {
  'use strict';

  const DEFAULT_LIVES = {
    realEstate: { economic: 50, accounting: 50, technical: 60, design: 60, operational: 50 },
    business: { economic: 10, accounting: 10, technical: 12, design: 15, operational: 10 },
    factory: { economic: 25, accounting: 20, technical: 30, design: 35, operational: 25 },
    machineryEquipment: { economic: 15, accounting: 10, technical: 18, design: 20, operational: 15 },
    vehiclesFleet: { economic: 10, accounting: 5, technical: 12, design: 15, operational: 10 },
    agricultureFarms: { economic: 20, accounting: 15, technical: 25, design: 30, operational: 20 },
    livestock: { economic: 5, accounting: 3, technical: 8, design: 10, operational: 5 },
    naturalResourcesMining: { economic: 20, accounting: 15, technical: 25, design: 30, operational: 20 },
    oilGas: { economic: 20, accounting: 15, technical: 25, design: 30, operational: 20 },
    infrastructure: { economic: 40, accounting: 30, technical: 50, design: 60, operational: 40 },
    intellectualProperty: { economic: 10, accounting: 10, technical: 12, design: 15, operational: 10 },
    brandsTrademarks: { economic: 15, accounting: 10, technical: 18, design: 20, operational: 15 },
    patents: { economic: 12, accounting: 10, technical: 15, design: 20, operational: 12 },
    copyrightsContent: { economic: 10, accounting: 10, technical: 12, design: 15, operational: 10 },
    franchises: { economic: 10, accounting: 10, technical: 12, design: 15, operational: 10 },
    licensesPermits: { economic: 8, accounting: 5, technical: 10, design: 15, operational: 8 },
    financialAssets: { economic: 5, accounting: 5, technical: 5, design: 5, operational: 5 },
    cryptoDigital: { economic: 5, accounting: 5, technical: 5, design: 5, operational: 5 },
    commodities: { economic: 1, accounting: 1, technical: 1, design: 1, operational: 1 },
    artCollectibles: { economic: 30, accounting: 30, technical: 50, design: 100, operational: 30 },
    jewelryPreciousMetals: { economic: 30, accounting: 30, technical: 50, design: 100, operational: 30 },
    softwareTechnology: { economic: 7, accounting: 5, technical: 8, design: 10, operational: 7 },
    medicalEquipment: { economic: 10, accounting: 7, technical: 12, design: 15, operational: 10 },
    educationalEquipment: { economic: 10, accounting: 7, technical: 12, design: 15, operational: 10 },
    distressedAsset: { economic: 5, accounting: 3, technical: 8, design: 10, operational: 5 },
    tourismAsset: { economic: 30, accounting: 25, technical: 35, design: 40, operational: 30 },
    personalWealth: { economic: 10, accounting: 10, technical: 12, design: 15, operational: 10 },
    scrapSalvage: { economic: 1, accounting: 1, technical: 1, design: 1, operational: 1 },
    maritimeAsset: { economic: 25, accounting: 20, technical: 30, design: 35, operational: 25 },
    logisticsAsset: { economic: 20, accounting: 15, technical: 25, design: 30, operational: 20 },
    fuelStation: { economic: 20, accounting: 15, technical: 25, design: 30, operational: 20 },
    beautyWellness: { economic: 7, accounting: 5, technical: 10, design: 12, operational: 7 },
    giftsStationery: { economic: 7, accounting: 5, technical: 10, design: 12, operational: 7 },
    furnitureAsset: { economic: 10, accounting: 7, technical: 12, design: 15, operational: 10 },
    retailBusiness: { economic: 7, accounting: 5, technical: 10, design: 12, operational: 7 }
  };

  class EconomicLifeClient {
    constructor() {
      this.cache = null;
      this.lastFetch = 0;
      this.ttlMs = 5 * 60 * 1000; // 5 minutes
    }

    _normalizeRecord(row) {
      return {
        assetClass: row.asset_class,
        nameAr: row.name_ar,
        nameEn: row.name_en,
        economic: Number(row.economic_life_years) || 0,
        accounting: Number(row.accounting_life_years) || 0,
        technical: Number(row.technical_life_years) || 0,
        design: Number(row.design_life_years) || 0,
        operational: Number(row.operational_life_years) || 0,
        min: Number(row.min_life_years) || 0,
        max: Number(row.max_life_years) || 0,
        source: row.source,
        notes: row.notes,
        updatedAt: row.updated_at
      };
    }

    async fetchAll(force = false) {
      const now = Date.now();
      if (!force && this.cache && (now - this.lastFetch) < this.ttlMs) {
        return this.cache;
      }

      try {
        const res = await fetch('/api/economic-life');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success || !Array.isArray(json.data)) throw new Error('Invalid response');
        const map = {};
        json.data.forEach(row => {
          map[row.asset_class] = this._normalizeRecord(row);
        });
        this.cache = map;
        this.lastFetch = now;
        return map;
      } catch (err) {
        // Fallback to defaults on any error
        this.cache = { ...DEFAULT_LIVES };
        this.lastFetch = now;
        return this.cache;
      }
    }

    async get(assetClass, force = false) {
      const all = await this.fetchAll(force);
      return all[assetClass] || DEFAULT_LIVES[assetClass] || DEFAULT_LIVES.realEstate;
    }

    getSync(assetClass) {
      if (this.cache && this.cache[assetClass]) return this.cache[assetClass];
      return DEFAULT_LIVES[assetClass] || DEFAULT_LIVES.realEstate;
    }

    // Compute remaining life dynamically based on acquisition/build year
    computeRemainingLife(assetClass, yearAcquiredOrBuilt, currentYear = new Date().getFullYear()) {
      const lives = this.getSync(assetClass);
      const age = Math.max(0, currentYear - (Number(yearAcquiredOrBuilt) || currentYear));
      const remaining = {
        economic: Math.max(0, lives.economic - age),
        accounting: Math.max(0, lives.accounting - age),
        technical: Math.max(0, lives.technical - age),
        design: Math.max(0, lives.design - age),
        operational: Math.max(0, lives.operational - age)
      };
      return { ...lives, age, remaining };
    }

    clearCache() {
      this.cache = null;
      this.lastFetch = 0;
    }
  }

  const economicLifeClient = new EconomicLifeClient();

  if (typeof window !== 'undefined') {
    window.EconomicLifeClient = EconomicLifeClient;
    window.economicLifeClient = economicLifeClient;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.EconomicLifeClient = EconomicLifeClient;
    globalThis.economicLifeClient = economicLifeClient;
  }
})();
