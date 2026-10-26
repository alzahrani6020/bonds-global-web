'use strict';

const {
  money,
  normalizeLedgerRows,
  buildFinancialStatements
} = require('../accounting/ledger-report-engine');
const { envelope } = require('../shared/result-envelope');

const NORMAL_DEBIT = new Set([
  'asset','expense','contra_liability','contra_equity','contra_revenue'
]);

function finite(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowKey(row) {
  return String(row.account_code || '').trim();
}

function aggregateRows(entityRows = [], required = [], scope = 'balance') {
  const accountMeta = new Map();
  const totals = new Map();

  for (const entity of entityRows) {
    const entityId = String(entity?.id || '').trim();
    if (!entityId) {
      required.push('entities.id');
      continue;
    }

    let normalized;
    try {
      normalized = normalizeLedgerRows(
        scope === 'period'
          ? (entity.period_rows || [])
          : (entity.balance_rows || [])
      );
    } catch (error) {
      required.push(`entities.${entityId}.${scope}_rows_valid`);
      continue;
    }

    for (const row of normalized) {
      const key = rowKey(row);
      const existing = accountMeta.get(key);
      if (existing && existing.account_type !== row.account_type) {
        required.push(`account_type_consistency:${key}`);
        continue;
      }
      if (!existing) {
        accountMeta.set(key, {
          account_code: row.account_code,
          account_name: row.account_name,
          account_type: row.account_type
        });
      }
      const current = totals.get(key) || { debit:0, credit:0 };
      current.debit = money(current.debit + row.debit);
      current.credit = money(current.credit + row.credit);
      totals.set(key, current);
    }
  }

  return [...totals.entries()].map(([key, total]) => ({
    ...accountMeta.get(key),
    debit: total.debit,
    credit: total.credit
  }));
}

function addJournalLine(rows, meta, side, amount) {
  const key = meta.account_code;
  let row = rows.find(item => item.account_code === key);
  if (!row) {
    row = {
      account_code: meta.account_code,
      account_name: meta.account_name,
      account_type: meta.account_type,
      debit:0,
      credit:0
    };
    rows.push(row);
  }
  row[side] = money(row[side] + amount);
}

function accountIndex(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(row.account_code, {
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type
    });
  }
  return map;
}

function eliminationLines(pair, accountMap, required, index, tolerance) {
  const type = String(pair?.type || '').trim();
  const sourceAmount = finite(pair?.source_amount);
  const counterpartyAmount = finite(pair?.counterparty_amount);

  if (!['balance','income'].includes(type)) {
    required.push(`intercompany_pairs[${index}].type_balance_or_income`);
  }
  if (sourceAmount === null || sourceAmount < 0) {
    required.push(`intercompany_pairs[${index}].source_amount_non_negative`);
  }
  if (counterpartyAmount === null || counterpartyAmount < 0) {
    required.push(`intercompany_pairs[${index}].counterparty_amount_non_negative`);
  }

  const debitCode = String(pair?.debit_account_code || '').trim();
  const creditCode = String(pair?.credit_account_code || '').trim();
  if (!debitCode) required.push(`intercompany_pairs[${index}].debit_account_code`);
  if (!creditCode) required.push(`intercompany_pairs[${index}].credit_account_code`);

  const debitMeta = accountMap.get(debitCode);
  const creditMeta = accountMap.get(creditCode);
  if (debitCode && !debitMeta) required.push(`intercompany_account_exists:${debitCode}`);
  if (creditCode && !creditMeta) required.push(`intercompany_account_exists:${creditCode}`);

  if (sourceAmount === null || counterpartyAmount === null || !debitMeta || !creditMeta) {
    return null;
  }

  const difference = money(sourceAmount - counterpartyAmount);
  const absoluteDifference = Math.abs(difference);
  if (absoluteDifference > tolerance) {
    required.push(`intercompany_pairs[${index}].difference_within_tolerance`);
    return null;
  }

  const eliminationAmount = money(Math.min(sourceAmount, counterpartyAmount));

  return {
    id:String(pair?.id || `pair_${index + 1}`),
    type,
    debit:debitMeta,
    credit:creditMeta,
    source_amount:sourceAmount,
    counterparty_amount:counterpartyAmount,
    difference,
    elimination_amount:eliminationAmount,
    matched:absoluteDifference <= tolerance
  };
}

