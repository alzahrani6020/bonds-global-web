'use strict';

const ACCOUNT_TYPES = new Set([
  'asset','liability','equity','revenue','expense',
  'contra_asset','contra_liability','contra_equity','contra_revenue','contra_expense'
]);

function requiredText(value, code, max = 200) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  if (out.length > max) throw new Error(code + '_TOO_LONG');
  return out;
}

class SupabaseAccountingAccountStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('ACCOUNTING_ACCOUNT_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async createAccount(input = {}) {
    const accountingEntityId = requiredText(input.accountingEntityId, 'ACCOUNTING_ENTITY_REQUIRED', 80);
    const code = requiredText(input.code, 'ACCOUNTING_ACCOUNT_CODE_REQUIRED', 64);
    const name = requiredText(input.name, 'ACCOUNTING_ACCOUNT_NAME_REQUIRED', 200);
    const accountType = requiredText(input.accountType, 'ACCOUNTING_ACCOUNT_TYPE_REQUIRED', 40).toLowerCase();
    if (!ACCOUNT_TYPES.has(accountType)) throw new Error('ACCOUNTING_ACCOUNT_TYPE_INVALID');

    const { data: existing, error: readError } = await this.supabase
      .from('accounting_accounts')
      .select('id,accounting_entity_id,code,name,account_type,parent_id,is_postable,is_active,metadata')
      .eq('accounting_entity_id', accountingEntityId)
      .eq('code', code)
      .maybeSingle();

    if (readError) throw new Error(String(readError.message || readError.code || 'ACCOUNTING_ACCOUNT_READ_FAILED'));
    if (existing) {
      if (
        existing.name === name &&
        existing.account_type === accountType &&
        String(existing.parent_id || '') === String(input.parentId || '') &&
        existing.is_postable === (input.isPostable !== false)
      ) {
        return { account: existing, state: 'replayed' };
      }
      throw new Error('ACCOUNTING_ACCOUNT_CODE_CONFLICT');
    }

    if (input.parentId) {
      const { data: parent, error: parentError } = await this.supabase
        .from('accounting_accounts')
        .select('id')
        .eq('id', input.parentId)
        .eq('accounting_entity_id', accountingEntityId)
        .maybeSingle();
      if (parentError) throw new Error(String(parentError.message || parentError.code || 'ACCOUNTING_ACCOUNT_PARENT_READ_FAILED'));
      if (!parent) throw new Error('ACCOUNTING_ACCOUNT_PARENT_INVALID');
    }

    const row = {
      accounting_entity_id: accountingEntityId,
      code,
      name,
      account_type: accountType,
      parent_id: input.parentId || null,
      is_postable: input.isPostable !== false,
      is_active: input.isActive !== false,
      metadata: input.metadata || {}
    };

    const { data, error } = await this.supabase
      .from('accounting_accounts')
      .insert(row)
      .select('id,accounting_entity_id,code,name,account_type,parent_id,is_postable,is_active,metadata')
      .single();

    if (error) throw new Error(String(error.message || error.code || 'ACCOUNTING_ACCOUNT_CREATE_FAILED'));
    return { account: data, state: 'created' };
  }
}

module.exports = { SupabaseAccountingAccountStore, ACCOUNT_TYPES };
