'use strict';

/**
 * CountryIndicatorEngine
 * Pulls the latest non-empty macro observations from World Bank Open Data
 * and persists them separately from city-level facts.
 */

const ARAB_COUNTRY_CODES = [
  'DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR','MA',
  'OM','PS','QA','SA','SO','SD','SY','TN','AE','YE'
];

const WORLD_BANK_METRICS = [
  { metricCode: 'inflation_rate', indicator: 'FP.CPI.TOTL.ZG', unit: '%', confidence: 95 },
  { metricCode: 'economic_growth_rate', indicator: 'NY.GDP.MKTP.KD.ZG', unit: '%', confidence: 95 },
  { metricCode: 'unemployment_rate', indicator: 'SL.UEM.TOTL.ZS', unit: '%', confidence: 88, modeledSource: true },
  { metricCode: 'population_total', indicator: 'SP.POP.TOTL', unit: 'person', confidence: 95 },
  { metricCode: 'gdp_per_capita_usd', indicator: 'NY.GDP.PCAP.CD', unit: 'USD', confidence: 95 },
  { metricCode: 'fdi_net_inflows_pct_gdp', indicator: 'BX.KLT.DINV.WD.GD.ZS', unit: '% GDP', confidence: 90 }
];

class CountryIndicatorEngine {
  constructor(options = {}) {
    this.timeoutMs = Number(options.timeoutMs || 15000);
    this.metrics = options.metrics || WORLD_BANK_METRICS;
  }

  normalizeCountries(countryCodes) {
    const input = Array.isArray(countryCodes) && countryCodes.length ? countryCodes : ARAB_COUNTRY_CODES;
    return [...new Set(input.map(code => String(code || '').toUpperCase()))]
      .filter(code => ARAB_COUNTRY_CODES.includes(code));
  }

  async fetchMetric(metric, countryCodes) {
    const countries = this.normalizeCountries(countryCodes);
    if (!countries.length) return { metric: metric.metricCode, rows: [], sourceLastUpdated: null };

    const url = `https://api.worldbank.org/v2/country/${countries.join(';')}/indicator/${metric.indicator}?format=json&mrnev=1&per_page=100`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'BondsGlobal-CountryData/2.0'
      },
      signal: AbortSignal.timeout(this.timeoutMs)
    });
    if (!response.ok) throw new Error(`World Bank ${metric.indicator}: HTTP ${response.status}`);

    const json = await response.json();
    const sourceLastUpdated = json?.[0]?.lastupdated || null;
    const rows = (Array.isArray(json?.[1]) ? json[1] : [])
      .filter(row => countries.includes(String(row?.country?.id || '').toUpperCase()))
      .filter(row => row?.value !== null && row?.value !== undefined && /^\d{4}$/.test(String(row?.date || '')))
      .map(row => ({
        countryCode: String(row.country.id).toUpperCase(),
        metricCode: metric.metricCode,
        year: Number(row.date),
        value: Number(row.value),
        unit: metric.unit,
        sourceId: 'world_bank',
        sourceName: 'World Bank Open Data',
        sourceUrl: `https://api.worldbank.org/v2/country/${String(row.country.id).toUpperCase()}/indicator/${metric.indicator}?format=json&mrnev=1`,
        observedAt: `${row.date}-12-31`,
        confidence: metric.confidence,
        metadata: {
          indicator: metric.indicator,
          indicator_name: row?.indicator?.value || null,
          source_last_updated: sourceLastUpdated,
          modeled_source: metric.modeledSource === true,
          retrieval_mode: 'mrnev=1'
        }
      }));

    return { metric: metric.metricCode, rows, sourceLastUpdated };
  }

  async refresh(supabase, options = {}) {
    if (!supabase) throw new Error('supabase client is required');
    const countries = this.normalizeCountries(options.countryCodes);
    const startedAt = Date.now();
    const fetchedAt = new Date().toISOString();
    let updated = 0;
    let failed = 0;
    const errors = [];

    const results = await Promise.allSettled(
      this.metrics.map(metric => this.fetchMetric(metric, countries))
    );

    for (const result of results) {
      if (result.status !== 'fulfilled') {
        failed++;
        errors.push(result.reason?.message || String(result.reason));
        continue;
      }

      const rows = result.value.rows.map(row => ({
        country_code: row.countryCode,
        metric_code: row.metricCode,
        year: row.year,
        value: row.value,
        unit: row.unit,
        source_id: row.sourceId,
        source_name: row.sourceName,
        source_url: row.sourceUrl,
        observed_at: row.observedAt,
        fetched_at: fetchedAt,
        confidence: row.confidence,
        geographic_scope: 'country',
        metadata: row.metadata,
        updated_at: fetchedAt
      }));

      if (!rows.length) continue;
      const { error } = await supabase
        .from('country_indicator_observations')
        .upsert(rows, { onConflict: 'country_code,metric_code,year,source_id' });
      if (error) {
        failed++;
        errors.push(`${result.value.metric}: ${error.message}`);
        continue;
      }
      updated += rows.length;
    }

    return {
      updated,
      failed,
      skipped: 0,
      errors,
      total: this.metrics.length,
      observations: updated,
      countries: countries.length,
      elapsedMs: Date.now() - startedAt
    };
  }
}

module.exports = {
  CountryIndicatorEngine,
  ARAB_COUNTRY_CODES,
  WORLD_BANK_METRICS
};
