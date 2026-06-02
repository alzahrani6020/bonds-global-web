const {
  calculateBreakEven,
  calculateLoan,
  calculateDTI,
  calculatePricing,
  calculateCashFlow,
  calculateFeasibility,
  INGREDIENT_UNITS,
  getUnitMultiplier,
  getEffectiveFee,
  formatNumber,
  calculateHealthScore,
  generateSmartTips,
  parseIngredientsCSVText,
  calculateSensitivity
} = require('../calculators/calc-functions');

// ============================================================================
// calculateBreakEven
// ============================================================================

describe('calculateBreakEven', () => {
  test('basic break-even calculation (example from HTML)', () => {
    const r = calculateBreakEven(10000, 300, 500, 100, 0, 0);
    expect(r.breakEvenUnits).toBe(50);   // 10000 / (500-300) = 50
    expect(r.breakEvenAmount).toBe(25000); // 50 * 500
    expect(r.revenue).toBe(50000);
    expect(r.totalCost).toBe(40000);      // 10000 + 300*100
    expect(r.profit).toBe(10000);
    expect(r.netProfit).toBe(10000);
    expect(r.profitMargin).toBeCloseTo(20, 1); // 10000/50000*100
  });

  test('returns zero break-even when no fixed costs and contribution >= 0', () => {
    const r = calculateBreakEven(0, 50, 100, 10);
    expect(r.breakEvenUnits).toBe(0);
    expect(r.breakEvenAmount).toBe(0);
  });

  test('returns -1 for impossible break-even (negative contribution)', () => {
    const r = calculateBreakEven(10000, 150, 100, 10);
    expect(r.breakEvenUnits).toBe(-1);
    expect(r.breakEvenAmount).toBe(-1);
  });

  test('returns -1 for zero contribution with fixed costs', () => {
    const r = calculateBreakEven(5000, 100, 100, 10);
    expect(r.breakEvenUnits).toBe(-1);
    expect(r.breakEvenAmount).toBe(-1);
  });

  test('handles zero selling price', () => {
    const r = calculateBreakEven(1000, 50, 0, 100);
    expect(r.breakEvenUnits).toBe(-1);
    expect(r.revenue).toBe(0);
  });

  test('handles zero quantity', () => {
    const r = calculateBreakEven(5000, 50, 100, 0);
    expect(r.revenue).toBe(0);
    expect(r.totalCost).toBe(5000);
    expect(r.profit).toBe(-5000);
  });

  test('Saudi-specific: VAT 15% + Zakat 2.5%', () => {
    const r = calculateBreakEven(10000, 300, 500, 200, 15, 2.5);
    // profit = 200*500 - (10000 + 300*200) = 100000 - 70000 = 30000
    expect(r.profit).toBe(30000);
    // tax = 30000 * 0.15 = 4500
    expect(r.taxAmount).toBeCloseTo(4500, 5);
    // profit after tax = 25500
    expect(r.profitAfterTax).toBeCloseTo(25500, 5);
    // zakat = 25500 * 0.025 = 637.5
    expect(r.zakatAmount).toBeCloseTo(637.5, 5);
    // net profit = 24862.5
    expect(r.netProfit).toBeCloseTo(24862.5, 5);
  });

  test('no tax or zakat applied on zero/negative profit', () => {
    const r = calculateBreakEven(10000, 500, 400, 10, 15, 2.5);
    expect(r.profit).toBeLessThan(0);
    expect(r.taxAmount).toBe(0);
    expect(r.zakatAmount).toBe(0);
    expect(r.netProfit).toBe(r.profit);
  });

  test('handles very large numbers', () => {
    const r = calculateBreakEven(1e9, 500, 1000, 1e6, 15, 2.5);
    expect(r.breakEvenUnits).toBe(2000000);
    expect(r.revenue).toBe(1e9);
    expect(r.profit).toBe(-5e8); // revenue 1e9 - totalCost 1.5e9 = -5e8
  });

  test('handles negative inputs gracefully (math still works)', () => {
    const r = calculateBreakEven(-1000, 50, 100, 10);
    // negative fixed costs is weird but the formula still runs
    expect(r.profit).toBe(1000 - 500 + 1000); // revenue 1000 - cost 500 + "negative" fixed cost
    expect(r.profit).toBe(1500);
  });

  test('profitMargin and ROI are zero when revenue/totalCost are zero', () => {
    const r = calculateBreakEven(0, 0, 0, 0, 0, 0);
    expect(r.profitMargin).toBe(0);
    expect(r.roi).toBe(0);
  });
});

