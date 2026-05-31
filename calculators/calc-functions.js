/**
 * Bonds Calculator Pure Functions
 * Extracted from calculator HTML files — no DOM dependencies.
 *
 * Sources:
 *   - calculator.html          → calculateBreakEven
 *   - calculators/loan.html    → calculateLoan
 *   - calculators/pricing.html → calculatePricing
 *   - calculators/cash-flow.html → calculateCashFlow
 *   - calculators/feasibility.html → calculateFeasibility
 */

// ============================================================================
// 1. Break-Even (from calculator.html)
// ============================================================================

/**
 * @param {number} fixedCosts       – monthly fixed costs
 * @param {number} variableCostPerUnit
 * @param {number} sellingPrice
 * @param {number} quantity         – expected monthly quantity
 * @param {number} [taxRate=0]      – tax % (e.g. 15 for VAT)
 * @param {number} [zakatRate=0]    – zakat % (e.g. 2.5)
 */
function calculateBreakEven(fixedCosts, variableCostPerUnit, sellingPrice, quantity, taxRate, zakatRate) {
  fixedCosts = fixedCosts || 0;
  variableCostPerUnit = variableCostPerUnit || 0;
  sellingPrice = sellingPrice || 0;
  quantity = quantity || 0;
  taxRate = (taxRate !== undefined && taxRate !== null) ? taxRate : 0;
  zakatRate = (zakatRate !== undefined && zakatRate !== null) ? zakatRate : 0;

  var contribution = sellingPrice - variableCostPerUnit;
  var breakEvenUnits, breakEvenAmount;

  if (contribution > 0) {
    breakEvenUnits = Math.ceil(fixedCosts / contribution);
    breakEvenAmount = breakEvenUnits * sellingPrice;
  } else if (fixedCosts === 0 && contribution >= 0) {
    breakEvenUnits = 0;
    breakEvenAmount = 0;
  } else {
    breakEvenUnits = -1;
    breakEvenAmount = -1;
  }

  var revenue = quantity * sellingPrice;
  var totalCost = fixedCosts + (variableCostPerUnit * quantity);
  var profit = revenue - totalCost;

  var taxAmount = profit > 0 ? profit * (taxRate / 100) : 0;
  var profitAfterTax = profit - taxAmount;
  var zakatAmount = profitAfterTax > 0 ? profitAfterTax * (zakatRate / 100) : 0;
  var netProfit = profitAfterTax - zakatAmount;

  var profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;
  var roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  return {
    contribution,
    breakEvenUnits,
    breakEvenAmount,
    revenue,
    totalCost,
    profit,
    taxAmount,
    profitAfterTax,
    zakatAmount,
    netProfit,
    profitMargin,
    roi
  };
}

// ============================================================================
// 2. Loan & Amortization (from calculators/loan.html)
// ============================================================================

/**
 * @param {number} principal        – total loan amount
 * @param {number} downPayment
 * @param {number} annualRate       – annual interest % (e.g. 5)
 * @param {number} termMonths
 * @param {string} [frequency='monthly'] – 'monthly' | 'quarterly'
 * @param {number} [extraFees=0]
 */
function calculateLoan(principal, downPayment, annualRate, termMonths, frequency, extraFees) {
  principal = principal || 0;
  downPayment = downPayment || 0;
  annualRate = annualRate || 0;
  termMonths = termMonths || 0;
  frequency = frequency || 'monthly';
  extraFees = extraFees || 0;

  var netLoan = principal - downPayment + extraFees;
  var isMonthly = frequency === 'monthly';
  var periodsPerYear = isMonthly ? 12 : 4;
  var totalPayments = isMonthly ? termMonths : Math.floor(termMonths / 3);
  if (totalPayments < 1) totalPayments = 1;

  var periodicRate = (annualRate / 100) / periodsPerYear;

  var installment = 0;
  if (periodicRate === 0) {
    installment = netLoan / totalPayments;
  } else {
    installment = netLoan * (periodicRate * Math.pow(1 + periodicRate, totalPayments)) /
                  (Math.pow(1 + periodicRate, totalPayments) - 1);
  }

  var totalPaid = installment * totalPayments;
  var totalInterest = totalPaid - netLoan;
  var ear = Math.pow(1 + periodicRate, periodsPerYear) - 1;

  var schedule = [];
  var balance = netLoan;
  var totalPrincipalPaid = 0;
  var totalInterestPaid = 0;

  for (var i = 1; i <= totalPayments; i++) {
    var interestPayment = balance * periodicRate;
    var principalPayment = installment - interestPayment;
    balance -= principalPayment;
    if (balance < 0) {
      principalPayment += balance;
      balance = 0;
    }
    totalPrincipalPaid += principalPayment;
    totalInterestPaid += interestPayment;
    schedule.push({
      period: i,
      installment: installment,
      principal: principalPayment,
      interest: interestPayment,
      balance: balance
    });
  }

  return {
    netLoan,
    installment,
    totalPaid,
    totalInterest,
    ear,
    schedule,
    totalPayments,
    totalPrincipalPaid,
    totalInterestPaid,
    periodicRate,
    periodsPerYear
  };
}

