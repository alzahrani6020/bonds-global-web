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
 *   - calculators/restaurant.html → getUnitMultiplier, getEffectiveFee, formatNumber,
 *                                   calculateHealthScore, generateSmartTips,
 *                                   parseIngredientsCSVText, calculateSensitivity
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var exports = factory();
    root.BondsCalc = exports;
    // Global aliases for backwards compatibility with HTML inline scripts
    if (typeof self !== 'undefined' && self === root) {
      self.calculateBreakEven = exports.calculateBreakEven;
      self.calculateLoan = exports.calculateLoan;
      self.calculateDTI = exports.calculateDTI;
      self.calculatePricing = exports.calculatePricing;
      self.calculateCashFlow = exports.calculateCashFlow;
      self.calculateFeasibility = exports.calculateFeasibility;
      self.calculateMedicalViability = exports.calculateMedicalViability;
    }
  }
}(typeof self !== 'undefined' ? self : this, function () {

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
 * @param {Object} [options]        – { platformFeePct, campaignDiscountPct, fixedCostBreakdown, variableCostBreakdown }
 */
function calculateBreakEven(fixedCosts, variableCostPerUnit, sellingPrice, quantity, taxRate, zakatRate, options) {
  fixedCosts = fixedCosts || 0;
  variableCostPerUnit = variableCostPerUnit || 0;
  sellingPrice = sellingPrice || 0;
  quantity = quantity || 0;
  taxRate = (taxRate !== undefined && taxRate !== null) ? taxRate : 0;
  zakatRate = (zakatRate !== undefined && zakatRate !== null) ? zakatRate : 0;
  options = options || {};

  var platformFeePct = options.platformFeePct || 0;
  var campaignDiscountPct = options.campaignDiscountPct || 0;
  var totalDeductionPct = platformFeePct + campaignDiscountPct;
  var effectivePrice = sellingPrice * (1 - totalDeductionPct / 100);

  var contribution = effectivePrice - variableCostPerUnit;
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

  var revenue = quantity * effectivePrice;
  var grossRevenue = quantity * sellingPrice;
  var platformFeeAmount = quantity * sellingPrice * (platformFeePct / 100);
  var campaignDiscountAmount = quantity * sellingPrice * (campaignDiscountPct / 100);
  var totalCost = fixedCosts + (variableCostPerUnit * quantity);
  var profit = revenue - totalCost;

  var taxAmount = profit > 0 ? profit * (taxRate / 100) : 0;
  var profitAfterTax = profit - taxAmount;
  var zakatAmount = profitAfterTax > 0 ? profitAfterTax * (zakatRate / 100) : 0;
  var netProfit = profitAfterTax - zakatAmount;

  // Standard profit margin is based on gross (listed) revenue, not net revenue after fees
  var profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
  var roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  return {
    contribution,
    breakEvenUnits,
    breakEvenAmount,
    revenue,
    grossRevenue,
    effectivePrice,
    platformFeeAmount,
    campaignDiscountAmount,
    totalCost,
    profit,
    taxAmount,
    profitAfterTax,
    zakatAmount,
    netProfit,
    profitMargin,
    roi,
    fixedCostBreakdown: options.fixedCostBreakdown || null,
    variableCostBreakdown: options.variableCostBreakdown || null
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
 * @param {Object} [options]        – { platformFeePct, deliveryCostPerUnit, packagingCostPerUnit, cacPerUnit }
 */
function calculatePricing(directCost, overheadCost, desiredMargin, taxRate, zakatRate, volume, monthlyFixed, options) {
  directCost = directCost || 0;
  overheadCost = overheadCost || 0;
  desiredMargin = desiredMargin || 0;
  taxRate = taxRate || 0;
  zakatRate = zakatRate || 0;
  volume = volume || 0;
  monthlyFixed = monthlyFixed || 0;
  options = options || {};

  var platformFeePct = options.platformFeePct || 0;
  var deliveryCostPerUnit = options.deliveryCostPerUnit || 0;
  var packagingCostPerUnit = options.packagingCostPerUnit || 0;
  var cacPerUnit = options.cacPerUnit || 0;

  var costPerUnit = directCost + overheadCost;
  var totalCostPerUnit = costPerUnit + deliveryCostPerUnit + packagingCostPerUnit + cacPerUnit;

  var priceBeforeFees = 0;
  if (desiredMargin < 100 && desiredMargin > -100) {
    priceBeforeFees = totalCostPerUnit / (1 - (desiredMargin / 100));
  }

  var priceBeforeTax = 0;
  if (platformFeePct < 100) {
    priceBeforeTax = priceBeforeFees / (1 - (platformFeePct / 100));
  }

  var platformFeeAmount = priceBeforeTax * (platformFeePct / 100);
  var netRevenuePerUnit = priceBeforeTax - platformFeeAmount;
  var profitBeforeTax = netRevenuePerUnit - totalCostPerUnit;
  var taxAmount = profitBeforeTax > 0 ? profitBeforeTax * (taxRate / 100) : 0;
  var profitAfterTax = profitBeforeTax - taxAmount;
  var zakatAmount = profitAfterTax > 0 ? profitAfterTax * (zakatRate / 100) : 0;
  var netProfitPerUnit = profitAfterTax - zakatAmount;
  var monthlyProfit = netProfitPerUnit * volume;
  var actualMargin = priceBeforeTax > 0 ? (netProfitPerUnit / priceBeforeTax) * 100 : 0;
  var netRequiredPerUnit = totalCostPerUnit + (volume > 0 ? monthlyFixed / volume : 0);
  var breakEvenPrice = platformFeePct < 100 ? netRequiredPerUnit / (1 - platformFeePct / 100) : 0;

  return {
    costPerUnit,
    totalCostPerUnit,
    priceBeforeFees,
    priceBeforeTax,
    platformFeePct,
    platformFeeAmount,
    deliveryCostPerUnit,
    packagingCostPerUnit,
    cacPerUnit,
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
 * @param {Object} [options]    – { platformFeePct, wasteRatePct, packagingCostPerOrder, deliveryCostPerOrder, monthlyGrowthPct }
 */
function calculateFeasibility(setupCosts, monthlyCosts, revenue, options) {
  setupCosts = setupCosts || {};
  monthlyCosts = monthlyCosts || {};
  revenue = revenue || {};
  options = options || {};

  var platformFeePct = options.platformFeePct || 0;
  var wasteRatePct = options.wasteRatePct || 0;
  var packagingCostPerOrder = options.packagingCostPerOrder || 0;
  var deliveryCostPerOrder = options.deliveryCostPerOrder || 0;
  var monthlyGrowthPct = options.monthlyGrowthPct || 0;

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
  var monthlySupplies = monthlyCosts.supplies || 0;
  var avgPrice = revenue.avgPrice || 0;
  var dailyOrders = revenue.dailyOrders || 0;
  var workDays = revenue.workDays || 0;
  var monthlyOrderCount = dailyOrders * workDays;

  var suppliesPerOrder = monthlyOrderCount > 0 ? monthlySupplies / monthlyOrderCount : 0;
  var effectiveOrderRevenue = avgPrice * (1 - platformFeePct / 100);
  var effectiveOrderCost = suppliesPerOrder * (1 + wasteRatePct / 100) + packagingCostPerOrder + deliveryCostPerOrder;
  var orderContribution = effectiveOrderRevenue - effectiveOrderCost;

  // Monthly projections with optional growth
  var monthlyProjections = [];
  var totalYearlyRevenue = 0;
  var totalYearlyProfit = 0;
  var totalYearlyVariableCost = 0;
  var totalPlatformFeeAmount = 0;
  var totalWasteCost = 0;
  var totalPackagingCost = 0;
  var totalDeliveryCost = 0;

  for (var m = 0; m < 12; m++) {
    var growthFactor = Math.pow(1 + monthlyGrowthPct / 100, m);
    var monthOrders = monthlyOrderCount * growthFactor;
    var monthRevenue = effectiveOrderRevenue * monthOrders;
    var monthSupplies = suppliesPerOrder * monthOrders;
    var monthWaste = monthSupplies * (wasteRatePct / 100);
    var monthPackaging = packagingCostPerOrder * monthOrders;
    var monthDelivery = deliveryCostPerOrder * monthOrders;
    var monthVariableCost = monthSupplies + monthWaste + monthPackaging + monthDelivery;
    var monthPlatformFee = (avgPrice * monthOrders) * (platformFeePct / 100);
    var monthProfit = monthRevenue - monthlyFixed - monthVariableCost;

    monthlyProjections.push({
      month: m + 1,
      orders: monthOrders,
      revenue: monthRevenue,
      platformFee: monthPlatformFee,
      supplies: monthSupplies,
      waste: monthWaste,
      packaging: monthPackaging,
      delivery: monthDelivery,
      variableCost: monthVariableCost,
      fixedCost: monthlyFixed,
      profit: monthProfit
    });

    totalYearlyRevenue += monthRevenue;
    totalYearlyProfit += monthProfit;
    totalYearlyVariableCost += monthVariableCost;
    totalPlatformFeeAmount += monthPlatformFee;
    totalWasteCost += monthWaste;
    totalPackagingCost += monthPackaging;
    totalDeliveryCost += monthDelivery;
  }

  var monthlyRevenue = totalYearlyRevenue / 12;
  var yearlyRevenue = totalYearlyRevenue;
  var monthlyVariable = totalYearlyVariableCost / 12;
  var monthlyTotal = monthlyFixed + monthlyVariable;
  var monthlyProfit = totalYearlyProfit / 12;
  var yearlyProfit = totalYearlyProfit;
  var profitMargin = yearlyRevenue > 0 ? (yearlyProfit / yearlyRevenue) * 100 : 0;

  var beOrdersPerDay = (orderContribution * workDays) > 0 ? monthlyFixed / (orderContribution * workDays) : 0;
  var beOrdersPerMonth = beOrdersPerDay * workDays;
  var beRevenuePerMonth = beOrdersPerMonth * avgPrice;

  var roiMonths = monthlyProfit > 0 ? setupTotal / monthlyProfit : Infinity;

  function calcScenario(dOrders, growth) {
    var totalRev = 0;
    var totalProfit = 0;
    var totalOrders = 0;
    for (var i = 0; i < 12; i++) {
      var gf = Math.pow(1 + growth / 100, i);
      var orders = dOrders * workDays * gf;
      var rev = effectiveOrderRevenue * orders;
      var supplies = suppliesPerOrder * orders;
      var waste = supplies * (wasteRatePct / 100);
      var packaging = packagingCostPerOrder * orders;
      var delivery = deliveryCostPerOrder * orders;
      var variable = supplies + waste + packaging + delivery;
      var profit = rev - monthlyFixed - variable;
      totalRev += rev;
      totalProfit += profit;
      totalOrders += orders;
    }
    var avgMonthlyRev = totalRev / 12;
    var avgMonthlyProfit = totalProfit / 12;
    var margin = avgMonthlyRev > 0 ? (avgMonthlyProfit / avgMonthlyRev) * 100 : 0;
    return { revenue: avgMonthlyRev, profit: avgMonthlyProfit, margin, yearlyRevenue: totalRev, yearlyProfit: totalProfit };
  }

  var pess = calcScenario(Math.round(dailyOrders * 0.6), monthlyGrowthPct);
  pess.dailyOrders = Math.round(dailyOrders * 0.6);
  var exp = calcScenario(dailyOrders, monthlyGrowthPct);
  exp.dailyOrders = dailyOrders;
  var opt = calcScenario(Math.round(dailyOrders * 1.4), monthlyGrowthPct);
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
    scenarios,
    monthlyProjections,
    platformFeePct,
    platformFeeAmount: totalPlatformFeeAmount / 12,
    yearlyPlatformFeeAmount: totalPlatformFeeAmount,
    wasteRatePct,
    wasteCost: totalWasteCost / 12,
    yearlyWasteCost: totalWasteCost,
    packagingCost: totalPackagingCost / 12,
    yearlyPackagingCost: totalPackagingCost,
    deliveryCost: totalDeliveryCost / 12,
    yearlyDeliveryCost: totalDeliveryCost,
    effectiveOrderRevenue,
    effectiveOrderCost,
    orderContribution,
    monthlyGrowthPct
  };
}

// ============================================================================
// 6. Medical Viability (calculators/medical-viability.html)
// ============================================================================

/**
 * @param {Object} setupCosts   – { license, equipment, furniture, marketing, other }
 * @param {Object} monthlyCosts – { rent, salaries, utilities, ads, misc, supplies, depreciation }
 * @param {Object} revenue      – { unitPrice, dailyUnits, workDays }
 * @param {Object} options      – { activity, monthlyGrowthPct, cogsRatio, expiryLossPct, insurancePct, discountPct,
 *                                   doctorCommissionPct, consumablesPerVisit, noShowPct,
 *                                   insuranceRejectionPct, reagentCostRatio, failedTestsPct }
 */
function calculateMedicalViability(setupCosts, monthlyCosts, revenue, options) {
  setupCosts = setupCosts || {};
  monthlyCosts = monthlyCosts || {};
  revenue = revenue || {};
  options = options || {};

  const activity = options.activity || 'pharmacy';
  const unitPrice = revenue.unitPrice || 0;
  const dailyUnits = revenue.dailyUnits || 0;
  const workDays = revenue.workDays || 0;
  const monthlyGrowthPct = options.monthlyGrowthPct || 0;
  const vatRate = options.vatRate || 0;
  const zakatRate = options.zakatRate || 0;
  const extraServiceRevenue = options.extraServiceRevenue || 0;
  const extraServiceCost = options.extraServiceCost || 0;

  const setupTotal = Object.keys(setupCosts).reduce(function(sum, k) {
    return sum + (setupCosts[k] || 0);
  }, 0);

  const monthlyFixed = (monthlyCosts.rent || 0) +
                       (monthlyCosts.salaries || 0) +
                       (monthlyCosts.utilities || 0) +
                       (monthlyCosts.ads || 0) +
                       (monthlyCosts.misc || 0) +
                       (monthlyCosts.depreciation || 0);

  function calcMonth(dUnits, monthIndex) {
    const growthFactor = Math.pow(1 + monthlyGrowthPct / 100, monthIndex);
    const mUnits = dUnits * workDays * growthFactor;
    const medicalGross = unitPrice * mUnits;
    const mGross = medicalGross + extraServiceRevenue;
    let mDeduction = 0;
    let mVariable = 0;
    let mVariableDetail = {};
    let mLossDetail = {};

    if (activity === 'pharmacy') {
      const cogsRatio = options.cogsRatio || 0;
      const expiryLossPct = options.expiryLossPct || 0;
      const insurancePct = options.insurancePct || 0;
      const discountPct = options.discountPct || 0;
      const insuranceAmount = medicalGross * (insurancePct / 100);
      const discountAmount = medicalGross * (discountPct / 100);
      const cogsAmount = medicalGross * (cogsRatio / 100);
      const expiryLoss = cogsAmount * (expiryLossPct / 100);
      mDeduction = insuranceAmount + discountAmount;
      mVariable = cogsAmount + expiryLoss;
      mVariableDetail = { cogsAmount, expiryLoss };
      mLossDetail = { insuranceAmount, discountAmount };
    } else if (activity === 'clinic') {
      const doctorCommissionPct = options.doctorCommissionPct || 0;
      const consumablesPerVisit = options.consumablesPerVisit || 0;
      const noShowPct = options.noShowPct || 0;
      const insuranceRejectionPct = options.insuranceRejectionPct || 0;
      const attendedUnits = mUnits * (1 - noShowPct / 100);
      const noShowLoss = medicalGross * (noShowPct / 100);
      const attendedRevenue = medicalGross - noShowLoss;
      const insuranceRejectionAmount = attendedRevenue * (insuranceRejectionPct / 100);
      mDeduction = noShowLoss + insuranceRejectionAmount;
      const doctorCommissionPerVisit = unitPrice * (doctorCommissionPct / 100);
      mVariable = (doctorCommissionPerVisit + consumablesPerVisit) * attendedUnits;
      mLossDetail = { noShowLoss, insuranceRejectionAmount, attendedUnits };
    } else if (activity === 'lab') {
      const reagentCostRatio = options.reagentCostRatio || 0;
      const failedTestsPct = options.failedTestsPct || 0;
      const insurancePct = options.insurancePct || 0;
      const insuranceAmount = medicalGross * (insurancePct / 100);
      const reagentCost = medicalGross * (reagentCostRatio / 100);
      const failedTestsCost = reagentCost * (failedTestsPct / 100);
      mDeduction = insuranceAmount;
      mVariable = reagentCost + failedTestsCost;
      mVariableDetail = { reagentCost, failedTestsCost };
      mLossDetail = { insuranceAmount };
    }

    const vatAmount = mGross * (vatRate / 100);
    mDeduction += vatAmount;
    mVariable += extraServiceCost;

    const mNet = mGross - mDeduction;
    let mProfit = mNet - monthlyFixed - mVariable;
    let zakatAmount = 0;
    if (zakatRate > 0 && mProfit > 0) {
      zakatAmount = mProfit * (zakatRate / 100);
      mProfit -= zakatAmount;
    }

    return {
      month: monthIndex + 1,
      units: mUnits,
      grossRevenue: mGross,
      medicalGross: medicalGross,
      deduction: mDeduction,
      vatAmount,
      zakatAmount,
      netRevenue: mNet,
      variableCost: mVariable,
      fixedCost: monthlyFixed,
      profit: mProfit,
      variableDetail: mVariableDetail,
      lossDetail: mLossDetail
    };
  }

  function aggregate(dUnits) {
    const projections = [];
    let totalGross = 0;
    let totalDeduction = 0;
    let totalNet = 0;
    let totalVariable = 0;
    let totalProfit = 0;
    let totalVat = 0;
    let totalZakat = 0;
    for (let m = 0; m < 12; m++) {
      const p = calcMonth(dUnits, m);
      projections.push(p);
      totalGross += p.grossRevenue;
      totalDeduction += p.deduction;
      totalNet += p.netRevenue;
      totalVariable += p.variableCost;
      totalProfit += p.profit;
      totalVat += p.vatAmount;
      totalZakat += p.zakatAmount;
    }
    return {
      projections,
      grossRevenue: totalGross / 12,
      deductionAmount: totalDeduction / 12,
      netRevenue: totalNet / 12,
      variableCost: totalVariable / 12,
      profit: totalProfit / 12,
      vatAmount: totalVat / 12,
      zakatAmount: totalZakat / 12,
      yearlyGross: totalGross,
      yearlyNet: totalNet,
      yearlyProfit: totalProfit,
      yearlyVat: totalVat,
      yearlyZakat: totalZakat
    };
  }

  const base = aggregate(dailyUnits);
  const firstMonth = calcMonth(dailyUnits, 0);

  const grossRevenue = base.grossRevenue;
  const deductionAmount = base.deductionAmount;
  const netRevenue = base.netRevenue;
  const variableCost = base.variableCost;
  const monthlyProfit = base.profit;
  const yearlyRevenue = base.yearlyNet;
  const yearlyProfit = base.yearlyProfit;
  const profitMargin = yearlyRevenue > 0 ? (yearlyProfit / yearlyRevenue) * 100 : 0;

  const monthlyUnitCount = dailyUnits * workDays;
  const contributionPerUnit = monthlyUnitCount > 0 ? (firstMonth.netRevenue - firstMonth.variableCost) / monthlyUnitCount : 0;
  const beUnitsPerDay = contributionPerUnit > 0 && workDays > 0 ? monthlyFixed / (contributionPerUnit * workDays) : 0;
  const beUnitsPerMonth = beUnitsPerDay * workDays;
  const beRevenuePerMonth = beUnitsPerMonth * unitPrice;

  const roiMonths = monthlyProfit > 0 ? setupTotal / monthlyProfit : Infinity;

  function calcScenario(dUnits) {
    const agg = aggregate(dUnits);
    const margin = agg.netRevenue > 0 ? (agg.profit / agg.netRevenue) * 100 : 0;
    return { dailyUnits: dUnits, units: dUnits * workDays, revenue: agg.netRevenue, profit: agg.profit, margin: margin };
  }

  const scenarios = {
    pessimistic: calcScenario(Math.round(dailyUnits * 0.6)),
    expected: calcScenario(dailyUnits),
    optimistic: calcScenario(Math.round(dailyUnits * 1.4))
  };

  function calcSensitivity(deltaPct) {
    const dUnits = dailyUnits * (1 + deltaPct / 100);
    const agg = aggregate(dUnits);
    return { deltaPct, dailyUnits: dUnits, monthlyProfit: agg.profit, yearlyProfit: agg.yearlyProfit };
  }

  const sensitivity = {
    minus20: calcSensitivity(-20),
    minus10: calcSensitivity(-10),
    plus10: calcSensitivity(10),
    plus20: calcSensitivity(20)
  };

  // Preserve detail from expected month for UI extras
  const firstDetail = base.projections[0];
  let variableDetail = {};
  let lossDetail = {};
  if (activity === 'pharmacy') {
    variableDetail = { cogsRatio: options.cogsRatio || 0, cogsAmount: firstDetail.variableDetail.cogsAmount, expiryLossPct: options.expiryLossPct || 0, expiryLoss: firstDetail.variableDetail.expiryLoss, insurancePct: options.insurancePct || 0, discountPct: options.discountPct || 0 };
    lossDetail = { insuranceAmount: firstDetail.lossDetail.insuranceAmount, discountAmount: firstDetail.lossDetail.discountAmount };
  } else if (activity === 'clinic') {
    const doctorCommissionPerVisit = unitPrice * ((options.doctorCommissionPct || 0) / 100);
    variableDetail = { doctorCommissionPct: options.doctorCommissionPct || 0, doctorCommissionPerVisit, consumablesPerVisit: options.consumablesPerVisit || 0, noShowPct: options.noShowPct || 0, insuranceRejectionPct: options.insuranceRejectionPct || 0 };
    lossDetail = { noShowLoss: firstDetail.lossDetail.noShowLoss, insuranceRejectionAmount: firstDetail.lossDetail.insuranceRejectionAmount, attendedUnits: firstDetail.lossDetail.attendedUnits };
  } else if (activity === 'lab') {
    variableDetail = { reagentCostRatio: options.reagentCostRatio || 0, reagentCost: firstDetail.variableDetail.reagentCost, failedTestsPct: options.failedTestsPct || 0, failedTestsCost: firstDetail.variableDetail.failedTestsCost, insurancePct: options.insurancePct || 0 };
    lossDetail = { insuranceAmount: firstDetail.lossDetail.insuranceAmount };
  }

  return {
    activity,
    setupTotal,
    monthlyFixed,
    monthlyVariable: variableCost,
    monthlyTotal: monthlyFixed + variableCost,
    grossRevenue,
    deductionAmount,
    netRevenue,
    monthlyRevenue: netRevenue,
    yearlyRevenue,
    monthlyProfit,
    yearlyProfit,
    profitMargin,
    beUnitsPerDay,
    beUnitsPerMonth,
    beRevenuePerMonth,
    roiMonths,
    scenarios,
    sensitivity,
    monthlyProjections: base.projections,
    monthlyGrowthPct,
    vatRate,
    zakatRate,
    vatAmount: base.vatAmount,
    zakatAmount: base.zakatAmount,
    yearlyVat: base.yearlyVat,
    yearlyZakat: base.yearlyZakat,
    extraServiceRevenue,
    extraServiceCost,
    variableDetail,
    lossDetail,
    unitPrice,
    dailyUnits,
    workDays
  };
}

// ============================================================================
// 7. Restaurant Calculator Helpers (from calculators/restaurant.html)
// ============================================================================

var INGREDIENT_UNITS = [
  { value: 'kg', label: 'كغ', factor: 1, priceLabel: 'لكغ' },
  { value: 'g', label: 'غرام', factor: 0.001, priceLabel: 'لكغ' },
  { value: 'mg', label: 'ملغ', factor: 0.000001, priceLabel: 'لكغ' },
  { value: 'l', label: 'لتر', factor: 1, priceLabel: 'للتر' },
  { value: 'ml', label: 'مل', factor: 0.001, priceLabel: 'للتر' },
  { value: 'piece', label: 'قطعة', factor: 1, priceLabel: 'للقطعة' },
  { value: 'box', label: 'علبة', factor: 1, priceLabel: 'للعلبة' },
  { value: 'cup', label: 'كوب', factor: 1, priceLabel: 'للكوب' },
  { value: 'spoon', label: 'ملعقة', factor: 1, priceLabel: 'للملعقة' }
];

function getUnitMultiplier(unitValue) {
  var opt = INGREDIENT_UNITS.find(function(u) { return u.value === unitValue; });
  return opt ? opt.factor : 1;
}

function getEffectiveFee(platformData, monthlyGMV) {
  var baseFee = (platformData.fee || 0) + (platformData.serviceFee || 0);
  var tiers = platformData.feeTiers;
  if (!tiers || !monthlyGMV || monthlyGMV <= 0) return { fee: baseFee, tierApplied: false };
  for (var i = 0; i < tiers.length; i++) {
    var t = tiers[i];
    if (monthlyGMV >= t.min && monthlyGMV <= t.max) {
      return { fee: (t.fee || 0) + (platformData.serviceFee || 0), tierApplied: true, tierName: t.min + '-' + t.max };
    }
  }
  return { fee: baseFee, tierApplied: false };
}

function formatNumber(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return Math.round(n).toLocaleString('en-US');
}

function calculateHealthScore(r, lang) {
  lang = lang || 'ar';
  var isEn = lang === 'en';
  var inputs = r.inputs;
  var score = 0;
  var breakdown = [];

  var labels = isEn
    ? ['Profit Margin', 'Food Cost', 'Fee Burden', 'Break-Even Safety']
    : ['هامش الربح', 'تكلفة الطعام', 'عبء العمولة', 'أمان التعادل'];
  var icons = ['💰', '🍽️', '📱', '🛡️'];

  // 1. Profit Margin (30% weight)
  var marginScore = 0;
  if (r.profitMargin >= 20) marginScore = 100;
  else if (r.profitMargin >= 10) marginScore = 50 + (r.profitMargin - 10) * 5;
  else if (r.profitMargin >= 0) marginScore = r.profitMargin * 5;
  else marginScore = 0;
  score += marginScore * 0.30;
  breakdown.push({ label: labels[0], score: Math.round(marginScore), icon: icons[0] });

  // 2. Food Cost (25% weight)
  var foodScore = 0;
  var fc = r.weightedFoodCostPct || 0;
  if (fc <= 25) foodScore = 100;
  else if (fc <= 30) foodScore = 100 - (fc - 25) * 5;
  else if (fc <= 35) foodScore = 75 - (fc - 30) * 5;
  else foodScore = Math.max(0, 50 - (fc - 35) * 3);
  score += foodScore * 0.25;
  breakdown.push({ label: labels[1], score: Math.round(foodScore), icon: icons[1] });

  // 3. Platform Fee Burden (25% weight)
  var avgFee = 0;
  if (inputs.platforms.length > 0) {
    var totalFee = inputs.platforms.reduce(function(sum, p) { return sum + p.fee + (p.serviceFee || 0); }, 0);
    avgFee = totalFee / inputs.platforms.length;
  }
  var feeScore = 0;
  if (avgFee <= 20) feeScore = 100;
  else if (avgFee <= 25) feeScore = 100 - (avgFee - 20) * 5;
  else if (avgFee <= 30) feeScore = 75 - (avgFee - 25) * 5;
  else feeScore = Math.max(0, 50 - (avgFee - 30) * 3);
  score += feeScore * 0.25;
  breakdown.push({ label: labels[2], score: Math.round(feeScore), icon: icons[2] });

  // 4. Break-Even Safety (20% weight)
  var beScore = 0;
  if (r.breakEvenDaily > 0) {
    var ratio = inputs.dailyOrders / r.breakEvenDaily;
    if (ratio >= 2) beScore = 100;
    else if (ratio >= 1.5) beScore = 75 + (ratio - 1.5) * 50;
    else if (ratio >= 1) beScore = 50 + (ratio - 1) * 50;
    else beScore = Math.max(0, ratio * 50);
  } else {
    beScore = 100;
  }
  score += beScore * 0.20;
  breakdown.push({ label: labels[3], score: Math.round(beScore), icon: icons[3] });

  var finalScore = Math.round(Math.min(100, Math.max(0, score)));

  var color = finalScore >= 80 ? '#16a34a' : (finalScore >= 50 ? '#d4a853' : '#dc2626');

  var labelText = isEn
    ? (finalScore >= 80 ? 'Excellent — Your restaurant is in great shape' :
       finalScore >= 60 ? 'Good — There is room for small improvement' :
       finalScore >= 40 ? 'Average — Review costs and pricing' :
       'Weak — You need immediate operational intervention')
    : (finalScore >= 80 ? 'ممتاز — مطعمك في وضع صحي جداً' :
       finalScore >= 60 ? 'جيد — هناك مجال لتحسين بسيط' :
       finalScore >= 40 ? 'متوسط — راجع التكاليف والأسعار' :
       'ضعيف — تحتاج لتدخل فوري في النموذج التشغيلي');

  return { finalScore, breakdown, labelText, color };
}

function generateSmartTips(r, currency, lang) {
  lang = lang || 'ar';
  var isEn = lang === 'en';
  var tips = [];
  var inputs = r.inputs;
  currency = currency || '';

  // Tip 1: Profit vs loss
  if (r.netProfit < 0) {
    var be = r.breakEvenDaily;
    var needed = be - inputs.dailyOrders;
    if (needed > 0) {
      tips.push(isEn
        ? 'You are currently losing money. Increasing daily orders by just ' + needed + ' reaches break-even.'
        : 'أنت تخسر حالياً. زيادة الطلبات اليومية بـ ' + needed + ' طلب فقط تحقق لك نقطة التعادل.');
    }
    var priceBoost = Math.ceil((-r.netProfit / (inputs.dailyOrders * inputs.workingDays)) / (inputs.dailyOrders * inputs.workingDays) * 100);
    if (priceBoost > 0 && priceBoost < 50) {
      tips.push(isEn
        ? 'Raising prices by ~' + priceBoost + '% achieves break-even without more orders.'
        : 'زيادة سعر البيع ' + priceBoost + '% تقريباً يحقق التعادل بدون زيادة طلبات.');
    }
  } else {
    tips.push(isEn
      ? 'Your total profit is ' + formatNumber(Math.round(r.netProfit)) + ' ' + currency + '/month. Try scaling on your best platform (' + r.bestPlatform.name + ').'
      : 'أرباحك الإجمالية ' + formatNumber(Math.round(r.netProfit)) + ' ' + currency + '/شهر. حاول زيادة الحجم على أفضل منصة (' + r.bestPlatform.name + ').');
  }

  // Tip 2: Best vs worst platform
  if (r.worstPlatform && r.bestPlatform && r.worstPlatform.name !== r.bestPlatform.name) {
    var diff = r.bestPlatform.monthlyProfit - r.worstPlatform.monthlyProfit;
    if (diff > 0) {
      tips.push(isEn
        ? 'Gap between best (' + r.bestPlatform.name + ') and worst (' + r.worstPlatform.name + ') = ' + formatNumber(Math.round(diff)) + ' ' + currency + '/month.'
        : 'الفرق بين أفضل منصة (' + r.bestPlatform.name + ') وأسوأها (' + r.worstPlatform.name + ') = ' + formatNumber(Math.round(diff)) + ' ' + currency + '/شهر.');
    }
  }

  // Tip 3: Break-even analysis
  if (r.breakEvenDaily > inputs.dailyOrders * 1.5) {
    tips.push(isEn
      ? 'Break-even is high (' + r.breakEvenDaily + ' orders/day). Review fixed costs or profit margin.'
      : 'نقطة التعادل مرتفعة (' + r.breakEvenDaily + ' طلب/يوم). راجع التكاليف الثابتة أو هامش الربح.');
  }

  // Tip 4: Open vs closed model
  var openProfit = 0, closedProfit = 0;
  r.platformResults.forEach(function(p) {
    var pm = inputs.platforms.find(function(x) { return x.name === p.name; });
    if (pm) {
      if (pm.operatingModel === 'open') openProfit += p.monthlyProfit;
      else if (pm.operatingModel === 'closed') closedProfit += p.monthlyProfit;
    }
  });
  if (openProfit > closedProfit && closedProfit > 0) {
    tips.push(isEn
      ? 'Open-courier model (like Mrsool) earns ' + formatNumber(Math.round(openProfit - closedProfit)) + ' ' + currency + ' more than closed-menu platforms.'
      : 'نموذج المندوب المفتوح (مثل مرسول) يحقق ربحاً أعلى بـ ' + formatNumber(Math.round(openProfit - closedProfit)) + ' ' + currency + ' من القائمة المغلقة.');
  }

  // Tip 5: Food cost
  if (r.weightedFoodCostPct > 35) {
    tips.push(isEn
      ? 'Food cost ratio is high (' + r.weightedFoodCostPct.toFixed(1) + '%). Ideal range is 25-30%.'
      : 'نسبة تكلفة الطعام مرتفعة (' + r.weightedFoodCostPct.toFixed(1) + '%). المعدل المثالي 25-30%.');
  }

  return tips;
}

function parseIngredientsCSVText(text) {
  var lines = text.split('\n').filter(function(l) { return l.trim(); });
  var ingredients = [];
  lines.forEach(function(line, idx) {
    if (idx === 0 && line.toLowerCase().includes('ingredient')) return; // skip header
    var parts = line.split(',');
    if (parts.length >= 3) {
      ingredients.push({ name: parts[0].trim(), unit: parts[1].trim(), price: parseFloat(parts[2]) || 0 });
    }
  });
  return ingredients;
}

function calculateSensitivity(baseResult, commissionDelta, ordersDelta, priceDelta, costDelta, vatRate) {
  var inputs = baseResult.inputs;
  var adjustedPrice = baseResult.weightedPrice * (1 + priceDelta/100);
  var adjustedCost = baseResult.weightedCost * (1 + costDelta/100);
  var adjustedOrders = inputs.dailyOrders * (1 + ordersDelta/100);
  var monthlyFixed = inputs.rent + inputs.salaries + inputs.utilities + inputs.licenses + inputs.cloudKitchen + inputs.marketing;
  var dailyFixed = monthlyFixed / inputs.workingDays;
  vatRate = vatRate || 0;

  var platformResults = inputs.platforms.map(function(p) {
    var ef = getEffectiveFee(p, inputs.monthlyGMV);
    var totalFee = ef.fee + commissionDelta;
    if (totalFee < 0) totalFee = 0;
    var commissionValue = adjustedPrice * (totalFee / 100);
    var vatValue = commissionValue * (vatRate / 100);
    var pgFeeValue = adjustedPrice * ((p.paymentGatewayFee || 0) / 100);
    var campaignValue = adjustedPrice * ((p.campaignDiscount || 0) / 100);
    var totalDeduction = commissionValue + vatValue + pgFeeValue + campaignValue;
    var platformPrice = adjustedPrice - totalDeduction;
    var varCostPerOrder = adjustedCost + inputs.packaging + inputs.delivery;
    var contributionPerOrder = platformPrice - varCostPerOrder;
    var dailyProfit = contributionPerOrder * adjustedOrders - dailyFixed;
    var monthlyProfit = dailyProfit * inputs.workingDays;
    var breakEvenOrders = contributionPerOrder > 0 ? Math.ceil(dailyFixed / contributionPerOrder) : -1;
    return {
      name: p.name, monthlyProfit: monthlyProfit, breakEvenOrders: breakEvenOrders
    };
  });

  var bestPlatform = platformResults.reduce(function(best, p) {
    return (p.monthlyProfit > best.monthlyProfit) ? p : best;
  }, platformResults[0] || { monthlyProfit: -Infinity });

  var totalMonthlyRevenue = adjustedPrice * adjustedOrders * inputs.workingDays;
  var totalMonthlyVarCost = (adjustedCost + inputs.packaging + inputs.delivery) * adjustedOrders * inputs.workingDays;
  var netProfit = totalMonthlyRevenue - totalMonthlyVarCost - monthlyFixed;

  return {
    netProfit: netProfit,
    bestPlatform: bestPlatform,
    breakEvenDaily: platformResults.length > 0 && platformResults[0].breakEvenOrders > 0 ? platformResults[0].breakEvenOrders : -1
  };
}

// ============================================================================
// Exports
// ============================================================================

return {
  calculateBreakEven,
  calculateLoan,
  calculateDTI,
  calculatePricing,
  calculateCashFlow,
  calculateFeasibility,
  calculateMedicalViability,
  INGREDIENT_UNITS,
  getUnitMultiplier,
  getEffectiveFee,
  formatNumber,
  calculateHealthScore,
  generateSmartTips,
  parseIngredientsCSVText,
  calculateSensitivity
};

}));