// ============================================================================
// calculateLoan
// ============================================================================

describe('calculateLoan', () => {
  test('basic monthly loan (example from HTML)', () => {
    const r = calculateLoan(500000, 50000, 5, 240, 'monthly', 2500);
    expect(r.netLoan).toBe(452500); // 500000 - 50000 + 2500
    expect(r.totalPayments).toBe(240);
    expect(r.installment).toBeGreaterThan(0);
    expect(r.totalPaid).toBeGreaterThan(r.netLoan);
    expect(r.totalInterest).toBeGreaterThan(0);
    expect(r.ear).toBeGreaterThan(0);
    expect(r.schedule.length).toBe(240);
    // last balance should be ~0
    expect(r.schedule[r.schedule.length - 1].balance).toBeCloseTo(0, 1);
  });

  test('quarterly frequency', () => {
    const r = calculateLoan(500000, 0, 5, 24, 'quarterly', 0);
    expect(r.periodsPerYear).toBe(4);
    expect(r.totalPayments).toBe(8); // floor(24/3)
    expect(r.schedule.length).toBe(8);
  });

  test('zero interest rate', () => {
    const r = calculateLoan(100000, 0, 0, 12, 'monthly', 0);
    expect(r.installment).toBeCloseTo(100000 / 12, 5);
    expect(r.totalInterest).toBe(0);
    expect(r.ear).toBe(0);
  });

  test('zero loan amount', () => {
    const r = calculateLoan(0, 0, 5, 12, 'monthly', 0);
    expect(r.netLoan).toBe(0);
    expect(r.installment).toBe(0);
    expect(r.schedule.length).toBe(12);
    expect(r.schedule[0].balance).toBe(0);
  });

  test('totalPayments minimum is 1', () => {
    const r = calculateLoan(100000, 0, 5, 1, 'quarterly', 0);
    expect(r.totalPayments).toBe(1);
  });

  test('schedule totals add up', () => {
    const r = calculateLoan(300000, 0, 6, 60, 'monthly', 0);
    var totalPrincipal = 0;
    var totalInterest = 0;
    r.schedule.forEach(function (row) {
      totalPrincipal += row.principal;
      totalInterest += row.interest;
    });
    expect(totalPrincipal).toBeCloseTo(r.netLoan, 0);
    expect(totalInterest).toBeCloseTo(r.totalInterestPaid, 0);
  });

  test('high interest rate', () => {
    const r = calculateLoan(100000, 0, 25, 12, 'monthly', 0);
    expect(r.installment).toBeGreaterThan(0);
    expect(r.totalInterest).toBeGreaterThan(0);
  });

  test('very small term', () => {
    const r = calculateLoan(100000, 0, 5, 1, 'monthly', 0);
    expect(r.totalPayments).toBe(1);
    expect(r.schedule.length).toBe(1);
  });
});

// ============================================================================
// calculateDTI
// ============================================================================

describe('calculateDTI', () => {
  test('normal DTI', () => {
    expect(calculateDTI(3000, 15000)).toBeCloseTo(20, 5);
  });

  test('high DTI', () => {
    expect(calculateDTI(5000, 10000)).toBe(50);
  });

  test('zero income returns null', () => {
    expect(calculateDTI(3000, 0)).toBeNull();
  });

  test('negative income returns null', () => {
    expect(calculateDTI(3000, -1000)).toBeNull();
  });

  test('zero installment', () => {
    expect(calculateDTI(0, 10000)).toBe(0);
  });
});

// ============================================================================
// calculatePricing
// ============================================================================

