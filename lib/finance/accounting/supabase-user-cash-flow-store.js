'use strict';

function isoDate(value, code) {
  const text = String(value == null ? '' : value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(code);
  return text;
}

class SupabaseUserCashFlowStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('USER_CASH_FLOW_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async reportInputs({ accountingEntityId, startsOn, endsOn } = {}) {
    const entity = String(accountingEntityId || '').trim();
    if (!entity) throw new Error('ACCOUNTING_ENTITY_REQUIRED');

    const start = isoDate(startsOn, 'CASH_FLOW_FROM_DATE_INVALID');
    const end = isoDate(endsOn, 'CASH_FLOW_TO_DATE_INVALID');
    if (start > end) throw new Error('CASH_FLOW_DATE_RANGE_INVALID');

    const [balanceResult, movementResult] = await Promise.all([
      this.supabase.rpc('accounting_user_cash_balance', {
        p_accounting_entity_id: entity,
        p_before: start
      }),
      this.supabase.rpc('accounting_user_cash_flow_movements', {
        p_accounting_entity_id: entity,
        p_from: start,
        p_to: end
      })
    ]);

    if (balanceResult?.error) {
      throw new Error(String(balanceResult.error.message || balanceResult.error.code || 'CASH_FLOW_BALANCE_QUERY_FAILED'));
    }
    if (movementResult?.error) {
      throw new Error(String(movementResult.error.message || movementResult.error.code || 'CASH_FLOW_MOVEMENTS_QUERY_FAILED'));
    }

    const openingBalance = Number(balanceResult?.data ?? 0);
    if (!Number.isFinite(openingBalance)) throw new Error('CASH_FLOW_OPENING_BALANCE_INVALID');

    return {
      opening_balance: openingBalance,
      movements: Array.isArray(movementResult?.data) ? movementResult.data : []
    };
  }
}

module.exports = {
  isoDate,
  SupabaseUserCashFlowStore
};
