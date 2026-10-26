'use strict';

const { createHash } = require('crypto');

const MAX_BANK_ROWS = 500;
const DATE_WINDOW_DAYS = 3;

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function requiredText(value, code) {
  const text = String(value == null ? '' : value).trim();
  if (!text) throw new Error(code);
  return text;
}

function normalizeDate(value) {
  const text = requiredText(value, 'BANK_RECONCILIATION_DATE_REQUIRED');
  const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s].*)?$/);
  if (!match || Number.isNaN(Date.parse(match[1] + 'T00:00:00Z'))) {
    throw new Error('BANK_RECONCILIATION_DATE_INVALID');
  }
  return match[1];
}

function normalizeMoney(value, code) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) throw new Error(code);
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function normalizeCurrency(value, fallback = 'SAR') {
  const currency = String(value || fallback || 'SAR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('BANK_RECONCILIATION_CURRENCY_INVALID');
  return currency;
}

function normalizeReference(value) {
  return String(value || '')
    .normalize('NFKC')
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function dayDistance(a, b) {
  const left = Date.parse(a + 'T00:00:00Z');
  const right = Date.parse(b + 'T00:00:00Z');
  return Math.round(Math.abs(left - right) / 86400000);
}

function fingerprint(row) {
  return createHash('sha256').update(JSON.stringify({
    source_id: row.source_id,
    bank_date: row.bank_date,
    amount: row.amount,
    currency: row.currency,
    reference: row.reference,
    description: row.description
  })).digest('hex');
}

function normalizeBankRows(rows, { requestKey, defaultCurrency = 'SAR' } = {}) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error('BANK_RECONCILIATION_ROWS_REQUIRED');
  }
  if (rows.length > MAX_BANK_ROWS) {
    throw new Error('BANK_RECONCILIATION_ROW_LIMIT_EXCEEDED');
  }
  const key = requiredText(requestKey, 'BANK_RECONCILIATION_REQUEST_KEY_REQUIRED');

  return rows.map((value, index) => {
    const row = cleanObject(value);
    const bankDate = normalizeDate(row.bank_date || row.date || row.effective_at);
    const amount = normalizeMoney(row.amount, 'BANK_RECONCILIATION_AMOUNT_INVALID');
    const currency = normalizeCurrency(row.currency, defaultCurrency);
    const reference = String(row.reference || row.bank_reference || '').trim();
    const description = String(row.description || row.memo || '').trim();
    const sourceId = String(row.source_id || row.sourceId || `${key}:${index + 1}`).trim();
    if (!sourceId || sourceId.length > 256) throw new Error('BANK_RECONCILIATION_SOURCE_ID_INVALID');

    const normalized = {
      source_id: sourceId,
      bank_date: bankDate,
      amount,
      currency,
      reference,
      normalized_reference: normalizeReference(reference),
      description
    };
    return { ...normalized, source_fingerprint: fingerprint(normalized) };
  });
}

function normalizeLedgerRows(rows = []) {
  if (!Array.isArray(rows)) throw new Error('BANK_RECONCILIATION_LEDGER_ROWS_INVALID');
  return rows.map(value => {
    const row = cleanObject(value);
    const journalEntryId = requiredText(row.journal_entry_id, 'BANK_RECONCILIATION_JOURNAL_REQUIRED');
    const journalLineId = requiredText(row.journal_line_id, 'BANK_RECONCILIATION_JOURNAL_LINE_REQUIRED');
    const effectiveDate = normalizeDate(row.effective_at || row.effective_date);
    const amount = normalizeMoney(row.amount, 'BANK_RECONCILIATION_LEDGER_AMOUNT_INVALID');
    return {
      journal_entry_id: journalEntryId,
      journal_line_id: journalLineId,
      effective_date: effectiveDate,
      amount,
      currency: normalizeCurrency(row.currency),
      reference: String(row.reference || '').trim(),
      normalized_reference: normalizeReference(row.reference),
      description: String(row.description || '').trim()
    };
  });
}

function candidateResult(bank, ledger, status, matchMethod, confidence) {
  const expected = ledger ? ledger.amount : null;
  return {
    source_type: 'bank_statement',
    source_id: bank.source_id,
    source_fingerprint: bank.source_fingerprint,
    bank_date: bank.bank_date,
    bank_reference: bank.reference || null,
    bank_description: bank.description || null,
    actual_amount: bank.amount,
    expected_amount: expected,
    variance_amount: expected == null
      ? null
      : Math.round(((bank.amount - expected) + Number.EPSILON) * 100) / 100,
    currency: bank.currency,
    status,
    match_method: matchMethod,
    match_confidence: confidence,
    candidate_journal_entry_id: ledger?.journal_entry_id || null,
    candidate_journal_line_id: ledger?.journal_line_id || null
  };
}

function reconcileBankRows({ bankRows, ledgerRows, alreadyMatchedLineIds = [] } = {}) {
  const matchedIds = new Set((alreadyMatchedLineIds || []).map(String));
  const ledger = normalizeLedgerRows(ledgerRows).filter(row => !matchedIds.has(row.journal_line_id));
  const results = [];

  for (const bank of bankRows) {
    const available = ledger.filter(row => !matchedIds.has(row.journal_line_id) && row.currency === bank.currency);
    const sameAmount = available.filter(row => row.amount === bank.amount);

    const exactReferenceAmount = bank.normalized_reference
      ? sameAmount.filter(row => row.normalized_reference && row.normalized_reference === bank.normalized_reference)
      : [];

    if (exactReferenceAmount.length === 1) {
      const candidate = exactReferenceAmount[0];
      matchedIds.add(candidate.journal_line_id);
      results.push(candidateResult(bank, candidate, 'matched', 'exact_reference_amount', 1));
      continue;
    }

    const exactAmountDate = sameAmount.filter(row => row.effective_date === bank.bank_date);
    if (exactAmountDate.length === 1) {
      const candidate = exactAmountDate[0];
      matchedIds.add(candidate.journal_line_id);
      results.push(candidateResult(bank, candidate, 'matched', 'exact_amount_date', 0.98));
      continue;
    }

    const referenceCandidates = bank.normalized_reference
      ? available.filter(row => row.normalized_reference && row.normalized_reference === bank.normalized_reference)
      : [];
    if (referenceCandidates.length === 1) {
      results.push(candidateResult(bank, referenceCandidates[0], 'variance', 'exact_reference_amount_variance', 0.9));
      continue;
    }

    const windowCandidates = sameAmount.filter(row =>
      dayDistance(row.effective_date, bank.bank_date) <= DATE_WINDOW_DAYS
    );
    if (windowCandidates.length === 1) {
      results.push(candidateResult(bank, windowCandidates[0], 'unmatched', 'probable_amount_date_window', 0.7));
      continue;
    }

    results.push(candidateResult(
      bank,
      null,
      'unmatched',
      sameAmount.length > 1 || exactReferenceAmount.length > 1 ? 'ambiguous' : 'none',
      0
    ));
  }

  return {
    rows: results,
    summary: {
      total: results.length,
      matched: results.filter(row => row.status === 'matched').length,
      variance: results.filter(row => row.status === 'variance').length,
      unmatched: results.filter(row => row.status === 'unmatched').length
    }
  };
}

module.exports = {
  MAX_BANK_ROWS,
  DATE_WINDOW_DAYS,
  normalizeReference,
  normalizeBankRows,
  normalizeLedgerRows,
  reconcileBankRows
};