/**
 * Debt-to-Income ratio (%).
 */
function calculateDTI(installment, monthlyIncome) {
  if (monthlyIncome > 0) {
    return (installment / monthlyIncome) * 100;
  }
  return null;
}

// ============================================================================
// 3. Product Pricing (from calculators/pricing.html)
// ============================================================================

/**
 * @param {number} directCost       – materials + labour per unit
 * @param {number} overheadCost     – indirect cost per unit
 * @param {number} desiredMargin    – target profit margin % (e.g. 25)
 * @param {number} [taxRate=0]      – tax % on profit
 * @param {number} [zakatRate=0]    – zakat % on profit after tax
 * @param {number} [volume=0]       – expected monthly sales volume
 * @param {number} [monthlyFixed=0] – monthly fixed costs
 */
function calculatePricing(directCost, overheadCost, desiredMargin, taxRate, zakatRate, volume, monthlyFixed) {
  directCost = directCost || 0;
  overheadCost = overheadCost || 0;
  desiredMargin = desiredMargin || 0;
  taxRate = taxRate || 0;
  zakatRate = zakatRate || 0;
  volume = volume || 0;
  monthlyFixed = monthlyFixed || 0;

  var costPerUnit = directCost + overheadCost;
  var priceBeforeTax = 0;
  if (desiredMargin < 100) {
    priceBeforeTax = costPerUnit / (1 - (desiredMargin / 100));
  }

  var profitBeforeTax = priceBeforeTax - costPerUnit;
  var taxAmount = profitBeforeTax > 0 ? profitBeforeTax * (taxRate / 100) : 0;
  var profitAfterTax = profitBeforeTax - taxAmount;
  var zakatAmount = profitAfterTax > 0 ? profitAfterTax * (zakatRate / 100) : 0;
  var netProfitPerUnit = profitAfterTax - zakatAmount;
  var monthlyProfit = netProfitPerUnit * volume;
  var actualMargin = priceBeforeTax > 0 ? (netProfitPerUnit / priceBeforeTax) * 100 : 0;
  var breakEvenPrice = costPerUnit + (volume > 0 ? monthlyFixed / volume : 0);

  return {
    costPerUnit,
    priceBeforeTax,
    profitBeforeTax,
    taxAmount,
    profitAfterTax,
    zakatAmount,
    netProfitPerUnit,
    monthlyProfit,
    actualMargin,
    breakEvenPrice,
    monthlyFixed
  };
}

// ============================================================================
// 4. Cash-Flow Projection (from calculators/cash-flow.html)
// ============================================================================

/**
 * @param {number} openingBalance
 * @param {Array<Object>} monthlyData – 12 items:
 *   [{ inflows: {sales, other, loans}, outflows: {rent, salaries, raw, marketing, taxes, loan_repay, other_exp} }, ...]
 */
function calculateCashFlow(openingBalance, monthlyData) {
  openingBalance = openingBalance || 0;
  monthlyData = monthlyData || [];

  var months = [];
  var INFLOW_KEYS = ['sales', 'other', 'loans'];
  var OUTFLOW_KEYS = ['rent', 'salaries', 'raw', 'marketing', 'taxes', 'loan_repay', 'other_exp'];

  for (var m = 0; m < monthlyData.length; m++) {
    var data = monthlyData[m] || {};
    var month = {
      inflows: {},
      outflows: {},
      totalIn: 0,
      totalOut: 0,
      netCashFlow: 0,
      openingBalance: 0,
      closingBalance: 0
    };

    INFLOW_KEYS.forEach(function (key) {
      var val = (data.inflows && data.inflows[key]) || 0;
      month.inflows[key] = val;
      month.totalIn += val;
    });

    OUTFLOW_KEYS.forEach(function (key) {
      var val = (data.outflows && data.outflows[key]) || 0;
      month.outflows[key] = val;
      month.totalOut += val;
    });

    month.netCashFlow = month.totalIn - month.totalOut;
    month.openingBalance = (m === 0) ? openingBalance : months[m - 1].closingBalance;
    month.closingBalance = month.openingBalance + month.netCashFlow;
    months.push(month);
  }

  var totalIn = 0;
  var totalOut = 0;
  var netFlow = 0;
  var minBal = Infinity;
  var maxBal = -Infinity;

  months.forEach(function (m) {
    totalIn += m.totalIn;
    totalOut += m.totalOut;
    netFlow += m.netCashFlow;
    if (m.closingBalance < minBal) minBal = m.closingBalance;
    if (m.closingBalance > maxBal) maxBal = m.closingBalance;
  });

  if (minBal === Infinity) minBal = 0;
  if (maxBal === -Infinity) maxBal = 0;

  return {
    months,
    totalIn,
    totalOut,
    netFlow,
    minBal,
    maxBal,
    closingBalance: months.length > 0 ? months[months.length - 1].closingBalance : openingBalance
  };
}

