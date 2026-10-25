'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabaseAccountingDimensionStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('ACCOUNTING_DIMENSION_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async createDimension(input = {}) {
    const type = requiredText(input.dimensionType,'ACCOUNTING_DIMENSION_TYPE_REQUIRED');
    if (!['cost_center','segment'].includes(type)) {
      throw new Error('ACCOUNTING_DIMENSION_TYPE_UNSUPPORTED');
    }

    const row = {
      accounting_entity_id:requiredText(input.accountingEntityId,'ACCOUNTING_ENTITY_REQUIRED'),
      dimension_type:type,
      code:requiredText(input.code,'ACCOUNTING_DIMENSION_CODE_REQUIRED'),
      name:requiredText(input.name,'ACCOUNTING_DIMENSION_NAME_REQUIRED'),
      parent_id:input.parentId || null,
      status:input.status || 'active',
      metadata:input.metadata || {},
      created_by:input.createdBy || null
    };

    const { data, error } = await this.supabase
      .from('accounting_dimensions')
      .insert(row)
      .select()
      .single();

    if (error) {
      throw new Error(String(
        error.message || error.code || 'ACCOUNTING_DIMENSION_CREATE_FAILED'
      ));
    }
    return data;
  }
}

module.exports = { SupabaseAccountingDimensionStore };
