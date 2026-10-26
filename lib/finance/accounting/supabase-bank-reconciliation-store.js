'use strict';

const TERMINAL_STATUSES = new Set(['matched','resolved','ignored']);

function requiredText(value, code) {
  const text = String(value == null ? '' : value).trim();
  if (!text) throw new Error(code);
  return text;
}

function dateOnly(value, code) {
  const text = requiredText(value, code);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(code);
  return text;
}

class SupabaseBankReconciliationStore {
  constructor(supabase) {
    if (!supabase || typeof supabase.from !== 'function') {
      throw new Error('BANK_RECONCILIATION_DATABASE_REQUIRED');
    }
    this.supabase = supabase;
  }

  async loadLedgerCandidates({ accountingEntityId, from, to } = {}) {
    const entityId = requiredText(accountingEntityId, 'ACCOUNTING_ENTITY_REQUIRED');
    const startsOn = dateOnly(from, 'BANK_RECONCILIATION_FROM_DATE_INVALID');
    const endsOn = dateOnly(to, 'BANK_RECONCILIATION_TO_DATE_INVALID');
    if (startsOn > endsOn) throw new Error('BANK_RECONCILIATION_DATE_RANGE_INVALID');

    const cashResult = await this.supabase
      .from('accounting_cash_accounts')
      .select('account_id')
      .eq('accounting_entity_id', entityId)
      .eq('status', 'active');

    if (cashResult.error) {
      throw new Error(String(cashResult.error.message || 'BANK_RECONCILIATION_CASH_ACCOUNTS_READ_FAILED'));
    }

    const cashAccountIds = (cashResult.data || []).map(row => row.account_id).filter(Boolean);
    if (!cashAccountIds.length) return [];

    const linesResult = await this.supabase
      .from('accounting_journal_lines')
      .select('id,journal_entry_id,account_id,account_code,account_name,debit,credit')
      .eq('accounting_entity_id', entityId)
      .in('account_id', cashAccountIds);

    if (linesResult.error) {
      throw new Error(String(linesResult.error.message || 'BANK_RECONCILIATION_LINES_READ_FAILED'));
    }

    const lines = linesResult.data || [];
    const journalIds = [...new Set(lines.map(row => row.journal_entry_id).filter(Boolean))];
    if (!journalIds.length) return [];

    const journalsResult = await this.supabase
      .from('accounting_journal_entries')
      .select('id,financial_event_id,effective_at,currency,description,status,metadata')
      .eq('accounting_entity_id', entityId)
      .eq('status', 'posted')
      .gte('effective_at', startsOn + 'T00:00:00Z')
      .lte('effective_at', endsOn + 'T23:59:59.999Z')
      .in('id', journalIds);

    if (journalsResult.error) {
      throw new Error(String(journalsResult.error.message || 'BANK_RECONCILIATION_JOURNALS_READ_FAILED'));
    }

    const journals = journalsResult.data || [];
    const eventIds = [...new Set(journals.map(row => row.financial_event_id).filter(Boolean))];

    let events = [];
    if (eventIds.length) {
      const eventsResult = await this.supabase
        .from('financial_events')
        .select('id,event_key,source_record_id')
        .eq('accounting_entity_id', entityId)
        .in('id', eventIds);

      if (eventsResult.error) {
        throw new Error(String(eventsResult.error.message || 'BANK_RECONCILIATION_EVENTS_READ_FAILED'));
      }
      events = eventsResult.data || [];
    }

    const journalById = new Map(journals.map(row => [row.id, row]));
    const eventById = new Map(events.map(row => [row.id, row]));

    return lines.flatMap(line => {
      const journal = journalById.get(line.journal_entry_id);
      if (!journal) return [];
      const event = eventById.get(journal.financial_event_id) || {};
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      const amount = Math.round(((debit - credit) + Number.EPSILON) * 100) / 100;
      if (!Number.isFinite(amount) || amount === 0) return [];

      return [{
        journal_entry_id: journal.id,
        journal_line_id: line.id,
        effective_at: String(journal.effective_at || '').slice(0,10),
        amount,
        currency: journal.currency,
        reference: event.source_record_id || event.event_key || journal.metadata?.event_key || '',
        description: journal.description || ''
      }];
    });
  }

  async matchedLineIds(accountingEntityId) {
    const entityId = requiredText(accountingEntityId, 'ACCOUNTING_ENTITY_REQUIRED');
    const result = await this.supabase
      .from('finance_reconciliation_items')
      .select('journal_line_id')
      .eq('accounting_entity_id', entityId)
      .eq('status', 'matched')
      .not('journal_line_id', 'is', null);

    if (result.error) {
      throw new Error(String(result.error.message || 'BANK_RECONCILIATION_MATCHES_READ_FAILED'));
    }
    return (result.data || []).map(row => row.journal_line_id).filter(Boolean);
  }

  async persist({ accountingEntityId, rows } = {}) {
    const entityId = requiredText(accountingEntityId, 'ACCOUNTING_ENTITY_REQUIRED');
    if (!Array.isArray(rows) || !rows.length) return [];

    const sourceIds = rows.map(row => row.source_id);
    const existingResult = await this.supabase
      .from('finance_reconciliation_items')
      .select('id,source_id,source_fingerprint,status')
      .eq('accounting_entity_id', entityId)
      .eq('source_type', 'bank_statement')
      .in('source_id', sourceIds);

    if (existingResult.error) {
      throw new Error(String(existingResult.error.message || 'BANK_RECONCILIATION_EXISTING_READ_FAILED'));
    }

    const existing = new Map((existingResult.data || []).map(row => [row.source_id, row]));
    const mutable = [];

    for (const row of rows) {
      const current = existing.get(row.source_id);
      if (current && current.source_fingerprint && current.source_fingerprint !== row.source_fingerprint) {
        throw new Error('BANK_RECONCILIATION_SOURCE_CONFLICT');
      }
      if (current && TERMINAL_STATUSES.has(current.status)) continue;

      mutable.push({
        accounting_entity_id: entityId,
        source_type: 'bank_statement',
        source_id: row.source_id,
        source_fingerprint: row.source_fingerprint,
        bank_date: row.bank_date,
        bank_reference: row.bank_reference,
        bank_description: row.bank_description,
        actual_amount: row.actual_amount,
        expected_amount: row.expected_amount,
        variance_amount: row.variance_amount,
        currency: row.currency,
        status: row.status,
        match_method: row.match_method,
        match_confidence: row.match_confidence,
        journal_entry_id: row.candidate_journal_entry_id,
        journal_line_id: row.candidate_journal_line_id,
        updated_at: new Date().toISOString()
      });
    }

    if (mutable.length) {
      const upsertResult = await this.supabase
        .from('finance_reconciliation_items')
        .upsert(mutable, { onConflict: 'accounting_entity_id,source_type,source_id' });

      if (upsertResult.error) {
        throw new Error(String(upsertResult.error.message || 'BANK_RECONCILIATION_SAVE_FAILED'));
      }
    }

    const finalResult = await this.supabase
      .from('finance_reconciliation_items')
      .select('*')
      .eq('accounting_entity_id', entityId)
      .eq('source_type', 'bank_statement')
      .in('source_id', sourceIds)
      .order('bank_date', { ascending: true });

    if (finalResult.error) {
      throw new Error(String(finalResult.error.message || 'BANK_RECONCILIATION_RESULT_READ_FAILED'));
    }
    return finalResult.data || [];
  }
}

module.exports = {
  TERMINAL_STATUSES,
  SupabaseBankReconciliationStore
};
