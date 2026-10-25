'use strict';

const {
  createDefaultFinancialStatementMapping
} = require('./financial-statement-mapping');

const ASSET_TYPES = new Set(['asset', 'contra_asset']);
const LIABILITY_TYPES = new Set(['liability', 'contra_liability']);
const EQUITY_TYPES = new Set(['equity', 'contra_equity']);
const REVENUE_TYPES = new Set(['revenue', 'contra_revenue']);
const EXPENSE_TYPES = new Set(['expense', 'contra_expense']);
const CREDIT_NORMAL = new Set([
  'liability', 'equity', 'revenue',
  'contra_asset', 'contra_expense'
]);

function money(value) {
  const out = Number(value);
  if (!Number.isFinite(out)) throw new Error('LEDGER_AMOUNT_INVALID');
  return Math.round((out + Number.EPSILON) * 100) / 100;
}

function normalizeLedgerRows(rows = []) {
  if (!Array.isArray(rows)) throw new Error('LEDGER_ROWS_ARRAY_REQUIRED');
  return rows.map((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('LEDGER_ROW_INVALID');
    }
    const accountCode = String(row.account_code || '').trim();
    const accountName = String(row.account_name || '').trim();
    const accountType = String(row.account_type || '').trim();
    if (!accountCode || !accountName || !accountType) {
      throw new Error('LEDGER_ACCOUNT_METADATA_REQUIRED');
    }
    if (!ASSET_TYPES.has(accountType) &&
        !LIABILITY_TYPES.has(accountType) &&
        !EQUITY_TYPES.has(accountType) &&
        !REVENUE_TYPES.has(accountType) &&
        !EXPENSE_TYPES.has(accountType)) {
      throw new Error('LEDGER_ACCOUNT_TYPE_UNSUPPORTED');
    }

    const debit = money(row.debit || row.total_debit || 0);
    const credit = money(row.credit || row.total_credit || 0);
    if (debit < 0 || credit < 0) throw new Error('LEDGER_NEGATIVE_MOVEMENT_FORBIDDEN');

    const rawBalance = CREDIT_NORMAL.has(accountType)
      ? credit - debit
      : debit - credit;

    return {
      row_no: index + 1,
      account_code: accountCode,
      account_name: accountName,
      account_type: accountType,
      debit,
      credit,
      balance: money(rawBalance)
    };
  });
}

function trialBalance(rows = []) {
  const normalized = normalizeLedgerRows(rows);
  const totalDebit = money(normalized.reduce((sum, row) => sum + row.debit, 0));
  const totalCredit = money(normalized.reduce((sum, row) => sum + row.credit, 0));
  const difference = money(totalDebit - totalCredit);
  return {
    ok: Math.abs(difference) <= 0.01,
    total_debit: totalDebit,
    total_credit: totalCredit,
    difference,
    rows: normalized
  };
}

function sumByTypes(rows, types) {
  return money(rows
    .filter(row => types.has(row.account_type))
    .reduce((sum, row) => sum + row.balance, 0));
}

function mappedFields({ balanceRows, periodRows, mappingRegistry }) {
  const out = {};
  const provenance = {};

  for (const rule of mappingRegistry.list()) {
    const balanceRow = balanceRows.find(row => row.account_code === rule.account_code);
    const periodRow = periodRows.find(row => row.account_code === rule.account_code);

    for (const target of rule.targets) {
      const incomeField = ['cogs', 'operating_expenses', 'interest_expense'].includes(target.field);
      const source = incomeField ? periodRow : balanceRow;
      if (!source) continue;
      const value = money(source.balance * target.multiplier);
      out[target.field] = money((out[target.field] || 0) + value);
      if (!provenance[target.field]) provenance[target.field] = [];
      provenance[target.field].push({
        account_code: source.account_code,
        account_name: source.account_name,
        account_type: source.account_type,
        balance: source.balance,
        multiplier: target.multiplier
      });
    }
  }

  return { values: out, provenance };
}

function buildFinancialStatements({
  balanceRows = [],
  periodRows = [],
  mappingRegistry = createDefaultFinancialStatementMapping()
} = {}) {
  const cumulativeTrial = trialBalance(balanceRows);
  const periodTrial = trialBalance(periodRows);

  if (!cumulativeTrial.ok) throw new Error('CUMULATIVE_TRIAL_BALANCE_UNBALANCED');
  if (!periodTrial.ok) throw new Error('PERIOD_TRIAL_BALANCE_UNBALANCED');

  const assets = sumByTypes(cumulativeTrial.rows, ASSET_TYPES);
  const liabilities = sumByTypes(cumulativeTrial.rows, LIABILITY_TYPES);
  const baseEquity = sumByTypes(cumulativeTrial.rows, EQUITY_TYPES);
  const cumulativeRevenue = sumByTypes(cumulativeTrial.rows, REVENUE_TYPES);
  const cumulativeExpenses = sumByTypes(cumulativeTrial.rows, EXPENSE_TYPES);
  const cumulativeEarnings = money(cumulativeRevenue - cumulativeExpenses);
  const equityIncludingEarnings = money(baseEquity + cumulativeEarnings);
  const accountingDifference = money(assets - liabilities - equityIncludingEarnings);

  if (Math.abs(accountingDifference) > 0.01) {
    throw new Error('BALANCE_SHEET_ACCOUNTING_EQUATION_FAILED');
  }

  const periodRevenue = sumByTypes(periodTrial.rows, REVENUE_TYPES);
  const periodExpenses = sumByTypes(periodTrial.rows, EXPENSE_TYPES);
  const netIncome = money(periodRevenue - periodExpenses);

  const mapped = mappedFields({
    balanceRows: cumulativeTrial.rows,
    periodRows: periodTrial.rows,
    mappingRegistry
  });

  const normalizedInput = {
    total_assets: assets,
    total_liabilities: liabilities,
    equity: equityIncludingEarnings,
    revenue: periodRevenue,
    net_income: netIncome,
    ...mapped.values
  };

  if (normalizedInput.cogs != null) {
    normalizedInput.operating_income = money(
      periodRevenue -
      Number(normalizedInput.cogs || 0) -
      Number(normalizedInput.operating_expenses || 0)
    );
  }

  return {
    ok: true,
    trial_balance: {
      cumulative: cumulativeTrial,
      period: periodTrial
    },
    balance_sheet: {
      total_assets: assets,
      total_liabilities: liabilities,
      base_equity: baseEquity,
      cumulative_earnings: cumulativeEarnings,
      total_equity: equityIncludingEarnings,
      accounting_difference: accountingDifference
    },
    income_statement: {
      revenue: periodRevenue,
      expenses: periodExpenses,
      net_income: netIncome
    },
    normalized_input: normalizedInput,
    mapping_provenance: mapped.provenance,
    provenance: {
      source: 'bonds_accounting_ledger',
      deterministic: true,
      ai_generated: false
    }
  };
}

module.exports = {
  ASSET_TYPES,
  LIABILITY_TYPES,
  EQUITY_TYPES,
  REVENUE_TYPES,
  EXPENSE_TYPES,
  money,
  normalizeLedgerRows,
  trialBalance,
  buildFinancialStatements
};
