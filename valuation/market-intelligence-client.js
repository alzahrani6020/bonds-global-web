/**
 * Market Intelligence Client
 *
 * Loads market data from the central database via /api/market-intelligence.
 * Falls back to sensible defaults if the API is unavailable.
 */
(function () {
  'use strict';

  const DEFAULT_MARKET_DATA = {
    averageSellingPrice: 0,
    averageBuyingPrice: 0,
    transactionCount: 0,
    supplyIndex: 5,
    demandIndex: 5,
    competitorCount: 0,
    averageSaleSpeedDays: 90,
    inflationRate: 0.03,
    interestRate: 0.06,
    economicGrowthRate: 0.03
  };

  class MarketIntelligenceClient {
    constructor() {
      this.cache = null;
      this.lastFetch = 0;
      this.ttlMs = 5 * 60 * 1000; // 5 minutes
    }

    _normalizeRecord(row) {
      return {
        assetClass: row.asset_class,
        country: row.country,
        city: row.city,
        averageSellingPrice: Number(row.average_selling_price) || 0,
        averageBuyingPrice: Number(row.average_buying_price) || 0,
        transactionCount: Number(row.transaction_count) || 0,
        supplyIndex: Number(row.supply_index) || 5,
        demandIndex: Number(row.demand_index) || 5,
        competitorCount: Number(row.competitor_count) || 0,
        averageSaleSpeedDays: Number(row.average_sale_speed_days) || 90,
        inflationRate: Number(row.inflation_rate) || 0.03,
        interestRate: Number(row.interest_rate) || 0.06,
        economicGrowthRate: Number(row.economic_growth_rate) || 0.03,
        source: row.source,
        recordedAt: row.recorded_at,
        updatedAt: row.updated_at
      };
    }

    _defaultData(assetClass) {
      return { ...DEFAULT_MARKET_DATA, assetClass };
    }

    async fetchAll(force = false) {
      const now = Date.now();
      if (!force && this.cache && (now - this.lastFetch) < this.ttlMs) {
        return this.cache;
      }

      try {
        const res = await fetch('/api/market-intelligence');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Fetch failed');
        const records = (json.data || []).map(r => this._normalizeRecord(r));
        this.cache = records;
        this.lastFetch = now;
        return records;
      } catch (err) {
        return [];
      }
    }

    async getData(assetClass, country = null, city = null, force = false) {
      const all = await this.fetchAll(force);
      const exact = all.find(r =>
        r.assetClass === assetClass &&
        r.country === country &&
        r.city === city
      );
      if (exact) return exact;

      const countryOnly = all.find(r =>
        r.assetClass === assetClass &&
        r.country === country &&
        !r.city
      );
      if (countryOnly) return countryOnly;

      const global = all.find(r =>
        r.assetClass === assetClass &&
        !r.country &&
        !r.city
      );
      if (global) return global;

      return this._defaultData(assetClass);
    }

    clearCache() {
      this.cache = null;
      this.lastFetch = 0;
    }
  }

  const marketIntelligenceClient = new MarketIntelligenceClient();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { MarketIntelligenceClient };
  }
  if (typeof window !== 'undefined') {
    window.MarketIntelligenceClient = MarketIntelligenceClient;
    window.marketIntelligenceClient = marketIntelligenceClient;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.MarketIntelligenceClient = MarketIntelligenceClient;
    globalThis.marketIntelligenceClient = marketIntelligenceClient;
  }
})();
