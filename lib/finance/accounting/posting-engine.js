'use strict';

const { normalizeFinancialEvent } = require('./financial-event');
const { createDefaultPolicyRegistry } = require('./accounting-policy');

function money(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) throw new Error('POSTING_AMOUNT_INVALID');
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

function validateBalanced(lines = []) {
  if (!Array.isArray(lines) || lines.length < 2) throw new Error('JOURNAL_LINES_REQUIRED');
  let debit = 0;
  let credit = 0;
  for (const line of lines) {
    const d = money(line.debit || 0);
    const c = money(line.credit || 0);
    if (d < 0 || c < 0) throw new Error('JOURNAL_LINE_NEGATIVE_FORBIDDEN');
    if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
      throw new Error('JOURNAL_LINE_ONE_SIDED_REQUIRED');
    }
    debit += d;
    credit += c;
  }
  debit = money(debit);
  credit = money(credit);
  if (debit !== credit) throw new Error('JOURNAL_NOT_BALANCED');
  return { debit, credit };
}

function buildPosting(eventInput, { policyRegistry = createDefaultPolicyRegistry() } = {}) {
  const event = normalizeFinancialEvent(eventInput);
  const rule = policyRegistry.resolve(event);
  const amount = money(event.amount);

  const lines = [
    {
      line_no: 1,
      account_code: rule.debit_account.code,
      account_name: rule.debit_account.name,
      debit: amount,
      credit: 0
    },
    {
      line_no: 2,
      account_code: rule.credit_account.code,
      account_name: rule.credit_account.name,
      debit: 0,
      credit: amount
    }
  ];

  const totals = validateBalanced(lines);

  return {
    accounting_entity_id: event.accounting_entity_id,
    event_id: event.id,
    event_type: event.type,
    idempotency_key: event.idempotency_key,
    effective_date: event.effective_date,
    currency: event.currency,
    description: rule.description,
    source: event.source,
    evidence: event.evidence,
    subledger: {
      code: event.type,
      source_record_id: event.source.record_id,
      amount,
      currency: event.currency
    },
    journal: {
      status: 'ready_to_post',
      total_debit: totals.debit,
      total_credit: totals.credit,
      lines
    }
  };
}

async function postFinancialEvent({
  event,
  store,
  policyRegistry = createDefaultPolicyRegistry()
} = {}) {
  if (!store || typeof store.claimEvent !== 'function' || typeof store.commitPosting !== 'function') {
    throw new Error('POSTING_STORE_REQUIRED');
  }

  const posting = buildPosting(event, { policyRegistry });
  const claim = await store.claimEvent({
    accounting_entity_id: posting.accounting_entity_id,
    event_id: posting.event_id,
    idempotency_key: posting.idempotency_key
  });

  if (!claim || typeof claim !== 'object') throw new Error('POSTING_CLAIM_INVALID');
  if (claim.state === 'replayed' && claim.posting) {
    return { ...claim.posting, replayed: true };
  }
  if (claim.state !== 'claimed') {
    throw new Error(claim.state === 'conflict' ? 'POSTING_IDEMPOTENCY_CONFLICT' : 'POSTING_CLAIM_REJECTED');
  }

  const committed = await store.commitPosting(posting);
  if (!committed || committed.ok !== true) throw new Error('POSTING_COMMIT_FAILED');

  return {
    ...posting,
    posting_id: committed.posting_id || null,
    replayed: false
  };
}

module.exports = {
  money,
  validateBalanced,
  buildPosting,
  postFinancialEvent
};