function consolidationAnalysis(input = {}) {
  const required = [];
  const entities = Array.isArray(input.entities) ? input.entities : [];
  if (entities.length < 2) required.push('entities_minimum_2');

  const parentCount = entities.filter(entity => entity?.role === 'parent').length;
  if (parentCount !== 1) required.push('exactly_one_parent');

  const ownership = [];
  for (const [index, entity] of entities.entries()) {
    const id = String(entity?.id || '').trim();
    const role = String(entity?.role || '').trim();
    const ownershipPct = role === 'parent' ? 100 : finite(entity?.ownership_pct);

    if (!id) required.push(`entities[${index}].id`);
    if (!['parent','subsidiary'].includes(role)) {
      required.push(`entities[${index}].role_parent_or_subsidiary`);
    }
    if (role === 'subsidiary' &&
        (ownershipPct === null || ownershipPct <= 0 || ownershipPct > 100)) {
      required.push(`entities[${index}].ownership_pct_gt_0_lte_100`);
    }

    const nciPct = ownershipPct === null ? null : money(100 - ownershipPct);
    if (role === 'subsidiary' && nciPct > 0) {
      const nci = entity?.nci && typeof entity.nci === 'object' ? entity.nci : null;
      const equity = finite(nci?.equity);
      const periodIncome = finite(nci?.period_income);
      if (equity === null) required.push(`entities[${index}].nci.equity`);
      if (periodIncome === null) required.push(`entities[${index}].nci.period_income`);
    }

    ownership.push({
      entity_id:id,
      role,
      ownership_pct:ownershipPct,
      nci_pct:nciPct
    });
  }

  const balanceRows = aggregateRows(entities, required, 'balance');
  const periodRows = aggregateRows(entities, required, 'period');
  const balanceAccountMap = accountIndex(balanceRows);
  const periodAccountMap = accountIndex(periodRows);
  const allAccountMap = new Map([...balanceAccountMap, ...periodAccountMap]);

  const tolerance = finite(input.match_tolerance) ?? 0.01;
  if (tolerance < 0) required.push('match_tolerance_non_negative');

  const pairs = Array.isArray(input.intercompany_pairs)
    ? input.intercompany_pairs
    : [];

  const eliminations = pairs
    .map((pair,index) =>
      eliminationLines(pair, allAccountMap, required, index, tolerance)
    )
    .filter(Boolean);

  const adjustmentRows = Array.isArray(input.adjustments) ? input.adjustments : [];
  const normalizedAdjustments = [];

  for (const [index, adjustment] of adjustmentRows.entries()) {
    const scope = String(adjustment?.scope || '').trim();
    const debitCode = String(adjustment?.debit_account_code || '').trim();
    const creditCode = String(adjustment?.credit_account_code || '').trim();
    const amount = finite(adjustment?.amount);

    if (!['balance','period','both'].includes(scope)) {
      required.push(`adjustments[${index}].scope_balance_period_or_both`);
    }
    if (amount === null || amount <= 0) {
      required.push(`adjustments[${index}].amount_positive`);
    }

    const debitMeta = allAccountMap.get(debitCode);
    const creditMeta = allAccountMap.get(creditCode);
    if (!debitMeta) required.push(`adjustment_account_exists:${debitCode}`);
    if (!creditMeta) required.push(`adjustment_account_exists:${creditCode}`);

    if (debitMeta && creditMeta && amount !== null && amount > 0) {
      normalizedAdjustments.push({
        id:String(adjustment?.id || `adjustment_${index + 1}`),
        scope,
        debit:debitMeta,
        credit:creditMeta,
        amount:money(amount),
        adjustment_type:String(adjustment?.adjustment_type || 'manual').trim()
      });
    }
  }

  if (required.length) {
    return envelope(
      'consolidation',
      {},
      input,
      {
        method:'full_consolidation_with_explicit_eliminations',
        acquisition_accounting:'explicit_adjustments_only',
        intercompany_matching:'paired_amounts_with_tolerance',
        fail_closed:true
      },
      required
    );
  }

  const consolidatedBalance = balanceRows.map(row => ({...row}));
  const consolidatedPeriod = periodRows.map(row => ({...row}));

  for (const elimination of eliminations) {
    const targetRows = elimination.type === 'income'
      ? [consolidatedBalance, consolidatedPeriod]
      : [consolidatedBalance];

    for (const rows of targetRows) {
      addJournalLine(rows, elimination.debit, 'debit', elimination.elimination_amount);
      addJournalLine(rows, elimination.credit, 'credit', elimination.elimination_amount);
    }
  }

  for (const adjustment of normalizedAdjustments) {
    const targetRows =
      adjustment.scope === 'both'
        ? [consolidatedBalance, consolidatedPeriod]
        : adjustment.scope === 'balance'
          ? [consolidatedBalance]
          : [consolidatedPeriod];

    for (const rows of targetRows) {
      addJournalLine(rows, adjustment.debit, 'debit', adjustment.amount);
      addJournalLine(rows, adjustment.credit, 'credit', adjustment.amount);
    }
  }

  let statements;
  try {
    statements = buildFinancialStatements({
      balanceRows:consolidatedBalance,
      periodRows:consolidatedPeriod
    });
  } catch (error) {
    return {
      ...envelope(
        'consolidation',
        {},
        input,
        {
          method:'full_consolidation_with_explicit_eliminations',
          acquisition_accounting:'explicit_adjustments_only',
          intercompany_matching:'paired_amounts_with_tolerance',
          fail_closed:true
        },
        ['consolidation_statement_validation']
      ),
      error:{code:String(error?.message || 'CONSOLIDATION_STATEMENT_BUILD_FAILED')}
    };
  }

  const nci = entities
    .filter(entity => entity?.role === 'subsidiary' && Number(entity?.ownership_pct) < 100)
    .map(entity => ({
      entity_id:String(entity.id),
      ownership_pct:Number(entity.ownership_pct),
      nci_pct:money(100 - Number(entity.ownership_pct)),
      nci_equity:money(entity.nci.equity),
      nci_period_income:money(entity.nci.period_income)
    }));

  return {
    ok:true,
    executed:true,
    engine_code:'consolidation',
    status:'computed',
    metrics:{
      entity_count:entities.length,
      subsidiary_count:entities.filter(e=>e.role === 'subsidiary').length,
      intercompany_pair_count:eliminations.length,
      elimination_total:money(
        eliminations.reduce((sum,row)=>sum + row.elimination_amount,0)
      ),
      adjustment_total:money(
        normalizedAdjustments.reduce((sum,row)=>sum + row.amount,0)
      ),
      consolidated_trial_balance:statements.trial_balance,
      consolidated_balance_sheet:statements.balance_sheet,
      consolidated_income_statement:statements.income_statement,
      normalized_input:statements.normalized_input,
      intercompany_reconciliation:eliminations,
      ownership,
      nci,
      nci_equity_total:money(nci.reduce((sum,row)=>sum + row.nci_equity,0)),
      nci_period_income_total:money(
        nci.reduce((sum,row)=>sum + row.nci_period_income,0)
      )
    },
    diagnostics:{
      method:'full_consolidation_with_explicit_eliminations',
      acquisition_accounting:'explicit_adjustments_only',
      intercompany_matching:'paired_amounts_with_tolerance',
      fail_closed:true
    },
    required_inputs:[],
    evidence:[{
      source:'bonds_financial_engine',
      evidence_type:'deterministic_computation',
      evidence_code:'consolidation',
      value:{
        entity_count:entities.length,
        elimination_count:eliminations.length
      },
      confidence:100,
      timestamp:new Date().toISOString()
    }],
    provenance:{
      source:'bonds_financial_engine',
      deterministic:true,
      ai_generated:false
    }
  };
}

module.exports = {
  NORMAL_DEBIT,
  consolidationAnalysis
};
