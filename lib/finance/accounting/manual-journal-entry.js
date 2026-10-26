'use strict';

const { createHash } = require('crypto');
const { validateBalanced } = require('./posting-engine');

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
    'ACCOUNTING_JOURNAL_ACCOUNT_CODE_REQUIRED'
  );
  const debit = Number(row.debit || 0);
  const credit = Number(row.credit || 0);

  return {
    line_no:index + 1,
    account_code:accountCode,
    account_name:String(
      row.account_name || row.accountName || accountCode
    ).trim() || accountCode,
    debit,
    credit,
    dimensions:cleanObject(row.dimensions)
  };
}

function postingFingerprint({
  accountingEntityId,
  effectiveAt,
  currency,
  description,
  sourceRecordId,
  lines
}) {
  return createHash('sha256')
    .update(JSON.stringify({
      accounting_entity_id:accountingEntityId,
      effective_at:effectiveAt,
      currency,
      description,
      source_record_id:sourceRecordId,
      lines
    }))
    .digest('hex');
}

function prepareManualJournalEntry(input = {}, context = {}) {
  const payload = cleanObject(input);
  const accountingEntityId = requiredText(
    payload.accounting_entity_id || payload.accountingEntityId,
    'ACCOUNTING_ENTITY_REQUIRED'
  );
  const effectiveAt = requiredText(
    payload.effective_at || payload.effective_date,
    'ACCOUNTING_JOURNAL_EFFECTIVE_DATE_REQUIRED'
  );
  if (Number.isNaN(Date.parse(effectiveAt))) {
    throw new Error('ACCOUNTING_JOURNAL_EFFECTIVE_DATE_INVALID');
  }

  const requestKey = requiredText(
    payload.request_key || payload.requestKey || context.requestId,
    'ACCOUNTING_JOURNAL_REQUEST_KEY_REQUIRED'
  );
  const sourceRecordId = String(
    payload.source_record_id || payload.sourceRecordId || requestKey
  ).trim() || requestKey;

  const lines = (Array.isArray(payload.lines) ? payload.lines : [])
    .map(normalizeLine);
  const totals = validateBalanced(lines);

  const currency = String(payload.currency || 'SAR').trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error('ACCOUNTING_JOURNAL_CURRENCY_INVALID');
  }

  const description = String(
    payload.description || 'Manual journal entry'
  ).trim() || 'Manual journal entry';

  const fingerprint = postingFingerprint({
    accountingEntityId,
    effectiveAt,
    currency,
    description,
    sourceRecordId,
    lines
  });

  const eventId = String(
    payload.event_id || payload.eventId ||
    `manual-journal:${requestKey}:${fingerprint.slice(0,16)}`
  ).trim();

  const idempotencyKey = createHash('sha256')
    .update(`${accountingEntityId}:${requestKey}`)
    .digest('hex');

  const event = {
    accounting_entity_id:accountingEntityId,
    id:eventId,
    type:'manual_journal_entry',
    idempotency_key:idempotencyKey,
    effective_date:effectiveAt,
    amount:totals.debit,
    currency,
    source:{
      system:'bonds_manual_journal',
      record_id:sourceRecordId
    },
    service_code:'daily_journal_entries',
    payload:{
      ...cleanObject(payload.payload),
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
      code:'manual_journal',
      source_record_id:sourceRecordId,
      amount:totals.debit,
      currency
    },
    journal:{
      status:'ready_to_post',
      total_debit:totals.debit,
      total_credit:totals.credit,
      lines
    }
  };
}

module.exports = {
  postingFingerprint,
  prepareManualJournalEntry
};
