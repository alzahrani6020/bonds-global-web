/**
 * Bonds Pro-Forma Financial Statements Engine
 * Builds Income Statement, Cash Flow Statement, and Balance Sheet
 * for manufacturing and project-based sectors.
 */
(function (global) {
  'use strict';

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  /**
   * Build monthly pro-forma statements for a manufacturing/project.
   * @param {Object} inputs - detailed sector inputs
   * @param {number} months - projection length (default 60)
   * @param {Object} options - sector-specific options
   */
  function buildProFormaStatements(inputs, months = 60, options = {}) {
    const sector = options.sector || 'default';
    if (sector === 'water-factory') {
      return buildWaterFactoryProForma(inputs, months, options);
    }
    return buildGenericProForma(inputs, months, options);
  }

  function buildWaterFactoryProForma(inputs, months = 60, options = {}) {
    const projectMonths = Math.max(12, Math.min(120, toNumber(months, 60)));

    // Revenue drivers
    const maxDailyProduction = toNumber(inputs.dailyProduction);
    const initialUtilization = toNumber(inputs.initialCapacityUtilization, 60);
    const monthlyGrowthRate = toNumber(inputs.monthlyGrowthRate, 5);
    const wastageRate = toNumber(inputs.wastageRate, 2);
    const bottlePrice = toNumber(inputs.bottlePrice);
    const directRate = toNumber(inputs.directSalesRate, 30) / 100;
    const distRate = toNumber(inputs.distributorSalesRate, 50) / 100;
    const platformRate = toNumber(inputs.platformSalesRate, 20) / 100;
    const distDiscount = toNumber(inputs.distributorDiscountRate, 20) / 100;
    const platformCommission = toNumber(inputs.platformCommissionRate, 15) / 100;
    const avgNetPrice = bottlePrice *
      (directRate + distRate * (1 - distDiscount) + platformRate * (1 - platformCommission));

    // Cost drivers
    const materialCostPerBottle =
      toNumber(inputs.bottleCostPerUnit) +
      toNumber(inputs.capCostPerUnit, 0.05) +
      toNumber(inputs.labelCostPerUnit, 0.05) +
      toNumber(inputs.cartonCostPerBottle, 0.08) +
      toNumber(inputs.shrinkCostPerBottle, 0.05);
    const logisticsCostPerBottle = toNumber(inputs.logisticsCostPerBottle, 0.12);
    const variableCostPerBottle = materialCostPerBottle + logisticsCostPerBottle;

    const kWhPerThousand = toNumber(inputs.kWhPerThousandBottles, 8);
    const electricityRate = toNumber(inputs.electricityRatePerKwh, 0.18);
    const waterM3PerThousand = toNumber(inputs.waterM3PerThousandBottles, 1.5);
    const waterRate = toNumber(inputs.waterRatePerM3, 2.5);

    const shiftCost = toNumber(inputs.shiftCostPerWorker, 150);
    const workers = toNumber(inputs.workersPerShift, 6);
    const shifts = toNumber(inputs.shiftCount, 2);
    const workingDays = toNumber(inputs.monthlyWorkingDays, 26);
    const enteredSalaries = toNumber(inputs.monthlySalaries, shiftCost * workers * shifts * workingDays);

    const factoryCost = toNumber(inputs.factoryCost, 4000000);
    const maintenanceRate = toNumber(inputs.maintenanceRate, 1);
    const licenseInsurance = toNumber(inputs.monthlyLicenseInsurance, 8000);
    const labCost = toNumber(inputs.labCostPerMonth || inputs.labCostMonthly, 10000);
    const marketingCost = toNumber(inputs.marketingCostPerCustomer, 400) * toNumber(inputs.monthlyNewCustomers, 40);

    // Inflation
    const costInflationMonthly = Math.pow(1 + toNumber(inputs.annualCostInflation, 3) / 100, 1 / 12);
    const priceInflationMonthly = Math.pow(1 + toNumber(inputs.annualPriceIncrease, 2) / 100, 1 / 12);

    // Financing
    const equityRatio = Math.min(100, Math.max(0, toNumber(inputs.equityRatio, 30)));
    const totalFacilityCost = toNumber(inputs.warehouseAreaM2, 800) * toNumber(inputs.buildingCostPerM2, 1500);
    const rawMaterialInventory = maxDailyProduction * variableCostPerBottle * toNumber(inputs.rawMaterialInventoryDays, 15);
    const totalInvestment = factoryCost + totalFacilityCost + rawMaterialInventory;
    const loanAmount = totalInvestment * (1 - equityRatio / 100);
    const annualInterest = toNumber(inputs.loanInterestRate, 7) / 100;
    const monthlyInterest = annualInterest / 12;
    const loanMonths = toNumber(inputs.loanTermYears, 5) * 12;
    const monthlyInstallment = calculatePMT(loanAmount, monthlyInterest, loanMonths);

    // Depreciation (straight-line over 10 years for machinery, 20 years for building)
    const machineryLifeMonths = 120;
    const buildingLifeMonths = 240;

    // Tax
    const taxRate = 0.20;

    // Working capital (CCC)
    const sectorWorkingCapital = {
      'water-factory': { dso: 15, dio: 20, dpo: 30 },
      'food-factory': { dso: 30, dio: 15, dpo: 30 },
      'retail': { dso: 15, dio: 45, dpo: 30 },
      'hospitality': { dso: 10, dio: 7, dpo: 21 },
      'real-estate': { dso: 0, dio: 0, dpo: 30 },
      'default': { dso: 30, dio: 15, dpo: 30 }
    };
    const wcDefaults = sectorWorkingCapital[options.sector] || sectorWorkingCapital['default'];
    const dsoDays = Math.max(0, toNumber(inputs.dsoDays, wcDefaults.dso));
    const dioDays = Math.max(0, toNumber(inputs.dioDays, wcDefaults.dio));
    const dpoDays = Math.max(0, toNumber(inputs.dpoDays, wcDefaults.dpo));

    // Capacity constraints & step capex
    const maxCapacityUtilization = Math.min(1, Math.max(0.5, toNumber(inputs.maxCapacityUtilization, 95) / 100));
    const capacityExpansionThreshold = Math.min(1, Math.max(0.5, toNumber(inputs.capacityExpansionThreshold, 85) / 100));
    const capacityExpansionAmount = Math.max(0, toNumber(inputs.capacityExpansionAmount, 50) / 100);
    const capacityExpansionCostRate = Math.max(0, toNumber(inputs.capacityExpansionCostRate, 30) / 100);
    let currentMaxDailyProduction = maxDailyProduction;
    let currentFactoryCost = factoryCost;
    let stepCapexTotal = 0;
    const capacityHistory = [];

    const incomeStatement = [];
    const cashFlow = [];
    const balanceSheet = [];

    let retainedEarnings = 0;
    let cashBalance = 0;
    let loanBalance = loanAmount;
    let accumulatedDepreciation = 0;
    let taxLossCarryforward = 0;
    let totalRevenueAll = 0;
    let totalNetIncomeAll = 0;

    for (let m = 1; m <= projectMonths; m++) {
      const priceMultiplier = Math.pow(priceInflationMonthly, m - 1);
      const costMultiplier = Math.pow(costInflationMonthly, m - 1);

      // Capacity expansion logic
      const demandedDaily = maxDailyProduction * (initialUtilization / 100) * Math.pow(1 + monthlyGrowthRate / 100, m - 1);
      const effectiveCapacity = currentMaxDailyProduction * maxCapacityUtilization;
      let stepCapex = 0;
      if (capacityExpansionAmount > 0 && demandedDaily > effectiveCapacity) {
        const prevCapacity = currentMaxDailyProduction;
        stepCapex = currentFactoryCost * capacityExpansionCostRate;
        currentMaxDailyProduction = currentMaxDailyProduction * (1 + capacityExpansionAmount);
        currentFactoryCost += stepCapex;
        stepCapexTotal += stepCapex;
        capacityHistory.push({ month: m, addedCapacity: currentMaxDailyProduction - prevCapacity, newCapacity: currentMaxDailyProduction, cost: stepCapex });
      }

      const cappedDaily = Math.min(demandedDaily, currentMaxDailyProduction * maxCapacityUtilization);
      const effectiveDaily = cappedDaily * (1 - wastageRate / 100);
      const monthlyUnits = effectiveDaily * 30;

      const revenue = monthlyUnits * avgNetPrice * priceMultiplier;
      const cogs = monthlyUnits * variableCostPerBottle * costMultiplier;
      const electricity = (monthlyUnits / 1000) * kWhPerThousand * electricityRate * costMultiplier;
      const water = (monthlyUnits / 1000) * waterM3PerThousand * waterRate * costMultiplier;
      const maintenance = currentFactoryCost * (maintenanceRate / 100) / 12 * costMultiplier;
      const salaries = enteredSalaries * costMultiplier;
      const opex = salaries + electricity + water + maintenance + licenseInsurance * costMultiplier + labCost * costMultiplier + marketingCost * costMultiplier;

      const monthlyDepreciationMachinery = currentFactoryCost / machineryLifeMonths;
      const monthlyDepreciationBuilding = totalFacilityCost / buildingLifeMonths;
      const monthlyDepreciation = monthlyDepreciationMachinery + monthlyDepreciationBuilding;

      const grossProfit = revenue - cogs;
      const ebitda = grossProfit - (opex - monthlyDepreciation);
      const ebit = ebitda - monthlyDepreciation;

      const interestExpense = loanBalance * monthlyInterest;
      const principalPaid = Math.min(loanBalance, monthlyInstallment - interestExpense);
      const ebt = ebit - interestExpense;

      let taxableIncome = ebt;
      let utilizedLoss = 0;
      if (taxableIncome > 0 && taxLossCarryforward > 0) {
        utilizedLoss = Math.min(taxLossCarryforward, taxableIncome);
        taxableIncome -= utilizedLoss;
        taxLossCarryforward -= utilizedLoss;
      }
      const tax = Math.max(0, taxableIncome * taxRate);
      if (ebt < 0) {
        taxLossCarryforward += Math.abs(ebt);
      }
      const netIncome = ebt - tax;

      const accountsReceivable = revenue * (dsoDays / 30);
      const inventory = cogs * (dioDays / 30);
      const accountsPayable = cogs * (dpoDays / 30);
      const netWorkingCapital = accountsReceivable + inventory - accountsPayable;

      incomeStatement.push({
        month: m,
        revenue: round(revenue),
        cogs: round(cogs),
        grossProfit: round(grossProfit),
        opex: round(opex),
        ebitda: round(ebitda),
        depreciation: round(monthlyDepreciation),
        ebit: round(ebit),
        interestExpense: round(interestExpense),
        tax: round(tax),
        netIncome: round(netIncome),
        taxLossCarryforward: round(taxLossCarryforward),
        accountsReceivable: round(accountsReceivable),
        inventory: round(inventory),
        accountsPayable: round(accountsPayable),
        netWorkingCapital: round(netWorkingCapital)
      });

      const prevNetWorkingCapital = m === 1 ? 0 : (incomeStatement[m - 2].accountsReceivable + incomeStatement[m - 2].inventory - incomeStatement[m - 2].accountsPayable);
      const changeInWorkingCapital = netWorkingCapital - prevNetWorkingCapital;
      const operatingCashFlow = netIncome + monthlyDepreciation - changeInWorkingCapital;
      const investingCashFlow = (m === 1 ? -totalInvestment : 0) - stepCapex;
      const financingCashFlow = m === 1 ? loanAmount : -(principalPaid + interestExpense);
      const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;
      cashBalance += netCashFlow;
      loanBalance = Math.max(0, loanBalance - principalPaid);
      accumulatedDepreciation += monthlyDepreciation;
      retainedEarnings += netIncome;

      cashFlow.push({
        month: m,
        operatingCashFlow: round(operatingCashFlow),
        investingCashFlow: round(investingCashFlow),
        financingCashFlow: round(financingCashFlow),
        netCashFlow: round(netCashFlow),
        cashBalance: round(cashBalance),
        loanBalance: round(loanBalance)
      });

      const operatingCurrentAssets = accountsReceivable + inventory;
      const totalAssets = cashBalance + currentFactoryCost + totalFacilityCost - accumulatedDepreciation + operatingCurrentAssets;
      const totalLiabilities = loanBalance + accountsPayable;
      const equity = totalAssets - totalLiabilities;

      balanceSheet.push({
        month: m,
        cash: round(cashBalance),
        accountsReceivable: round(accountsReceivable),
        inventory: round(inventory),
        operatingCurrentAssets: round(operatingCurrentAssets),
        fixedAssets: round(currentFactoryCost + totalFacilityCost),
        accumulatedDepreciation: round(accumulatedDepreciation),
        netFixedAssets: round(currentFactoryCost + totalFacilityCost - accumulatedDepreciation),
        totalAssets: round(totalAssets),
        accountsPayable: round(accountsPayable),
        totalDebt: round(loanBalance),
        totalLiabilities: round(totalLiabilities),
        retainedEarnings: round(retainedEarnings),
        totalEquity: round(equity),
        balanceCheck: round(totalAssets - totalLiabilities - equity)
      });

      totalRevenueAll += revenue;
      totalNetIncomeAll += netIncome;
    }

    const freeCashFlows = cashFlow.map(r => r.netCashFlow);
    const waccMonthly = Math.pow(1 + (options.discountRate || 0.10), 1 / 12) - 1;
    const projectNpv = calculateNPV(freeCashFlows, waccMonthly);
    const projectIrr = calculateMIRR(freeCashFlows);
    const minCash = Math.min(...cashFlow.map(r => r.cashBalance));
    const fundingGap = minCash < 0 ? Math.abs(minCash) : 0;
    const finalTotalInvestment = totalInvestment + stepCapexTotal;

    return {
      summary: {
        totalInvestment: round(finalTotalInvestment),
        initialInvestment: round(totalInvestment),
        stepCapexTotal: round(stepCapexTotal),
        loanAmount: round(loanAmount),
        equityAmount: round(totalInvestment - loanAmount),
        monthlyInstallment: round(monthlyInstallment),
        totalRevenue: round(totalRevenueAll),
        totalNetIncome: round(totalNetIncomeAll),
        npv: round(projectNpv),
        irr: round(projectIrr * 100),
        fundingGap: round(fundingGap),
        minCashBalance: round(minCash)
      },
      incomeStatement,
      cashFlow,
      balanceSheet,
      capacityHistory,
      monthly: {
        avgRevenue: round(totalRevenueAll / projectMonths),
        avgNetIncome: round(totalNetIncomeAll / projectMonths)
      }
    };
  }

  function buildGenericProForma(inputs, months = 60, options = {}) {
    const projectMonths = Math.max(12, Math.min(120, toNumber(months, 60)));
    const sector = options.sector || 'default';

    // Normalize generic drivers
    const unitPrice = resolveUnitPrice(inputs);
    const initialVolume = resolveMonthlyVolumeForSector(inputs, sector, projectMonths);
    const unitVariableCost = resolveUnitVariableCost(inputs, unitPrice, initialVolume);
    const monthlyFixedCosts = resolveMonthlyFixedCosts(inputs);
    const totalInvestment = resolveTotalInvestment(inputs);

    if (!unitPrice || !initialVolume || totalInvestment <= 0) {
      return emptyProForma(projectMonths);
    }

    const initialUtilization = toNumber(inputs.initialCapacityUtilization, 60);
    const monthlyGrowthRate = toNumber(inputs.monthlyGrowthRate, 2);
    const wastageRate = toNumber(inputs.wastageRate, 0);
    const maxCapacityUtilization = Math.min(1, Math.max(0.5, toNumber(inputs.maxCapacityUtilization, 95) / 100));
    const capacityExpansionThreshold = Math.min(1, Math.max(0.5, toNumber(inputs.capacityExpansionThreshold, 85) / 100));
    const capacityExpansionAmount = Math.max(0, toNumber(inputs.capacityExpansionAmount, 50) / 100);
    const capacityExpansionCostRate = Math.max(0, toNumber(inputs.capacityExpansionCostRate, 30) / 100);

    const costInflationMonthly = Math.pow(1 + toNumber(inputs.annualCostInflation, 3) / 100, 1 / 12);
    const priceInflationMonthly = Math.pow(1 + toNumber(inputs.annualPriceIncrease, 2) / 100, 1 / 12);

    const equityRatio = Math.min(100, Math.max(0, toNumber(inputs.equityRatio, 30)));
    const loanAmount = totalInvestment * (1 - equityRatio / 100);
    const annualInterest = toNumber(inputs.loanInterestRate, 7) / 100;
    const monthlyInterest = annualInterest / 12;
    const loanMonths = toNumber(inputs.loanTermYears, 5) * 12;
    const monthlyInstallment = calculatePMT(loanAmount, monthlyInterest, loanMonths);

    const machineryLifeMonths = 120;
    const maintenanceRate = toNumber(inputs.maintenanceRate, 1);
    const taxRate = 0.20;

    const sectorWorkingCapital = {
      'food-factory': { dso: 30, dio: 20, dpo: 30 },
      'industrial': { dso: 45, dio: 30, dpo: 35 },
      'real-estate': { dso: 15, dio: 0, dpo: 45 },
      'restaurants': { dso: 5, dio: 10, dpo: 15 },
      'technology': { dso: 30, dio: 0, dpo: 15 },
      'default': { dso: 30, dio: 15, dpo: 30 }
    };
    const wcDefaults = sectorWorkingCapital[sector] || sectorWorkingCapital['default'];
    const dsoDays = Math.max(0, toNumber(inputs.dsoDays, wcDefaults.dso));
    const dioDays = Math.max(0, toNumber(inputs.dioDays, wcDefaults.dio));
    const dpoDays = Math.max(0, toNumber(inputs.dpoDays, wcDefaults.dpo));

    let currentMaxVolume = initialVolume;
    let currentFixedAssetBase = totalInvestment;
    let stepCapexTotal = 0;
    const capacityHistory = [];

    const incomeStatement = [];
    const cashFlow = [];
    const balanceSheet = [];

    let retainedEarnings = 0;
    let cashBalance = 0;
    let loanBalance = loanAmount;
    let accumulatedDepreciation = 0;
    let taxLossCarryforward = 0;
    let totalRevenueAll = 0;
    let totalNetIncomeAll = 0;

    for (let m = 1; m <= projectMonths; m++) {
      const priceMultiplier = Math.pow(priceInflationMonthly, m - 1);
      const costMultiplier = Math.pow(costInflationMonthly, m - 1);

      const demandedVolume = initialVolume * (initialUtilization / 100) * Math.pow(1 + monthlyGrowthRate / 100, m - 1);
      const effectiveCapacity = currentMaxVolume * maxCapacityUtilization;
      let stepCapex = 0;
      if (capacityExpansionAmount > 0 && demandedVolume > effectiveCapacity) {
        const prevCapacity = currentMaxVolume;
        stepCapex = currentFixedAssetBase * capacityExpansionCostRate;
        currentMaxVolume = currentMaxVolume * (1 + capacityExpansionAmount);
        currentFixedAssetBase += stepCapex;
        stepCapexTotal += stepCapex;
        capacityHistory.push({ month: m, addedCapacity: currentMaxVolume - prevCapacity, newCapacity: currentMaxVolume, cost: stepCapex });
      }

      const cappedVolume = Math.min(demandedVolume, currentMaxVolume * maxCapacityUtilization);
      const effectiveVolume = cappedVolume * (1 - wastageRate / 100);

      const revenue = effectiveVolume * unitPrice * priceMultiplier;
      const cogs = effectiveVolume * unitVariableCost * costMultiplier;
      const maintenance = currentFixedAssetBase * (maintenanceRate / 100) / 12 * costMultiplier;
      const opex = monthlyFixedCosts * costMultiplier + maintenance;

      const monthlyDepreciation = currentFixedAssetBase / machineryLifeMonths;
      const grossProfit = revenue - cogs;
      const ebitda = grossProfit - (opex - monthlyDepreciation);
      const ebit = ebitda - monthlyDepreciation;

      const interestExpense = loanBalance * monthlyInterest;
      const principalPaid = Math.min(loanBalance, monthlyInstallment - interestExpense);
      const ebt = ebit - interestExpense;

      let taxableIncome = ebt;
      let utilizedLoss = 0;
      if (taxableIncome > 0 && taxLossCarryforward > 0) {
        utilizedLoss = Math.min(taxLossCarryforward, taxableIncome);
        taxableIncome -= utilizedLoss;
        taxLossCarryforward -= utilizedLoss;
      }
      const tax = Math.max(0, taxableIncome * taxRate);
      if (ebt < 0) {
        taxLossCarryforward += Math.abs(ebt);
      }
      const netIncome = ebt - tax;

      const accountsReceivable = revenue * (dsoDays / 30);
      const inventory = cogs * (dioDays / 30);
      const accountsPayable = cogs * (dpoDays / 30);
      const netWorkingCapital = accountsReceivable + inventory - accountsPayable;

      incomeStatement.push({
        month: m,
        revenue: round(revenue),
        cogs: round(cogs),
        grossProfit: round(grossProfit),
        opex: round(opex),
        ebitda: round(ebitda),
        depreciation: round(monthlyDepreciation),
        ebit: round(ebit),
        interestExpense: round(interestExpense),
        tax: round(tax),
        netIncome: round(netIncome),
        taxLossCarryforward: round(taxLossCarryforward),
        accountsReceivable: round(accountsReceivable),
        inventory: round(inventory),
        accountsPayable: round(accountsPayable),
        netWorkingCapital: round(netWorkingCapital)
      });

      const prevNetWorkingCapital = m === 1 ? 0 : (incomeStatement[m - 2].accountsReceivable + incomeStatement[m - 2].inventory - incomeStatement[m - 2].accountsPayable);
      const changeInWorkingCapital = netWorkingCapital - prevNetWorkingCapital;
      const operatingCashFlow = netIncome + monthlyDepreciation - changeInWorkingCapital;
      const investingCashFlow = (m === 1 ? -totalInvestment : 0) - stepCapex;
      const financingCashFlow = m === 1 ? loanAmount : -(principalPaid + interestExpense);
      const netCashFlow = operatingCashFlow + investingCashFlow + financingCashFlow;
      cashBalance += netCashFlow;
      loanBalance = Math.max(0, loanBalance - principalPaid);
      accumulatedDepreciation += monthlyDepreciation;
      retainedEarnings += netIncome;

      cashFlow.push({
        month: m,
        operatingCashFlow: round(operatingCashFlow),
        investingCashFlow: round(investingCashFlow),
        financingCashFlow: round(financingCashFlow),
        netCashFlow: round(netCashFlow),
        cashBalance: round(cashBalance),
        loanBalance: round(loanBalance)
      });

      const operatingCurrentAssets = accountsReceivable + inventory;
      const totalAssets = cashBalance + currentFixedAssetBase - accumulatedDepreciation + operatingCurrentAssets;
      const totalLiabilities = loanBalance + accountsPayable;
      const equity = totalAssets - totalLiabilities;

      balanceSheet.push({
        month: m,
        cash: round(cashBalance),
        accountsReceivable: round(accountsReceivable),
        inventory: round(inventory),
        operatingCurrentAssets: round(operatingCurrentAssets),
        fixedAssets: round(currentFixedAssetBase),
        accumulatedDepreciation: round(accumulatedDepreciation),
        netFixedAssets: round(currentFixedAssetBase - accumulatedDepreciation),
        totalAssets: round(totalAssets),
        accountsPayable: round(accountsPayable),
        totalDebt: round(loanBalance),
        totalLiabilities: round(totalLiabilities),
        retainedEarnings: round(retainedEarnings),
        totalEquity: round(equity),
        balanceCheck: round(totalAssets - totalLiabilities - equity)
      });

      totalRevenueAll += revenue;
      totalNetIncomeAll += netIncome;
    }

    const freeCashFlows = cashFlow.map(r => r.netCashFlow);
    const waccMonthly = Math.pow(1 + (options.discountRate || 0.10), 1 / 12) - 1;
    const projectNpv = calculateNPV(freeCashFlows, waccMonthly);
    const projectIrr = calculateMIRR(freeCashFlows);
    const minCash = Math.min(...cashFlow.map(r => r.cashBalance));
    const fundingGap = minCash < 0 ? Math.abs(minCash) : 0;
    const finalTotalInvestment = totalInvestment + stepCapexTotal;

    return {
      summary: {
        totalInvestment: round(finalTotalInvestment),
        initialInvestment: round(totalInvestment),
        stepCapexTotal: round(stepCapexTotal),
        loanAmount: round(loanAmount),
        equityAmount: round(totalInvestment - loanAmount),
        monthlyInstallment: round(monthlyInstallment),
        totalRevenue: round(totalRevenueAll),
        totalNetIncome: round(totalNetIncomeAll),
        npv: round(projectNpv),
        irr: round(projectIrr * 100),
        fundingGap: round(fundingGap),
        minCashBalance: round(minCash)
      },
      incomeStatement,
      cashFlow,
      balanceSheet,
      capacityHistory,
      monthly: {
        avgRevenue: round(totalRevenueAll / projectMonths),
        avgNetIncome: round(totalNetIncomeAll / projectMonths)
      }
    };
  }

  function emptyProForma(projectMonths) {
    return {
      summary: { totalInvestment: 0, initialInvestment: 0, stepCapexTotal: 0, loanAmount: 0, equityAmount: 0, monthlyInstallment: 0, totalRevenue: 0, totalNetIncome: 0, npv: 0, irr: 0, fundingGap: 0, minCashBalance: 0 },
      incomeStatement: [],
      cashFlow: [],
      balanceSheet: [],
      capacityHistory: [],
      monthly: { avgRevenue: 0, avgNetIncome: 0 }
    };
  }

  // Generic input normalizers
  function resolveUnitPrice(inputs) {
    const candidates = [
      'unitPrice', 'bottlePrice', 'avgTicket', 'subscriptionPrice', 'pricePerKg', 'revenuePerTrip',
      'avgDailyRate', 'avgDailyRevenue', 'monthlyFee', 'sellingPricePerUnit', 'sellingPricePerVilla',
      'sellingPricePerApartment', 'avgDailyRevenuePerBed', 'avgMonthlyRevenuePerClinic'
    ];
    for (const c of candidates) {
      const v = toNumber(inputs[c]);
      if (v > 0) return v;
    }
    return 0;
  }

  function resolveMonthlyVolume(inputs) {
    return resolveMonthlyVolumeForSector(inputs, 'default', 60);
  }

  function resolveMonthlyVolumeForSector(inputs, sector, projectMonths) {
    if (sector === 'real-estate' || sector === 'land-development' || sector === 'villa-construction' || sector === 'residential-building') {
      const units = toNumber(inputs.unitsCount);
      const months = toNumber(inputs.projectMonths, projectMonths);
      if (units > 0 && months > 0) return units / months;
    }
    if (sector === 'restaurants' || sector === 'food-truck' || sector === 'coffee-shop' || sector === 'fast-food-restaurant' || sector === 'fine-dining-restaurant' || sector === 'cloud-kitchen') {
      const daily = toNumber(inputs.dailyCustomers || inputs.dailyOrders || inputs.avgDailyCustomers);
      if (daily > 0) return daily * 30;
    }
    const monthlyCapacity = toNumber(inputs.monthlyCapacity);
    if (monthlyCapacity > 0) return monthlyCapacity;
    const dailyCustomers = toNumber(inputs.dailyCustomers);
    if (dailyCustomers > 0) return dailyCustomers * 30;
    const subscribers = toNumber(inputs.subscribers);
    if (subscribers > 0) return subscribers;
    const unitsCount = toNumber(inputs.unitsCount);
    if (unitsCount > 0) return unitsCount;
    const dailyProduction = toNumber(inputs.dailyProduction);
    if (dailyProduction > 0) return dailyProduction * 30;
    const monthlyTrips = toNumber(inputs.monthlyTrips);
    if (monthlyTrips > 0) return monthlyTrips;
    const yieldPerHectare = toNumber(inputs.yieldPerHectare);
    const areaHectares = toNumber(inputs.areaHectares, toNumber(inputs.areaSize));
    if (yieldPerHectare > 0 && areaHectares > 0) return yieldPerHectare * areaHectares;
    return 0;
  }

  function resolveUnitVariableCost(inputs, unitPrice, monthlyVolume = 1) {
    const candidates = [
      'unitVariableCost', 'rawMaterialCostPerUnit', 'bottleCostPerUnit', 'operationalCostPerKg',
      'costPerUnit', 'fuelMaintenance', 'monthlyServers'
    ];
    for (const c of candidates) {
      const v = toNumber(inputs[c]);
      if (v > 0) {
        if (c === 'fuelMaintenance' || c === 'monthlyServers') return v / Math.max(1, monthlyVolume);
        return v;
      }
    }
    const foodCostRate = toNumber(inputs.foodCostRate);
    if (foodCostRate > 0) return unitPrice * (foodCostRate / 100);
    const materialCostRate = toNumber(inputs.materialCostRate);
    if (materialCostRate > 0) return unitPrice * (materialCostRate / 100);
    return unitPrice * 0.4;
  }

  function resolveMonthlyFixedCosts(inputs) {
    const fixed = toNumber(inputs.monthlyFixedCosts);
    if (fixed > 0) return fixed;
    const salaries = toNumber(inputs.monthlySalaries);
    const utilities = toNumber(inputs.monthlyUtilities);
    const marketing = toNumber(inputs.monthlyMarketing);
    const rent = toNumber(inputs.monthlyRent);
    const total = salaries + utilities + marketing + rent;
    if (total > 0) return total;
    return toNumber(inputs.factoryCost, 0) * 0.02;
  }

  function resolveTotalInvestment(inputs) {
    const candidates = [
      'totalInvestment', 'factoryCost', 'setupCost', 'constructionCost', 'equipmentCost',
      'developmentCost', 'initialInvestment', 'landCost', 'buildingCost', 'landValue', 'projectCost'
    ];
    for (const c of candidates) {
      const v = toNumber(inputs[c]);
      if (v > 0) return v;
    }
    return 0;
  }

  function calculateNPV(cashFlows, monthlyRate) {
    let npv = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      npv += cashFlows[i] / Math.pow(1 + monthlyRate, i);
    }
    return npv;
  }

  function calculateMIRR(cashFlows, financeRate = 0.08, reinvestRate = 0.10) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) return 0;
    const n = cashFlows.length - 1;
    let negativePv = 0;
    let positiveFv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      if (cashFlows[t] < 0) negativePv += cashFlows[t] / Math.pow(1 + financeRate, t);
      else positiveFv += cashFlows[t] * Math.pow(1 + reinvestRate, n - t);
    }
    if (negativePv === 0) return 0;
    const monthlyMirr = Math.pow(positiveFv / Math.abs(negativePv), 1 / n) - 1;
    return Math.pow(1 + monthlyMirr, 12) - 1;
  }

  function calculateIRR(cashFlows, guess = 0.1) {
    if (!Array.isArray(cashFlows) || cashFlows.length < 2) return 0;
    const maxIterations = 100;
    const tolerance = 1e-7;
    let rate = guess;
    for (let i = 0; i < maxIterations; i++) {
      let npv = 0;
      let derivative = 0;
      for (let t = 0; t < cashFlows.length; t++) {
        npv += cashFlows[t] / Math.pow(1 + rate, t);
        if (t > 0) derivative -= t * cashFlows[t] / Math.pow(1 + rate, t + 1);
      }
      if (Math.abs(derivative) < tolerance) break;
      const newRate = rate - npv / derivative;
      if (Math.abs(newRate - rate) < tolerance) return newRate;
      rate = newRate;
    }
    return rate;
  }

  function calculatePMT(principal, monthlyRate, months) {
    if (principal <= 0 || months <= 0) return 0;
    if (monthlyRate <= 0) return principal / months;
    return principal *
      (monthlyRate * Math.pow(1 + monthlyRate, months)) /
      (Math.pow(1 + monthlyRate, months) - 1);
  }

  function round(n) {
    return Math.round(n * 100) / 100;
  }

  /**
   * Monte Carlo simulation for project outcomes.
   */
  function runMonteCarlo(baseInputs, variables, iterations = 1000, options = {}) {
    const npvs = [];
    const irrs = [];
    const netIncomes = [];
    const successFlags = [];

    for (let i = 0; i < iterations; i++) {
      const scenarioInputs = { ...baseInputs };
      variables.forEach(v => {
        const value = sampleVariable(v);
        scenarioInputs[v.field || v.name] = value;
      });

      try {
        const pf = buildProFormaStatements(scenarioInputs, 60, options);
        npvs.push(pf.summary.npv);
        irrs.push(pf.summary.irr);
        if (!Number.isFinite(pf.summary.irr) || pf.summary.irr > 1000) {
          const mirr = calculateMIRR(pf.cashFlow.map(r => r.netCashFlow));
          irrs[irrs.length - 1] = mirr;
        }
        netIncomes.push(pf.summary.totalNetIncome);
        successFlags.push(pf.summary.npv > 0 ? 1 : 0);
      } catch (err) {
        // ignore failed scenarios
      }
    }

    const npvVar95 = calculateVaR(npvs, 0.95);
    const npvCVar95 = calculateCVaR(npvs, 0.95);
    const npvVar99 = calculateVaR(npvs, 0.99);
    const npvCVar99 = calculateCVaR(npvs, 0.99);

    return {
      iterations: npvs.length,
      npv: summarizeDistribution(npvs),
      irr: summarizeDistribution(irrs),
      netIncome: summarizeDistribution(netIncomes),
      successRate: npvs.length > 0 ? (successFlags.reduce((a, b) => a + b, 0) / npvs.length) : 0,
      histogram: buildHistogram(npvs, 12),
      risk: {
        var95: round(npvVar95),
        cvar95: round(npvCVar95),
        var99: round(npvVar99),
        cvar99: round(npvCVar99)
      }
    };
  }

  function calculateVaR(values, confidence) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const p = 1 - confidence;
    return percentile(sorted, p);
  }

  function calculateCVaR(values, confidence) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const p = 1 - confidence;
    const thresholdIndex = Math.floor((sorted.length - 1) * p);
    const tail = sorted.slice(0, thresholdIndex + 1);
    if (tail.length === 0) return sorted[0];
    return tail.reduce((a, b) => a + b, 0) / tail.length;
  }

  function sampleVariable(v) {
    if (v.type === 'triangular') {
      const { min, max, mode } = v;
      const u = Math.random();
      const f = (mode - min) / (max - min);
      if (u <= f) {
        return min + Math.sqrt(u * (max - min) * (mode - min));
      }
      return max - Math.sqrt((1 - u) * (max - min) * (max - mode));
    }
    if (v.type === 'uniform') {
      return v.min + Math.random() * (v.max - v.min);
    }
    let u = 0, w = 0;
    while (w === 0) {
      u = Math.random() * 2 - 1;
      w = u * u + (Math.random() * 2 - 1) ** 2;
    }
    w = Math.sqrt(-2 * Math.log(w) / w);
    const sample = u * w * (v.stddev || 0) + (v.mean || 0);
    if (v.min !== undefined && sample < v.min) return v.min;
    if (v.max !== undefined && sample > v.max) return v.max;
    return sample;
  }

  function summarizeDistribution(values) {
    if (values.length === 0) return { mean: 0, median: 0, p5: 0, p95: 0, min: 0, max: 0 };
    const sorted = [...values].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
    const median = percentile(sorted, 0.5);
    const p5 = percentile(sorted, 0.05);
    const p95 = percentile(sorted, 0.95);
    return {
      mean: round(mean),
      median: round(median),
      p5: round(p5),
      p95: round(p95),
      min: round(sorted[0]),
      max: round(sorted[sorted.length - 1])
    };
  }

  function percentile(sorted, p) {
    const idx = (sorted.length - 1) * p;
    const lower = Math.floor(idx);
    const upper = Math.ceil(idx);
    if (lower === upper) return sorted[lower];
    return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
  }

  function buildHistogram(values, bins) {
    if (values.length === 0) return { labels: [], counts: [] };
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = (max - min) / bins || 1;
    const counts = new Array(bins).fill(0);
    values.forEach(v => {
      const idx = Math.min(bins - 1, Math.max(0, Math.floor((v - min) / step)));
      counts[idx]++;
    });
    const labels = [];
    for (let i = 0; i < bins; i++) {
      labels.push(round(min + i * step) + ' - ' + round(min + (i + 1) * step));
    }
    return { labels, counts };
  }

  function goalSeek(baseInputs, targetField, targetMetric = 'npv', targetValue = 0, min = 0, max = null, options = {}) {
    let lower = toNumber(min, 0);
    let upper = toNumber(max, lower + 1000);
    const tolerance = 0.001;
    const maxIterations = 50;

    function evaluate(value) {
      const inputs = { ...baseInputs, [targetField]: value };
      const pf = buildProFormaStatements(inputs, 60, options);
      return pf.summary[targetMetric] - targetValue;
    }

    let upperValue = evaluate(upper);
    let expansionCount = 0;
    while (upperValue < 0 && expansionCount < 20) {
      upper *= 2;
      upperValue = evaluate(upper);
      expansionCount++;
    }

    let lowerValue = evaluate(lower);
    let upperVal = upperValue;

    if (lowerValue * upperVal > 0) {
      return { found: false, value: null, reason: 'No sign change in range', bestValue: lower, bestError: lowerValue };
    }

    for (let i = 0; i < maxIterations; i++) {
      const mid = (lower + upper) / 2;
      const midValue = evaluate(mid);
      if (Math.abs(midValue) < tolerance) {
        return { found: true, value: round(mid), iterations: i + 1 };
      }
      if (midValue * lowerValue > 0) {
        lower = mid;
        lowerValue = midValue;
      } else {
        upper = mid;
        upperVal = midValue;
      }
    }

    const bestValue = round((lower + upper) / 2);
    return { found: true, value: bestValue, iterations: maxIterations, approximate: true };
  }

  const ProFormaEngine = {
    buildProFormaStatements,
    calculateNPV,
    calculateIRR,
    runMonteCarlo,
    goalSeek
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProFormaEngine;
  }
  global.ProFormaEngine = ProFormaEngine;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
