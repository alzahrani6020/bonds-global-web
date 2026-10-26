'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabaseAccountingEquityStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('ACCOUNTING_EQUITY_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async configureMovementPolicy(input = {}) {
    const category = requiredText(
      input.movementCategory,
      'ACCOUNTING_EQUITY_MOVEMENT_CATEGORY_REQUIRED'
    );
    if (![
      'capital_contribution',
      'distribution',
      'other_equity'
    ].includes(category)) {
      throw new Error('ACCOUNTING_EQUITY_MOVEMENT_CATEGORY_INVALID');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_configure_equity_movement_policy',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_event_type: requiredText(
          input.eventType,
          'ACCOUNTING_EQUITY_EVENT_TYPE_REQUIRED'
        ),
        p_movement_category: category,
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
        'ACCOUNTING_EQUITY_POLICY_CONFIGURE_FAILED'
      ));
    }
    return data;
  }

  async statement(input = {}) {
    const { data, error } = await this.supabase.rpc(
      'accounting_changes_in_equity_statement_rows',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_from: requiredText(
          input.from,
          'EQUITY_FROM_REQUIRED'
        ),
        p_to: requiredText(
          input.to,
          'EQUITY_TO_REQUIRED'
        )
      }
    );

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_CHANGES_IN_EQUITY_FAILED'
      ));
    }
    return Array.isArray(data) ? data : [];
  }
}

module.exports = { SupabaseAccountingEquityStore };
