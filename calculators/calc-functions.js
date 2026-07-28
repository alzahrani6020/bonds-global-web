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
      self.calculatePriceTargets = exports.calculatePriceTargets;
      self.calculateLoan = exports.calculateLoan;
      self.calculateDTI = exports.calculateDTI;
      self.calculatePricing = exports.calculatePricing;
      self.calculateCashFlow = exports.calculateCashFlow;
      self.calculateFeasibility = exports.calculateFeasibility;
      self.calculateMedicalViability = exports.calculateMedicalViability;
      self.calculateInvestmentScore = exports.calculateInvestmentScore;
      self.calculateRealProjectAnalysis = exports.calculateRealProjectAnalysis;
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
  var wasteAndIncidentalsPct = options.wasteAndIncidentalsPct || options.contingencyPct || 0;
  var totalDeductionPct = platformFeePct + campaignDiscountPct;
  var effectivePrice = sellingPrice * (1 - totalDeductionPct / 100);

  var adjustedVariableCostPerUnit = variableCostPerUnit * (1 + wasteAndIncidentalsPct / 100);
  var wasteAndIncidentalsAmountPerUnit = adjustedVariableCostPerUnit - variableCostPerUnit;

  var contribution = effectivePrice - adjustedVariableCostPerUnit;
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
  var totalCost = fixedCosts + (adjustedVariableCostPerUnit * quantity);
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
    wasteAndIncidentalsPct,
    wasteAndIncidentalsAmountPerUnit,
    adjustedVariableCostPerUnit,
    fixedCostBreakdown: options.fixedCostBreakdown || null,
    variableCostBreakdown: options.variableCostBreakdown || null
  };
}

/**
 * Calculate optimal/target prices for a given cost structure.
 *
 * @param {number} fixedCosts       – monthly fixed costs
 * @param {number} variableCostPerUnit
 * @param {number} quantity         – expected monthly quantity
 * @param {Object} [options]        – { platformFeePct, campaignDiscountPct, wasteAndIncidentalsPct, taxRate, zakatRate }
 */
