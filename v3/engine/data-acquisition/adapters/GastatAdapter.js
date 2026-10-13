/**
 * GastatAdapter — محول الهيئة العامة للإحصاء السعودية.
 * يجلب بيانات حقيقية من بوابة KAPSARC Open Data التي تعيد نشر بيانات GASTAT
 * عبر API موثق (Opendatasoft v2.1).
 *
 * Datasets المستخدمة:
 * - main-labor-market-indicators: مؤشرات سوق العمل (البطالة، الأجور)
 * - population-by-detailed-age-gender-governorate-nationality-and-region: تعداد السكان
 * - gross-domestic-product-by-kind-of-economic-activity-at-current-prices-2023-100: النمو
 */
const BaseAdapter = require('../BaseAdapter');

class GastatAdapter extends BaseAdapter {
  constructor(config = {}) {
    super({
      sourceId: 'gastat',
      sourceName: 'الهيئة العامة للإحصاء (عبر KAPSARC)',
      ...config
    });
    this.apiBaseUrl = config.apiBaseUrl || 'https://datasource.kapsarc.org/api/explore/v2.1';
    this.useFallback = config.useFallback === true;
    this.tryRealApi = config.tryRealApi !== false; // true by default now
  }

  supportedMetrics() {
    return [
      'population',
      'household_income',
      'growth_rate',
      'unemployment_rate',
      'establishments_count',
      'inflation_rate'
    ];
  }

  async fetch(options = {}) {
    const { cityCode, year = new Date().getFullYear(), population, purchasingPowerIndex } = options;
    const metrics = {};
    const metricQuality = {};
    const metricScope = {};
    const metricSourceUrl = {};
    let observedYear = year;

    if (this.tryRealApi) {
      try {
        const [labor, pop] = await Promise.allSettled([
          this._fetchLaborMarket(year),
          this._fetchPopulationByRegion(cityCode)
        ]);

        if (labor.status === 'fulfilled' && labor.value && Object.keys(labor.value.metrics || {}).length) {
          Object.assign(metrics, labor.value.metrics);
          observedYear = labor.value.dataYear || observedYear;
          for (const k of Object.keys(labor.value.metrics)) {
            metricQuality[k] = 'open_data';
            metricScope[k] = 'national';
            metricSourceUrl[k] = 'https://datasource.kapsarc.org/explore/dataset/main-labor-market-indicators/';
          }
        }

        if (pop.status === 'fulfilled' && pop.value?.value != null) {
          metrics.population = pop.value.value;
          metricQuality.population = 'open_data';
          metricScope.population = 'region';
          metricSourceUrl.population = 'https://datasource.kapsarc.org/explore/dataset/population-by-detailed-age-gender-governorate-nationality-and-region/';
          if (pop.value.dataYear) observedYear = pop.value.dataYear;
        }
      } catch (err) {
        // A failed public-source request must not silently become an estimate.
      }
    }

    if (!Object.keys(metrics).length) {
      if (!this.useFallback) return [];
      return this._fallbackData(cityCode, year, 'fallback', population, purchasingPowerIndex);
    }

    if (this.useFallback) {
      const fallback = this._fallbackData(cityCode, year, 'fallback', metrics.population || population, purchasingPowerIndex)[0];
      for (const key of Object.keys(fallback.metrics)) {
        if (metrics[key] == null) {
          metrics[key] = fallback.metrics[key];
          metricQuality[key] = 'fallback';
          metricScope[key] = 'model';
          metricSourceUrl[key] = null;
        }
      }
    }

    const openDataCount = Object.values(metricQuality).filter(q => q === 'open_data').length;
    const fallbackCount = Object.values(metricQuality).filter(q => q === 'fallback').length;
    const quality = fallbackCount ? 'mixed' : (openDataCount ? 'open_data' : 'unknown');

    return [{
      cityCode: cityCode ? cityCode.toUpperCase() : 'UNK',
      year: observedYear,
      metrics,
      metricQuality,
      metricScope,
      metricSourceUrl,
      externalId: `gastat-${cityCode || 'UNK'}-${observedYear}`,
      source: this.config.sourceId,
      quality
    }];
  }

  async validate(rawItem) {
    const errors = [];
    if (!rawItem.cityCode) errors.push('cityCode is required');
    if (!rawItem.year) errors.push('year is required');
    if (!rawItem.metrics || typeof rawItem.metrics !== 'object') {
      errors.push('metrics object is required');
    }
    return { valid: errors.length === 0, errors };
  }

