/**
 * Bonds V3 — Project Model Loader
 *
 * Loads a project model with all assumptions, risks, and city-specific data
 * from Supabase.
 */

const { createClient } = require('@supabase/supabase-js');

function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase URL or key environment variables');
  }

  return createClient(url, key);
}

async function loadProjectModel(supabase, projectModelCode, cityCode = null) {
  // Load project model
  const { data: projectModel, error: modelError } = await supabase
    .from('project_models')
    .select('*')
    .eq('code', projectModelCode)
    .eq('is_published', true)
    .single();

  if (modelError || !projectModel) {
    throw new Error(`Project model not found: ${projectModelCode}`);
  }

  // Load assumptions with their metadata
  const { data: assumptions, error: assumptionsError } = await supabase
    .from('project_model_assumptions')
    .select(`
      value,
      financial_assumptions:assumption_id (
        code,
        name_ar,
        name_en,
        category,
        unit_type,
        default_value,
        min_value,
        max_value
      )
    `)
    .eq('project_model_id', projectModel.id);

  if (assumptionsError) throw assumptionsError;

  // Normalize assumptions shape to match calculator expectations
  const normalizedAssumptions = assumptions.map(a => ({
    code: a.financial_assumptions.code,
    name_ar: a.financial_assumptions.name_ar,
    name_en: a.financial_assumptions.name_en,
    category: a.financial_assumptions.category,
    unit_type: a.financial_assumptions.unit_type,
    value: a.value,
    default_value: a.financial_assumptions.default_value,
    min_value: a.financial_assumptions.min_value,
    max_value: a.financial_assumptions.max_value
  }));

  // Load risks with weights
  const { data: risks, error: risksError } = await supabase
    .from('project_model_risks')
    .select(`
      score,
      notes,
      risk_factors:risk_factor_id (
        code,
        name_ar,
        name_en,
        category,
        weight
      )
    `)
    .eq('project_model_id', projectModel.id);

  if (risksError) throw risksError;

  const normalizedRisks = risks.map(r => ({
    risk_factor_id: r.risk_factors.code,
    code: r.risk_factors.code,
    name_ar: r.risk_factors.name_ar,
    name_en: r.risk_factors.name_en,
    category: r.risk_factors.category,
    weight: r.risk_factors.weight,
    score: r.score,
    notes: r.notes
  }));

  // Load city market data and risk adjustments if city provided
  let marketData = null;
  let cityIndicators = null;
  let cityRiskAdjustments = [];
  let countryBenchmarks = null;
  let city = null;

  if (cityCode) {
    const { data: cityData, error: cityError } = await supabase
      .from('cities')
      .select('id, name_ar, name_en, country_code')
      .eq('code', cityCode)
      .single();

    city = cityData;

    if (cityError) throw cityError;

    // Load country-specific benchmarks for adjustment engine
    const currentYear = new Date().getFullYear();
    if (city && city.country_code) {
      const { data: benchmarks, error: benchmarksError } = await supabase
        .from('country_benchmarks')
        .select('metric_code, benchmark_value')
        .eq('country_code', city.country_code)
        .lte('year', currentYear)
        .order('year', { ascending: false });

      if (!benchmarksError && benchmarks) {
        countryBenchmarks = {};
        benchmarks.forEach(b => {
          if (!countryBenchmarks[b.metric_code]) {
            countryBenchmarks[b.metric_code] = Number(b.benchmark_value);
          }
        });
      }
    }

    const { data: market, error: marketError } = await supabase
      .from('city_market_data')
      .select(`
        *,
        city:city_id (name_ar, name_en)
      `)
      .eq('city_id', city.id)
      .eq('activity_id', projectModel.activity_id)
      .order('data_year', { ascending: false })
      .limit(1)
      .single();

    if (!marketError) marketData = market;

    // Load city-level economic indicators (Gold layer from Data Acquisition Platform)
    const { data: indicators, error: indicatorsError } = await supabase
      .from('city_indicators')
      .select('*')
      .eq('city_id', city.id)
      .lte('year', currentYear)
      .order('year', { ascending: false })
      .limit(1)
      .single();

    if (!indicatorsError) cityIndicators = indicators;

    const { data: adjustments, error: adjustmentError } = await supabase
      .from('city_risk_adjustments')
      .select(`
        adjustment,
        risk_factors:risk_factor_id (code)
      `)
      .eq('city_id', city.id);

    if (!adjustmentError) {
      cityRiskAdjustments = adjustments.map(a => ({
        risk_factor_id: a.risk_factors.code,
        adjustment: a.adjustment
      }));
    }
  }

  return {
    projectModel,
    assumptions: normalizedAssumptions,
    risks: normalizedRisks,
    marketData,
    cityIndicators,
    cityRiskAdjustments,
    city,
    countryBenchmarks
  };
}

module.exports = {
  createSupabaseClient,
  loadProjectModel
};
