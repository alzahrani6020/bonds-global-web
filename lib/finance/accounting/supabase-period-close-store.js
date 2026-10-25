'use strict';

const ALLOWED_ACTIONS = new Set(['soft_close','close','reopen']);

function requiredText(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

class SupabasePeriodCloseStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('ACCOUNTING_PERIOD_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async transition({
    accountingEntityId,
    periodId,
    action,
    actorUserId,
    reason = null,
    metadata = {}
  } = {}) {
    const entityId = requiredText(
      accountingEntityId,
      'ACCOUNTING_ENTITY_REQUIRED'
    );
    const targetPeriodId = requiredText(
      periodId,
      'ACCOUNTING_PERIOD_REQUIRED'
    );
    const actorId = requiredText(
      actorUserId,
      'ACCOUNTING_PERIOD_ACTOR_REQUIRED'
    );
    const normalizedAction = requiredText(
      action,
      'ACCOUNTING_PERIOD_ACTION_REQUIRED'
    );

    if (!ALLOWED_ACTIONS.has(normalizedAction)) {
      throw new Error('ACCOUNTING_PERIOD_ACTION_UNSUPPORTED');
    }

    const normalizedReason = reason == null ? null : String(reason).trim() || null;
    if (normalizedAction === 'reopen' && !normalizedReason) {
      throw new Error('ACCOUNTING_PERIOD_REOPEN_REASON_REQUIRED');
    }

    const { data, error } = await this.supabase.rpc(
      'accounting_transition_period',
      {
        p_accounting_entity_id:entityId,
        p_period_id:targetPeriodId,
        p_action:normalizedAction,
        p_actor_user_id:actorId,
        p_reason:normalizedReason,
        p_metadata:metadata && typeof metadata === 'object' && !Array.isArray(metadata)
          ? metadata
          : {}
      }
    );

    if (error) {
      throw new Error(String(
        error.message || error.code || 'ACCOUNTING_PERIOD_TRANSITION_FAILED'
      ));
    }
    if (!data || data.ok !== true) {
      throw new Error('ACCOUNTING_PERIOD_TRANSITION_FAILED');
    }
    return data;
  }

  softClose(input = {}) {
    return this.transition({ ...input, action:'soft_close' });
  }

  close(input = {}) {
    return this.transition({ ...input, action:'close' });
  }

  reopen(input = {}) {
    return this.transition({ ...input, action:'reopen' });
  }
}

module.exports = {
  ALLOWED_ACTIONS,
  SupabasePeriodCloseStore
};
