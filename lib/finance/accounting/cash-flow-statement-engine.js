'use strict';

const VALID_CATEGORIES = Object.freeze(new Set(['operating','investing','financing']));

function money(value, code = 'CASH_FLOW_AMOUNT_INVALID') {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(code);
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function normalizeMovement(row = {}, index = 0) {
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    throw new Error('CASH_FLOW_MOVEMENT_INVALID');
  }
  const category = String(row.cash_flow_category || '').trim();
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error('CASH_FLOW_CLASSIFICATION_REQUIRED');
  }
  const eventKey = String(row.event_key || '').trim();
  const eventType = String(row.event_type || '').trim();
  const effectiveDate = String(row.effective_date || '').slice(0,10);
  if (!eventKey || !eventType || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
    throw new Error('CASH_FLOW_MOVEMENT_PROVENANCE_REQUIRED');
  }
  return Object.freeze({
    row_no:index + 1,
    financial_event_id:row.financial_event_id || null,
    event_key:eventKey,
    event_type:eventType,
    effective_date:effectiveDate,
    category,
    cash_amount:money(row.cash_amount)
  });
}

function bucket() {
  return { inflows:0, outflows:0, net:0 };
}

function addAmount(target, amount) {
  if (amount > 0) target.inflows = money(target.inflows + amount);
  if (amount < 0) target.outflows = money(target.outflows + Math.abs(amount));
  target.net = money(target.net + amount);
}

function buildCashFlowStatement({ opening_balance = 0, movements = [] } = {}) {
  const opening = money(opening_balance, 'CASH_FLOW_OPENING_BALANCE_INVALID');
  if (!Array.isArray(movements)) throw new Error('CASH_FLOW_MOVEMENTS_ARRAY_REQUIRED');

  const rows = movements.map(normalizeMovement);
  const sections = {
    operating:bucket(),
    investing:bucket(),
    financing:bucket()
  };
  const periodMap = new Map();

  for (const row of rows) {
    addAmount(sections[row.category], row.cash_amount);

    let period = periodMap.get(row.effective_date);
    if (!period) {
      period = {
        period:row.effective_date,
        inflows:{},
        outflows:{},
        evidence:[]
      };
      periodMap.set(row.effective_date, period);
    }

    const key = row.category;
    if (row.cash_amount > 0) {
      period.inflows[key] = money((period.inflows[key] || 0) + row.cash_amount);
    } else if (row.cash_amount < 0) {
      period.outflows[key] = money((period.outflows[key] || 0) + Math.abs(row.cash_amount));
    }
    period.evidence.push({
      financial_event_id:row.financial_event_id,
      event_key:row.event_key,
      event_type:row.event_type,
      category:row.category,
      cash_amount:row.cash_amount
    });
  }

  const netChange = money(
    sections.operating.net +
    sections.investing.net +
    sections.financing.net
  );
  const closing = money(opening + netChange);

  return {
    ok:true,
    opening_cash:opening,
    operating_activities:sections.operating,
    investing_activities:sections.investing,
    financing_activities:sections.financing,
    net_change_in_cash:netChange,
    closing_cash:closing,
    movements:rows,
    analysis_input:{
      opening_balance:opening,
      periods:Array.from(periodMap.values()).sort((a,b) => a.period.localeCompare(b.period))
    },
    provenance:{
      source:'bonds_accounting_ledger',
      classification_source:'accounting_cash_flow_policies',
      cash_account_source:'accounting_cash_accounts',
      deterministic:true,
      ai_generated:false
    }
  };
}

function runCashFlowAnalysisFromStatement(statement, options = {}) {
  if (!statement || statement.ok !== true || !statement.analysis_input) {
    throw new Error('CASH_FLOW_STATEMENT_REQUIRED');
  }
  const { runFinancialEngine } = require('../financial-engine-registry');
  const result = runFinancialEngine(
    'cash_flow_analysis',
    statement.analysis_input,
    options
  );
  return {
    ...result,
    cash_flow_statement:statement,
    diagnostics:{
      ...(result.diagnostics || {}),
      input_source:'accounting_cash_flow_statement',
      classification_verified:true,
      cash_accounts_explicit:true
    }
  };
}

module.exports = {
  VALID_CATEGORIES,
  normalizeMovement,
  buildCashFlowStatement,
  runCashFlowAnalysisFromStatement
};
