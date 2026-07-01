/**
 * BONDS Decision Profile
 *
 * A decision-centric user profile that records patterns instead of personal data.
 */

const { clamp } = require('../confidence/confidence-engine');

class DecisionProfile {
  constructor(data = {}) {
    this.userId = data.user_id || data.userId || null;
    this.decisionPatterns = data.decision_patterns || data.decisionPatterns || {};
    this.sectors = data.sectors || data.sectors || [];
    this.valuationMethods = data.valuation_methods || data.valuationMethods || [];
    this.reportTypes = data.report_types || data.reportTypes || [];
    this.expertiseScore = data.expertise_score || data.expertiseScore || 0;
    this.dataSources = data.data_sources || data.dataSources || [];
    this.formulas = data.formulas || [];
    this.metadata = data.metadata || {};
    this.createdAt = data.created_at || data.createdAt || null;
    this.updatedAt = data.updated_at || data.updatedAt || null;
  }

  static fromRow(row) {
    return new DecisionProfile(row);
  }

  recordDecision(decisionType, weight = 1) {
    this.decisionPatterns[decisionType] = (this.decisionPatterns[decisionType] || 0) + weight;
    this._touch();
  }

  recordSector(sector, weight = 1) {
    this._pushWeighted(this.sectors, sector, weight);
    this._touch();
  }

  recordValuationMethod(method, weight = 1) {
    this._pushWeighted(this.valuationMethods, method, weight);
    this._touch();
  }

  recordReportType(reportType, weight = 1) {
    this._pushWeighted(this.reportTypes, reportType, weight);
    this._touch();
  }

  recordDataSource(source, weight = 1) {
    this._pushWeighted(this.dataSources, source, weight);
    this._touch();
  }

  recordFormula(formulaCode, weight = 1) {
    this._pushWeighted(this.formulas, formulaCode, weight);
    this._touch();
  }

  computeExpertise() {
    // Expertise increases with diversity and volume of decisions.
    const decisionVolume = Object.values(this.decisionPatterns).reduce((a, b) => a + b, 0);
    const diversity = Object.keys(this.decisionPatterns).length
      + new Set(this.sectors).size
      + new Set(this.valuationMethods).size
      + new Set(this.reportTypes).size;
    const score = Math.min(100, decisionVolume * 2 + diversity * 5);
    this.expertiseScore = clamp(score, 0, 100);
    return this.expertiseScore;
  }

  topDecisions(limit = 5) {
    return Object.entries(this.decisionPatterns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([type, count]) => ({ type, count }));
  }

  topSectors(limit = 3) {
    return this._topByFrequency(this.sectors, limit);
  }

  topReportTypes(limit = 3) {
    return this._topByFrequency(this.reportTypes, limit);
  }

  topDataSources(limit = 3) {
    return this._topByFrequency(this.dataSources, limit);
  }

  toJSON() {
    return {
      user_id: this.userId,
      decision_patterns: this.decisionPatterns,
      sectors: this.sectors,
      valuation_methods: this.valuationMethods,
      report_types: this.reportTypes,
      expertise_score: this.expertiseScore,
      data_sources: this.dataSources,
      formulas: this.formulas,
      metadata: this.metadata,
      created_at: this.createdAt,
      updated_at: this.updatedAt
    };
  }

  _pushWeighted(list, value, weight) {
    for (let i = 0; i < weight; i++) list.push(value);
  }

  _topByFrequency(list, limit) {
    const counts = {};
    for (const item of list) counts[item] = (counts[item] || 0) + 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([item, count]) => ({ item, count }));
  }

  _touch() {
    this.updatedAt = new Date().toISOString();
  }
}

class DecisionProfileService {
  constructor(supabase) {
    this.supabase = supabase;
  }

  async getOrCreate(userId) {
    if (!this.supabase) throw new Error('Supabase client required');
    const { data, error } = await this.supabase
      .from('bonds_decision_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    if (data) return DecisionProfile.fromRow(data);
    return new DecisionProfile({ user_id: userId });
  }

  async save(profile) {
    if (!this.supabase) throw new Error('Supabase client required');
    profile.computeExpertise();
    const row = profile.toJSON();
    const { data, error } = await this.supabase
      .from('bonds_decision_profiles')
      .upsert(row, { onConflict: 'user_id' })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return DecisionProfile.fromRow(data);
  }
}

module.exports = {
  DecisionProfile,
  DecisionProfileService
};
