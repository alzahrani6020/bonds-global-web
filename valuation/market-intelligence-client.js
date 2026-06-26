/**
 * Market Intelligence Client
 *
 * Loads market data from the central database via /api/market-intelligence.
 * Supports country/region/city/sector fallbacks and historical snapshots.
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
    economicGrowthRate: 0.03,
    riskScore: 5,
    outlook: 'neutral',
    confidence: 0.5,
    dataQualityScore: 50,
    notes: ''
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
        country: row.country || '',
        region: row.region || '',
        city: row.city || '',
        sector: row.sector || '',
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
        riskScore: Number(row.risk_score) || 5,
        outlook: row.outlook || 'neutral',
        confidence: Number(row.confidence) || 0.5,
        dataQualityScore: Number(row.data_quality_score) || 50,
        notes: row.notes || '',
        source: row.source,
        recordedAt: row.recorded_at,
        updatedAt: row.updated_at
      };
    }

    _defaultData(assetClass) {
      return { ...DEFAULT_MARKET_DATA, assetClass };
    }

    _scoreMatch(row, dims) {
      let score = 0;
      if (row.country && row.country === dims.country) score += 8;
      if (row.region && row.region === dims.region) score += 4;
      if (row.city && row.city === dims.city) score += 2;
      if (row.sector && row.sector === dims.sector) score += 1;
      return score;
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

    async getData(assetClass, country = '', region = '', city = '', sector = '') {
      const all = await this.fetchAll();
      const dims = { country: country || '', region: region || '', city: city || '', sector: sector || '' };
      const candidates = all.filter(r => r.assetClass === assetClass);
      if (!candidates.length) return this._defaultData(assetClass);

      candidates.sort((a, b) => this._scoreMatch(b, dims) - this._scoreMatch(a, dims));
      const best = candidates[0];
      return this._scoreMatch(best, dims) > 0 ? best : this._defaultData(assetClass);
    }

    async fetchHistory(assetClass, { country = '', region = '', city = '', sector = '', limit = 30 } = {}) {
      try {
        const params = new URLSearchParams({ history: '1', assetClass, limit: String(limit) });
        if (country) params.set('country', country);
        if (region) params.set('region', region);
        if (city) params.set('city', city);
        if (sector) params.set('sector', sector);
        const res = await fetch(`/api/market-intelligence?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Fetch failed');
        return (json.data || []).map(r => this._normalizeRecord(r));
      } catch (err) {
        return [];
      }
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