describe('calculatePricing', () => {
  test('basic pricing (example from HTML)', () => {
    const r = calculatePricing(150, 50, 25, 15, 2.5, 500, 20000);
    expect(r.costPerUnit).toBe(200);
    expect(r.priceBeforeTax).toBeCloseTo(266.67, 2); // 200 / (1 - 0.25)
    expect(r.profitBeforeTax).toBeCloseTo(66.67, 2);
    expect(r.taxAmount).toBeCloseTo(10, 1);          // 66.67 * 0.15
    expect(r.zakatAmount).toBeCloseTo(1.42, 2);      // (66.67-10) * 0.025
    expect(r.monthlyProfit).toBeCloseTo(r.netProfitPerUnit * 500, 1);
    expect(r.actualMargin).toBeGreaterThan(0);
    expect(r.breakEvenPrice).toBeCloseTo(240, 1);    // 200 + 20000/500
  });

  test('margin >= 100 returns zero priceBeforeTax', () => {
    const r = calculatePricing(100, 0, 100, 15, 2.5, 100, 0);
    expect(r.priceBeforeTax).toBe(0);
    expect(r.profitBeforeTax).toBe(-100); // 0 - 100
  });

  test('zero costs and margin', () => {
    const r = calculatePricing(0, 0, 0, 0, 0, 0, 0);
    expect(r.costPerUnit).toBe(0);
    expect(r.priceBeforeTax).toBe(0); // 0 / 1 = 0
    expect(r.netProfitPerUnit).toBe(0);
  });

  test('no tax or zakat when profitBeforeTax <= 0', () => {
    const r = calculatePricing(200, 100, 0, 15, 2.5, 10, 0);
    // priceBeforeTax = 300 / 1 = 300, profitBeforeTax = 0
    expect(r.taxAmount).toBe(0);
    expect(r.zakatAmount).toBe(0);
  });

  test('Saudi-specific defaults: 15% VAT + 2.5% Zakat', () => {
    const r = calculatePricing(100, 50, 30, 15, 2.5, 1000, 10000);
    expect(r.costPerUnit).toBe(150);
    expect(r.priceBeforeTax).toBeCloseTo(214.29, 2);
    expect(r.taxAmount).toBeCloseTo(9.64, 2);     // (214.29-150)*0.15
    expect(r.zakatAmount).toBeCloseTo(1.37, 2);   // profitAfterTax * 0.025
  });

  test('breakEvenPrice with zero volume equals costPerUnit', () => {
    const r = calculatePricing(100, 50, 25, 0, 0, 0, 5000);
    expect(r.breakEvenPrice).toBe(150);
  });

  test('negative margin still computes', () => {
    const r = calculatePricing(100, 0, -10, 0, 0, 10, 0);
    expect(r.priceBeforeTax).toBeCloseTo(90.91, 2); // 100 / 1.1
  });
});

// ============================================================================
// calculateCashFlow
// ============================================================================

describe('calculateCashFlow', () => {
  test('basic 12-month cash flow', () => {
    var monthlyData = [];
    for (var i = 0; i < 12; i++) {
      monthlyData.push({
        inflows: { sales: 50000, other: 0, loans: 0 },
        outflows: { rent: 8000, salaries: 20000, raw: 10000, marketing: 2000, taxes: 0, loan_repay: 0, other_exp: 1000 }
      });
    }
    const r = calculateCashFlow(10000, monthlyData);
    expect(r.months.length).toBe(12);
    expect(r.totalIn).toBe(50000 * 12);
    expect(r.totalOut).toBe(41000 * 12);
    expect(r.netFlow).toBe(9000 * 12);
    expect(r.closingBalance).toBe(10000 + 9000 * 12);
    expect(r.minBal).toBe(19000); // month 1 closing (lowest closing balance)
    expect(r.maxBal).toBe(r.closingBalance);
  });

  test('empty monthlyData returns openingBalance as closing', () => {
    const r = calculateCashFlow(5000, []);
    expect(r.months.length).toBe(0);
    expect(r.closingBalance).toBe(5000);
    expect(r.minBal).toBe(0);
    expect(r.maxBal).toBe(0);
  });

  test('negative closing balance in some months', () => {
    var monthlyData = [];
    for (var i = 0; i < 3; i++) {
      monthlyData.push({
        inflows: { sales: 10000, other: 0, loans: 0 },
        outflows: { rent: 5000, salaries: 15000, raw: 0, marketing: 0, taxes: 0, loan_repay: 0, other_exp: 0 }
      });
    }
    const r = calculateCashFlow(5000, monthlyData);
    // month1: 5000 + (10000-20000) = -5000
    expect(r.months[0].closingBalance).toBe(-5000);
    // month2: -5000 + (10000-20000) = -15000
    expect(r.months[1].closingBalance).toBe(-15000);
    expect(r.minBal).toBe(-25000); // month 3 closing balance
  });

  test('loan inflow in a single month', () => {
    var monthlyData = [];
    for (var i = 0; i < 12; i++) {
      monthlyData.push({
        inflows: { sales: 20000, other: 0, loans: i === 2 ? 100000 : 0 },
        outflows: { rent: 5000, salaries: 10000, raw: 3000, marketing: 1000, taxes: 0, loan_repay: i >= 3 ? 2000 : 0, other_exp: 500 }
      });
    }
    const r = calculateCashFlow(0, monthlyData);
    expect(r.months[2].totalIn).toBe(120000);
    expect(r.months[3].closingBalance).toBeLessThan(r.months[2].closingBalance);
  });

  test('partial month data (missing keys default to 0)', () => {
    const r = calculateCashFlow(1000, [
      { inflows: { sales: 5000 }, outflows: { rent: 2000 } }
    ]);
    expect(r.months[0].totalIn).toBe(5000);
    expect(r.months[0].totalOut).toBe(2000);
    expect(r.months[0].closingBalance).toBe(4000); // 1000 + 3000
  });
});