function calculatePriceTargets(fixedCosts, variableCostPerUnit, quantity, options) {
  fixedCosts = fixedCosts || 0;
  variableCostPerUnit = variableCostPerUnit || 0;
  quantity = quantity || 0;
  options = options || {};

  var platformFeePct = options.platformFeePct || 0;
  var campaignDiscountPct = options.campaignDiscountPct || 0;
  var wasteAndIncidentalsPct = options.wasteAndIncidentalsPct || 0;
  var taxRate = (options.taxRate !== undefined && options.taxRate !== null) ? options.taxRate : 0;
  var zakatRate = (options.zakatRate !== undefined && options.zakatRate !== null) ? options.zakatRate : 0;
  var totalDeductionPct = platformFeePct + campaignDiscountPct;
  var adjustedVariableCostPerUnit = variableCostPerUnit * (1 + wasteAndIncidentalsPct / 100);

  // Minimum price where contribution per unit is zero (covers variable cost only)
  var minPriceNoLoss = Infinity;
  if (totalDeductionPct < 100) {
    minPriceNoLoss = adjustedVariableCostPerUnit / (1 - totalDeductionPct / 100);
  }

  // Price that achieves zero net profit at the expected quantity
  var priceForZeroProfit = 0;
  if (quantity > 0 && totalDeductionPct < 100) {
    priceForZeroProfit = (fixedCosts + adjustedVariableCostPerUnit * quantity) / (quantity * (1 - totalDeductionPct / 100));
  }

  function netProfitAtPrice(price) {
    var effectivePrice = price * (1 - totalDeductionPct / 100);
    var revenue = quantity * effectivePrice;
    var totalCost = fixedCosts + adjustedVariableCostPerUnit * quantity;
    var profit = revenue - totalCost;
    var taxAmount = profit > 0 ? profit * (taxRate / 100) : 0;
    var profitAfterTax = profit - taxAmount;
    var zakatAmount = profitAfterTax > 0 ? profitAfterTax * (zakatRate / 100) : 0;
    return profitAfterTax - zakatAmount;
  }

  // Find price that yields a specific net profit margin on gross revenue
  function priceForMargin(targetMarginPct) {
    var low = Math.max(priceForZeroProfit, minPriceNoLoss, 0);
    var high = Math.max(low * 2, minPriceNoLoss * 2, 1);
    var maxIter = 60;
    for (var i = 0; i < maxIter; i++) {
      var mid = (low + high) / 2;
      var net = netProfitAtPrice(mid);
      var grossRevenue = quantity * mid;
      var margin = grossRevenue > 0 ? (net / grossRevenue) * 100 : 0;
      if (Math.abs(margin - targetMarginPct) < 0.01 || (high - low) < 0.001) return mid;
      if (margin < targetMarginPct) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return (low + high) / 2;
  }

  // Find price that yields a specific absolute net profit
  function priceForProfit(targetProfit) {
    var low = priceForZeroProfit;
    var high = Math.max(low * 2, minPriceNoLoss * 2, 1);
    var maxIter = 60;
    for (var i = 0; i < maxIter; i++) {
      var mid = (low + high) / 2;
      var net = netProfitAtPrice(mid);
      if (Math.abs(net - targetProfit) < 0.01 || (high - low) < 0.001) return mid;
      if (net < targetProfit) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return (low + high) / 2;
  }

  return {
    minPriceNoLoss: minPriceNoLoss,
    priceForZeroProfit: priceForZeroProfit,
    priceForMargin: priceForMargin,
    priceForProfit: priceForProfit
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
  var paymentGatewayFeePct = options.paymentGatewayFeePct || 0;
  var deliveryCostPerUnit = options.deliveryCostPerUnit || 0;
  var packagingCostPerUnit = options.packagingCostPerUnit || 0;
  var cacPerUnit = options.cacPerUnit || 0;
  var wasteAndIncidentalsPct = options.wasteAndIncidentalsPct || options.contingencyPct || 0;

  var costPerUnit = directCost + overheadCost;
  var baseTotalCostPerUnit = costPerUnit + deliveryCostPerUnit + packagingCostPerUnit + cacPerUnit;
  var wasteAndIncidentalsAmount = baseTotalCostPerUnit * (wasteAndIncidentalsPct / 100);
  var totalCostPerUnit = baseTotalCostPerUnit + wasteAndIncidentalsAmount;

  var priceBeforeFees = 0;
  if (desiredMargin < 100 && desiredMargin > -100) {
    priceBeforeFees = totalCostPerUnit / (1 - (desiredMargin / 100));
  }

  var totalDeductionPct = platformFeePct + paymentGatewayFeePct;
  var priceBeforeTax = 0;
  if (totalDeductionPct < 100) {
    priceBeforeTax = priceBeforeFees / (1 - (totalDeductionPct / 100));
  }

  var platformFeeAmount = priceBeforeTax * (platformFeePct / 100);
  var paymentGatewayAmount = priceBeforeTax * (paymentGatewayFeePct / 100);
  var netRevenuePerUnit = priceBeforeTax - platformFeeAmount - paymentGatewayAmount;
  var profitBeforeTax = netRevenuePerUnit - totalCostPerUnit;
  var taxAmount = profitBeforeTax > 0 ? profitBeforeTax * (taxRate / 100) : 0;
  var profitAfterTax = profitBeforeTax - taxAmount;
  var zakatAmount = profitAfterTax > 0 ? profitAfterTax * (zakatRate / 100) : 0;
  var netProfitPerUnit = profitAfterTax - zakatAmount;
  var monthlyProfit = netProfitPerUnit * volume;
  var actualMargin = priceBeforeTax > 0 ? (netProfitPerUnit / priceBeforeTax) * 100 : 0;
  var netRequiredPerUnit = totalCostPerUnit + (volume > 0 ? monthlyFixed / volume : 0);
  var breakEvenPrice = totalDeductionPct < 100 ? netRequiredPerUnit / (1 - totalDeductionPct / 100) : 0;

  return {
    costPerUnit,
    baseTotalCostPerUnit,
    wasteAndIncidentalsPct,
    wasteAndIncidentalsAmount,
    // backward compatibility aliases
    contingencyPct: wasteAndIncidentalsPct,
    contingencyAmount: wasteAndIncidentalsAmount,
    totalCostPerUnit,
    priceBeforeFees,
    priceBeforeTax,
    platformFeePct,
    platformFeeAmount,
    paymentGatewayFeePct,
    paymentGatewayAmount,
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
 * @param {Object} [options] – { wasteAndIncidentalsPct }
 */
function calculateCashFlow(openingBalance, monthlyData, options) {
  openingBalance = openingBalance || 0;
  monthlyData = monthlyData || [];
  options = options || {};
  var wasteAndIncidentalsPct = options.wasteAndIncidentalsPct || options.contingencyPct || 0;
  var wasteMultiplier = 1 + wasteAndIncidentalsPct / 100;
  // keys that operational waste/incidentals reserve applies to
  var WASTE_OUTFLOW_KEYS = ['rent', 'salaries', 'raw', 'marketing', 'other_exp'];

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
      closingBalance: 0,
      wasteAndIncidentals: 0
    };

    INFLOW_KEYS.forEach(function (key) {
      var val = (data.inflows && data.inflows[key]) || 0;
      month.inflows[key] = val;
      month.totalIn += val;
    });

    OUTFLOW_KEYS.forEach(function (key) {
      var rawVal = (data.outflows && data.outflows[key]) || 0;
      var val = rawVal;
      if (WASTE_OUTFLOW_KEYS.indexOf(key) >= 0) {
        val = rawVal * wasteMultiplier;
        month.wasteAndIncidentals += val - rawVal;
      }
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
  var totalWasteAndIncidentals = 0;
  var minBal = Infinity;
  var maxBal = -Infinity;

  months.forEach(function (m) {
    totalIn += m.totalIn;
    totalOut += m.totalOut;
    netFlow += m.netCashFlow;
    totalWasteAndIncidentals += m.wasteAndIncidentals;
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
    closingBalance: months.length > 0 ? months[months.length - 1].closingBalance : openingBalance,
    wasteAndIncidentalsPct,
    totalWasteAndIncidentals
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
  const wasteAndIncidentalsPct = options.wasteAndIncidentalsPct || options.contingencyPct || 0;

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

    const wasteAndIncidentalsAmount = mVariable * (wasteAndIncidentalsPct / 100);
    mVariable += wasteAndIncidentalsAmount;

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
      wasteAndIncidentalsAmount,
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
    let totalWaste = 0;
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
      totalWaste += p.wasteAndIncidentalsAmount || 0;
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
      wasteAndIncidentalsAmount: totalWaste / 12,
      profit: totalProfit / 12,
      vatAmount: totalVat / 12,
      zakatAmount: totalZakat / 12,
      yearlyGross: totalGross,
      yearlyNet: totalNet,
      yearlyProfit: totalProfit,
      yearlyWaste: totalWaste,
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
  const wasteAndIncidentalsAmount = base.wasteAndIncidentalsAmount;
  const monthlyProfit = base.profit;
  const yearlyRevenue = base.yearlyNet;
  const yearlyProfit = base.yearlyProfit;
  const yearlyWaste = base.yearlyWaste;
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
    wasteAndIncidentalsPct,
    wasteAndIncidentalsAmount,
    yearlyWaste,
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
// 6b. Investment Readiness Score
// ============================================================================

/**
 * Calculates an Investment Readiness Score (0-100) from a viability result.
 * @param {Object} result – output from calculateMedicalViability or similar
 */
function calculateInvestmentScore(result) {
  result = result || {};
  const profitMargin = result.profitMargin || 0;
  const roiMonths = result.roiMonths === Infinity ? 999 : (result.roiMonths || 999);
  const dailyUnits = result.dailyUnits || 0;
  const beUnitsPerDay = result.beUnitsPerDay || 0;
  const monthlyGrowthPct = result.monthlyGrowthPct || 0;
  const monthlyProfit = result.monthlyProfit || 0;

  // 1. Profitability (0-40 points)
  let profitabilityScore = 0;
  if (monthlyProfit > 0) {
    if (profitMargin >= 25) profitabilityScore = 40;
    else if (profitMargin >= 20) profitabilityScore = 35;
    else if (profitMargin >= 15) profitabilityScore = 28;
    else if (profitMargin >= 10) profitabilityScore = 20;
    else if (profitMargin >= 5) profitabilityScore = 12;
    else profitabilityScore = 6;
  }

  // 2. Payback speed (0-30 points)
  let paybackScore = 0;
  if (roiMonths <= 12) paybackScore = 30;
  else if (roiMonths <= 18) paybackScore = 25;
  else if (roiMonths <= 24) paybackScore = 20;
  else if (roiMonths <= 30) paybackScore = 15;
  else if (roiMonths <= 36) paybackScore = 10;
  else if (roiMonths <= 48) paybackScore = 5;

  // 3. Safety margin above break-even (0-20 points)
  let safetyScore = 0;
  if (beUnitsPerDay > 0) {
    const safetyMargin = ((dailyUnits - beUnitsPerDay) / beUnitsPerDay) * 100;
    if (safetyMargin >= 80) safetyScore = 20;
    else if (safetyMargin >= 50) safetyScore = 16;
    else if (safetyMargin >= 25) safetyScore = 12;
    else if (safetyMargin >= 10) safetyScore = 8;
    else if (safetyMargin > 0) safetyScore = 4;
  } else if (dailyUnits > 0) {
    safetyScore = 20;
  }

  // 4. Growth trajectory (0-10 points)
  let growthScore = 0;
  if (monthlyGrowthPct >= 10) growthScore = 10;
  else if (monthlyGrowthPct >= 5) growthScore = 7;
  else if (monthlyGrowthPct >= 3) growthScore = 5;
  else if (monthlyGrowthPct > 0) growthScore = 3;

  const total = profitabilityScore + paybackScore + safetyScore + growthScore;

  // Verdict
  let verdict = 'critical';
  let verdictLabel = 'حرج';
  let verdictLabelEn = 'Critical';
  let verdictDesc = 'المشروع غير مجدي حالياً. يحتاج إعادة هيكلة شاملة للتكاليف والإيرادات.';
  let verdictDescEn = 'The project is currently not viable. It needs a full restructuring of costs and revenue.';
  let verdictColor = '#ef4444';

  if (total >= 80) {
    verdict = 'excellent';
    verdictLabel = 'ممتاز';
    verdictLabelEn = 'Excellent';
    verdictDesc = 'استثمار قوي ومبشر. المؤشرات المالية صحية وفترة الاسترداد مقبولة.';
    verdictDescEn = 'A strong and promising investment. Financial indicators are healthy and payback is reasonable.';
    verdictColor = '#22c55e';
  } else if (total >= 60) {
    verdict = 'good';
    verdictLabel = 'جيد';
    verdictLabelEn = 'Good';
    verdictDesc = 'مشروع قابل للتنفيذ. أنصح بدراسة تفصيلية قبل الافتتاح.';
    verdictDescEn = 'The project is feasible. We recommend a detailed study before opening.';
    verdictColor = '#84cc16';
  } else if (total >= 40) {
    verdict = 'fair';
    verdictLabel = 'متوسط';
    verdictLabelEn = 'Fair';
    verdictDesc = 'المشروع يعمل لكن يحتاج تحسينات واضحة لزيادة الربحية وتقليل المخاطر.';
    verdictDescEn = 'The project works but needs clear improvements to increase profitability and reduce risk.';
    verdictColor = '#f59e0b';
  } else if (total >= 20) {
    verdict = 'weak';
    verdictLabel = 'ضعيف';
    verdictLabelEn = 'Weak';
    verdictDesc = 'مخاطر عالية. يحتاج إلى تعديلات جوهرية قبل اتخاذ قرار الاستثمار.';
    verdictDescEn = 'High risk. Material changes are needed before making an investment decision.';
    verdictColor = '#f97316';
  }

  // Smart recommendations
  const recommendationsAr = [];
  const recommendationsEn = [];
  if (monthlyProfit < 0) {
    recommendationsAr.push('الربح الشهري سلبي: راجع التكاليف الثابتة أو زد الإيرادات اليومية.');
    recommendationsEn.push('Monthly profit is negative: review fixed costs or increase daily revenue.');
  }
  if (roiMonths > 36) {
    recommendationsAr.push('فترة استرداد رأس المال طويلة: جرب تقليل تكلفة الافتتاح أو زيادة هامش الربح.');
    recommendationsEn.push('Payback period is long: try reducing setup costs or increasing profit margin.');
  }
  if (profitMargin < 10) {
    recommendationsAr.push('هامش الربح منخفض: راجع التسعير أو التكاليف المتغيرة.');
    recommendationsEn.push('Profit margin is low: review pricing or variable costs.');
  }
  if (beUnitsPerDay > 0 && ((dailyUnits - beUnitsPerDay) / beUnitsPerDay) < 0.1) {
    recommendationsAr.push('هامش السلامة ضيق: عدد الوحدات اليومية قريب جداً من نقطة التعادل.');
    recommendationsEn.push('Safety margin is tight: daily units are very close to break-even.');
  }
  if (monthlyGrowthPct === 0) {
    recommendationsAr.push('لا يوجد نمو شهري محدد: ضع خطة تسويقية لزيادة الطلب تدريجياً.');
    recommendationsEn.push('No monthly growth set: create a marketing plan to gradually increase demand.');
  }
  if (recommendationsAr.length === 0) {
    recommendationsAr.push('المؤشرات جيدة. أنصح بإعداد دراسة جدوى تفصيلية للحصول على تمويل أو موافقة الشركاء.');
    recommendationsEn.push('Indicators look good. We recommend preparing a detailed feasibility study for funding or partner approval.');
  }

  return {
    score: Math.round(total),
    maxScore: 100,
    verdict,
    verdictLabel,
    verdictLabelEn,
    verdictDesc,
    verdictDescEn,
    verdictColor,
    profitabilityScore,
    paybackScore,
    safetyScore,
    growthScore,
    recommendations: recommendationsAr,
    recommendationsEn: recommendationsEn
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
  var lang = (typeof document !== 'undefined' && document.documentElement && document.documentElement.lang && document.documentElement.lang.startsWith('en')) ? 'en' : 'ar';
  if (typeof BondsFormatting !== 'undefined' && BondsFormatting.formatNumber) {
    return BondsFormatting.formatNumber(n, lang);
  }
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
// 9. Real Project Analysis (hidden costs, risk reserve, investment rating)
// ============================================================================

var ACTIVITY_PROFILES = {
  restaurant:   { hiddenCostPct: 0.12, riskReservePct: 0.08, deliveryFactor: 0.04, perishableFactor: 0.06, seasonalFactor: 0.03, regulatoryFactor: { low: 0.02, medium: 0.04, high: 0.07 } },
  retail:       { hiddenCostPct: 0.08, riskReservePct: 0.06, deliveryFactor: 0.03, perishableFactor: 0.04, seasonalFactor: 0.02, regulatoryFactor: { low: 0.02, medium: 0.03, high: 0.05 } },
  manufacturing:{ hiddenCostPct: 0.15, riskReservePct: 0.10, deliveryFactor: 0.02, perishableFactor: 0.02, seasonalFactor: 0.04, regulatoryFactor: { low: 0.03, medium: 0.06, high: 0.10 } },
  services:     { hiddenCostPct: 0.10, riskReservePct: 0.07, deliveryFactor: 0.01, perishableFactor: 0.00, seasonalFactor: 0.02, regulatoryFactor: { low: 0.01, medium: 0.03, high: 0.06 } },
  ecommerce:    { hiddenCostPct: 0.11, riskReservePct: 0.08, deliveryFactor: 0.06, perishableFactor: 0.03, seasonalFactor: 0.03, regulatoryFactor: { low: 0.02, medium: 0.04, high: 0.06 } },
  healthcare:   { hiddenCostPct: 0.14, riskReservePct: 0.11, deliveryFactor: 0.02, perishableFactor: 0.05, seasonalFactor: 0.02, regulatoryFactor: { low: 0.04, medium: 0.08, high: 0.14 } },
  education:    { hiddenCostPct: 0.09, riskReservePct: 0.06, deliveryFactor: 0.01, perishableFactor: 0.00, seasonalFactor: 0.05, regulatoryFactor: { low: 0.02, medium: 0.04, high: 0.07 } },
  general:      { hiddenCostPct: 0.10, riskReservePct: 0.07, deliveryFactor: 0.03, perishableFactor: 0.03, seasonalFactor: 0.03, regulatoryFactor: { low: 0.02, medium: 0.04, high: 0.07 } }
};

function calculateRealProjectAnalysis(input) {
  input = input || {};
  var activityType = input.activityType || 'general';
  var revenue = input.revenue || 0;
  var directCosts = input.directCosts || 0;
  var salaries = input.salaries || 0;
  var rent = input.rent || 0;
  var inventoryCost = input.inventoryCost || 0;
  var equipmentCost = input.equipmentCost || 0;
  var deliveryCost = input.deliveryCost || 0;
  var projectValue = input.projectValue || 0;
  var deliveryEnabled = !!input.deliveryEnabled;
  var perishableInventory = !!input.perishableInventory;
  var seasonalStaff = !!input.seasonalStaff;
  var regulatoryRequirements = input.regulatoryRequirements || 'low';

  var profile = ACTIVITY_PROFILES[activityType] || ACTIVITY_PROFILES.general;
  var regLevel = ['low', 'medium', 'high'].indexOf(regulatoryRequirements) >= 0 ? regulatoryRequirements : 'low';
  var wasteAndIncidentalsPct = input.wasteAndIncidentalsPct || input.contingencyPct || 0;

  var operatingCosts = directCosts + salaries + rent + inventoryCost + equipmentCost;

  var hiddenAdjustment = profile.hiddenCostPct;
  if (deliveryEnabled) hiddenAdjustment += profile.deliveryFactor;
  if (perishableInventory) hiddenAdjustment += profile.perishableFactor;
  if (seasonalStaff) hiddenAdjustment += profile.seasonalFactor;
  hiddenAdjustment += profile.regulatoryFactor[regLevel];
  hiddenAdjustment += wasteAndIncidentalsPct / 100;

  var hiddenCostTotal = operatingCosts * hiddenAdjustment;
  var riskReserve = (operatingCosts + hiddenCostTotal) * profile.riskReservePct;
  var totalRealCost = operatingCosts + hiddenCostTotal + riskReserve + (deliveryEnabled ? deliveryCost : 0);
  var realProfit = revenue - totalRealCost;

  var fixedCosts = salaries + rent + equipmentCost + hiddenCostTotal + riskReserve;
  var variableCosts = directCosts + inventoryCost + (deliveryEnabled ? deliveryCost : 0);
  var contributionMarginRatio = revenue > 0 ? (revenue - variableCosts) / revenue : 0;
  var breakEvenRevenue = contributionMarginRatio > 0 ? fixedCosts / contributionMarginRatio : -1;

  var paybackPeriodMonths = realProfit > 0 ? projectValue / realProfit : Infinity;

  var profitMargin = revenue > 0 ? (realProfit / revenue) * 100 : 0;

  // Investment rating: A/B/C/D
  var investmentRating = 'D';
  if (profitMargin >= 25 && paybackPeriodMonths <= 12) {
    investmentRating = 'A';
  } else if (profitMargin >= 15 && paybackPeriodMonths <= 24) {
    investmentRating = 'B';
  } else if (profitMargin >= 5 && paybackPeriodMonths <= 36) {
    investmentRating = 'C';
  }

  var ratingLabels = {
    A: { ar: 'ممتاز', en: 'Excellent' },
    B: { ar: 'جيد', en: 'Good' },
    C: { ar: 'مقبول', en: 'Fair' },
    D: { ar: 'ضعيف', en: 'Weak' }
  };

  function calcScenario(revenueMult, costMult) {
    var scenRevenue = revenue * revenueMult;
    var scenOperating = operatingCosts * costMult;
    var scenHidden = scenOperating * hiddenAdjustment;
    var scenReserve = (scenOperating + scenHidden) * profile.riskReservePct;
    var scenTotalCost = scenOperating + scenHidden + scenReserve;
    var scenProfit = scenRevenue - scenTotalCost;
    var scenMargin = scenRevenue > 0 ? (scenProfit / scenRevenue) * 100 : 0;
    return {
      revenue: scenRevenue,
      totalCost: scenTotalCost,
      realProfit: scenProfit,
      profitMargin: scenMargin,
      hiddenCostTotal: scenHidden,
      riskReserve: scenReserve
    };
  }

  var scenarios = {
    pessimistic: calcScenario(0.7, 1.15),
    expected: calcScenario(1.0, 1.0),
    optimistic: calcScenario(1.3, 0.9)
  };

  var monthlyProjection = [];
  for (var m = 0; m < 12; m++) {
    monthlyProjection.push({
      month: m + 1,
      revenue: revenue,
      operatingCosts: operatingCosts,
      hiddenCostTotal: hiddenCostTotal,
      riskReserve: riskReserve,
      totalRealCost: totalRealCost,
      realProfit: realProfit
    });
  }

  var hiddenFactorBreakdown = {
    base: profile.hiddenCostPct,
    delivery: deliveryEnabled ? profile.deliveryFactor : 0,
    perishable: perishableInventory ? profile.perishableFactor : 0,
    seasonal: seasonalStaff ? profile.seasonalFactor : 0,
    regulatory: profile.regulatoryFactor[regLevel],
    wasteAndIncidentals: wasteAndIncidentalsPct / 100
  };

  var hiddenCostBreakdown = {
    base: profile.hiddenCostPct * 100,
    delivery: deliveryEnabled ? profile.deliveryFactor * 100 : 0,
    perishable: perishableInventory ? profile.perishableFactor * 100 : 0,
    seasonal: seasonalStaff ? profile.seasonalFactor * 100 : 0,
    regulatory: profile.regulatoryFactor[regLevel] * 100,
    wasteAndIncidentals: wasteAndIncidentalsPct,
    total: hiddenAdjustment * 100
  };

  return {
    activityType: activityType,
    operatingCosts: operatingCosts,
    wasteAndIncidentalsPct: wasteAndIncidentalsPct,
    hiddenCostTotal: hiddenCostTotal,
    hiddenCostPct: hiddenAdjustment * 100,
    hiddenFactorBreakdown: hiddenFactorBreakdown,
    hiddenCostBreakdown: hiddenCostBreakdown,
    riskReserve: riskReserve,
    riskReservePct: profile.riskReservePct * 100,
    totalRealCost: totalRealCost,
    realProfit: realProfit,
    profitMargin: profitMargin,
    breakEvenRevenue: breakEvenRevenue,
    paybackPeriodMonths: paybackPeriodMonths,
    investmentRating: investmentRating,
    investmentRatingLabel: ratingLabels[investmentRating],
    scenarios: scenarios,
    monthlyProjection: monthlyProjection,
    details: {
      fixedCosts: fixedCosts,
      variableCosts: variableCosts,
      contributionMarginRatio: contributionMarginRatio * 100,
      projectValue: projectValue,
      equipmentCost: equipmentCost,
      deliveryCost: deliveryCost
    }
  };
}

// ============================================================================
// Exports
// ============================================================================

return {
  calculateBreakEven,
  calculatePriceTargets,
  calculateLoan,
  calculateDTI,
  calculatePricing,
  calculateCashFlow,
  calculateFeasibility,
  calculateMedicalViability,
  calculateInvestmentScore,
  calculateRealProjectAnalysis,
  ACTIVITY_PROFILES,
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
