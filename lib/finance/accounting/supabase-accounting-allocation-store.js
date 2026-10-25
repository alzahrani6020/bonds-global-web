'use strict';

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabaseAccountingAllocationStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('ACCOUNTING_ALLOCATION_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async configureRule(input = {}) {
    const targets = Array.isArray(input.targets) ? input.targets : null;
    if (!targets || targets.length === 0) {
      throw new Error('ACCOUNTING_ALLOCATION_TARGETS_INVALID');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_configure_allocation_rule',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_rule_code: requiredText(
          input.ruleCode,
          'ACCOUNTING_ALLOCATION_RULE_CODE_REQUIRED'
        ),
        p_name: requiredText(
          input.name,
          'ACCOUNTING_ALLOCATION_RULE_NAME_REQUIRED'
        ),
        p_source_account_id: requiredText(
          input.sourceAccountId,
          'ACCOUNTING_ALLOCATION_SOURCE_ACCOUNT_REQUIRED'
        ),
        p_source_dimensions: input.sourceDimensions || {},
        p_targets: targets,
        p_status: input.status || 'active',
        p_actor_id: requiredText(
          input.actorId,
          'ACCOUNTING_ALLOCATION_ACTOR_REQUIRED'
        ),
        p_metadata: input.metadata || {}
      }
    );

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_ALLOCATION_RULE_SAVE_FAILED'
      ));
    }
    return data;
  }

  async executeRule(input = {}) {
    const amount = Number(input.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error('ACCOUNTING_ALLOCATION_AMOUNT_INVALID');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_execute_allocation',
      {
        p_accounting_entity_id: requiredText(
          input.accountingEntityId,
          'ACCOUNTING_ENTITY_REQUIRED'
        ),
        p_rule_id: requiredText(
          input.ruleId,
          'ACCOUNTING_ALLOCATION_RULE_REQUIRED'
        ),
        p_amount: amount,
        p_effective_at: requiredText(
          input.effectiveAt,
          'ACCOUNTING_ALLOCATION_EFFECTIVE_AT_REQUIRED'
        ),
        p_request_key: requiredText(
          input.requestKey,
          'ACCOUNTING_ALLOCATION_REQUEST_KEY_REQUIRED'
        ),
        p_actor_id: requiredText(
          input.actorId,
          'ACCOUNTING_ALLOCATION_ACTOR_REQUIRED'
        )
      }
    );

    if (error) {
      throw new Error(String(
        error.message ||
        error.code ||
        'ACCOUNTING_ALLOCATION_EXECUTION_FAILED'
      ));
    }
    return data;
  }
}

module.exports = { SupabaseAccountingAllocationStore };