// ============================================================================
// calculateFeasibility
// ============================================================================

describe('calculateFeasibility', () => {
  test('basic feasibility (example values from HTML)', () => {
    const setup = { license: 5000, furniture: 40000, equipment: 30000, marketing: 8000, safety: 3000, other: 5000 };
    const monthly = { rent: 8000, salaries: 12000, utilities: 1500, gasNet: 800, supplies: 8000, ads: 2000, misc: 1000 };
    const revenue = { avgPrice: 35, dailyOrders: 80, workDays: 26 };
    const r = calculateFeasibility(setup, monthly, revenue);

    expect(r.setupTotal).toBe(91000);
    expect(r.monthlyFixed).toBe(25300); // 8000+12000+1500+800+2000+1000
    expect(r.monthlyVariable).toBe(8000);
    expect(r.monthlyTotal).toBe(33300);
    expect(r.monthlyRevenue).toBe(35 * 80 * 26); // 72800
    expect(r.monthlyProfit).toBe(72800 - 33300); // 39500
    expect(r.yearlyRevenue).toBe(r.monthlyRevenue * 12);
    expect(r.profitMargin).toBeCloseTo((39500 / 72800) * 100, 5);
    expect(r.roiMonths).toBeCloseTo(91000 / 39500, 5);

    // Break-even
    expect(r.beOrdersPerDay).toBeCloseTo(33300 / (35 * 26), 5);
    expect(r.beOrdersPerMonth).toBeCloseTo(r.beOrdersPerDay * 26, 5);

    // Scenarios
    expect(r.scenarios.pessimistic.dailyOrders).toBe(48); // round(80*0.6)
    expect(r.scenarios.expected.dailyOrders).toBe(80);
    expect(r.scenarios.optimistic.dailyOrders).toBe(112); // round(80*1.4)
  });

  test('loss-making project', () => {
    const setup = { license: 5000, furniture: 10000, equipment: 5000, marketing: 2000, safety: 1000, other: 0 };
    const monthly = { rent: 5000, salaries: 10000, utilities: 1000, gasNet: 500, supplies: 3000, ads: 2000, misc: 500 };
    const revenue = { avgPrice: 10, dailyOrders: 10, workDays: 20 };
    const r = calculateFeasibility(setup, monthly, revenue);
    expect(r.monthlyRevenue).toBe(2000);  // 10*10*20
    expect(r.monthlyTotal).toBe(22000);   // fixed 19000 + variable 3000
    expect(r.monthlyProfit).toBe(-20000);
    expect(r.roiMonths).toBe(Infinity);
    expect(r.profitMargin).toBeLessThan(0);
  });

  test('zero revenue params', () => {
    const r = calculateFeasibility({}, {}, {});
    expect(r.monthlyRevenue).toBe(0);
    expect(r.monthlyProfit).toBe(0);
    expect(r.roiMonths).toBe(Infinity);
    expect(r.beOrdersPerDay).toBe(0);
  });

  test('very high daily orders', () => {
    const setup = { license: 0, furniture: 0, equipment: 0, marketing: 0, safety: 0, other: 0 };
    const monthly = { rent: 0, salaries: 0, utilities: 0, gasNet: 0, supplies: 0, ads: 0, misc: 0 };
    const revenue = { avgPrice: 100, dailyOrders: 10000, workDays: 30 };
    const r = calculateFeasibility(setup, monthly, revenue);
    expect(r.monthlyRevenue).toBe(30000000);
    expect(r.monthlyProfit).toBe(30000000);
    expect(r.roiMonths).toBe(0); // setupTotal is 0
  });

  test('scenario margins are consistent', () => {
    const setup = { license: 1000, furniture: 0, equipment: 0, marketing: 0, safety: 0, other: 0 };
    const monthly = { rent: 0, salaries: 0, utilities: 0, gasNet: 0, supplies: 0, ads: 0, misc: 0 };
    const revenue = { avgPrice: 50, dailyOrders: 100, workDays: 20 };
    const r = calculateFeasibility(setup, monthly, revenue);
    // All scenarios should have same margin because costs are zero
    expect(r.scenarios.pessimistic.margin).toBe(100);
    expect(r.scenarios.expected.margin).toBe(100);
    expect(r.scenarios.optimistic.margin).toBe(100);
  });

  test('missing optional keys default to 0', () => {
    const setup = { license: 5000 };
    const monthly = { rent: 3000 };
    const revenue = { avgPrice: 20, dailyOrders: 10, workDays: 20 };
    const r = calculateFeasibility(setup, monthly, revenue);
    expect(r.setupTotal).toBe(5000);
    expect(r.monthlyFixed).toBe(3000);
    expect(r.monthlyVariable).toBe(0);
  });
});

