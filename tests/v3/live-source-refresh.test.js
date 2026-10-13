/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('live source refresh and dynamic years', () => {
  test('country observation migration preserves provenance and year', () => {
    const sql = read('supabase/migrations/20261013123000_country_indicator_observations.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.country_indicator_observations');
    expect(sql).toContain('UNIQUE(country_code, metric_code, year, source_id)');
    expect(sql).toContain('source_url text');
    expect(sql).toContain('observed_at date');
    expect(sql).toContain('geographic_scope text');
  });

  test('country engine covers all Arab countries with latest non-empty World Bank queries', () => {
    const source = read('lib/data/country-indicator-engine.js');
    expect(source).toContain("'DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR','MA'");
    expect(source).toContain("'OM','PS','QA','SA','SO','SD','SY','TN','AE','YE'");
    expect(source).toContain('mrnev=1');
    expect(source).toContain("metricCode: 'inflation_rate'");
    expect(source).toContain("metricCode: 'economic_growth_rate'");
    expect(source).toContain("metricCode: 'population_total'");
    expect(source).toContain("metricCode: 'gdp_per_capita_usd'");
    expect(source).toContain("metricCode: 'fdi_net_inflows_pct_gdp'");
    expect(source).toContain("sourceId: 'world_bank'");
    expect(source).toContain("source_id: 'world_bank_country'");
  });

  test('scheduled and instant refresh both use CountryIndicatorEngine', () => {
    const scheduled = read('api/reference-data.js');
    const instant = read('v3/api/data-engine.js');
    expect(scheduled).toContain("require('../lib/data/country-indicator-engine')");
    expect(scheduled).toContain('new CountryIndicatorEngine({ timeoutMs: SOURCE_FETCH_TIMEOUT_MS }).refresh(supabase)');
    expect(instant).toContain("require('../../lib/data/country-indicator-engine')");
    expect(instant).toContain('results.countryIndicators = await countryEngine.refresh');
    expect(instant).toContain('countryCodes: [city.country_code]');
  });

  test('observed source year wins over requested year', () => {
    const pipeline = read('v3/engine/data-acquisition/DataPipeline.js');
    expect(pipeline).toContain('Number.isInteger(Number(metric.year)) ? Number(metric.year)');
    expect(pipeline).toContain('Number.isInteger(Number(year)) ? Number(year)');
  });

  test('Saudi adapters use latest source observations without synthetic fallback by default', () => {
    const gastat = read('v3/engine/data-acquisition/adapters/GastatAdapter.js');
    const sama = read('v3/engine/data-acquisition/adapters/SamaAdapter.js');

    expect(gastat).toContain("options.year === 'latest'");
    expect(gastat).toContain('this._fetchLaborMarket(year, latestRequested)');
    expect(gastat).toContain('this.useFallback = config.useFallback === true');
    expect(gastat).toContain('const dataYear = 2022;');
    expect(gastat).toContain("sourcePeriod: '2022 Census'");

    expect(sama).toContain("options.year === 'latest'");
    expect(sama).toContain('this._fetchInflation(year, latestRequested)');
    expect(sama).toContain('this._fetchGrowthRate(year, latestRequested)');
    expect(sama).toContain('this.useFallback = config.useFallback === true');
    expect(sama).toContain("sourceQuality === 'fallback' ? null");
  });

  test('catalog years endpoint is data-driven', () => {
    const api = read('v3/api/index.js');
    expect(api).toContain('async function handleCatalogYears');
    expect(api).toContain("from('city_indicators').select('year')");
    expect(api).toContain("from('normalized_metrics')");
    expect(api).toContain("select('year,source_url,source_id,metadata')");
    expect(api).toContain("from('city_market_data')");
    expect(api).toContain("from('country_indicator_observations')");
    expect(api).toContain("path === '/catalog/years'");
    expect(api).toContain('sourceYears');
    expect(api).toContain('legacyYears');
    expect(api).toContain('sourceBacked: verified.length > 0');
    expect(api).toContain("new CountryIndicatorEngine({ timeoutMs: 12000 })");
  });

  test('city intelligence and comparison contain no hard-coded year choices', () => {
    const intelligence = read('v3/city-intelligence.html');
    const comparison = read('v3/city-comparison.html');

    expect(intelligence).toContain("API_URL + '/catalog/years?'");
    expect(intelligence).toContain("year: /^\\d{4}$/.test(year) ? Number(year) : 'latest'");
    expect(intelligence).not.toMatch(/<option value="202[0-9]"/);

    expect(comparison).toContain("API_URL + '/catalog/years?'");
    expect(comparison).not.toMatch(/<option value="202[0-9]"/);
    expect(comparison).toContain('أحدث سنة متاحة');
    expect(intelligence).toContain('أحدث سنة مصدرية (');
    expect(comparison).toContain('أحدث سنة مصدرية (');
  });

  test('World Bank refresh retries transient failures with bounded concurrency', () => {
    const engine = read('lib/data/country-indicator-engine.js');
    expect(engine).toContain('async fetchMetricWithRetry');
    expect(engine).toContain('for (let i = 0; i < this.metrics.length; i += 2)');
    expect(engine).toContain('this.fetchMetricWithRetry(metric, countries, 2)');
  });

  test('country context retries incomplete source coverage', () => {
    const api = read('v3/api/index.js');
    expect(api).toContain('const uniqueMetricCount = new Set(observationRows.map(row => row.metric_code)).size');
    expect(api).toContain('const incompleteCoverage = uniqueMetricCount < 3');
  });

  test('country context route is wired and self-heals an empty or old source cache', () => {
    const api = read('v3/api/index.js');
    expect(api).toContain("path.match(/^\\/countries\\/[^\\/]+\\/context$/)");
    expect(api).toContain('return await handleCountryContext(req, res, path)');
    expect(api).toContain("console.warn('[country-context refresh]'");
    expect(api).toContain('cacheAgeMs > 6 * 60 * 60 * 1000');
    expect(api).toContain("countryCodes: [countryCode]");
  });

  test('country context preserves country scope, source and freshness', () => {
    const api = read('v3/api/index.js');
    const page = read('v3/city-intelligence.html');

    expect(api).toContain("geographic_scope: 'country'");
    expect(api).toContain('freshness_status');
    expect(api).toContain('freshness_sla_days');
    expect(page).toContain('سياق وطني');
    expect(page).toContain('قديم حسب سياسة الحداثة');
    expect(page).toContain('gdp_per_capita_usd');
    expect(page).toContain('population_total');
  });

  test('country context excludes untrusted legacy market interest rows', () => {
    const api = read('v3/api/index.js');
    expect(api).not.toContain('Keep a sourced interest-rate observation from the legacy market feed');
    expect(api).not.toContain("from('market_data')\n    .select('interest_rate");
  });

  test('latest city APIs prefer source-backed normalized years over legacy Gold years', () => {
    const api = read('v3/api/index.js');
    expect(api).toContain('async function resolveLatestSourceBackedCityYear');
    expect(api).toContain("from('normalized_metrics')");
    expect(api).toContain("row.metadata?.observationKind === 'observed'");
    expect(api).toContain('targetYear = await resolveLatestSourceBackedCityYear(supabase, city.id)');
  });

  test('latest city endpoints never fall back to modeled legacy rows', () => {
    const api = read('v3/api/index.js');
    const occurrences = api.match(/dataStatus: 'no_source_backed_city_data'/g) || [];
    expect(occurrences.length).toBeGreaterThanOrEqual(3);
    expect(api).toContain("requestedYear: 'latest'");
    expect(api).toContain('legacyAvailableYear');
    expect(api).toContain('marketData: []');
    expect(api).toContain('indicators: null');
  });

  test('instant auto-fill resolves latest source year before activity engines', () => {
    const api = read('v3/api/data-engine.js');
    expect(api).toContain('const effectiveYear = Number(results.city?.year)');
    expect(api).toContain('year: effectiveYear');
    expect(api).toContain('results.requestedYear = year');
    expect(api).toContain('results.effectiveYear = effectiveYear');
  });
});
