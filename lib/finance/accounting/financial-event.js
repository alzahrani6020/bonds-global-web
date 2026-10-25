'use strict';

const crypto = require('crypto');

const EVENT_TYPE_VALUES = Object.freeze([
  'invoice.issued',
  'payment.received',
  'service_fee.accrued',
  'expense.approved',
  'contract.signed',
  'financing.approved',
  'rent.due',
  'asset.depreciation'
]);
const EVENT_TYPE_SET = new Set(EVENT_TYPE_VALUES);

const HEX64 = /^[0-9a-f]{64}$/i;

function nonEmpty(value, code) {
  const text = String(value == null ? '' : value).trim();
  if (!text) throw new Error(code);
  return text;
}

function isoDate(value, code) {
  const text = nonEmpty(value, code);
  const ts = Date.parse(text);
  if (Number.isNaN(ts)) throw new Error(code);
  return new Date(ts).toISOString();
}

function positiveAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('FINANCIAL_EVENT_AMOUNT_INVALID');
  }
  return amount;
}

function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (value && typeof value === 'object') {
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  }
  return JSON.stringify(value);
}

function deriveIdempotencyKey(input) {
  const explicit = String(input?.idempotency_key || '').trim().toLowerCase();
  if (explicit) {
    if (!HEX64.test(explicit)) throw new Error('FINANCIAL_EVENT_IDEMPOTENCY_KEY_INVALID');
    return explicit;
  }

  const fingerprint = {
    accounting_entity_id: input?.accounting_entity_id,
    type: input?.type,
    effective_date: input?.effective_date,
    source: input?.source,
    amount: input?.amount,
    currency: input?.currency,
    payload: input?.payload || {}
  };
  return crypto.createHash('sha256').update(canonicalJson(fingerprint)).digest('hex');
}

function normalizeFinancialEvent(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('FINANCIAL_EVENT_OBJECT_REQUIRED');
  }

  const type = nonEmpty(input.type, 'FINANCIAL_EVENT_TYPE_REQUIRED');
  if (!EVENT_TYPE_SET.has(type)) throw new Error('FINANCIAL_EVENT_TYPE_UNSUPPORTED');

  const accountingEntityId = nonEmpty(
    input.accounting_entity_id,
    'FINANCIAL_EVENT_ACCOUNTING_ENTITY_REQUIRED'
  );

  const source = input.source && typeof input.source === 'object' && !Array.isArray(input.source)
    ? input.source
    : {};
  const sourceSystem = nonEmpty(source.system, 'FINANCIAL_EVENT_SOURCE_SYSTEM_REQUIRED');
  const sourceRecordId = nonEmpty(source.record_id, 'FINANCIAL_EVENT_SOURCE_RECORD_REQUIRED');

  const currency = nonEmpty(input.currency || 'SAR', 'FINANCIAL_EVENT_CURRENCY_REQUIRED').toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('FINANCIAL_EVENT_CURRENCY_INVALID');

  const payload = input.payload == null ? {} : input.payload;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('FINANCIAL_EVENT_PAYLOAD_INVALID');
  }

  const evidence = input.evidence == null ? [] : input.evidence;
  if (!Array.isArray(evidence)) throw new Error('FINANCIAL_EVENT_EVIDENCE_INVALID');

  const occurredAt = isoDate(input.occurred_at || new Date().toISOString(), 'FINANCIAL_EVENT_OCCURRED_AT_INVALID');
  const effectiveDate = isoDate(input.effective_date || occurredAt, 'FINANCIAL_EVENT_EFFECTIVE_DATE_INVALID');

  const eventId = nonEmpty(
    input.id || 'fevt_' + crypto.createHash('sha256')
      .update([accountingEntityId, type, sourceSystem, sourceRecordId, effectiveDate].join('|'))
      .digest('hex').slice(0, 24),
    'FINANCIAL_EVENT_ID_REQUIRED'
  );

  return {
    id: eventId,
    type,
    accounting_entity_id: accountingEntityId,
    occurred_at: occurredAt,
    effective_date: effectiveDate,
    amount: positiveAmount(input.amount),
    currency,
    source: {
      system: sourceSystem,
      record_id: sourceRecordId
    },
    service_code: input.service_code == null ? null : String(input.service_code).trim() || null,
    idempotency_key: deriveIdempotencyKey(input),
    payload: { ...payload },
    evidence: evidence.slice(0, 100)
  };
}

module.exports = {
  EVENT_TYPES: EVENT_TYPE_VALUES,
  canonicalJson,
  deriveIdempotencyKey,
  normalizeFinancialEvent
};
