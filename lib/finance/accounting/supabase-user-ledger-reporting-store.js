'use strict';

function requireIsoDate(value, code) {
  const text = String(value == null ? '' : value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(code);
  return text;
}

class SupabaseUserLedgerReportingStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('USER_LEDGER_REPORTING_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async balances({ accountingEntityId, from = null, to = null } = {}) {
    const entity = String(accountingEntityId || '').trim();
    if (!entity) throw new Error('ACCOUNTING_ENTITY_REQUIRED');

    const pFrom = from == null ? null : requireIsoDate(from, 'ACCOUNTING_REPORT_FROM_DATE_INVALID');
    const pTo = to == null ? null : requireIsoDate(to, 'ACCOUNTING_REPORT_TO_DATE_INVALID');

    if (pFrom && pTo && pFrom > pTo) {
      throw new Error('ACCOUNTING_REPORT_DATE_RANGE_INVALID');
    }

    const { data, error } = await this.supabase.rpc('accounting_user_ledger_balances', {
      p_accounting_entity_id: entity,
      p_from: pFrom,
      p_to: pTo
    });

    if (error) {
      const message = String(error.message || error.code || 'USER_LEDGER_REPORTING_QUERY_FAILED');
      if (message.includes('ACCOUNTING_ENTITY_ACCESS_DENIED')) {
        throw new Error('ACCOUNTING_ENTITY_ACCESS_DENIED');
      }
      if (message.includes('AUTHENTICATION_REQUIRED')) {
        throw new Error('AUTHENTICATION_REQUIRED');
      }
      throw new Error(message);
    }

    return Array.isArray(data) ? data : [];
  }

  async statementRows({ accountingEntityId, startsOn, endsOn } = {}) {
    const start = requireIsoDate(startsOn, 'ACCOUNTING_REPORT_FROM_DATE_INVALID');
    const end = requireIsoDate(endsOn, 'ACCOUNTING_REPORT_TO_DATE_INVALID');

    if (start > end) throw new Error('ACCOUNTING_REPORT_DATE_RANGE_INVALID');

    const [balanceRows, periodRows] = await Promise.all([
      this.balances({ accountingEntityId, from:null, to:end }),
      this.balances({ accountingEntityId, from:start, to:end })
    ]);

    return { balanceRows, periodRows };
  }
}

module.exports = {
  requireIsoDate,
  SupabaseUserLedgerReportingStore
};
