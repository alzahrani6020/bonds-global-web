'use strict';

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value) {
  return Math.round((num(value) + Number.EPSILON) * 100) / 100;
}

function accountContribution(row) {
  const type = String(row.account_type || '').trim();
  const debit = num(row.debit);
  const credit = num(row.credit);

  if (type === 'revenue') return { revenue:credit - debit, expense:0 };
  if (type === 'contra_revenue') return { revenue:-(debit - credit), expense:0 };
  if (type === 'expense') return { revenue:0, expense:debit - credit };
  if (type === 'contra_expense') return { revenue:0, expense:-(credit - debit) };
  return { revenue:0, expense:0 };
}

function buildCostCenterAnalysis(rows = []) {
  if (!Array.isArray(rows)) throw new Error('COST_CENTER_ROWS_ARRAY_REQUIRED');

  const groups = new Map();

  for (const row of rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      throw new Error('COST_CENTER_ROW_INVALID');
    }

    const key = row.cost_center_id || 'UNASSIGNED';
    if (!groups.has(key)) {
      groups.set(key, {
        cost_center_id:row.cost_center_id || null,
        code:String(row.cost_center_code || (row.cost_center_id ? '' : 'UNASSIGNED')).trim(),
        name:String(row.cost_center_name || (row.cost_center_id ? '' : 'Unassigned')).trim(),
        total_debit:0,
        total_credit:0,
        revenue:0,
        expenses:0,
        accounts:[]
      });
    }

    const group = groups.get(key);
    const debit = money(row.debit);
    const credit = money(row.credit);
    const contribution = accountContribution(row);

    group.total_debit = money(group.total_debit + debit);
    group.total_credit = money(group.total_credit + credit);
    group.revenue = money(group.revenue + contribution.revenue);
    group.expenses = money(group.expenses + contribution.expense);
    group.accounts.push({
      account_code:String(row.account_code || '').trim(),
      account_name:String(row.account_name || '').trim(),
      account_type:String(row.account_type || '').trim(),
      debit,
      credit
    });
  }

  const centers = Array.from(groups.values())
    .map(group => ({
      ...group,
      operating_result:money(group.revenue - group.expenses),
      net_debit_movement:money(group.total_debit - group.total_credit)
    }))
    .sort((a,b) => a.code.localeCompare(b.code));

  const totalMovement = centers.reduce(
    (sum, center) => sum + center.total_debit + center.total_credit,
    0
  );
  const unassigned = centers.find(center => center.cost_center_id === null);
  const unassignedMovement = unassigned
    ? unassigned.total_debit + unassigned.total_credit
    : 0;

  return {
    ok:true,
    centers,
    totals:{
      revenue:money(centers.reduce((s,c) => s + c.revenue,0)),
      expenses:money(centers.reduce((s,c) => s + c.expenses,0)),
      operating_result:money(centers.reduce((s,c) => s + c.operating_result,0)),
      total_debit:money(centers.reduce((s,c) => s + c.total_debit,0)),
      total_credit:money(centers.reduce((s,c) => s + c.total_credit,0))
    },
    allocation:{
      unassigned_movement:money(unassignedMovement),
      unassigned_ratio:totalMovement > 0
        ? unassignedMovement / totalMovement
        : 0
    },
    provenance:{
      source:'accounting_cost_center_ledger',
      deterministic:true,
      ai_generated:false
    }
  };
}

module.exports = {
  accountContribution,
  buildCostCenterAnalysis
};
