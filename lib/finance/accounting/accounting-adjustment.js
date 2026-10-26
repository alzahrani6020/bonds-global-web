'use strict';

const { createHash } = require('crypto');
const { validateBalanced } = require('./posting-engine');

const ADJUSTMENT_TYPES = Object.freeze(new Set([
  'accrual',
  'deferral',
  'reclassification',
  'correction',
  'reversal'
]));

function cleanObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function requiredText(value, code) {
  const text = String(value == null ? '' : value).trim();
  if (!text) throw new Error(code);
  return text;
}

function normalizeLine(line, index) {
  const row = cleanObject(line);
  const accountCode = requiredText(
    row.account_code || row.accountCode,
    'ACCOUNTING_ADJUSTMENT_ACCOUNT_CODE_REQUIRED'
  );
  return {
    line_no:index + 1,
    account_code:accountCode,
    account_name:String(row.account_name || row.accountName || accountCode).trim() || accountCode,
    debit:Number(row.debit || 0),
    credit:Number(row.credit || 0),
    dimensions:cleanObject(row.dimensions)
  };
}

function reverseLines(lines = []) {
  return lines.map((line, index) => ({
    line_no:index + 1,
    account_code:line.account_code,
    account_name:line.account_name || line.account_code,
    debit:Number(line.credit || 0),
    credit:Number(line.debit || 0),
    dimensions:cleanObject(line.dimensions)
  }));
}

function adjustmentFingerprint(input) {
  return createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');
}

function prepareAccountingAdjustment(input = {}, context = {}) {
  const payload = cleanObject(input);
  const accountingEntityId = requiredText(
    payload.accounting_entity_id || payload.accountingEntityId,
    'ACCOUNTING_ENTITY_REQUIRED'
  );
  const effectiveAt = requiredText(
    payload.effective_at || payload.effective_date,
    'ACCOUNTING_ADJUSTMENT_EFFECTIVE_DATE_REQUIRED'
  );
  if (Number.isNaN(Date.parse(effectiveAt))) {
    throw new Error('ACCOUNTING_ADJUSTMENT_EFFECTIVE_DATE_INVALID');
  }

  const requestKey = requiredText(
    payload.request_key || payload.requestKey || context.requestId,
    'ACCOUNTING_ADJUSTMENT_REQUEST_KEY_REQUIRED'
  );
  const adjustmentType = requiredText(
    payload.adjustment_type || payload.adjustmentType,
    'ACCOUNTING_ADJUSTMENT_TYPE_REQUIRED'
  ).toLowerCase();
  if (!ADJUSTMENT_TYPES.has(adjustmentType)) {
    throw new Error('ACCOUNTING_ADJUSTMENT_TYPE_INVALID');
  }

  const reason = requiredText(payload.reason, 'ACCOUNTING_ADJUSTMENT_REASON_REQUIRED');
  const sourceJournalId = String(
    payload.source_journal_id || payload.sourceJournalId || ''
  ).trim() || null;

  if ((adjustmentType === 'reversal' || adjustmentType === 'correction') && !sourceJournalId) {
    throw new Error('ACCOUNTING_ADJUSTMENT_SOURCE_JOURNAL_REQUIRED');
  }

  let lines;
  if (adjustmentType === 'reversal') {
    const sourceLines = Array.isArray(context.sourceJournalLines)
      ? context.sourceJournalLines.map(normalizeLine)
      : [];
    if (!sourceLines.length) {
      throw new Error('ACCOUNTING_ADJUSTMENT_SOURCE_LINES_REQUIRED');
    }
    lines = reverseLines(sourceLines);
  } else {
    lines = (Array.isArray(payload.lines) ? payload.lines : []).map(normalizeLine);
  }

  const totals = validateBalanced(lines);
  const currency = String(payload.currency || context.sourceCurrency || 'SAR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('ACCOUNTING_ADJUSTMENT_CURRENCY_INVALID');
  }

  const sourceRecordId = String(
    payload.source_record_id || payload.sourceRecordId ||
    sourceJournalId || requestKey
  ).trim() || requestKey;
  const description = String(
    payload.description || `Accounting ${adjustmentType} adjustment`
  ).trim();

  const fingerprint = adjustmentFingerprint({
    accounting_entity_id:accountingEntityId,
    effective_at:effectiveAt,
    adjustment_type:adjustmentType,
    reason,
    source_journal_id:sourceJournalId,
    currency,
    description,
    source_record_id:sourceRecordId,
    lines
  });
  const idempotencyKey = createHash('sha256')
    .update(`${accountingEntityId}:${requestKey}`)
    .digest('hex');
  const eventId = String(
    payload.event_id || payload.eventId ||
    `accounting-adjustment:${requestKey}:${fingerprint.slice(0,16)}`
  ).trim();

  const event = {
    accounting_entity_id:accountingEntityId,
    id:eventId,
    type:`accounting_adjustment_${adjustmentType}`,
    idempotency_key:idempotencyKey,
    effective_date:effectiveAt,
    amount:totals.debit,
    currency,
    source:{
      system:'bonds_accounting_adjustment',
      record_id:sourceRecordId
    },
    service_code:'accounting_adjustments',
    payload:{
      ...cleanObject(payload.payload),
      adjustment_type:adjustmentType,
      reason,
      source_journal_id:sourceJournalId,
      posting_fingerprint:fingerprint
    },
    evidence:Array.isArray(payload.evidence) ? payload.evidence : []
  };

  return {
    event,
    accounting_entity_id:accountingEntityId,
    event_id:eventId,
    event_type:event.type,
    idempotency_key:idempotencyKey,
    effective_date:effectiveAt,
    currency,
    description,
    source:event.source,
    evidence:event.evidence,
    subledger:{
      code:'accounting_adjustment',
      source_record_id:sourceRecordId,
      amount:totals.debit,
      currency
    },
    journal:{
      status:'ready_to_post',
      total_debit:totals.debit,
      total_credit:totals.credit,
      reversal_of:adjustmentType === 'reversal' ? sourceJournalId : null,
      lines
    }
  };
}

module.exports = {
  ADJUSTMENT_TYPES,
  adjustmentFingerprint,
  prepareAccountingAdjustment,
  reverseLines
};
