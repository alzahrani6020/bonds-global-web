/**
 * Depreciation Factors Client
 *
 * Loads asset-class-specific depreciation factors and methods from the central
 * database via /api/depreciation-factors. Falls back to BDS_STANDARDS if the
 * API is unavailable.
 */
(function () {
  'use strict';

  class DepreciationFactorsClient {
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
        factors: typeof row.factors === 'string' ? JSON.parse(row.factors) : (row.factors || {}),
        methods: typeof row.methods === 'string' ? JSON.parse(row.methods) : (row.methods || {}),
        notes: row.notes,
        updatedAt: row.updated_at
      };
    }

    _fallbackStandard(assetClass) {
      if (typeof BDS_STANDARDS !== 'undefined' && BDS_STANDARDS[assetClass]) {
        const std = BDS_STANDARDS[assetClass];
        return {
          assetClass,
          nameAr: std.notes && std.notes.ar,
          nameEn: std.notes && std.notes.en,
          factors: std.factors || {},
          methods: std.methods || {},
          notes: std.notes && std.notes.en,
          updatedAt: null
        };
      }
      return null;
    }

    async fetchAll(force = false) {
      const now = Date.now();
      if (!force && this.cache && (now - this.lastFetch) < this.ttlMs) {
        return this.cache;
      }

      try {
        const res = await fetch('/api/depreciation-factors');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Fetch failed');
        const records = (json.data || []).map(r => this._normalizeRecord(r));
        this.cache = records;
        this.lastFetch = now;
        return records;
      } catch (err) {
        // Fallback to embedded BDS_STANDARDS
        if (typeof BDS_STANDARDS !== 'undefined') {
          this.cache = Object.keys(BDS_STANDARDS).map(k => this._fallbackStandard(k));
          this.lastFetch = now;
          return this.cache;
        }
        return [];
      }
    }

    async getStandard(assetClass, force = false) {
      const all = await this.fetchAll(force);
      return all.find(r => r.assetClass === assetClass) || this._fallbackStandard(assetClass);
    }

    clearCache() {
      this.cache = null;
      this.lastFetch = 0;
    }
  }

  const depreciationFactorsClient = new DepreciationFactorsClient();

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { DepreciationFactorsClient };
  }
  if (typeof window !== 'undefined') {
    window.DepreciationFactorsClient = DepreciationFactorsClient;
    window.depreciationFactorsClient = depreciationFactorsClient;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.DepreciationFactorsClient = DepreciationFactorsClient;
    globalThis.depreciationFactorsClient = depreciationFactorsClient;
  }
})();
