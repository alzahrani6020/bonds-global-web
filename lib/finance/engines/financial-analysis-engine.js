'use strict';

const { finite, safeDiv, pct } = require('../shared/math');
const { envelope } = require('../shared/result-envelope');

function financialAnalysis(input = {}, options = {}) {
  const revenue = finite(input.revenue);
  const cogs = finite(input.cogs);
  const operatingExpenses = finite(input.operating_expenses);
  const ebitda = finite(input.ebitda) ??
    (revenue !== null && cogs !== null && operatingExpenses !== null
      ? revenue - cogs - operatingExpenses
      : null);
  const netIncome = finite(input.net_income);
  const currentAssets = finite(input.current_assets);
  const currentLiabilities = finite(input.current_liabilities);
  const cash = finite(input.cash);
  const inventoryValue = finite(input.inventory);
  const inventory = inventoryValue ?? 0;
  const operatingIncome = finite(input.operating_income);
  const priorRevenue = finite(input.prior_revenue);
  const priorNetIncome = finite(input.prior_net_income);
  const costOfEquityPct = finite(input.cost_of_equity_pct);
  const explicitCostOfDebtPct = finite(input.cost_of_debt_pct);
  const taxRatePct = finite(input.tax_rate_pct);
  const totalAssets = finite(input.total_assets);
  const totalLiabilities = finite(input.total_liabilities);
  const equity = finite(input.equity) ??
    (totalAssets !== null && totalLiabilities !== null ? totalAssets - totalLiabilities : null);
  const debt = finite(input.total_debt);
  const interest = finite(input.interest_expense);
  const receivables = finite(input.receivables);
  const workingCapital = currentAssets !== null && currentLiabilities !== null
    ? currentAssets - currentLiabilities
    : null;
  const assetTurnover = safeDiv(revenue, totalAssets);
  const netDebt = debt !== null && cash !== null ? debt - cash : null;
  const netDebtToEbitda = safeDiv(netDebt, ebitda);
  const inventoryTurnover = safeDiv(cogs, inventoryValue);
  const operatingMarginPct = revenue && operatingIncome !== null
    ? pct(operatingIncome / revenue)
    : null;
  const costOfDebtPct = explicitCostOfDebtPct ??
    (debt && interest !== null ? pct(interest / debt) : null);
  const revenueGrowthPct = revenue !== null && priorRevenue
    ? pct((revenue - priorRevenue) / Math.abs(priorRevenue))
    : null;
  const earningsGrowthPct = netIncome !== null && priorNetIncome
    ? pct((netIncome - priorNetIncome) / Math.abs(priorNetIncome))
    : null;
  const totalCapital = debt !== null && equity !== null ? debt + equity : null;
  let waccPct = null;
  const waccCapitalValid = totalCapital !== null && totalCapital > 0 &&
    debt !== null && debt >= 0 && equity !== null && equity >= 0;
  const waccTaxValid = debt === 0 ||
    (taxRatePct !== null && taxRatePct >= 0 && taxRatePct <= 100);

  if (waccCapitalValid && waccTaxValid) {
    const equityWeight = equity / totalCapital;
    const debtWeight = debt / totalCapital;
    const equityComponent = equityWeight === 0
      ? 0
      : (costOfEquityPct !== null ? equityWeight * costOfEquityPct : null);
    const debtComponent = debtWeight === 0
      ? 0
      : (costOfDebtPct !== null
        ? debtWeight * costOfDebtPct * (1 - taxRatePct / 100)
        : null);
    if (equityComponent !== null && debtComponent !== null) {
      waccPct = equityComponent + debtComponent;
    }
  }

  const metrics = {
    gross_profit: revenue !== null && cogs !== null ? revenue - cogs : null,
    gross_margin_pct: revenue && cogs !== null ? pct((revenue - cogs) / revenue) : null,
    ebitda,
    ebitda_margin_pct: revenue && ebitda !== null ? pct(ebitda / revenue) : null,
    net_margin_pct: revenue && netIncome !== null ? pct(netIncome / revenue) : null,
    current_ratio: safeDiv(currentAssets, currentLiabilities),
    quick_ratio: safeDiv(
      currentAssets !== null ? currentAssets - inventory : null,
      currentLiabilities
    ),
    cash_ratio: safeDiv(cash, currentLiabilities),
    debt_to_equity: safeDiv(debt, equity),
    debt_to_assets: safeDiv(debt, totalAssets),
    liabilities_to_assets: safeDiv(totalLiabilities, totalAssets),
    interest_coverage: safeDiv(ebitda, interest),
    roa_pct: totalAssets && netIncome !== null ? pct(netIncome / totalAssets) : null,
    roe_pct: equity && netIncome !== null ? pct(netIncome / equity) : null,
    receivables_turnover: receivables ? safeDiv(revenue, receivables) : null,
    inventory_turnover: inventoryTurnover,
    operating_margin_pct: operatingMarginPct,
    cost_of_debt_pct: costOfDebtPct,
    revenue_growth_pct: revenueGrowthPct,
    earnings_growth_pct: earningsGrowthPct,
    wacc_pct: waccPct,
    working_capital: workingCapital,
    asset_turnover: assetTurnover,
    net_debt: netDebt,
    net_debt_to_ebitda: netDebtToEbitda
  };

  const required = [];
  const serviceCode = String(options.serviceCode || '').trim();

  switch (serviceCode) {
    case 'financial_ratios':
      if (revenue === null) required.push('revenue');
      if (currentAssets === null) required.push('current_assets');
      if (currentLiabilities === null) required.push('current_liabilities');
      break;
    case 'liquidity_analysis':
      if (currentAssets === null) required.push('current_assets');
      if (currentLiabilities === null) required.push('current_liabilities');
      break;
    case 'working_capital_analysis':
      if (currentAssets === null) required.push('current_assets');
      if (currentLiabilities === null) required.push('current_liabilities');
      break;
    case 'asset_turnover_analysis':
      if (revenue === null) required.push('revenue');
      if (totalAssets === null) required.push('total_assets');
      else if (totalAssets === 0) required.push('non_zero_total_assets');
      break;
    case 'net_debt_analysis':
      if (debt === null) required.push('total_debt');
      if (cash === null) required.push('cash');
      break;
    case 'net_debt_ebitda':
      if (debt === null) required.push('total_debt');
      if (cash === null) required.push('cash');
      if (ebitda === null) required.push('ebitda_or_revenue_cogs_operating_expenses');
      else if (ebitda === 0) required.push('non_zero_ebitda');
      break;
    case 'gross_margin_analysis':
      if (revenue === null) required.push('revenue');
      else if (revenue === 0) required.push('non_zero_revenue');
      if (cogs === null) required.push('cogs');
      break;
    case 'net_margin_analysis':
      if (revenue === null) required.push('revenue');
      else if (revenue === 0) required.push('non_zero_revenue');
      if (netIncome === null) required.push('net_income');
      break;
    case 'debt_to_equity_analysis':
      if (debt === null) required.push('total_debt');
      if (equity === null) required.push('equity_or_total_assets_and_total_liabilities');
      else if (equity === 0) required.push('non_zero_equity');
      break;
    case 'interest_coverage_analysis':
      if (ebitda === null) required.push('ebitda_or_revenue_cogs_operating_expenses');
      if (interest === null) required.push('interest_expense');
      else if (interest === 0) required.push('non_zero_interest_expense');
      break;
    case 'ebitda_analysis':
      if (ebitda === null) required.push('ebitda_or_revenue_cogs_operating_expenses');
      break;
    case 'operating_margin_analysis':
      if (revenue === null) required.push('revenue');
      else if (revenue === 0) required.push('non_zero_revenue');
      if (operatingIncome === null) required.push('operating_income');
      break;
    case 'inventory_turnover_analysis':
      if (cogs === null) required.push('cogs');
      if (inventoryValue === null) required.push('inventory');
      else if (inventoryValue === 0) required.push('non_zero_inventory');
      break;
    case 'receivables_turnover_analysis':
      if (revenue === null) required.push('revenue');
      if (receivables === null) required.push('receivables');
      else if (receivables === 0) required.push('non_zero_receivables');
      break;
    case 'cost_of_debt_analysis':
      if (debt === null) required.push('total_debt');
      else if (debt === 0) required.push('non_zero_total_debt');
      if (interest === null) required.push('interest_expense');
      break;
    case 'revenue_growth_analysis':
      if (revenue === null) required.push('revenue');
      if (priorRevenue === null) required.push('prior_revenue');
      else if (priorRevenue === 0) required.push('non_zero_prior_revenue');
      break;
    case 'earnings_growth_analysis':
      if (netIncome === null) required.push('net_income');
      if (priorNetIncome === null) required.push('prior_net_income');
      else if (priorNetIncome === 0) required.push('non_zero_prior_net_income');
      break;
    case 'wacc_analysis':
      if (debt === null) required.push('total_debt');
      else if (debt < 0) required.push('non_negative_total_debt');
      if (equity === null) required.push('equity_or_total_assets_and_total_liabilities');
      else if (equity < 0) required.push('non_negative_equity');
      if (totalCapital !== null && totalCapital <= 0) required.push('positive_total_capital');
      if (equity !== null && equity > 0 && costOfEquityPct === null) {
        required.push('cost_of_equity_pct');
      }
      if (debt !== null && debt > 0) {
        if (costOfDebtPct === null) required.push('cost_of_debt_pct_or_interest_expense');
        if (taxRatePct === null) required.push('tax_rate_pct');
        else if (taxRatePct < 0 || taxRatePct > 100) required.push('tax_rate_pct_0_to_100');
      }
      break;
    default:
      if (revenue === null) required.push('revenue');
      if (currentAssets === null) required.push('current_assets');
      if (currentLiabilities === null) required.push('current_liabilities');
      break;
  }

  return envelope('financial_analysis', metrics, input, {
    available_metric_count: Object.values(metrics).filter(v => v !== null).length,
    service_scope: serviceCode || null
  }, required);
}

module.exports = { financialAnalysis };
