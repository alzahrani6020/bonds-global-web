'use strict';

function requireText(value, code) {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error(code);
  return normalized;
}

function optionalMoney(value, code) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new Error(code);
  return number;
}

class SupabaseAssetCollateralStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('ASSET_COLLATERAL_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async createAsset(input = {}) {
    const accountingEntityId = requireText(
      input.accountingEntityId,
      'ASSET_ACCOUNTING_ENTITY_REQUIRED'
    );
    const assetNumber = requireText(input.assetNumber, 'ASSET_NUMBER_REQUIRED');
    const assetClass = requireText(input.assetClass, 'ASSET_CLASS_REQUIRED');

    const row = {
      accounting_entity_id:accountingEntityId,
      asset_number:assetNumber,
      asset_class:assetClass,
      asset_type:input.assetType || null,
      project_id:input.projectId || null,
      location:input.location || null,
      area:optionalMoney(input.area, 'ASSET_AREA_INVALID'),
      market_value:optionalMoney(input.marketValue, 'ASSET_MARKET_VALUE_INVALID'),
      acquisition_date:input.acquisitionDate || null,
      acquisition_cost:optionalMoney(input.acquisitionCost, 'ASSET_ACQUISITION_COST_INVALID'),
      currency:String(input.currency || 'SAR').toUpperCase(),
      useful_life_months:input.usefulLifeMonths == null ? null : Number(input.usefulLifeMonths),
      residual_value:optionalMoney(input.residualValue, 'ASSET_RESIDUAL_VALUE_INVALID'),
      lifecycle_status:input.lifecycleStatus || 'active',
      metadata:input.metadata || {}
    };

    if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error('ASSET_CURRENCY_INVALID');
    if (row.useful_life_months !== null &&
        (!Number.isInteger(row.useful_life_months) || row.useful_life_months <= 0)) {
      throw new Error('ASSET_USEFUL_LIFE_INVALID');
    }

    const { data, error } = await this.supabase
      .from('bonds_assets')
      .insert(row)
      .select()
      .single();

    if (error) throw new Error(String(error.message || error.code || 'ASSET_CREATE_FAILED'));
    return data;
  }

  async assignCollateral(input = {}) {
    const accountingEntityId = requireText(
      input.accountingEntityId,
      'COLLATERAL_ACCOUNTING_ENTITY_REQUIRED'
    );
    const assetId = requireText(input.assetId, 'COLLATERAL_ASSET_REQUIRED');

    const row = {
      accounting_entity_id:accountingEntityId,
      asset_id:assetId,
      status:input.status || 'proposed',
      secured_amount:optionalMoney(input.securedAmount, 'COLLATERAL_SECURED_AMOUNT_INVALID'),
      collateral_value:optionalMoney(input.collateralValue, 'COLLATERAL_VALUE_INVALID'),
      currency:String(input.currency || 'SAR').toUpperCase(),
      priority:input.priority == null ? null : Number(input.priority),
      lien_holder:input.lienHolder || null,
      agreement_reference:input.agreementReference || null,
      valid_from:input.validFrom || null,
      valid_to:input.validTo || null,
      metadata:input.metadata || {},
      created_by:input.createdBy || null
    };

    if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error('COLLATERAL_CURRENCY_INVALID');
    if (row.priority !== null &&
        (!Number.isInteger(row.priority) || row.priority <= 0)) {
      throw new Error('COLLATERAL_PRIORITY_INVALID');
    }
    if (row.valid_from && row.valid_to && row.valid_from > row.valid_to) {
      throw new Error('COLLATERAL_DATE_RANGE_INVALID');
    }

    const { data, error } = await this.supabase
      .from('asset_collateral_assignments')
      .insert(row)
      .select()
      .single();

    if (error) {
      const message = String(error.message || error.code || 'COLLATERAL_ASSIGNMENT_FAILED');
      throw new Error(message);
    }
    return data;
  }
}

module.exports = { SupabaseAssetCollateralStore };
