'use strict';

class SupabaseFixedAssetDepreciationStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function' || typeof supabase.rpc !== 'function') {
      throw new Error('FIXED_ASSET_DEPRECIATION_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async configurePolicy(input = {}) {
    const entityId = String(input.accountingEntityId || '').trim();
    const assetId = String(input.assetId || '').trim();
    const inServiceDate = String(input.inServiceDate || '').trim();
    const expenseAccountId = String(input.depreciationExpenseAccountId || '').trim();
    const accumulatedAccountId = String(input.accumulatedDepreciationAccountId || '').trim();

    if (!entityId) throw new Error('ACCOUNTING_ENTITY_REQUIRED');
    if (!assetId) throw new Error('FIXED_ASSET_REQUIRED');
    if (!inServiceDate || Number.isNaN(Date.parse(inServiceDate))) {
      throw new Error('FIXED_ASSET_IN_SERVICE_DATE_INVALID');
    }
    if (!expenseAccountId) throw new Error('DEPRECIATION_EXPENSE_ACCOUNT_REQUIRED');
    if (!accumulatedAccountId) throw new Error('ACCUMULATED_DEPRECIATION_ACCOUNT_REQUIRED');
    if (expenseAccountId === accumulatedAccountId) {
      throw new Error('DEPRECIATION_ACCOUNTS_MUST_DIFFER');
    }

    const depreciationMethod = input.depreciationMethod || 'straight_line';
    if (depreciationMethod !== 'straight_line') {
      throw new Error('DEPRECIATION_METHOD_UNSUPPORTED');
    }

    const prorationMethod = input.prorationMethod || 'daily_actual';
    if (!['daily_actual','full_month'].includes(prorationMethod)) {
      throw new Error('DEPRECIATION_PRORATION_UNSUPPORTED');
    }

    const row = {
      accounting_entity_id:entityId,
      asset_id:assetId,
      depreciation_method:depreciationMethod,
      proration_method:prorationMethod,
      in_service_date:inServiceDate.slice(0,10),
      depreciation_expense_account_id:expenseAccountId,
      accumulated_depreciation_account_id:accumulatedAccountId,
      status:input.status || 'active',
      metadata:input.metadata || {},
      created_by:input.createdBy || null
    };

    const { data, error } = await this.supabase
      .from('accounting_asset_depreciation_policies')
      .upsert(row, { onConflict:'accounting_entity_id,asset_id' })
      .select()
      .single();

    if (error) throw new Error(String(error.message || error.code || 'DEPRECIATION_POLICY_SAVE_FAILED'));
    return data;
  }

  async postPeriod({ accountingEntityId, assetId, periodId } = {}) {
    if (!accountingEntityId) throw new Error('ACCOUNTING_ENTITY_REQUIRED');
    if (!assetId) throw new Error('FIXED_ASSET_REQUIRED');
    if (!periodId) throw new Error('ACCOUNTING_PERIOD_REQUIRED');

    const { data, error } = await this.supabase.rpc('accounting_post_asset_depreciation', {
      p_accounting_entity_id:accountingEntityId,
      p_asset_id:assetId,
      p_period_id:periodId
    });

    if (error) throw new Error(String(error.message || error.code || 'DEPRECIATION_POST_FAILED'));
    if (!data || data.ok !== true) throw new Error('DEPRECIATION_POST_FAILED');
    return data;
  }
}

module.exports = { SupabaseFixedAssetDepreciationStore };
