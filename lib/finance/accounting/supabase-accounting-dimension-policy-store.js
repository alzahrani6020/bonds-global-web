'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabaseAccountingDimensionPolicyStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('ACCOUNTING_DIMENSION_POLICY_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async configurePolicy(input = {}) {
    const dimensionType = requiredText(
      input.dimensionType,
      'ACCOUNTING_DIMENSION_POLICY_TYPE_REQUIRED'
    );
    if (!['cost_center','segment'].includes(dimensionType)) {
      throw new Error('ACCOUNTING_DIMENSION_POLICY_TYPE_UNSUPPORTED');
    }

    const status = input.status || 'active';
    if (!['active','inactive'].includes(status)) {
      throw new Error('ACCOUNTING_DIMENSION_POLICY_STATUS_INVALID');
    }

    const row = {
      accounting_entity_id:requiredText(
        input.accountingEntityId,
        'ACCOUNTING_ENTITY_REQUIRED'
      ),
      account_id:requiredText(
        input.accountId,
        'ACCOUNTING_ACCOUNT_REQUIRED'
      ),
      dimension_type:dimensionType,
      required:input.required !== false,
      status,
      metadata:input.metadata || {},
      created_by:input.createdBy || null,
      updated_at:new Date().toISOString()
    };

    const { data, error } = await this.supabase
      .from('accounting_account_dimension_policies')
      .upsert(row, {
        onConflict:'accounting_entity_id,account_id,dimension_type'
      })
      .select()
      .single();

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_DIMENSION_POLICY_SAVE_FAILED'
      ));
    }
    return data;
  }
}

module.exports = { SupabaseAccountingDimensionPolicyStore };
