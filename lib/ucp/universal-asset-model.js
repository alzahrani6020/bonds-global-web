/**
 * BONDS Universal Asset Model (UAM)
 *
 * Every asset in the platform is represented by the same model, driven by
 * metadata. No sector-specific asset tables are allowed in Core Engine.
 */

const DEFAULT_MODELS = [
  {
    code: 'uam_real_estate',
    name: 'Real Estate Asset',
    asset_class: 'real_estate',
    schema: {
      identity: ['asset_number', 'name', 'location'],
      classification: ['asset_class', 'asset_type', 'sector'],
      ownership: ['owner_id', 'ownership_type'],
      lifecycle: ['status', 'acquisition_date', 'disposal_date'],
      physical: ['area', 'unit', 'year_built', 'condition_score'],
      financial: ['book_value', 'market_value', 'rental_income'],
      operational: ['occupancy_rate', 'operating_expenses'],
      market: ['demand_index', 'price_per_unit'],
      legal: ['title_status', 'zoning'],
      risk: ['risk_grade', 'insurance_value'],
      compliance: ['permits', 'inspection_date'],
      sustainability: ['energy_rating', 'carbon_footprint']
    }
  },
  {
    code: 'uam_vehicle',
    name: 'Vehicle Asset',
    asset_class: 'vehicle',
    schema: {
      identity: ['asset_number', 'name', 'plate_number'],
      classification: ['asset_class', 'asset_type', 'sector'],
      ownership: ['owner_id', 'ownership_type'],
      lifecycle: ['status', 'purchase_date', 'sale_date'],
      physical: ['model_year', 'mileage', 'fuel_type', 'condition_score'],
      financial: ['book_value', 'market_value'],
      operational: ['annual_usage', 'maintenance_cost'],
      market: ['depreciation_rate'],
      legal: ['registration_status'],
      risk: ['risk_grade', 'insurance_value'],
      compliance: ['inspection_date'],
      sustainability: ['emission_class']
    }
  },
  {
    code: 'uam_business',
    name: 'Business / Project Asset',
    asset_class: 'business',
    schema: {
      identity: ['asset_number', 'name'],
      classification: ['asset_class', 'sector', 'activity'],
      ownership: ['owner_id', 'ownership_type'],
      lifecycle: ['status', 'start_date', 'end_date'],
      physical: ['location', 'area'],
      financial: ['revenue', 'cogs', 'operating_expenses', 'net_profit', 'market_value'],
      operational: ['employees', 'capacity'],
      market: ['market_share', 'growth_rate'],
      legal: ['license_status'],
      risk: ['risk_grade'],
      compliance: ['tax_status'],
      sustainability: ['esg_score']
    }
  }
];

class UcpAssetModel {
  constructor({ code, name, asset_class, schema, lifecycle = {}, relationships = [], version = 1, status = 'active', metadata = {} }) {
    this.code = code;
    this.name = name;
    this.asset_class = asset_class;
    this.schema = schema || {};
    this.lifecycle = lifecycle;
    this.relationships = relationships || [];
    this.version = version;
    this.status = status;
    this.metadata = metadata;
  }

  validateAttributes(attributes) {
    const errors = [];
    for (const group of Object.keys(this.schema)) {
      for (const field of this.schema[group]) {
        // Required fields are identity and lifecycle status by default
        if ((group === 'identity' || field === 'status') && (attributes[field] === undefined || attributes[field] === null)) {
          errors.push(`Missing required attribute: ${field}`);
        }
      }
    }
    return { valid: errors.length === 0, errors };
  }
}

class UcpAsset {
  constructor({ id, model, identifier, projectId, attributes = {}, relationships = [], lifecycleStatus = 'draft', version = 1, metadata = {} }) {
    this.id = id;
    this.model = model;
    this.identifier = identifier;
    this.projectId = projectId;
    this.attributes = attributes;
    this.relationships = relationships;
    this.lifecycleStatus = lifecycleStatus;
    this.version = version;
    this.metadata = metadata;
  }

  get(fieldPath) {
    const parts = fieldPath.split('.');
    let value = this.attributes;
    for (const p of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[p];
    }
    return value;
  }

  set(fieldPath, value) {
    const parts = fieldPath.split('.');
    let target = this.attributes;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!target[parts[i]]) target[parts[i]] = {};
      target = target[parts[i]];
    }
    target[parts[parts.length - 1]] = value;
  }

  validate() {
    return this.model.validateAttributes(this.attributes);
  }

  toJSON() {
    return {
      id: this.id,
      modelCode: this.model.code,
      identifier: this.identifier,
      projectId: this.projectId,
      attributes: this.attributes,
      relationships: this.relationships,
      lifecycleStatus: this.lifecycleStatus,
      version: this.version,
      metadata: this.metadata
    };
  }

  static fromJSON(json, modelRegistry) {
    const model = modelRegistry.get(json.modelCode);
    return new UcpAsset({ ...json, model });
  }
}

class UniversalAssetModelRegistry {
  constructor({ models = [], preferStatic = false } = {}) {
    this.models = new Map();
    if (preferStatic || models.length === 0) {
      for (const m of DEFAULT_MODELS) this.register(new UcpAssetModel(m));
    }
    for (const m of models) this.register(new UcpAssetModel(m));
  }

  static async fromSupabase(supabase) {
    const { data, error } = await supabase.from('ucp_asset_models').select('*');
    if (error) throw error;
    return new UniversalAssetModelRegistry({ models: data || [] });
  }

  register(model) {
    if (!model || !model.code) throw new Error('Asset model must have code');
    this.models.set(model.code, model);
  }

  get(code) { return this.models.get(code); }
  list() { return Array.from(this.models.values()); }
  findByClass(assetClass) { return this.list().filter(m => m.asset_class === assetClass); }
}

module.exports = {
  UcpAssetModel,
  UcpAsset,
  UniversalAssetModelRegistry,
  DEFAULT_MODELS
};
