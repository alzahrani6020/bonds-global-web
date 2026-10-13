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
    this.useFallback = config.useFallback === true;
    this.tryRealApi = config.tryRealApi !== false; // true by default now
  }

  supportedMetrics() {
    return ['growth_rate', 'inflation_rate', 'business_ease_index'];
  }

  async fetch(options = {}) {
    const { cityCode, purchasingPowerIndex } = options;
    const latestRequested = options.year == null || options.year === 'latest' || !Number.isFinite(Number(options.year));
    const year = latestRequested ? null : Number(options.year);
    let quality = 'unknown';
    const metrics = {};
    const metricQuality = {};

    if (this.tryRealApi) {
      try {
        const [inflation, growth] = await Promise.allSettled([
          this._fetchInflation(year, latestRequested),
          this._fetchGrowthRate(year, latestRequested)
        ]);

        if (inflation.status === 'fulfilled' && inflation.value != null && (latestRequested || inflation.value.dataYear === year)) {
          metrics.inflation_rate = inflation.value.value;
          metricQuality.inflation_rate = 'open_data';
          quality = 'open_data';
        }
        if (growth.status === 'fulfilled' && growth.value != null && (latestRequested || growth.value.dataYear === year)) {
          metrics.growth_rate = growth.value.value;
          metricQuality.growth_rate = 'open_data';
          quality = 'open_data';
        }
      } catch (err) {
        // Keep fallback on error
      }
    }

    if (!Object.keys(metrics).length && !this.useFallback) return [];

    if (this.useFallback) {
      const fallback = this._fallbackData(cityCode, year || new Date().getFullYear(), 'fallback', purchasingPowerIndex)[0];
      for (const key of Object.keys(fallback.metrics)) {
        if (metrics[key] == null) {
          metrics[key] = fallback.metrics[key];
          metricQuality[key] = 'fallback';
        }
      }
    }
    // Overall quality reflects how many metrics came from real open data
    const openDataCount = Object.values(metricQuality).filter(q => q === 'open_data').length;
    quality = openDataCount >= 2 ? 'open_data' : (openDataCount > 0 ? 'mixed' : 'fallback');

    const openDataCount = Object.values(metricQuality).filter(q => q === 'open_data').length;
    const fallbackCount = Object.values(metricQuality).filter(q => q === 'fallback').length;
    quality = fallbackCount ? 'mixed' : (openDataCount ? 'open_data' : 'unknown');

    const observedYears = [];
    if (inflation?.status === 'fulfilled' && inflation.value?.dataYear) observedYears.push(inflation.value.dataYear);
    if (growth?.status === 'fulfilled' && growth.value?.dataYear) observedYears.push(growth.value.dataYear);
    const observedYear = observedYears.length ? Math.max(...observedYears) : (year || new Date().getFullYear());

    return [{
      cityCode: cityCode ? cityCode.toUpperCase() : 'UNK',
      year: observedYear,
      metrics,
      metricQuality,
      externalId: `sama-${cityCode || 'UNK'}-${observedYear}`,
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
        sourceUrl: sourceQuality === 'fallback' ? null : 'https://datasource.kapsarc.org',
        confidence: this.getConfidence(mapping.code, sourceQuality),
        confidenceReason: `Source: ${this.config.sourceName} (${sourceQuality})`,
        metadata: { cityCode, originalKey: key, dataQuality: sourceQuality, scope: 'national', estimated: sourceQuality === 'fallback' }
      });
    }

    return result;
  }

  // ── Real data fetchers ────────────────────────────────────

  async _fetchInflation(year, latestRequested = false) {
    const where = latestRequested
      ? "indicator like 'Inflation Rate %'"
      : `date >= '${year}-01-01' and date <= '${year}-12-31' and indicator like 'Inflation Rate %'`;
    const url = `${this.apiBaseUrl}/catalog/datasets/inflation-rate/records?` +
      `where=${encodeURIComponent(where)}` +
      `&order_by=date%20desc&limit=1`;
    const data = await this._getJson(url);
    if (data?.results?.[0]?.inflation_rate_ == null) return null;

    const date = data.results[0].date || '';
    const dataYear = parseInt(date.split('-')[0], 10) || null;
    return { value: parseFloat(data.results[0].inflation_rate_), dataYear };
  }
  async _fetchGrowthRate(year, latestRequested = false) {
    const query = latestRequested
      ? `order_by=date%20desc&limit=100`
      : `where=${encodeURIComponent(`date >= '${year}-01-01' and date <= '${year}-12-31'`)}&order_by=date%20desc&limit=100`;
    const url = `${this.apiBaseUrl}/catalog/datasets/growth-rates-of-gross-domestic-product-by-kind-of-economic-activity-at-2010-con0/records?${query}`;
    const data = await this._getJson(url);
    if (!data?.results?.length) return null;

    const latestDate = data.results[0].date || '';
    const latestYear = parseInt(latestDate.split('-')[0], 10) || null;
    const relevantRows = latestRequested && latestYear
      ? data.results.filter(row => parseInt(String(row.date || '').split('-')[0], 10) === latestYear)
      : data.results;
    const values = relevantRows.map(r => parseFloat(r.growth_rate_on_gdp)).filter(v => !isNaN(v));
    if (!values.length) return null;

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    return { value: parseFloat(avg.toFixed(2)), dataYear: latestYear || year || null };
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