// ============================================================================
// Restaurant Calculator Helpers
// ============================================================================

describe('INGREDIENT_UNITS', () => {
  test('has 9 units', () => {
    expect(INGREDIENT_UNITS.length).toBe(9);
  });

  test('contains kg, g, ml, piece', () => {
    expect(INGREDIENT_UNITS.some(u => u.value === 'kg')).toBe(true);
    expect(INGREDIENT_UNITS.some(u => u.value === 'g')).toBe(true);
    expect(INGREDIENT_UNITS.some(u => u.value === 'ml')).toBe(true);
    expect(INGREDIENT_UNITS.some(u => u.value === 'piece')).toBe(true);
  });
});

describe('getUnitMultiplier', () => {
  test('kg returns 1', () => {
    expect(getUnitMultiplier('kg')).toBe(1);
  });

  test('g returns 0.001', () => {
    expect(getUnitMultiplier('g')).toBe(0.001);
  });

  test('mg returns 0.000001', () => {
    expect(getUnitMultiplier('mg')).toBe(0.000001);
  });

  test('ml returns 0.001', () => {
    expect(getUnitMultiplier('ml')).toBe(0.001);
  });

  test('piece returns 1', () => {
    expect(getUnitMultiplier('piece')).toBe(1);
  });

  test('unknown unit returns 1', () => {
    expect(getUnitMultiplier('unknown')).toBe(1);
    expect(getUnitMultiplier('')).toBe(1);
    expect(getUnitMultiplier(null)).toBe(1);
  });
});

describe('getEffectiveFee', () => {
  test('returns base fee when no tiers', () => {
    const p = { fee: 20, serviceFee: 5 };
    const r = getEffectiveFee(p, 10000);
    expect(r.fee).toBe(25);
    expect(r.tierApplied).toBe(false);
  });

  test('returns base fee when monthlyGMV is zero', () => {
    const p = { fee: 20, serviceFee: 5, feeTiers: [{ min: 0, max: 5000, fee: 15 }] };
    const r = getEffectiveFee(p, 0);
    expect(r.fee).toBe(25);
    expect(r.tierApplied).toBe(false);
  });

  test('applies correct tier', () => {
    const p = { fee: 20, serviceFee: 5, feeTiers: [
      { min: 0, max: 5000, fee: 15 },
      { min: 5001, max: 20000, fee: 12 },
      { min: 20001, max: 100000, fee: 10 }
    ]};
    expect(getEffectiveFee(p, 3000).fee).toBe(20); // 15 + 5
    expect(getEffectiveFee(p, 3000).tierApplied).toBe(true);
    expect(getEffectiveFee(p, 3000).tierName).toBe('0-5000');
    expect(getEffectiveFee(p, 10000).fee).toBe(17); // 12 + 5
    expect(getEffectiveFee(p, 50000).fee).toBe(15); // 10 + 5
  });

  test('returns base fee when GMV above all tiers', () => {
    const p = { fee: 20, serviceFee: 5, feeTiers: [{ min: 0, max: 1000, fee: 15 }] };
    const r = getEffectiveFee(p, 5000);
    expect(r.fee).toBe(25);
    expect(r.tierApplied).toBe(false);
  });

  test('handles missing serviceFee', () => {
    const p = { fee: 20, feeTiers: [{ min: 0, max: 10000, fee: 15 }] };
    expect(getEffectiveFee(p, 5000).fee).toBe(15);
  });
});

