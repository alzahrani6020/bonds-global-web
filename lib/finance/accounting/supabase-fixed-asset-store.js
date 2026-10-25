'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabaseFixedAssetStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function') throw new Error('FIXED_ASSET_DATABASE_REQUIRED');
    this.supabase = supabase;
  }

  async createProfile(input = {}) {
    const row = {
      accounting_entity_id:requiredText(input.accountingEntityId,'FIXED_ASSET_ACCOUNTING_ENTITY_REQUIRED'),
      asset_id:requiredText(input.assetId,'FIXED_ASSET_ID_REQUIRED'),
      depreciation_method:'straight_line',
      in_service_date:requiredText(input.inServiceDate,'FIXED_ASSET_IN_SERVICE_DATE_REQUIRED'),
      useful_life_months:Number(input.usefulLifeMonths),
      residual_value:Number(input.residualValue || 0),
      depreciation_expense_account_code:requiredText(input.depreciationExpenseAccountCode,'FIXED_ASSET_EXPENSE_ACCOUNT_REQUIRED'),
      accumulated_depreciation_account_code:requiredText(input.accumulatedDepreciationAccountCode,'FIXED_ASSET_ACCUMULATED_ACCOUNT_REQUIRED'),
      status:input.status || 'active',
      metadata:input.metadata || {},
      created_by:input.createdBy || null
    };
    if (!Number.isInteger(row.useful_life_months) || row.useful_life_months <= 0) throw new Error('FIXED_ASSET_USEFUL_LIFE_INVALID');
    if (!Number.isFinite(row.residual_value) || row.residual_value < 0) throw new Error('FIXED_ASSET_RESIDUAL_VALUE_INVALID');
    if (row.depreciation_expense_account_code === row.accumulated_depreciation_account_code) throw new Error('FIXED_ASSET_SAME_ACCOUNT_FORBIDDEN');
    const { data, error } = await this.supabase.from('accounting_fixed_asset_profiles').insert(row).select().single();
    if (error) throw new Error(String(error.message || error.code || 'FIXED_ASSET_PROFILE_CREATE_FAILED'));
    return data;
  }
}

module.exports = { SupabaseFixedAssetStore };