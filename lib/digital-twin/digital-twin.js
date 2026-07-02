/**
 * BONDS Digital Twin Foundation
 *
 * Builds and maintains a digital representation of a project including
 * asset, financing, cashflow, risks, scenarios, market and indicators.
 */

const crypto = require('crypto');

function normalizeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchProjectData(supabase, projectId) {
  if (!supabase || !projectId) return null;

  const { data: project, error: projectError } = await supabase
    .from('bonds_projects')
    .select('*')
    .eq('id', projectId)
    .single();
  if (projectError || !project) return null;

  const cityPromise = project.city_id
    ? supabase.from('cities').select('*').eq('id', project.city_id).single()
    : Promise.resolve({ data: null, error: null });

  const [
    assetResult,
    valuationResult,
    financingResult,
    reportsResult,
    lifecycleResult,
    cityResult
  ] = await Promise.all([
    supabase.from('bonds_assets').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).single().catch(() => ({ data: null, error: null })),
    supabase.from('bonds_valuations').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).single().catch(() => ({ data: null, error: null })),
    supabase.from('bonds_financing').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).single().catch(() => ({ data: null, error: null })),
    supabase.from('bonds_reports').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(20),
    supabase.from('enterprise_lifecycle_instances').select('*').eq('entity_id', projectId).eq('entity_type', 'project').order('created_at', { ascending: false }).limit(1).single().catch(() => ({ data: null, error: null })),
    cityPromise.catch(() => ({ data: null, error: null }))
  ]);

  return {
    project,
    city: cityResult.data || null,
    asset: assetResult.data || null,
    valuation: valuationResult.data || null,
    financing: financingResult.data || null,
    reports: reportsResult.data || [],
    lifecycle: lifecycleResult.data || null
  };
}

async function fetchMarketData(supabase, project, city) {
  if (!supabase || !project || !city) return {};
  try {
    const activityCode = project.activity || project.sub_sector || project.sector;
    const currentYear = new Date().getFullYear();
    const { data: marketRows } = await supabase
      .from('city_market_data')
      .select('*')
      .eq('city_id', city.id)
      .eq('data_year', currentYear)
      .limit(10);

    const { data: indicatorRows } = await supabase
      .from('city_indicators')
      .select('*')
      .eq('city_id', city.id)
      .lte('year', currentYear)
      .order('year', { ascending: false })
      .limit(5);

    return {
      market: marketRows || [],
      indicators: indicatorRows || []
    };
  } catch (err) {
    console.warn('[DigitalTwin] market fetch failed:', err.message);
    return {};
  }
}

function buildSnapshot(project, dependencies = {}) {
  const city = dependencies.city || {};
  const asset = dependencies.asset || null;
  const valuation = dependencies.valuation || null;
  const financing = dependencies.financing || null;
  const reports = dependencies.reports || [];
  const lifecycle = dependencies.lifecycle || null;
  const market = dependencies.market || {};
  const indicators = dependencies.indicators || {};

  const assetValue = normalizeNumber(valuation?.value || asset?.market_value);
  const capital = normalizeNumber(project.capital);
  const revenue = normalizeNumber(project.revenue);
  const annualProfit = normalizeNumber(project.annual_profit);

  return {
    project_id: project.id,
    project_number: project.project_number,
    name: project.name,
    sector: project.sector,
    sub_sector: project.sub_sector,
    activity: project.activity,
    location: {
      country: project.country_code || city.country_code,
      city: city.name || project.city,
      city_id: project.city_id
    },
    asset: asset,
    valuation: valuation,
    financing: financing,
    reports: reports.slice(0, 20),
    market,
    indicators,
    lifecycle: lifecycle ? {
      current_stage: lifecycle.current_stage,
      workflow_code: lifecycle.workflow_code,
      status: lifecycle.status,
      started_at: lifecycle.started_at
    } : null,
    computed: {
      hasCertificate: reports.some(r => r.type === 'certificate'),
      reportCount: reports.length,
      assetValue,
      investedCapital: capital || assetValue,
      annualRevenue: revenue,
      annualProfit,
      profitMargin: revenue > 0 ? Math.round((annualProfit / revenue) * 1000) / 10 : 0,
      currentStage: lifecycle?.current_stage || 'idea'
    },
    generated_at: new Date().toISOString()
  };
}

function computeChecksum(snapshot) {
  return crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 16);
}

class DigitalTwin {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async build(projectId, dependencies = {}) {
    if (!this.supabase || !projectId) {
      return { snapshot: buildSnapshot({ id: projectId }, dependencies), checksum: computeChecksum(buildSnapshot({ id: projectId }, dependencies)) };
    }

    // If full dependencies are passed manually, use them directly (backward compatible).
    if (dependencies.project && dependencies.project.id) {
      const snapshot = buildSnapshot(dependencies.project, dependencies);
      return { snapshot, checksum: computeChecksum(snapshot) };
    }

    const data = await fetchProjectData(this.supabase, projectId);
    if (!data) {
      const snapshot = buildSnapshot({ id: projectId }, dependencies);
      return { snapshot, checksum: computeChecksum(snapshot) };
    }

    const marketData = await fetchMarketData(this.supabase, data.project, data.city);

    const fullDependencies = {
      ...dependencies,
      ...data,
      market: marketData.market || dependencies.market || {},
      indicators: marketData.indicators || dependencies.indicators || {}
    };

    const snapshot = buildSnapshot(data.project, fullDependencies);
    return { snapshot, checksum: computeChecksum(snapshot) };
  }

  async save(projectId, snapshot) {
    if (!this.supabase) return { project_id: projectId, version: 1, snapshot };
    const checksum = computeChecksum(snapshot);
    const { data: existing } = await this.supabase
      .from('bonds_digital_twins')
      .select('version')
      .eq('project_id', projectId)
      .single();

    const version = existing ? existing.version + 1 : 1;
    const { data, error } = await this.supabase
      .from('bonds_digital_twins')
      .upsert({
        project_id: projectId,
        version,
        snapshot,
        checksum
      }, { onConflict: 'project_id' })
      .select('*')
      .single();
    if (error) throw new Error(`Digital twin save failed: ${error.message}`);
    return data;
  }

  async get(projectId) {
    if (!this.supabase) return null;
    const { data, error } = await this.supabase
      .from('bonds_digital_twins')
      .select('*')
      .eq('project_id', projectId)
      .single();
    if (error && error.code !== 'PGRST116') throw new Error(`Digital twin fetch failed: ${error.message}`);
    return data;
  }
}

module.exports = {
  DigitalTwin,
  buildSnapshot,
  computeChecksum,
  fetchProjectData
};