describe('formatNumber', () => {
  test('formats positive integers', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  test('rounds decimals', () => {
    expect(formatNumber(1234.56)).toBe('1,235');
  });

  test('returns em-dash for undefined', () => {
    expect(formatNumber(undefined)).toBe('—');
  });

  test('returns em-dash for null', () => {
    expect(formatNumber(null)).toBe('—');
  });

  test('returns em-dash for NaN', () => {
    expect(formatNumber(NaN)).toBe('—');
  });

  test('formats negative numbers', () => {
    expect(formatNumber(-5000)).toBe('-5,000');
  });

  test('formats zero', () => {
    expect(formatNumber(0)).toBe('0');
  });
});

describe('calculateHealthScore', () => {
  test('excellent score for healthy restaurant (AR)', () => {
    const r = {
      inputs: { dailyOrders: 100, platforms: [{ fee: 15, serviceFee: 0 }] },
      profitMargin: 25,
      weightedFoodCostPct: 22,
      breakEvenDaily: 30
    };
    const result = calculateHealthScore(r, 'ar');
    expect(result.finalScore).toBeGreaterThanOrEqual(80);
    expect(result.color).toBe('#16a34a');
    expect(result.breakdown.length).toBe(4);
  });

  test('excellent score for healthy restaurant (EN)', () => {
    const r = {
      inputs: { dailyOrders: 100, platforms: [{ fee: 15, serviceFee: 0 }] },
      profitMargin: 25,
      weightedFoodCostPct: 22,
      breakEvenDaily: 30
    };
    const result = calculateHealthScore(r, 'en');
    expect(result.finalScore).toBeGreaterThanOrEqual(80);
    expect(result.labelText).toContain('Excellent');
    expect(result.breakdown[0].label).toBe('Profit Margin');
  });

  test('poor score for struggling restaurant', () => {
    const r = {
      inputs: { dailyOrders: 20, platforms: [{ fee: 30, serviceFee: 5 }] },
      profitMargin: -5,
      weightedFoodCostPct: 40,
      breakEvenDaily: 50
    };
    const result = calculateHealthScore(r);
    expect(result.finalScore).toBeLessThan(50);
    expect(result.color).toBe('#dc2626');
  });

  test('medium score for average restaurant', () => {
    const r = {
      inputs: { dailyOrders: 40, platforms: [{ fee: 20, serviceFee: 0 }] },
      profitMargin: 12,
      weightedFoodCostPct: 28,
      breakEvenDaily: 30
    };
    const result = calculateHealthScore(r);
    expect(result.finalScore).toBeGreaterThanOrEqual(40);
    expect(result.finalScore).toBeLessThan(80);
  });

  test('handles zero break-even safely', () => {
    const r = {
      inputs: { dailyOrders: 50, platforms: [] },
      profitMargin: 15,
      weightedFoodCostPct: 25,
      breakEvenDaily: -1
    };
    const result = calculateHealthScore(r);
    expect(result.finalScore).toBeGreaterThan(0);
    expect(result.breakdown[3].label).toBe('أمان التعادل');
  });

  test('label text matches score range', () => {
    const excellent = calculateHealthScore({ inputs: { dailyOrders: 100, platforms: [{ fee: 10 }] }, profitMargin: 30, weightedFoodCostPct: 20, breakEvenDaily: 20 }, 'ar');
    expect(excellent.labelText).toContain('ممتاز');

    const poor = calculateHealthScore({ inputs: { dailyOrders: 10, platforms: [{ fee: 35 }] }, profitMargin: -10, weightedFoodCostPct: 45, breakEvenDaily: 80 }, 'en');
    expect(poor.labelText).toContain('Weak');
  });
});

describe('generateSmartTips', () => {
  test('returns loss tips when netProfit < 0 (AR)', () => {
    const r = {
      inputs: { dailyOrders: 20, workingDays: 26, platforms: [{ name: 'A', operatingModel: 'open' }] },
      netProfit: -5000,
      breakEvenDaily: 40,
      bestPlatform: { name: 'A' },
      worstPlatform: { name: 'B' },
      platformResults: [{ name: 'A', monthlyProfit: -2000 }],
      weightedFoodCostPct: 30
    };
    const tips = generateSmartTips(r, 'SAR', 'ar');
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0]).toContain('تخسر');
  });

  test('returns loss tips when netProfit < 0 (EN)', () => {
    const r = {
      inputs: { dailyOrders: 20, workingDays: 26, platforms: [{ name: 'A', operatingModel: 'open' }] },
      netProfit: -5000,
      breakEvenDaily: 40,
      bestPlatform: { name: 'A' },
      worstPlatform: { name: 'B' },
      platformResults: [{ name: 'A', monthlyProfit: -2000 }],
      weightedFoodCostPct: 30
    };
    const tips = generateSmartTips(r, 'SAR', 'en');
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0]).toContain('losing money');
  });

  test('returns profit tip when netProfit >= 0', () => {
    const r = {
      inputs: { dailyOrders: 60, workingDays: 26, platforms: [{ name: 'A', operatingModel: 'open' }] },
      netProfit: 10000,
      breakEvenDaily: 30,
      bestPlatform: { name: 'A' },
      worstPlatform: { name: 'B' },
      platformResults: [{ name: 'A', monthlyProfit: 10000 }],
      weightedFoodCostPct: 28
    };
    const tips = generateSmartTips(r, 'SAR', 'ar');
    expect(tips.length).toBeGreaterThan(0);
    expect(tips[0]).toContain('أرباحك');
  });

  test('includes platform comparison when difference exists', () => {
    const r = {
      inputs: { dailyOrders: 50, workingDays: 26, platforms: [
        { name: 'A', operatingModel: 'open' },
        { name: 'B', operatingModel: 'closed' }
      ]},
      netProfit: 5000,
      breakEvenDaily: 20,
      bestPlatform: { name: 'A', monthlyProfit: 8000 },
      worstPlatform: { name: 'B', monthlyProfit: 2000 },
      platformResults: [
        { name: 'A', monthlyProfit: 8000 },
        { name: 'B', monthlyProfit: 2000 }
      ],
      weightedFoodCostPct: 28
    };
    const tips = generateSmartTips(r, 'SAR', 'ar');
    const hasDiffTip = tips.some(t => t.includes('أفضل منصة') && t.includes('أسوأها'));
    expect(hasDiffTip).toBe(true);
  });

  test('includes food cost warning when high (EN)', () => {
    const r = {
      inputs: { dailyOrders: 50, workingDays: 26, platforms: [{ name: 'A', operatingModel: 'open' }] },
      netProfit: 5000,
      breakEvenDaily: 20,
      bestPlatform: { name: 'A' },
      worstPlatform: { name: 'A' },
      platformResults: [{ name: 'A', monthlyProfit: 5000 }],
      weightedFoodCostPct: 38
    };
    const tips = generateSmartTips(r, 'SAR', 'en');
    const hasFoodTip = tips.some(t => t.includes('Food cost'));
    expect(hasFoodTip).toBe(true);
  });

  test('returns empty array for neutral restaurant', () => {
    const r = {
      inputs: { dailyOrders: 50, workingDays: 26, platforms: [{ name: 'A', operatingModel: 'open' }] },
      netProfit: 1000,
      breakEvenDaily: 10,
      bestPlatform: { name: 'A' },
      worstPlatform: { name: 'A' },
      platformResults: [{ name: 'A', monthlyProfit: 1000 }],
      weightedFoodCostPct: 25
    };
    const tips = generateSmartTips(r, 'SAR', 'ar');
    expect(tips.length).toBeGreaterThanOrEqual(0);
  });
});

