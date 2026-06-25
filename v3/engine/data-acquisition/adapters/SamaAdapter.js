/**
 * SamaAdapter — محول البنك المركزي السعودي.
 * يجلب بيانات حقيقية من بوابة KAPSARC Open Data التي تعيد نشر بيانات SAMA
 * عبر API موثق (Opendatasoft v2.1).
 *
 * Datasets المستخدمة:
 * - inflation-rate: مؤشر التضخم الشهري
 * - growth-rates-of-gross-domestic-product-by-kind-of-economic-activity-at-2010-con0: معدلات النمو
 */
const BaseAdapter = require('../BaseAdapter');

class SamaAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      sourceId: 'sama',
      sourceName: 'البنك المركزي السعودي (عبر KAPSARC)',
      ...config
    });
    this.apiBaseUrl = config.apiBaseUrl || 'https://datasource.kapsarc.org/api/explore/v2.1';
    this.useFallback = config.useFallback !== false;
    this.tryRealApi = config.tryRealApi !== false; // true by default now
  }

  supportedMetrics() {
    return ['growth_rate', 'inflation_rate', 'business_ease_index'];
  }

  async fetch(options = {}) {
    const { cityCode, year = new Date().getFullYear(), purchasingPowerIndex } = options;
    let quality = 'fallback';
    const metrics = {};
    const metricQuality = {};

    if (this.tryRealApi) {
      try {
        const [inflation, growth] = await Promise.allSettled([
          this._fetchInflation(year),
          this._fetchGrowthRate(year)
        ]);

        if (inflation.status === 'fulfilled' && inflation.value != null && inflation.value.dataYear === year) {
          metrics.inflation_rate = inflation.value.value;
          metricQuality.inflation_rate = 'open_data';
          quality = 'open_data';
        }
        if (growth.status === 'fulfilled' && growth.value != null && growth.value.dataYear === year) {
          metrics.growth_rate = growth.value.value;
          metricQuality.growth_rate = 'open_data';
          quality = 'open_data';
        }
      } catch (err) {
        // Keep fallback on error
      }
    }

    // Merge with fallback for missing metrics
    const fallback = this._fallbackData(cityCode, year, quality, purchasingPowerIndex)[0];
    for (const key of Object.keys(fallback.metrics)) {
      if (metrics[key] == null) {
        metrics[key] = fallback.metrics[key];
        metricQuality[key] = 'fallback';
      }
    }

    // Overall quality reflects how many metrics came from real open data
    const openDataCount = Object.values(metricQuality).filter(q => q === 'open_data').length;
    quality = openDataCount >= 2 ? 'open_data' : (openDataCount > 0 ? 'mixed' : 'fallback');

    return [{
      cityCode: cityCode ? cityCode.toUpperCase() : 'UNK',
      year,
      metrics,
      metricQuality,
      externalId: `sama-${cityCode || 'UNK'}-${year}`,
      source: this.config.sourceId,
      quality
    }];
  }

  async validate(rawItem) {
    const errors = [];
    if (!rawItem.year) errors.push('year is required');
    if (!rawItem.metrics || typeof rawItem.metrics !== 'object') {
      errors.push('metrics object is required');
    }
    return { valid: errors.length === 0, errors };
  }

  async transform(rawItem) {
    const { cityCode, year, metrics, metricQuality = {} } = rawItem;
    const result = [];

    const mappings = {
      growth_rate: { code: 'growth_rate', quality: 'official' },
      inflation_rate: { code: 'inflation_rate', quality: 'official' },
      business_ease_index: { code: 'business_ease_index', quality: 'estimated' }
    };

    for (const [key, value] of Object.entries(metrics)) {
      const mapping = mappings[key];
      if (!mapping) continue;

      const sourceQuality = metricQuality[key] || rawItem.quality || mapping.quality;
      result.push({
        metricCode: mapping.code,
        value: typeof value === 'number' ? value : parseFloat(value),
        valueText: null,
        year,
        sourceUrl: 'https://datasource.kapsarc.org',
        confidence: this.getConfidence(mapping.code, sourceQuality),
        confidenceReason: `Source: ${this.config.sourceName} (${sourceQuality})`,
        metadata: { cityCode, originalKey: key, dataQuality: sourceQuality }
      });
    }

    return result;
  }

  // ── Real data fetchers ────────────────────────────────────

  async _fetchInflation(year) {
    const url = `${this.apiBaseUrl}/catalog/datasets/inflation-rate/records?` +
      `where=${encodeURIComponent(`date >= '${year}-01-01' and date <= '${year}-12-31' and indicator like 'Inflation Rate %'`)}` +
      `&order_by=date%20desc&limit=1`;
    const data = await this._getJson(url);
    if (data?.results?.[0]?.inflation_rate_ == null) return null;

    const date = data.results[0].date || '';
    const dataYear = parseInt(date.split('-')[0], 10) || null;
    return { value: parseFloat(data.results[0].inflation_rate_), dataYear };
  }

  async _fetchGrowthRate(year) {
    // The KAPSARC dataset only has sector-level growth rates (no total GDP row).
    // We average the latest sector growth rates as a proxy for overall activity.
    const url = `${this.apiBaseUrl}/catalog/datasets/growth-rates-of-gross-domestic-product-by-kind-of-economic-activity-at-2010-con0/records?` +
      `where=${encodeURIComponent(`date >= '${year}-01-01' and date <= '${year}-12-31'`)}` +
      `&limit=100`;
    const data = await this._getJson(url);
    if (!data?.results?.length) return null;

    const values = data.results
      .map(r => parseFloat(r.growth_rate_on_gdp))
      .filter(v => !isNaN(v));
    if (!values.length) return null;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const date = data.results[0].date || '';
    const dataYear = parseInt(date.split('-')[0], 10) || null;
    return { value: parseFloat(avg.toFixed(2)), dataYear };
  }

  async _getJson(url) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs || 15000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BondsGlobal-DataAdapter/1.0'
        }
      });
      clearTimeout(timeout);
      if (!response.ok) return null;
      return await response.json();
    } catch (err) {
      clearTimeout(timeout);
      return null;
    }
  }

  _fallbackData(cityCode, year, quality = 'fallback', purchasingPowerIndex = 100) {
    const code = cityCode ? cityCode.toUpperCase() : 'UNK';
    const ppi = Number(purchasingPowerIndex) || 100;
    const adjustment = 0.85 + (ppi / 100) * 0.15;

    return [{
      cityCode: code,
      year,
      metrics: {
        growth_rate: parseFloat((3.0 * adjustment).toFixed(2)),
        inflation_rate: 2.4,
        business_ease_index: parseFloat((72 * adjustment).toFixed(1))
      },
      externalId: `sama-${code}-${year}`,
      source: this.config.sourceId,
      quality
    }];
  }
}

module.exports = SamaAdapter;
