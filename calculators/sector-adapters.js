/**
 * Bonds Sector Adapters
 * Converts standalone calculator inputs into the generic InvestmentEngine shape.
 */
(function (global) {
  'use strict';

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  const adapters = {
    /**
     * restaurant.html adapter
     */
    restaurant: function (inputs) {
      const setupCost = toNumber(inputs.setupCost);
      const monthlyFixed = toNumber(inputs.rent) + toNumber(inputs.salaries) + toNumber(inputs.utilities) + toNumber(inputs.licenseCost) + toNumber(inputs.marketingBudget);
      const dailyOrders = toNumber(inputs.dailyOrders, inputs.dailyCustomers);
      const workingDays = toNumber(inputs.workingDays, 26);
      const avgTicket = toNumber(inputs.avgTicket, inputs.averageOrderValue);
      const monthlyRevenue = dailyOrders * avgTicket * workingDays;
      const packagingPerOrder = toNumber(inputs.packagingPerOrder);
      const deliveryPerOrder = toNumber(inputs.deliveryPerOrder);
      const platformFeeRate = toNumber(inputs.platformFeeRate, toNumber(inputs.averagePlatformFee)) / 100;
      const wasteRate = toNumber(inputs.wasteRate) / 100;
      const monthlyVariable = dailyOrders * workingDays * (
        packagingPerOrder + deliveryPerOrder + avgTicket * (platformFeeRate + wasteRate)
      );
      return {
        totalInvestment: setupCost,
        monthlyRevenue,
        monthlyFixedCosts: monthlyFixed,
        monthlyVariableCosts: monthlyVariable,
        unitPrice: avgTicket,
        unitVariableCost: dailyOrders > 0 ? monthlyVariable / (dailyOrders * workingDays) : 0,
        projectMonths: 60,
        sectorRiskWeight: 1.2
      };
    },

    /**
     * real-project-analysis.html adapter
     */
    realProject: function (inputs) {
      const projectValue = toNumber(inputs.projectValue, inputs.monthlyRevenue * 12);
      const directCosts = toNumber(inputs.directCosts);
      const salaries = toNumber(inputs.salaries);
      const rent = toNumber(inputs.rent);
      const inventoryCost = toNumber(inputs.inventoryCost);
      const equipmentCost = toNumber(inputs.equipmentCost);
      const totalInvestment = directCosts + inventoryCost + equipmentCost;
      const monthlyRevenue = projectValue / 12;
      const monthlyFixed = salaries + rent;
      const monthlyVariable = monthlyRevenue * 0.15;
      return {
        totalInvestment,
        monthlyRevenue,
        monthlyFixedCosts: monthlyFixed,
        monthlyVariableCosts: monthlyVariable,
        unitPrice: monthlyRevenue,
        unitVariableCost: monthlyVariable,
        projectMonths: 60,
        sectorRiskWeight: 1.1
      };
    },

    /**
     * medical-viability.html adapter
     */
    medical: function (inputs) {
      const setupCost = toNumber(inputs.setupCost);
      const monthlyFixed = toNumber(inputs.rent) + toNumber(inputs.salaries) + toNumber(inputs.utilities) + toNumber(inputs.insurance) + toNumber(inputs.marketing) + toNumber(inputs.maintenance) + toNumber(inputs.misc);
      const dailyVisits = toNumber(inputs.dailyVisits, inputs.dailyCustomers);
      const workingDays = toNumber(inputs.workingDays, 26);
      const avgServicePrice = toNumber(inputs.avgServicePrice, inputs.averageOrderValue);
      const monthlyRevenue = dailyVisits * avgServicePrice * workingDays;
      const suppliesRate = toNumber(inputs.suppliesRate, 25) / 100;
      const monthlyVariable = monthlyRevenue * suppliesRate;
      return {
        totalInvestment: setupCost,
        monthlyRevenue,
        monthlyFixedCosts: monthlyFixed,
        monthlyVariableCosts: monthlyVariable,
        unitPrice: avgServicePrice,
        unitVariableCost: avgServicePrice * suppliesRate,
        projectMonths: 60,
        sectorRiskWeight: 1.15
      };
    },

    /**
     * manufacturing-feasibility.html adapter
     */
    manufacturing: function (inputs) {
      const machinery = toNumber(inputs.machineryCost);
      const tools = toNumber(inputs.toolsCost);
      const licenses = toNumber(inputs.licensesCost);
      const facility = toNumber(inputs.facilityCost);
      const rawMaterialsSetup = toNumber(inputs.rawMaterialsSetupCost);
      const totalInvestment = machinery + tools + licenses + facility + rawMaterialsSetup;
      const monthlyFixed = toNumber(inputs.rent) + toNumber(inputs.salaries) + toNumber(inputs.utilities) + toNumber(inputs.maintenance) + toNumber(inputs.ads) + toNumber(inputs.subscriptions) + toNumber(inputs.misc);
      const dailyUnits = toNumber(inputs.dailyUnits);
      const workingDays = toNumber(inputs.workingDays, 26);
      const unitPrice = toNumber(inputs.unitPrice);
      const rawCostPerUnit = toNumber(inputs.rawCostPerUnit);
      const packagingPerUnit = toNumber(inputs.packagingPerUnit);
      const distributionRate = toNumber(inputs.distributionCommissionRate) / 100;
      const wasteRate = toNumber(inputs.wasteRate) / 100;
      const monthlyUnits = dailyUnits * workingDays;
      const monthlyRevenue = monthlyUnits * unitPrice;
      const monthlyVariable = monthlyUnits * (rawCostPerUnit + packagingPerUnit + unitPrice * distributionRate) + monthlyRevenue * wasteRate;
      return {
        totalInvestment,
        monthlyRevenue,
        monthlyFixedCosts: monthlyFixed,
        monthlyVariableCosts: monthlyVariable,
        unitPrice,
        unitVariableCost: monthlyUnits > 0 ? monthlyVariable / monthlyUnits : 0,
        projectMonths: 60,
        sectorRiskWeight: 1.3
      };
    },

    /**
     * loan.html adapter
     * Treats the loan as a "project" where NPV = net benefit minus financing cost.
     */
    loan: function (inputs) {
      const loanAmount = toNumber(inputs.loanAmount);
      const downPayment = toNumber(inputs.downPayment);
      const totalProjectCost = loanAmount + downPayment;
      const installment = toNumber(inputs.installment, inputs.monthlyInstallment);
      const monthlyIncome = toNumber(inputs.monthlyIncome, 1);
      const termMonths = toNumber(inputs.loanTermMonths, toNumber(inputs.termMonths, 60));
      const monthlyRevenue = monthlyIncome;
      const monthlyFixed = installment;
      const monthlyVariable = 0;
      return {
        totalInvestment: totalProjectCost,
        monthlyRevenue,
        monthlyFixedCosts: monthlyFixed,
        monthlyVariableCosts: monthlyVariable,
        unitPrice: monthlyIncome,
        unitVariableCost: 0,
        projectMonths: termMonths,
        sectorRiskWeight: 1.0
      };
    }
  };

  function adapt(sectorId, inputs) {
    const fn = adapters[sectorId];
    if (!fn) return null;
    return fn(inputs);
  }

  const SectorAdapters = { adapt, adapters };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SectorAdapters;
  }
  global.SectorAdapters = SectorAdapters;
})(typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : this);
