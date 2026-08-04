/**
 * Bonds Pro-Forma Renderer — Shared rendering layer for investment-center calculators.
 * Renders Pro-Forma summaries, J-Curve, sensitivity, Monte Carlo, and yearly statements.
 */
(function (global) {
  'use strict';

  const defaultOptions = {
    sector: 'default',
    isAr: true,
    formatNumber: (n) => Number.isFinite(n) ? n.toLocaleString('en-US') : '∞',
    hideSelectors: [],
    projectionMonths: null
  };

  const labels = {
    ar: {
      revenue: 'الإيرادات', cogs: 'تكلفة البضاعة المباعة', grossProfit: 'إجمالي الربح',
      opex: 'المصاريف التشغيلية', ebitda: 'EBITDA', depreciation: 'الإهلاك',
      ebit: 'EBIT', interestExpense: 'مصاريف الفائدة', tax: 'الضريبة', netIncome: 'صافي الربح',
      operatingCashFlow: 'التدفق النقدي التشغيلي', investingCashFlow: 'التدفق الاستثماري',
      financingCashFlow: 'التدفق التمويلي', netCashFlow: 'صافي التدفق النقدي',
      cash: 'النقد', accountsReceivable: 'الذمم المدينة', inventory: 'المخزون',
      netFixedAssets: 'الأصول الثابتة الصافية', totalAssets: 'إجمالي الأصول',
      accountsPayable: 'الذمم الدائنة', totalDebt: 'إجمالي الديون', totalEquity: 'حقوق الملكية',
      cumulativeCash: 'الرصيد النقدي التراكمي',
      npvDistribution: 'فئة NPV',
      scenarios: 'عدد السيناريوهات',
      noData: 'لا توجد بيانات',
      additionalFunding: ' (يحتاج تمويلاً إضافياً)',
      noCashDeficit: 'لا يوجد عجز نقدي',
      month: 'ش '
    },
    en: {
      revenue: 'Revenue', cogs: 'COGS', grossProfit: 'Gross Profit',
      opex: 'Operating Expenses', ebitda: 'EBITDA', depreciation: 'Depreciation',
      ebit: 'EBIT', interestExpense: 'Interest Expense', tax: 'Tax', netIncome: 'Net Income',
      operatingCashFlow: 'Operating Cash Flow', investingCashFlow: 'Investing Cash Flow',
      financingCashFlow: 'Financing Cash Flow', netCashFlow: 'Net Cash Flow',
      cash: 'Cash', accountsReceivable: 'Accounts Receivable', inventory: 'Inventory',
      netFixedAssets: 'Net Fixed Assets', totalAssets: 'Total Assets',
      accountsPayable: 'Accounts Payable', totalDebt: 'Total Debt', totalEquity: 'Total Equity',
      cumulativeCash: 'Cumulative Cash Balance',
      npvDistribution: 'NPV Range',
      scenarios: 'Scenarios',
      noData: 'No data',
      additionalFunding: ' (additional funding needed)',
      noCashDeficit: 'No cash deficit',
      month: 'M'
    }
  };

  function toNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function getProFormaMonteCarloVariables(inputs, sector, isAr) {
    if (sector === 'water-factory') {
      return [
        { name: 'bottlePrice', field: 'bottlePrice', type: 'triangular', min: toNumber(inputs.bottlePrice) * 0.8, max: toNumber(inputs.bottlePrice) * 1.2, mode: toNumber(inputs.bottlePrice) },
        { name: 'dailyProduction', field: 'dailyProduction', type: 'triangular', min: toNumber(inputs.dailyProduction) * 0.8, max: toNumber(inputs.dailyProduction) * 1.2, mode: toNumber(inputs.dailyProduction) },
        { name: 'bottleCost', field: 'bottleCostPerUnit', type: 'triangular', min: toNumber(inputs.bottleCostPerUnit) * 0.8, max: toNumber(inputs.bottleCostPerUnit) * 1.2, mode: toNumber(inputs.bottleCostPerUnit) }
      ].filter(v => v.mode > 0);
    }
    const priceField = inputs.unitPrice ? 'unitPrice' : (inputs.avgTicket ? 'avgTicket' : (inputs.avgTicketValue ? 'avgTicketValue' : (inputs.subscriptionPrice ? 'subscriptionPrice' : (inputs.bottlePrice ? 'bottlePrice' : 'unitPrice'))));
    const volumeField = inputs.monthlyCapacity ? 'monthlyCapacity' : (inputs.dailyCustomers ? 'dailyCustomers' : (inputs.dailyOrders ? 'dailyOrders' : (inputs.subscribers ? 'subscribers' : (inputs.dailyProduction ? 'dailyProduction' : 'monthlyCapacity'))));
    const costField = inputs.rawMaterialCostPerUnit ? 'rawMaterialCostPerUnit' : (inputs.rawMaterialCost ? 'rawMaterialCost' : (inputs.foodCostRate ? 'foodCostRate' : (inputs.bottleCostPerUnit ? 'bottleCostPerUnit' : 'rawMaterialCostPerUnit')));
    return [
      { name: priceField, field: priceField, type: 'triangular', min: toNumber(inputs[priceField]) * 0.8, max: toNumber(inputs[priceField]) * 1.2, mode: toNumber(inputs[priceField]) },
      { name: volumeField, field: volumeField, type: 'triangular', min: toNumber(inputs[volumeField]) * 0.7, max: toNumber(inputs[volumeField]) * 1.3, mode: toNumber(inputs[volumeField]) },
      { name: costField, field: costField, type: 'triangular', min: toNumber(inputs[costField]) * 0.8, max: toNumber(inputs[costField]) * 1.2, mode: toNumber(inputs[costField]) }
    ].filter(v => v.mode > 0);
  }

  function getProFormaSensitivityConfig(inputs, sector, isAr) {
    if (sector === 'water-factory') {
      return { priceField: 'bottlePrice', volumeField: 'dailyProduction', priceLabel: isAr ? 'سعر البيع' : 'Price', volumeLabel: isAr ? 'حجم الإنتاج' : 'Volume' };
    }
    if (sector === 'real-estate') {
      return { priceField: 'unitPrice', volumeField: 'unitsCount', priceLabel: isAr ? 'سعر الوحدة' : 'Unit Price', volumeLabel: isAr ? 'عدد الوحدات' : 'Units' };
    }
    if (sector === 'restaurants' || sector === 'restaurant' || sector === 'cloud-kitchen' || sector === 'coffee-shop' || sector === 'fast-food-restaurant' || sector === 'fine-dining-restaurant' || sector === 'food-truck') {
      const priceField = inputs.avgTicketValue ? 'avgTicketValue' : 'avgTicket';
      const volumeField = inputs.dailyOrders ? 'dailyOrders' : 'dailyCustomers';
      return { priceField, volumeField, priceLabel: isAr ? 'متوسط الفاتورة' : 'Avg Ticket', volumeLabel: isAr ? 'الطلبات/العملاء اليوميين' : 'Daily Orders/Customers' };
    }
    if (sector === 'technology' || sector === 'e-learning-platform') {
      return { priceField: 'subscriptionPrice', volumeField: 'subscribers', priceLabel: isAr ? 'سعر الاشتراك' : 'Subscription Price', volumeLabel: isAr ? 'المشتركين' : 'Subscribers' };
    }
    // industrial / food-factory / default
    return { priceField: 'unitPrice', volumeField: 'monthlyCapacity', priceLabel: isAr ? 'سعر الوحدة' : 'Unit Price', volumeLabel: isAr ? 'الطاقة الشهرية' : 'Monthly Capacity' };
  }

  function aggregateByYear(rows, keys) {
    const years = {};
    rows.forEach(r => {
      const year = Math.ceil(r.month / 12);
      if (!years[year]) years[year] = {};
      keys.forEach(k => {
        years[year][k] = (years[year][k] || 0) + r[k];
      });
    });
    return years;
  }

  function renderSummary(pf, opts) {
    const currency = opts.isAr ? 'ر.س' : 'SAR';
    const revenueEl = document.getElementById('pfTotalRevenue');
    if (revenueEl) revenueEl.textContent = opts.formatNumber(pf.summary.totalRevenue) + ' ' + currency;

    const netIncomeEl = document.getElementById('pfTotalNetIncome');
    if (netIncomeEl) netIncomeEl.textContent = opts.formatNumber(pf.summary.totalNetIncome) + ' ' + currency;

    const npvEl = document.getElementById('pfNpv');
    if (npvEl) {
      npvEl.textContent = opts.formatNumber(pf.summary.npv) + ' ' + currency;
      npvEl.style.color = pf.summary.npv >= 0 ? '#4ade80' : '#f87171';
    }

    const irrEl = document.getElementById('pfIrr');
    if (irrEl) irrEl.textContent = opts.formatNumber(pf.summary.irr) + '%';

    const gapEl = document.getElementById('pfFundingGap');
    if (gapEl) {
      if (pf.summary.fundingGap > 0) {
        gapEl.textContent = opts.formatNumber(pf.summary.fundingGap) + ' ' + currency + (opts.isAr ? labels.ar.additionalFunding : labels.en.additionalFunding);
        gapEl.style.color = '#f87171';
      } else {
        gapEl.textContent = opts.isAr ? labels.ar.noCashDeficit : labels.en.noCashDeficit;
        gapEl.style.color = '#4ade80';
      }
    }

    const stepCapexEl = document.getElementById('pfStepCapex');
    if (stepCapexEl) stepCapexEl.textContent = opts.formatNumber(pf.summary.stepCapexTotal || 0) + ' ' + currency;

    const expansionsPanel = document.getElementById('capacityExpansionsPanel');
    const expansionsBody = document.getElementById('capacityExpansionsBody');
    if (expansionsPanel && expansionsBody) {
      if (pf.capacityHistory && pf.capacityHistory.length > 0) {
        expansionsPanel.style.display = 'block';
        expansionsBody.innerHTML = pf.capacityHistory.map(e =>
          '<tr style="border-bottom: 1px solid rgba(197,160,40,0.1);"><td style="padding: 0.5rem;">' + e.month + '</td><td style="text-align: center; padding: 0.5rem;">' + opts.formatNumber(e.newCapacity) + '</td><td style="text-align: center; padding: 0.5rem;">' + opts.formatNumber(e.cost) + ' ' + currency + '</td></tr>'
        ).join('');
      } else {
        expansionsPanel.style.display = 'none';
      }
    }
  }

  function renderCashCurve(pf, opts) {
    const canvas = document.getElementById('proFormaCashCurveChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (window._proFormaCashCurveChart) {
      window._proFormaCashCurveChart.destroy();
    }
    const t = opts.isAr ? labels.ar : labels.en;
    const labelsArr = pf.cashFlow.map(r => t.month + r.month);
    const data = pf.cashFlow.map(r => r.cashBalance);
    const pointColors = data.map(v => v < 0 ? '#f87171' : '#4ade80');
    window._proFormaCashCurveChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labelsArr,
        datasets: [{
          label: t.cumulativeCash,
          data: data,
          borderColor: '#d4a853',
          backgroundColor: 'rgba(212,168,83,0.15)',
          fill: true,
          tension: 0.3,
          pointBackgroundColor: pointColors,
          pointRadius: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(context) {
                return opts.formatNumber(context.parsed.y) + ' ' + (opts.isAr ? 'ر.س' : 'SAR');
              }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', maxTicksLimit: 12 } },
          y: { ticks: { color: '#94a3b8', callback: function(v) { return opts.formatNumber(v); } } }
        }
      }
    });
  }

  function renderMonteCarlo(inputs, pf, opts) {
    if (!window.ProFormaEngine || !window.ProFormaEngine.runMonteCarlo) return;
    const variables = getProFormaMonteCarloVariables(inputs, opts.sector, opts.isAr);
    if (variables.length === 0) return;
    const mc = window.ProFormaEngine.runMonteCarlo(inputs, variables, 1000, { sector: opts.sector });
    const currency = opts.isAr ? 'ر.س' : 'SAR';

    const successEl = document.getElementById('mcSuccessRate');
    if (successEl) successEl.textContent = (mc.successRate * 100).toFixed(1) + '%';

    const meanEl = document.getElementById('mcMeanNpv');
    if (meanEl) meanEl.textContent = opts.formatNumber(mc.npv.mean) + ' ' + currency;

    const medianEl = document.getElementById('mcMedianNpv');
    if (medianEl) medianEl.textContent = opts.formatNumber(mc.npv.median) + ' ' + currency;

    const rangeEl = document.getElementById('mcNpvRange');
    if (rangeEl) rangeEl.textContent = opts.formatNumber(mc.npv.p5) + ' - ' + opts.formatNumber(mc.npv.p95) + ' ' + currency;

    const setRiskEl = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = opts.formatNumber(value) + ' ' + currency;
        el.style.color = value < 0 ? '#f87171' : '#4ade80';
      }
    };
    setRiskEl('mcVar95', mc.risk.var95);
    setRiskEl('mcCvar95', mc.risk.cvar95);
    setRiskEl('mcVar99', mc.risk.var99);
    setRiskEl('mcCvar99', mc.risk.cvar99);

    const canvas = document.getElementById('monteCarloHistogramChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (window._monteCarloHistogramChart) window._monteCarloHistogramChart.destroy();
    const t = opts.isAr ? labels.ar : labels.en;
    window._monteCarloHistogramChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: mc.histogram.labels,
        datasets: [{
          label: opts.isAr ? 'توزيع NPV' : 'NPV Distribution',
          data: mc.histogram.counts,
          backgroundColor: 'rgba(212,168,83,0.7)',
          borderColor: '#d4a853',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              title: function() { return t.npvDistribution; }
            }
          }
        },
        scales: {
          x: { ticks: { color: '#94a3b8', maxTicksLimit: 8 } },
          y: { ticks: { color: '#94a3b8' }, title: { display: true, text: t.scenarios, color: '#e8ecf4' } }
        }
      }
    });
  }

  function renderSensitivity(inputs, pf, opts) {
    if (!window.ProFormaEngine || !window.ProFormaEngine.buildProFormaStatements) return;
    const canvas = document.getElementById('proFormaSensitivityChart');
    if (!canvas || typeof Chart === 'undefined') return;
    const ctx = canvas.getContext('2d');
    if (window._proFormaSensitivityChart) {
      window._proFormaSensitivityChart.destroy();
    }

    const sensConfig = getProFormaSensitivityConfig(inputs, opts.sector, opts.isAr);
    const priceValue = toNumber(inputs[sensConfig.priceField]);
    const volumeValue = toNumber(inputs[sensConfig.volumeField]);
    if (priceValue === 0 || volumeValue === 0) return;

    const variants = [-20, -10, 0, 10, 20];
    const buildPf = (copy) => window.ProFormaEngine.buildProFormaStatements(copy, 60, { sector: opts.sector });

    const priceScenarios = variants.map(pct => {
      const copy = { ...inputs, [sensConfig.priceField]: priceValue * (1 + pct / 100) };
      const p = buildPf(copy);
      return { label: (pct > 0 ? '+' : '') + pct + '%', npv: p.summary.npv, irr: p.summary.irr };
    });
    const volumeScenarios = variants.map(pct => {
      const copy = { ...inputs, [sensConfig.volumeField]: volumeValue * (1 + pct / 100) };
      const p = buildPf(copy);
      return { label: (pct > 0 ? '+' : '') + pct + '%', npv: p.summary.npv, irr: p.summary.irr };
    });

    const labelsArr = variants.map(pct => (pct > 0 ? '+' : '') + pct + '%');
    window._proFormaSensitivityChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labelsArr,
        datasets: [
          {
            label: (opts.isAr ? 'NPV - ' : 'NPV - ') + sensConfig.priceLabel,
            data: priceScenarios.map(s => s.npv),
            backgroundColor: 'rgba(212,168,83,0.7)',
            yAxisID: 'y'
          },
          {
            label: (opts.isAr ? 'NPV - ' : 'NPV - ') + sensConfig.volumeLabel,
            data: volumeScenarios.map(s => s.npv),
            backgroundColor: 'rgba(59,130,246,0.7)',
            yAxisID: 'y'
          },
          {
            label: (opts.isAr ? 'IRR - ' : 'IRR - ') + sensConfig.priceLabel,
            data: priceScenarios.map(s => s.irr),
            type: 'line',
            borderColor: '#f87171',
            borderWidth: 2,
            pointBackgroundColor: '#f87171',
            yAxisID: 'y1'
          },
          {
            label: (opts.isAr ? 'IRR - ' : 'IRR - ') + sensConfig.volumeLabel,
            data: volumeScenarios.map(s => s.irr),
            type: 'line',
            borderColor: '#4ade80',
            borderWidth: 2,
            pointBackgroundColor: '#4ade80',
            yAxisID: 'y1'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#e8ecf4' } } },
        scales: {
          x: { ticks: { color: '#94a3b8' } },
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            title: { display: true, text: 'NPV', color: '#e8ecf4' },
            ticks: { color: '#94a3b8' }
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            title: { display: true, text: 'IRR %', color: '#e8ecf4' },
            ticks: { color: '#94a3b8' },
            grid: { drawOnChartArea: false }
          }
        }
      }
    });
  }

  function renderYearlyTables(pf, opts) {
    const incomeYears = aggregateByYear(pf.incomeStatement, ['revenue', 'cogs', 'grossProfit', 'opex', 'ebitda', 'depreciation', 'ebit', 'interestExpense', 'tax', 'netIncome']);
    const cashYears = aggregateByYear(pf.cashFlow, ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'netCashFlow']);
    const bsLastMonthByYear = {};
    pf.balanceSheet.forEach(r => {
      const year = Math.ceil(r.month / 12);
      bsLastMonthByYear[year] = r;
    });

    const t = opts.isAr ? labels.ar : labels.en;

    function renderYearlyTable(tbodyId, rowsByYear, keys) {
      const tbody = document.getElementById(tbodyId);
      if (!tbody) return;
      tbody.innerHTML = keys.map(k => {
        const cells = [1, 2, 3, 4, 5].map(y => {
          const val = rowsByYear[y] ? rowsByYear[y][k] : 0;
          return '<td style="text-align: center; padding: 0.5rem;">' + opts.formatNumber(val) + '</td>';
        }).join('');
        return '<tr style="border-bottom: 1px solid rgba(197,160,40,0.1);"><td style="padding: 0.5rem;">' + t[k] + '</td>' + cells + '</tr>';
      }).join('');
    }

    renderYearlyTable('proFormaIncomeBody', incomeYears, ['revenue', 'cogs', 'grossProfit', 'opex', 'ebitda', 'depreciation', 'ebit', 'interestExpense', 'tax', 'netIncome']);
    renderYearlyTable('proFormaCashflowBody', cashYears, ['operatingCashFlow', 'investingCashFlow', 'financingCashFlow', 'netCashFlow']);
    renderYearlyTable('proFormaBalanceBody', bsLastMonthByYear, ['cash', 'accountsReceivable', 'inventory', 'netFixedAssets', 'totalAssets', 'accountsPayable', 'totalDebt', 'totalEquity']);
  }

  function render(inputs, userOptions) {
    const opts = { ...defaultOptions, ...userOptions };
    if (!window.ProFormaEngine || !window.ProFormaEngine.buildProFormaStatements) return;

    const projectionMonths = opts.projectionMonths || inputs.analysisDuration || inputs.projectMonths || 60;
    const pf = window.ProFormaEngine.buildProFormaStatements(inputs, projectionMonths, { sector: opts.sector });

    if (opts.hideSelectors && opts.hideSelectors.length > 0) {
      opts.hideSelectors.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) el.style.display = 'none';
      });
    }

    renderSummary(pf, opts);
    renderCashCurve(pf, opts);
    renderSensitivity(inputs, pf, opts);
    renderMonteCarlo(inputs, pf, opts);
    renderYearlyTables(pf, opts);
  }

  global.ProFormaRenderer = { render, labels };
})(window);