  async transform(rawItem) {
    const { cityCode, year, metrics, metricQuality = {}, metricScope = {}, metricSourceUrl = {} } = rawItem;
    const result = [];

    const mappings = {
      population: { code: 'population', unit: 'person', quality: 'official' },
      household_income: { code: 'household_income', unit: 'SAR', quality: 'official' },
      growth_rate: { code: 'growth_rate', unit: '%', quality: 'official' },
      unemployment_rate: { code: 'unemployment_rate', unit: '%', quality: 'official' },
      establishments_count: { code: 'establishments_count', unit: 'establishment', quality: 'official' },
      inflation_rate: { code: 'inflation_rate', unit: '%', quality: 'official' }
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
        sourceUrl: metricSourceUrl[key] || null,
        confidence: this.getConfidence(mapping.code, sourceQuality),
        confidenceReason: `Source: ${this.config.sourceName} (${sourceQuality}; scope=${metricScope[key] || 'unknown'})`,
        metadata: { cityCode, originalKey: key, dataQuality: sourceQuality, scope: metricScope[key] || 'unknown', estimated: sourceQuality === 'fallback' }
      });
    }

    return result;
  }

  // ── Real data fetchers ────────────────────────────────────

  async _fetchLaborMarket(year) {
    const metrics = {};
    let dataYear = null;

    // Unemployment rate: latest Saudi total unemployment rate for the requested year
    const unemploymentUrl = `${this.apiBaseUrl}/catalog/datasets/main-labor-market-indicators/records?` +
      `where=${encodeURIComponent(`indicator like 'Saudi Unemployment Rate(15) years and above' and gender like 'Total' and time_period >= '${year}-01-01' and time_period <= '${year}-12-31'`)}` +
      `&order_by=time_period%20desc,quarter%20desc&limit=1`;
    const unemployment = await this._getJson(unemploymentUrl);
    if (unemployment?.results?.[0]?.indicator_value != null) {
      metrics.unemployment_rate = parseFloat(unemployment.results[0].indicator_value);
      dataYear = parseInt(unemployment.results[0].time_period, 10) || dataYear;
    }

    // Average monthly wages (paid employees, total)
    const wagesUrl = `${this.apiBaseUrl}/catalog/datasets/main-labor-market-indicators/records?` +
      `where=${encodeURIComponent(`indicator like 'Average Monthly Wages of Paid employees  (main job) (+15) years' and gender like 'Total' and time_period >= '${year}-01-01' and time_period <= '${year}-12-31'`)}` +
      `&order_by=time_period%20desc,quarter%20desc&limit=1`;
    const wages = await this._getJson(wagesUrl);
    if (wages?.results?.[0]?.indicator_value != null) {
      // Annualize wages to approximate household income (2 earners assumption)
      const monthlyWage = parseFloat(wages.results[0].indicator_value);
      metrics.household_income = Math.round(monthlyWage * 12 * 1.8);
      dataYear = parseInt(wages.results[0].time_period, 10) || dataYear;
    }

    return { metrics, dataYear };
  }

  async _fetchPopulationByRegion(cityCode) {
    if (!cityCode) return null;

    // Canonical city codes use COUNTRY-REGION-CITY (e.g. SA-02-002 = Jeddah).
    // GASTAT/KAPSARC population endpoint is region-level, so map the canonical
    // region segment rather than relying on the retired RUH/JED short codes.
    const canonicalRegionMap = {
      '01': 'Ar Riyadh',
      '02': 'Makkah Al Mukarramah',
      '03': 'Al Madinah Al Munawwarah',
      '04': 'Al Qaseem',
      '05': 'Eastern Region',
      '06': 'Aseer',
      '07': 'Tabuk',
      '08': 'Hail',
      '09': 'Northern Borders',
      '10': 'Al Jawf',
      '11': 'Jazan',
      '12': 'Najran',
      '13': 'Al Bahah'
    };
    const legacyRegionMap = {
      RUH: 'Ar Riyadh',
      JED: 'Makkah Al Mukarramah',
      TIF: 'Makkah Al Mukarramah',
      MED: 'Al Madinah Al Munawwarah',
      DMM: 'Eastern Region',
      DHA: 'Eastern Region',
      KHB: 'Eastern Region',
      AHB: 'Aseer',
      ABH: 'Aseer',
      TAB: 'Tabuk',
      HAIL: 'Hail',
      QAS: 'Al Qaseem',
      ARA: 'Northern Borders',
      JAW: 'Al Jawf',
      NAJ: 'Najran',
      BAH: 'Al Bahah',
      JIZ: 'Jazan'
    };

    const normalizedCode = String(cityCode).toUpperCase();
    const canonicalMatch = normalizedCode.match(/^SA-(\d{2})-\d{3}$/);
    const regionName = canonicalMatch
      ? canonicalRegionMap[canonicalMatch[1]]
      : legacyRegionMap[normalizedCode];
    if (!regionName) return null;

    const url = `${this.apiBaseUrl}/catalog/datasets/population-by-detailed-age-gender-governorate-nationality-and-region/records?` +
      `where=${encodeURIComponent(`region = '${regionName}'`)}` +
      `&group_by=region&select=sum(population)`;

    const data = await this._getJson(url);
    if (!data?.results?.[0]?.['sum(population)']) return null;

    const value = Number(data.results[0]['sum(population)']) || null;
    if (value == null) return null;
    const yearCandidate = data.results[0].year ?? data.results[0].data_year ?? data.results[0].time_period ?? null;
    const dataYear = Number.parseInt(String(yearCandidate || ''), 10) || null;
    return { value, dataYear, regionName };
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

  _fallbackData(cityCode, year, quality = 'fallback', population = 1000000, purchasingPowerIndex = 100) {
    const code = cityCode ? cityCode.toUpperCase() : 'UNK';
    const pop = Number(population) || 1000000;
    const ppi = Number(purchasingPowerIndex) || 100;

    const tierFactor = pop >= 2000000 ? 1.0 : pop >= 800000 ? 0.92 : 0.85;
    const incomeFactor = ppi / 100;

    const householdIncome = Math.round(150000 * incomeFactor * tierFactor);
    const growthRate = parseFloat((3.0 * tierFactor).toFixed(2));
    const unemploymentRate = parseFloat((5.5 + (1 - tierFactor) * 5).toFixed(2));
    const establishmentsCount = Math.round(pop * 0.022 * tierFactor);
    const inflationRate = 2.4;

    return [{
      cityCode: code,
      year,
      metrics: {
        population: pop,
        household_income: householdIncome,
        growth_rate: growthRate,
        unemployment_rate: unemploymentRate,
        establishments_count: establishmentsCount,
        inflation_rate: inflationRate
      },
      externalId: `${code}-${year}`,
      source: this.config.sourceId,
      quality
    }];
  }
}

module.exports = GastatAdapter;
