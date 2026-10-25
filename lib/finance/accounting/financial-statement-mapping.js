'use strict';

const CANONICAL_FIELDS = Object.freeze(new Set([
  'cash',
  'receivables',
  'inventory',
  'current_assets',
  'current_liabilities',
  'total_debt',
  'cogs',
  'operating_expenses',
  'interest_expense'
]));

function clean(value, code) {
  const out = String(value == null ? '' : value).trim();
  if (!out) throw new Error(code);
  return out;
}

function normalizeTarget(target) {
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    throw new Error('STATEMENT_MAPPING_TARGET_REQUIRED');
  }
  const field = clean(target.field, 'STATEMENT_MAPPING_FIELD_REQUIRED');
  if (!CANONICAL_FIELDS.has(field)) {
    throw new Error('STATEMENT_MAPPING_FIELD_UNSUPPORTED');
  }
  const multiplier = target.multiplier == null ? 1 : Number(target.multiplier);
  if (!Number.isFinite(multiplier) || multiplier === 0) {
    throw new Error('STATEMENT_MAPPING_MULTIPLIER_INVALID');
  }
  return Object.freeze({ field, multiplier });
}

function normalizeRule(rule = {}) {
  const accountCode = clean(rule.account_code, 'STATEMENT_MAPPING_ACCOUNT_CODE_REQUIRED');
  const rawTargets = Array.isArray(rule.targets) ? rule.targets : [];
  if (!rawTargets.length) throw new Error('STATEMENT_MAPPING_TARGETS_REQUIRED');
  const targets = rawTargets.map(normalizeTarget);
  const unique = new Set(targets.map(t => t.field));
  if (unique.size !== targets.length) throw new Error('STATEMENT_MAPPING_DUPLICATE_FIELD');
  return Object.freeze({ account_code: accountCode, targets });
}

class FinancialStatementMappingRegistry {
  constructor(rules = []) {
    this.rules = new Map();
    for (const rule of rules) this.register(rule);
  }

  register(rule) {
    const normalized = normalizeRule(rule);
    if (this.rules.has(normalized.account_code)) {
      throw new Error('STATEMENT_MAPPING_DUPLICATE_ACCOUNT');
    }
    this.rules.set(normalized.account_code, normalized);
    return normalized;
  }

  resolve(accountCode) {
    return this.rules.get(String(accountCode || '').trim()) || null;
  }

  list() {
    return Array.from(this.rules.values());
  }
}

const DEFAULT_RULES = Object.freeze([
  {
    account_code: '1010',
    targets: [{ field: 'cash' }]
  },
  {
    account_code: '1100',
    targets: [{ field: 'receivables' }]
  },
  {
    account_code: '5100',
    targets: [{ field: 'operating_expenses' }]
  }
]);

function createDefaultFinancialStatementMapping(extraRules = []) {
  const merged = new Map(DEFAULT_RULES.map(rule => [rule.account_code, rule]));
  for (const rule of Array.isArray(extraRules) ? extraRules : []) {
    const code = String(rule?.account_code || '').trim();
    if (!code) throw new Error('STATEMENT_MAPPING_ACCOUNT_CODE_REQUIRED');
    merged.set(code, rule);
  }
  return new FinancialStatementMappingRegistry(Array.from(merged.values()));
}

module.exports = {
  CANONICAL_FIELDS,
  normalizeRule,
  FinancialStatementMappingRegistry,
  DEFAULT_RULES,
  createDefaultFinancialStatementMapping
};