// ============================================================================
// 5. Feasibility Analysis (from calculators/feasibility.html)
// ============================================================================

/**
 * @param {Object} setupCosts   – { license, furniture, equipment, marketing, safety, other }
 * @param {Object} monthlyCosts – { rent, salaries, utilities, gasNet, supplies, ads, misc }
 * @param {Object} revenue      – { avgPrice, dailyOrders, workDays }
 */
function calculateFeasibility(setupCosts, monthlyCosts, revenue) {
  setupCosts = setupCosts || {};
  monthlyCosts = monthlyCosts || {};
  revenue = revenue || {};

  var setupTotal = 0;
  for (var k in setupCosts) {
    setupTotal += setupCosts[k] || 0;
  }

  var monthlyFixed = (monthlyCosts.rent || 0) +
                     (monthlyCosts.salaries || 0) +
                     (monthlyCosts.utilities || 0) +
                     (monthlyCosts.gasNet || 0) +
                     (monthlyCosts.ads || 0) +
                     (monthlyCosts.misc || 0);
  var monthlyVariable = monthlyCosts.supplies || 0;
  var monthlyTotal = monthlyFixed + monthlyVariable;

  var avgPrice = revenue.avgPrice || 0;
  var dailyOrders = revenue.dailyOrders || 0;
  var workDays = revenue.workDays || 0;

  var monthlyRevenue = avgPrice * dailyOrders * workDays;
  var yearlyRevenue = monthlyRevenue * 12;

  var monthlyProfit = monthlyRevenue - monthlyTotal;
  var yearlyProfit = monthlyProfit * 12;
  var profitMargin = monthlyRevenue > 0 ? (monthlyProfit / monthlyRevenue) * 100 : 0;

  var beOrdersPerDay = (avgPrice * workDays) > 0 ? monthlyTotal / (avgPrice * workDays) : 0;
  var beOrdersPerMonth = beOrdersPerDay * workDays;
  var beRevenuePerMonth = beOrdersPerMonth * avgPrice;

  var roiMonths = monthlyProfit > 0 ? setupTotal / monthlyProfit : Infinity;

  function calcScenario(dOrders) {
    var mRev = avgPrice * dOrders * workDays;
    var mProfit = mRev - monthlyTotal;
    var margin = mRev > 0 ? (mProfit / mRev) * 100 : 0;
    return { revenue: mRev, profit: mProfit, margin };
  }

  var pess = calcScenario(Math.round(dailyOrders * 0.6));
  pess.dailyOrders = Math.round(dailyOrders * 0.6);
  var exp = calcScenario(dailyOrders);
  exp.dailyOrders = dailyOrders;
  var opt = calcScenario(Math.round(dailyOrders * 1.4));
  opt.dailyOrders = Math.round(dailyOrders * 1.4);

  var scenarios = {
    pessimistic: pess,
    expected: exp,
    optimistic: opt
  };

  return {
    setupTotal,
    monthlyFixed,
    monthlyVariable,
    monthlyTotal,
    monthlyRevenue,
    yearlyRevenue,
    monthlyProfit,
    yearlyProfit,
    profitMargin,
    beOrdersPerDay,
    beOrdersPerMonth,
    beRevenuePerMonth,
    roiMonths,
    scenarios
  };
}

// ============================================================================
// Exports
// ============================================================================

module.exports = {
  calculateBreakEven,
  calculateLoan,
  calculateDTI,
  calculatePricing,
  calculateCashFlow,
  calculateFeasibility
};