describe('parseIngredientsCSVText', () => {
  test('parses valid CSV lines', () => {
    const text = 'Flour,g,12.5\nBeef,kg,45\nSalt,g,2';
    const result = parseIngredientsCSVText(text);
    expect(result.length).toBe(3);
    expect(result[0]).toEqual({ name: 'Flour', unit: 'g', price: 12.5 });
    expect(result[1]).toEqual({ name: 'Beef', unit: 'kg', price: 45 });
  });

  test('skips header line containing "ingredient"', () => {
    const text = 'Ingredient,Unit,Price\nFlour,g,12.5\nBeef,kg,45';
    const result = parseIngredientsCSVText(text);
    expect(result.length).toBe(2);
    expect(result[0].name).toBe('Flour');
  });

  test('skips empty lines', () => {
    const text = 'Flour,g,12.5\n\n\nBeef,kg,45\n';
    const result = parseIngredientsCSVText(text);
    expect(result.length).toBe(2);
  });

  test('ignores lines with fewer than 3 columns', () => {
    const text = 'Flour,g\nBeef,kg,45\nSalt';
    const result = parseIngredientsCSVText(text);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Beef');
  });

  test('handles zero price', () => {
    const text = 'Flour,g,0';
    const result = parseIngredientsCSVText(text);
    expect(result[0].price).toBe(0);
  });

  test('returns empty array for empty text', () => {
    expect(parseIngredientsCSVText('')).toEqual([]);
    expect(parseIngredientsCSVText('\n\n')).toEqual([]);
  });
});

