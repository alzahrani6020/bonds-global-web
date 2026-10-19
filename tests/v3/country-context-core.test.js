const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('V3 country context core', () => {
  test('country context migration defines explicit country-scoped overlays', () => {
    const migration = read('v3/supabase/migrations/20261019030000_v3_country_context_core.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.country_profiles');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.canonical_activity_country');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.country_model_overrides');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.country_regulatory_requirements');
    expect(migration).toContain('no_cross_country_fallback');
    expect(migration).not.toMatch(/DROP TABLE\s+public\.project_models/i);
    expect(migration).not.toMatch(/DROP TABLE\s+public\.regulatory_requirements/i);
  });

  test('all 22 Arab country profiles are seeded with currencies', () => {
    const migration = read('v3/supabase/migrations/20261019030000_v3_country_context_core.sql');
    const codes = [
      'DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR',
      'MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE'
    ];

    for (const code of codes) {
      expect(migration).toContain(`('${code}'`);
    }
  });

  test('Saudi-specific labor localization does not leak into generic country field', () => {
    const migration = read('v3/supabase/migrations/20261019031000_v3_country_context_hardening.sql');

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS labor_localization_rate');
    expect(migration).toContain("c.country_code = 'SA'");
    expect(migration).toContain('Do not use for non-SA countries');
  });

  test('country model coverage is explicit and non-Saudi rows remain unverified', () => {
    const migration = read('v3/supabase/migrations/20261019031000_v3_country_context_hardening.sql');

    expect(migration).toContain("CASE WHEN cp.country_code = 'SA' THEN 'estimated' ELSE 'unverified' END");
    expect(migration).toContain("'crossCountryFallbackAllowed', false");
  });

  test('API catalog and models are country-aware', () => {
    const api = read('v3/api/index.js');

    expect(api).toContain('async function loadCountryProfile');
    expect(api).toContain('async function loadCountryModelOverride');
    expect(api).toContain(".from('country_profiles')");
    expect(api).toContain(".from('canonical_activity_country')");
    expect(api).toContain(".from('country_model_overrides')");
    expect(api).toContain("country_financial_model_unverified");
  });

  test('project loader rejects city/country mismatches and never silently changes country', () => {
    const loader = read('v3/engine/loader.js');

    expect(loader).toContain('city.country_code !== countryCode');
    expect(loader).toContain('does not belong to country');
    expect(loader).toContain("model_status: override?.status || 'unverified'");
    expect(loader).toContain('localized');
  });

  test('shared V3 screens persist one country context', () => {
    const context = read('v3/country-context.js');
    const screens = [
      'v3/city-intelligence.html',
      'v3/city-comparison.html',
      'v3/investment-map.html',
      'v3/opportunity-bank.html',
      'v3/alerts.html'
    ];

    expect(context).toContain("bonds_selected_country");
    expect(context).toContain("bonds:countrychange");

    for (const screen of screens) {
      expect(read(screen)).toContain('/v3/country-context.js');
    }
  });

  test('unknown country activity coverage is disclosed instead of presented as locally verified', () => {
    const context = read('v3/country-context.js');
    expect(context).toContain('formatActivityLabel');
    expect(context).toContain('الحالة المحلية غير موثقة');

    for (const screen of [
      'v3/city-intelligence.html',
      'v3/city-comparison.html',
      'v3/investment-map.html',
      'v3/opportunity-bank.html',
      'v3/alerts.html'
    ]) {
      expect(read(screen)).toContain('formatActivityLabel');
    }
  });

  test('country-aware screens refresh activity availability for the selected market', () => {
    for (const screen of [
      'v3/city-intelligence.html',
      'v3/city-comparison.html',
      'v3/investment-map.html',
      'v3/opportunity-bank.html',
      'v3/alerts.html'
    ]) {
      const source = read(screen);
      expect(source).toContain('/catalog/activities');
      expect(source).toContain('country');
    }
  });

  test('market screens disclose when source currency differs from selected country currency', () => {
    const context = read('v3/country-context.js');
    expect(context).toContain('formatProvenanceMoney');
    expect(context).toContain('عملة المصدر');
    expect(context).toContain('وليست العملة المحلية');

    for (const screen of [
      'v3/city-intelligence.html',
      'v3/city-comparison.html',
      'v3/investment-map.html',
      'v3/opportunity-bank.html'
    ]) {
      expect(read(screen)).toContain('formatProvenanceMoney');
    }
  });

  test('main market screens respect source currency provenance instead of relabeling values', () => {
    const context = read('v3/country-context.js');
    const map = read('v3/investment-map.html');
    const comparison = read('v3/city-comparison.html');
    const bank = read('v3/opportunity-bank.html');
    const intelligence = read('v3/city-intelligence.html');

    expect(context).toContain('formatCurrency');
    expect(map).toContain('formatMarketMoney');
    expect(comparison).toContain('currency_code');
    expect(bank).toContain('formatOpportunityMoney');
    expect(intelligence).toContain('currency_code');
    expect(intelligence).toContain('العملة غير موثقة');

    expect(map).not.toContain(' ر.س</span>');
    expect(comparison).not.toContain(" + ' ر.س'");
    expect(bank).not.toContain(' ر.س</span>');
  });

  test('monetary data carries explicit currency provenance and generators do not cross countries', () => {
    const migration = read('v3/supabase/migrations/20261019032000_v3_monetary_currency_provenance.sql');
    const marketFill = read('v3/scripts/fill-city-market-data.js');
    const indicatorFill = read('v3/scripts/fill-city-indicators.js');
    const activityEnrichment = read('v3/scripts/enrich-all-activities-market-data.js');

    expect(migration).toContain('ADD COLUMN IF NOT EXISTS currency_code');
    expect(migration).toContain("source IN (");
    expect(migration).toContain("'economic_model_population_weighted'");
    expect(marketFill).not.toContain('|| globalAvg');
    expect(indicatorFill).not.toContain('|| globalAvg');
    expect(marketFill).toContain('base.currency_code');
    expect(activityEnrichment).toContain("currency_code: 'SAR'");
  });

  test('localized model choices disclose estimated versus verified status', () => {
    const comparison = read('v3/city-comparison.html');

    expect(comparison).toContain("model.country_model_status === 'verified'");
    expect(comparison).toContain("model.country_model_status === 'estimated'");
    expect(comparison).toContain("'موثق'");
    expect(comparison).toContain("'تقديري'");
  });

  test('explicit country financial calculations never fall back to an unverified model', () => {
    const api = read('v3/api/index.js');
    const compare = read('v3/api/compare.js');
    const comparison = read('v3/city-comparison.html');

    expect(api).toContain('COUNTRY_MODEL_UNVERIFIED');
    expect(api).toContain('Country financial model is not localized');
    expect(compare).toContain("financial_status = 'country_model_unverified'");
    expect(compare).toContain('loadProjectModel(supabase, modelCode, city.code, city.country_code)');
    expect(comparison).toContain('filter(model => model.localized === true)');
  });

  test('alerts are scoped at the API by selected country', () => {
    const alertsApi = read('v3/api/alerts.js');
    const alertsPage = read('v3/alerts.html');

    expect(alertsApi).toContain("url.searchParams.get('country')");
    expect(alertsApi).toContain('city:city_id!inner');
    expect(alertsApi).toContain("query.eq('city.country_code', countryCode)");
    expect(alertsPage).toContain("params.set('country', countryCode)");
  });

  test('country context exposes operational coverage gaps without inventing localization', () => {
    const api = read('v3/api/index.js');

    expect(api).toContain('activities_unknown');
    expect(api).toContain('activities_sourced');
    expect(api).toContain('models_estimated');
    expect(api).toContain('models_verified');
    expect(api).toContain('models_unverified');
    expect(api).toContain('regulations_verified');
    expect(api).toContain('macro_metrics');
    expect(api).toContain('activity_country_verification');
    expect(api).toContain('financial_model_localization');
    expect(api).toContain('country_regulations');
    expect(api).toContain('macro_indicator_coverage');
  });

  test('data source registry is activated from a real existing source', () => {
    const migration = read('v3/supabase/migrations/20261019031000_v3_country_context_hardening.sql');

    expect(migration).toContain("'world_bank_open_data'");
    expect(migration).toContain("'World Bank Open Data'");
    expect(migration).toContain("ARRAY['DZ','BH','KM','DJ','EG','IQ','JO','KW','LB','LY','MR','MA','OM','PS','QA','SA','SO','SD','SY','TN','AE','YE']");
  });
});
