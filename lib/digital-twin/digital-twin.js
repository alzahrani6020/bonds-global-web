/**
 * BONDS Digital Twin Foundation
 *
 * Builds and maintains a digital representation of a project including
 * asset, financing, cashflow, risks, scenarios, market and indicators.
 */

const crypto = require('crypto');

function buildSnapshot(project, { asset, valuation, financing, reports = [], scenarios = [], market = {}, indicators = {} } = {}) {
  return {
    project_id: project.id,
    project_number: project.project_number,
    sector: project.sector,
    activity: project.activity,
    location: {
      country: project.country,
      city: project.city
    },
    asset: asset || null,
    valuation: valuation || null,
    financing: financing || null,
    reports: reports.slice(0, 20),
    scenarios: scenarios.slice(0, 20),
    market,
    indicators,
    computed: {
      hasCertificate: reports.some(r => r.type === 'certificate'),
      reportCount: reports.length,
      scenarioCount: scenarios.length
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
    // In production this would query bonds_projects, bonds_assets, bonds_valuations, etc.
    const project = { id: projectId, project_number: dependencies.projectNumber || projectId, ...dependencies };
    const snapshot = buildSnapshot(project, dependencies);
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
  computeChecksum
};