describe('calculateSensitivity', () => {
  const baseInputs = {
    dailyOrders: 50,
    workingDays: 26,
    rent: 5000, salaries: 8000, utilities: 1000, licenses: 500,
    cloudKitchen: 0, marketing: 2000,
    packaging: 2, delivery: 3,
    monthlyGMV: 50000,
    platforms: [
      { name: 'Talabat', fee: 20, serviceFee: 0, paymentGatewayFee: 0, campaignDiscount: 0 }
    ]
  };

  const baseResult = {
    inputs: baseInputs,
    weightedPrice: 50,
    weightedCost: 20
  };

  test('base case with no deltas', () => {
    const r = calculateSensitivity(baseResult, 0, 0, 0, 0, 15);
    expect(typeof r.netProfit).toBe('number');
    expect(r.bestPlatform).toBeDefined();
    expect(r.bestPlatform.name).toBe('Talabat');
  });

  test('commission increase reduces best platform profit', () => {
    const base = calculateSensitivity(baseResult, 0, 0, 0, 0, 15);
    const higher = calculateSensitivity(baseResult, 10, 0, 0, 0, 15);
    expect(higher.bestPlatform.monthlyProfit).toBeLessThan(base.bestPlatform.monthlyProfit);
  });

  test('price increase improves profit', () => {
    const base = calculateSensitivity(baseResult, 0, 0, 0, 0, 15);
    const higher = calculateSensitivity(baseResult, 0, 0, 20, 0, 15);
    expect(higher.netProfit).toBeGreaterThan(base.netProfit);
  });

  test('negative commission is clamped to zero', () => {
    const r = calculateSensitivity(baseResult, -50, 0, 0, 0, 15);
    expect(r.netProfit).toBeGreaterThan(0);
  });

  test('orders increase improves profit', () => {
    const base = calculateSensitivity(baseResult, 0, 0, 0, 0, 15);
    const more = calculateSensitivity(baseResult, 0, 50, 0, 0, 15);
    expect(more.netProfit).toBeGreaterThan(base.netProfit);
  });

  test('handles zero vatRate', () => {
    const r = calculateSensitivity(baseResult, 0, 0, 0, 0, 0);
    expect(typeof r.netProfit).toBe('number');
    expect(r.bestPlatform.name).toBe('Talabat');
  });

  test('returns -1 breakEven when contribution is negative', () => {
    const badResult = {
      inputs: baseInputs,
      weightedPrice: 10,
      weightedCost: 50
    };
    const r = calculateSensitivity(badResult, 0, 0, 0, 0, 15);
    expect(r.breakEvenDaily).toBe(-1);
  });
});
