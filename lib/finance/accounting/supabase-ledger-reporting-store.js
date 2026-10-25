'use strict';

function isoDateOnly(value, code) {
  const text = String(value == null ? '' : value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(code);
  return text;
}

class SupabaseLedgerReportingStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.rpc !== 'function') {
      throw new Error('LEDGER_REPORTING_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async balances({ accountingEntityId, from = null, to = null } = {}) {
    const entity = String(accountingEntityId || '').trim();
    if (!entity) throw new Error('ACCOUNTING_ENTITY_REQUIRED');
    const pFrom = from == null ? null : isoDateOnly(from, 'ACCOUNTING_REPORT_FROM_DATE_INVALID');
    const pTo = to == null ? null : isoDateOnly(to, 'ACCOUNTING_REPORT_TO_DATE_INVALID');
    if (pFrom && pTo && pFrom > pTo) throw new Error('ACCOUNTING_REPORT_DATE_RANGE_INVALID');

    const { data, error } = await this.supabase.rpc('accounting_ledger_balances', {
      p_accounting_entity_id: entity,
      p_from: pFrom,
      p_to: pTo
    });
    if (error) throw new Error(String(error.message || error.code || 'LEDGER_REPORTING_QUERY_FAILED'));
    return Array.isArray(data) ? data : [];
  }

  async statementRows({ accountingEntityId, startsOn, endsOn } = {}) {
    const start = isoDateOnly(startsOn, 'ACCOUNTING_REPORT_FROM_DATE_INVALID');
    const end = isoDateOnly(endsOn, 'ACCOUNTING_REPORT_TO_DATE_INVALID');
    if (start > end) throw new Error('ACCOUNTING_REPORT_DATE_RANGE_INVALID');

    const [balanceRows, periodRows] = await Promise.all([
      this.balances({ accountingEntityId, from:null, to:end }),
      this.balances({ accountingEntityId, from:start, to:end })
    ]);

    return { balanceRows, periodRows };
  }
}

module.exports = {
  isoDateOnly,
  SupabaseLedgerReportingStore
};
