'use strict';

const ALLOWED_SIDES = new Set(['debit', 'credit']);

function text(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

function normalizeAccount(account, side) {
  if (!account || typeof account !== 'object' || Array.isArray(account)) {
    throw new Error('ACCOUNTING_POLICY_ACCOUNT_REQUIRED');
  }
  const code = text(account.code, 'ACCOUNTING_POLICY_ACCOUNT_CODE_REQUIRED');
  const name = text(account.name || code, 'ACCOUNTING_POLICY_ACCOUNT_NAME_REQUIRED');
  if (!ALLOWED_SIDES.has(side)) throw new Error('ACCOUNTING_POLICY_SIDE_INVALID');
  return { code, name, side };
}

function normalizeRule(rule = {}) {
  const eventType = text(rule.event_type, 'ACCOUNTING_POLICY_EVENT_TYPE_REQUIRED');
  const debit = normalizeAccount(rule.debit_account, 'debit');
  const credit = normalizeAccount(rule.credit_account, 'credit');

  if (debit.code === credit.code) {
    throw new Error('ACCOUNTING_POLICY_SAME_ACCOUNT_FORBIDDEN');
  }

  return Object.freeze({
    event_type: eventType,
    debit_account: debit,
    credit_account: credit,
    description: String(rule.description || eventType).trim(),
    service_code: rule.service_code == null ? null : String(rule.service_code).trim() || null
  });
}

class AccountingPolicyRegistry {
  constructor(rules = []) {
    this.rules = new Map();
    for (const rule of rules) this.register(rule);
  }

  register(rule) {
    const normalized = normalizeRule(rule);
    const key = this._key(normalized.event_type, normalized.service_code);
    if (this.rules.has(key)) throw new Error('ACCOUNTING_POLICY_DUPLICATE_RULE');
    this.rules.set(key, normalized);
    return normalized;
  }

  resolve(event) {
    const eventType = text(event?.type, 'ACCOUNTING_POLICY_EVENT_TYPE_REQUIRED');
    const serviceCode = event?.service_code == null ? null : String(event.service_code).trim() || null;
    const specific = this.rules.get(this._key(eventType, serviceCode));
    const generic = this.rules.get(this._key(eventType, null));
    const rule = specific || generic;
    if (!rule) throw new Error('ACCOUNTING_POLICY_RULE_NOT_FOUND');
    return rule;
  }

  _key(eventType, serviceCode) {
    return eventType + '::' + (serviceCode || '*');
  }
}

const DEFAULT_RULES = Object.freeze([
  {
    event_type: 'invoice.issued',
    debit_account: { code: '1100', name: 'Accounts Receivable' },
    credit_account: { code: '4100', name: 'Service Revenue' },
    description: 'Recognize issued service invoice'
  },
  {
    event_type: 'payment.received',
    debit_account: { code: '1010', name: 'Cash and Bank' },
    credit_account: { code: '1100', name: 'Accounts Receivable' },
    description: 'Apply customer payment'
  },
  {
    event_type: 'service_fee.accrued',
    debit_account: { code: '1100', name: 'Accounts Receivable' },
    credit_account: { code: '4200', name: 'Financing Success Fees' },
    description: 'Accrue service success fee'
  },
  {
    event_type: 'expense.approved',
    debit_account: { code: '5100', name: 'Operating Expenses' },
    credit_account: { code: '2100', name: 'Accounts Payable' },
    description: 'Recognize approved expense'
  },
  {
    event_type: 'rent.due',
    debit_account: { code: '1100', name: 'Accounts Receivable' },
    credit_account: { code: '4300', name: 'Rental Income' },
    description: 'Recognize rent due'
  }
]);

function createDefaultPolicyRegistry(extraRules = []) {
  return new AccountingPolicyRegistry([...DEFAULT_RULES, ...extraRules]);
}

module.exports = {
  ALLOWED_SIDES,
  normalizeRule,
  AccountingPolicyRegistry,
  DEFAULT_RULES,
  createDefaultPolicyRegistry
};
