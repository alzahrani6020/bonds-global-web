'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabaseAccountingCashFlowStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('ACCOUNTING_CASH_FLOW_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async configureCashAccount(input = {}) {
    const { data, error } = await this.supabase.rpc(
      'accounting_configure_cash_account',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_account_id: requiredText(
          input.accountId,
          'ACCOUNTING_ACCOUNT_REQUIRED'
        ),
        p_status: input.status || 'active',
        p_actor_id: requiredText(
          input.actorId,
          'ACCOUNTING_ACTOR_REQUIRED'
        )
      }
    );
    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_CASH_ACCOUNT_CONFIGURE_FAILED'
      ));
    }
    return data;
  }

  async configurePolicy(input = {}) {
    const category = requiredText(
      input.cashFlowCategory,
      'ACCOUNTING_CASH_FLOW_CATEGORY_REQUIRED'
    );
    if (!['operating','investing','financing'].includes(category)) {
      throw new Error('ACCOUNTING_CASH_FLOW_CATEGORY_INVALID');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_configure_cash_flow_policy',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_event_type: requiredText(
          input.eventType,
          'ACCOUNTING_CASH_FLOW_EVENT_TYPE_REQUIRED'
        ),
        p_cash_flow_category: category,
        p_status: input.status || 'active',
        p_actor_id: requiredText(
          input.actorId,
          'ACCOUNTING_ACTOR_REQUIRED'
        )
      }
    );
    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_CASH_FLOW_POLICY_CONFIGURE_FAILED'
      ));
    }
    return data;
  }

  async dimensionStatement(input = {}) {
    const dimensionType = requiredText(
      input.dimensionType,
      'ACCOUNTING_DIMENSION_TYPE_REQUIRED'
    );
    if (!['cost_center','segment'].includes(dimensionType)) {
      throw new Error('ACCOUNTING_DIMENSION_TYPE_UNSUPPORTED');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_dimension_cash_flow_statement_rows',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_dimension_type: dimensionType,
        p_dimension_code: input.dimensionCode
          ? String(input.dimensionCode).trim()
          : null,
        p_from: requiredText(
          input.from,
          'CASH_FLOW_FROM_REQUIRED'
        ),
        p_to: requiredText(
          input.to,
          'CASH_FLOW_TO_REQUIRED'
        )
      }
    );
    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_DIMENSION_CASH_FLOW_FAILED'
      ));
    }
    return Array.isArray(data) ? data : [];
  }
}

module.exports = { SupabaseAccountingCashFlowStore };
