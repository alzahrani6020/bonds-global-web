/**
 * Project Feasibility Wizard — Bonds Global
 * 7-stage project feasibility calculator with Basic/Expert mode toggle,
 * multi-dimensional scoring, and PDF export.
 */

(function () {
  const form = {};
  let currentMode = 'basic';
  let currentStep = 1;
  let totalSteps = 7;
  let scores = {};
  let lastValidationValid = false;

  const translations = {
    ar: {
      stepLabels: ['المشروع', 'السوق', 'التشغيل', 'الاستثمار', 'التمويل', 'المخاطر', 'المراجعة'],
      next: 'التالي',
      back: 'السابق',
      finish: 'احسب النتيجة',
      restart: 'إعادة البدء',
      downloadPdf: 'تحميل تقرير PDF',
      print: 'طباعة التقرير',
      modeBasic: 'أساسي',
      modeExpert: 'احترافي',
      validationTitle: 'تحذيرات التحقق من البيانات',
      fixBeforeReport: 'يرجى تصحيح التحذيرات أعلاه قبل إصدار التقرير.',
      scores: {
        investment: 'درجة الاستثمار',
        finance: 'درجة التمويل',
        market: 'درجة السوق',
        risk: 'درجة المخاطرة',
        overall: 'الدرجة الإجمالية'
      },
      metrics: {
        roi: 'العائد على الاستثمار',
        profitMargin: 'هامش الربح',
        payback: 'فترة الاسترداد',
        breakEven: 'نقطة التعادل',
        annualNetProfit: 'صافي الربح السنوي'
      },
      verdicts: {
        excellent: 'فرصة استثمارية ممتازة',
        good: 'فرصة جيدة',
        average: 'مقبول مع تحسينات',
        poor: 'ضعيف',
        bad: 'غير موصى به'
      },
      months: 'شهر',
      sar: 'ر.س',
      calculateFirst: 'احسب النتيجة أولاً',
      fixWarningsBeforePdf: 'يرجى تصحيح تحذيرات التحقق قبل تحميل التقرير.'
    },
    en: {
      stepLabels: ['Project', 'Market', 'Operations', 'Investment', 'Financing', 'Risks', 'Review'],
      next: 'Next',
      back: 'Back',
      finish: 'Calculate Result',
      restart: 'Start Over',
      downloadPdf: 'Download PDF Report',
      print: 'Print Report',
      modeBasic: 'Basic',
      modeExpert: 'Expert',
      validationTitle: 'Data Validation Warnings',
      fixBeforeReport: 'Please fix the warnings above before generating the report.',
      scores: {
        investment: 'Investment Score',
        finance: 'Finance Score',
        market: 'Market Score',
        risk: 'Risk Score',
        overall: 'Overall Score'
      },
      metrics: {
        roi: 'Return on Investment',
        profitMargin: 'Profit Margin',
        payback: 'Payback Period',
        breakEven: 'Break-Even Revenue',
        annualNetProfit: 'Annual Net Profit'
      },
      verdicts: {
        excellent: 'Excellent Investment Opportunity',
        good: 'Good Opportunity',
        average: 'Acceptable with Improvements',
        poor: 'Weak',
        bad: 'Not Recommended'
      },
      months: 'months',
      sar: 'SAR',
      calculateFirst: 'Calculate the result first',
      fixWarningsBeforePdf: 'Please fix validation warnings before downloading the report.'
    }
  };

  const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
  const t = translations[lang];

  function get(id) {
    return parseFloat(document.getElementById(id)?.value) || 0;
  }

  function getInt(id) {
    return parseInt(document.getElementById(id)?.value, 10) || 0;
  }

  function getSelect(id) {
    return document.getElementById(id)?.value || '';
  }

  function getText(id) {
    return document.getElementById(id)?.value.trim() || '';
  }

  function formatMoney(n) {
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-US') + ' ' + t.sar;
  }

  function formatPercent(n) {
    if (!Number.isFinite(n)) return '-';
    return n.toFixed(1) + '%';
  }

  function formatMonths(n) {
    if (!Number.isFinite(n)) return '-';
    return n.toFixed(1) + ' ' + t.months;
  }

  function scoreLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 65) return 'good';
    if (score >= 50) return 'average';
    if (score >= 35) return 'poor';
    return 'bad';
  }

  function setMode(mode) {
    currentMode = mode;
    currentStep = 1;

    document.querySelectorAll('.mode-toggle__btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });

    document.querySelectorAll('[data-basic], [data-expert]').forEach(el => {
      const showBasic = mode === 'basic' && el.hasAttribute('data-basic');
      const showExpert = mode === 'expert' && el.hasAttribute('data-expert');
      el.classList.toggle('wizard-hidden', !showBasic && !showExpert);
    });

    updateStepUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateStepUI() {
    document.querySelectorAll('.wizard-step-content').forEach((el, idx) => {
      el.classList.toggle('active', idx + 1 === currentStep);
    });

    document.querySelectorAll('.wizard-step').forEach((el, idx) => {
      const step = idx + 1;
      el.classList.toggle('active', step === currentStep);
      el.classList.toggle('completed', step < currentStep);
    });

    const progress = totalSteps <= 1 ? 0 : ((currentStep - 1) / (totalSteps - 1)) * 100;
    const bar = document.querySelector('.wizard-progress__bar');
    if (bar) bar.style.width = progress + '%';

    const backBtn = document.getElementById('wizardBack');
    const nextBtn = document.getElementById('wizardNext');
    if (backBtn) backBtn.classList.toggle('wizard-hidden', currentStep === 1);
    if (nextBtn) {
      nextBtn.textContent = currentStep === totalSteps ? t.restart : (currentStep === totalSteps - 1 ? t.finish : t.next);
    }
  }

  function validateStep(step) {
    const section = document.getElementById('step' + step);
    if (!section) return true;
    const visibleRequired = Array.from(section.querySelectorAll('[data-required="true"]')).filter(el => {
      if (el.closest('[data-expert]') && currentMode === 'basic') return false;
      if (el.closest('[data-basic]') && currentMode === 'expert') return false;
      return el.offsetParent !== null;
    });
    let valid = true;
    visibleRequired.forEach(input => {
      if (!input.value.trim()) {
        input.style.borderColor = '#ef4444';
        valid = false;
      } else {
        input.style.borderColor = '';
      }
    });
    return valid;
  }

  function collectFormData() {
    form.projectName = document.getElementById('projectName')?.value || (lang === 'ar' ? 'مشروع جديد' : 'New Project');
    form.sector = getSelect('projectSector');
    form.location = document.getElementById('projectLocation')?.value || '';
    form.duration = getInt('projectDuration');

    form.projectOwner = getText('projectOwner');
    form.legalStructure = getSelect('legalStructure');
    form.startMonth = getInt('startMonth');
    form.projectPhase = getSelect('projectPhase');
    form.projectDurationYears = getInt('projectDurationYears');
    form.regulatoryApprovalsNeeded = getInt('regulatoryApprovalsNeeded');
    form.projectManagerExperience = getInt('projectManagerExperience');
    form.environmentalImpact = getInt('environmentalImpact');

    form.marketSize = get('marketSize');
    form.competitionLevel = getInt('competitionLevel');
    form.marketGrowthRate = get('marketGrowthRate');
    form.tam = get('tam');
    form.sam = get('sam');
    form.som = get('som');
    form.competitorCount = getInt('competitorCount');
    form.avgCompetitorPrice = get('avgCompetitorPrice');
    form.marketEntryBarrier = getInt('marketEntryBarrier');
    form.customerAcquisitionCost = get('customerAcquisitionCost');
    form.customerLifetimeValue = get('customerLifetimeValue');
    form.digitalAdBudget = get('digitalAdBudget');
    form.brandAwareness = get('brandAwareness');
    form.seasonalFactor = get('seasonalFactor');
    form.churnRate = get('churnRate');
    form.repeatPurchaseRate = get('repeatPurchaseRate');
    form.onlineVsOfflineRatio = get('onlineVsOfflineRatio');

    form.operatingExpenseRate = get('operatingExpenseRate');
    form.operatingDaysPerMonth = get('operatingDaysPerMonth');
    form.operatingHoursPerDay = get('operatingHoursPerDay');
    form.shiftCount = getInt('shiftCount');
    form.capacityUtilizationTarget = get('capacityUtilizationTarget');
    form.employeeProductivityIndex = getInt('employeeProductivityIndex');
    form.maintenanceCostRate = get('maintenanceCostRate');
    form.insuranceCostAnnual = get('insuranceCostAnnual');
    form.licenseRenewalCost = get('licenseRenewalCost');
    form.softwareSubscriptions = get('softwareSubscriptions');
    form.marketingBudget = get('marketingBudget');
    form.salesCommissionRate = get('salesCommissionRate');
    form.energyCostMonthly = get('energyCostMonthly');
    form.waterCostMonthly = get('waterCostMonthly');
    form.wasteDisposalCost = get('wasteDisposalCost');
    form.securityCost = get('securityCost');
    form.cleaningCost = get('cleaningCost');
    form.outsourcingCost = get('outsourcingCost');
    form.trainingCost = get('trainingCost');

    form.totalInvestment = get('totalInvestment');
    form.setupCost = get('setupCost');
    form.landCost = get('landCost');
    form.buildingCost = get('buildingCost');
    form.renovationCost = get('renovationCost');
    form.machineryCost = get('machineryCost');
    form.furnitureCost = get('furnitureCost');
    form.vehiclesCost = get('vehiclesCost');
    form.workingCapital = get('workingCapital');
    form.contingencyReserve = get('contingencyReserve');
    form.salvageValue = get('salvageValue');
    form.assetLifeYears = getInt('assetLifeYears');
    form.preOpeningCost = get('preOpeningCost');
    form.initialInventoryCost = get('initialInventoryCost');
    form.permitsAndLicensesCost = get('permitsAndLicensesCost');
    form.feasibilityStudyCost = get('feasibilityStudyCost');

    form.availableCapital = get('availableCapital');
    form.monthlyRevenue = get('monthlyRevenue');
    form.revenueGrowthRate = get('revenueGrowthRate');
    form.equityAmount = get('equityAmount');
    form.loanAmount = get('loanAmount');
    form.interestRate = get('interestRate');
    form.loanTermYears = getInt('loanTermYears');
    form.gracePeriodMonths = getInt('gracePeriodMonths');
    form.requiredRoi = get('requiredRoi');
    form.minDscr = get('minDscr');
    form.balloonPayment = get('balloonPayment');
    form.earlyRepaymentPenalty = get('earlyRepaymentPenalty');
    form.collateralValue = get('collateralValue');
    form.debtServiceStartMonth = getInt('debtServiceStartMonth');

    form.marketRisk = getInt('marketRisk');
    form.operationalRisk = getInt('operationalRisk');
    form.financialRisk = getInt('financialRisk');
    form.regulatoryRisk = getInt('regulatoryRisk');
    form.technologyRiskScore = getInt('technologyRiskScore');
    form.reputationRiskScore = getInt('reputationRiskScore');
    form.mitigationBudget = get('mitigationBudget');
    form.supplyChainRiskScore = getInt('supplyChainRiskScore');
    form.competitionRiskScore = getInt('competitionRiskScore');
    form.currencyRiskScore = getInt('currencyRiskScore');
    form.geopoliticalRiskScore = getInt('geopoliticalRiskScore');

    form.keyAssumptions = getText('keyAssumptions');
    form.sensitivityCase = getSelect('sensitivityCase');
    form.successFactors = getText('successFactors');
    form.exitStrategy = getSelect('exitStrategy');
  }

  function validateWizard() {
    const warnings = [];

    if (form.totalInvestment <= 0) warnings.push(lang === 'en' ? 'Total investment must be greater than zero.' : 'إجمالي الاستثمار يجب أن يكون أكبر من صفر.');
    if (form.monthlyRevenue <= 0) warnings.push(lang === 'en' ? 'Expected monthly revenue must be greater than zero.' : 'الإيرادات الشهرية المتوقعة يجب أن تكون أكبر من صفر.');
    if (form.monthlyFixedCosts < 0 || form.monthlyVariableCosts < 0 || form.availableCapital < 0) warnings.push(lang === 'en' ? 'Values cannot be negative.' : 'لا يمكن أن تكون القيم سالبة.');
    if (form.revenueGrowthRate > 100) warnings.push(lang === 'en' ? 'Annual revenue growth rate seems too high.' : 'معدل نمو الإيرادات السنوي مرتفع بشكل غير طبيعي.');
    if (form.marketGrowthRate > 100) warnings.push(lang === 'en' ? 'Annual market growth rate seems too high.' : 'معدل نمو السوق السنوي مرتفع بشكل غير طبيعي.');
    if (form.operatingExpenseRate > 100) warnings.push(lang === 'en' ? 'Operating expense ratio cannot exceed 100%.' : 'نسبة المصروفات التشغيلية لا يمكن أن تتجاوز 100%.');
    if (form.competitionLevel < 1 || form.competitionLevel > 5) warnings.push(lang === 'en' ? 'Competition level must be between 1 and 5.' : 'مستوى المنافسة يجب أن يكون بين 1 و 5.');

    const basicRisks = [form.marketRisk, form.operationalRisk, form.financialRisk, form.regulatoryRisk];
    if (basicRisks.some(r => r < 1 || r > 5)) {
      warnings.push(lang === 'en' ? 'Risk ratings must be between 1 and 5.' : 'درجات المخاطر يجب أن تكون بين 1 و 5.');
    }

    if (currentMode === 'expert') {
      if (form.marketEntryBarrier < 1 || form.marketEntryBarrier > 5) warnings.push(lang === 'en' ? 'Market entry barrier must be between 1 and 5.' : 'حاجز دخول السوق يجب أن يكون بين 1 و 5.');
      if (form.employeeProductivityIndex < 1 || form.employeeProductivityIndex > 5) warnings.push(lang === 'en' ? 'Employee productivity index must be between 1 and 5.' : 'مؤشر إنتاجية الموظف يجب أن يكون بين 1 و 5.');
      const expertRisks = [form.technologyRiskScore, form.reputationRiskScore, form.supplyChainRiskScore, form.competitionRiskScore, form.currencyRiskScore, form.geopoliticalRiskScore];
      if (expertRisks.some(r => r < 1 || r > 5)) warnings.push(lang === 'en' ? 'All risk scores must be between 1 and 5.' : 'جميع درجات المخاطر يجب أن تكون بين 1 و 5.');
      if (form.capacityUtilizationTarget > 100) warnings.push(lang === 'en' ? 'Capacity utilization target cannot exceed 100%.' : 'مستهدف استغلال الطاقة لا يمكن أن يتجاوز 100%.');
      if (form.brandAwareness > 100) warnings.push(lang === 'en' ? 'Brand awareness cannot exceed 100%.' : 'مستوى الوعي بالعلامة التجارية لا يمكن أن يتجاوز 100%.');
      if (form.environmentalImpact < 1 || form.environmentalImpact > 5) warnings.push(lang === 'en' ? 'Environmental impact must be between 1 and 5.' : 'التأثير البيئي يجب أن يكون بين 1 و 5.');
    }

    const monthlyNetProfit = form.monthlyRevenue - form.monthlyFixedCosts - form.monthlyVariableCosts;
    if (monthlyNetProfit < 0) warnings.push(lang === 'en' ? 'Monthly revenue is lower than total costs, indicating a monthly loss.' : 'الإيرادات الشهرية أقل من إجمالي التكاليف، مما يعني خسارة شهرية.');

    const roi = form.totalInvestment > 0 ? ((monthlyNetProfit * 12) / form.totalInvestment) * 100 : 0;
    if (roi > 1000) warnings.push(lang === 'en' ? 'Return on investment is unrealistic (over 1000%).' : 'العائد على الاستثمار غير واقعي (أكثر من 1000%).');

    const container = document.getElementById('wizardValidationWarnings');
    if (container) {
      if (warnings.length === 0) {
        container.classList.add('wizard-hidden');
        container.innerHTML = '';
      } else {
        container.classList.remove('wizard-hidden');
        container.innerHTML = '<div class="validation-warnings__title">⚠️ ' + t.validationTitle + '</div><ul>' + warnings.map(w => '<li>' + w + '</li>').join('') + '</ul><div class="validation-warnings__footer">' + t.fixBeforeReport + '</div>';
      }
    }

    lastValidationValid = warnings.length === 0;
    return warnings.length === 0;
  }

  function calculateScores() {
    let totalInvestment = form.totalInvestment;
    let monthlyFixed = form.monthlyFixedCosts;
    let monthlyVariable = form.monthlyVariableCosts;

    if (currentMode === 'expert') {
      const expertInvestment = form.landCost + form.buildingCost + form.renovationCost + form.machineryCost + form.furnitureCost + form.vehiclesCost + form.workingCapital + form.contingencyReserve + form.preOpeningCost + form.initialInventoryCost + form.permitsAndLicensesCost + form.feasibilityStudyCost;
      if (expertInvestment > 0) totalInvestment = expertInvestment;

      monthlyFixed += (form.insuranceCostAnnual / 12) + (form.licenseRenewalCost / 12) + form.softwareSubscriptions + form.marketingBudget + form.digitalAdBudget + form.mitigationBudget + form.energyCostMonthly + form.waterCostMonthly + form.wasteDisposalCost + form.securityCost + form.cleaningCost + form.outsourcingCost + form.trainingCost;
      monthlyVariable += form.monthlyRevenue * (form.maintenanceCostRate / 100) + form.monthlyRevenue * (form.salesCommissionRate / 100);
    }

    const monthlyNetProfit = form.monthlyRevenue - monthlyFixed - monthlyVariable;
    const annualNetProfit = monthlyNetProfit * 12;
    const roi = totalInvestment > 0 ? (annualNetProfit / totalInvestment) * 100 : 0;
    const profitMargin = form.monthlyRevenue > 0 ? (monthlyNetProfit / form.monthlyRevenue) * 100 : 0;
    const contribution = form.monthlyRevenue - monthlyVariable;
    const breakEvenRevenue = contribution > 0 ? (monthlyFixed / contribution) * form.monthlyRevenue : Infinity;
    const paybackMonths = monthlyNetProfit > 0 ? totalInvestment / monthlyNetProfit : Infinity;
    const selfFinanceRatio = totalInvestment > 0 ? (form.availableCapital / totalInvestment) * 100 : 0;
    const annualRevenue = form.monthlyRevenue * 12;
    const marketShare = form.marketSize > 0 ? (annualRevenue / form.marketSize) * 100 : 0;

    // Investment Score
    let roiScore;
    if (roi >= 50) roiScore = 100;
    else if (roi >= 35) roiScore = 85;
    else if (roi >= 25) roiScore = 70;
    else if (roi >= 15) roiScore = 55;
    else if (roi >= 5) roiScore = 40;
    else if (roi >= 0) roiScore = 25;
    else roiScore = 10;

    let paybackScore;
    if (paybackMonths <= 12) paybackScore = 100;
    else if (paybackMonths <= 24) paybackScore = 80;
    else if (paybackMonths <= 36) paybackScore = 60;
    else if (paybackMonths <= 48) paybackScore = 40;
    else paybackScore = 20;

    let selfFinanceScore;
    if (selfFinanceRatio >= 80) selfFinanceScore = 100;
    else if (selfFinanceRatio >= 60) selfFinanceScore = 80;
    else if (selfFinanceRatio >= 40) selfFinanceScore = 60;
    else if (selfFinanceRatio >= 20) selfFinanceScore = 40;
    else selfFinanceScore = 20;

    const investmentScore = roiScore * 0.4 + paybackScore * 0.35 + selfFinanceScore * 0.25;

    // Finance Score
    let marginScore;
    if (profitMargin >= 40) marginScore = 100;
    else if (profitMargin >= 30) marginScore = 85;
    else if (profitMargin >= 20) marginScore = 70;
    else if (profitMargin >= 10) marginScore = 55;
    else if (profitMargin >= 5) marginScore = 40;
    else if (profitMargin >= 0) marginScore = 25;
    else marginScore = 10;

    let breakEvenScore;
    if (!Number.isFinite(breakEvenRevenue)) breakEvenScore = 20;
    else {
      const ratio = breakEvenRevenue / form.monthlyRevenue;
      if (ratio <= 1.5) breakEvenScore = 100;
      else if (ratio <= 2) breakEvenScore = 80;
      else if (ratio <= 3) breakEvenScore = 60;
      else if (ratio <= 4) breakEvenScore = 40;
      else breakEvenScore = 20;
    }

    const cashFlowScore = monthlyNetProfit > 0 ? 100 : 0;
    const financeScore = marginScore * 0.4 + breakEvenScore * 0.3 + cashFlowScore * 0.3;

    // Market Score
    let mGrowthScore;
    if (form.marketGrowthRate >= 20) mGrowthScore = 100;
    else if (form.marketGrowthRate >= 15) mGrowthScore = 85;
    else if (form.marketGrowthRate >= 10) mGrowthScore = 70;
    else if (form.marketGrowthRate >= 5) mGrowthScore = 55;
    else if (form.marketGrowthRate >= 0) mGrowthScore = 40;
    else mGrowthScore = 20;

    let shareScore;
    if (marketShare < 1) shareScore = 40;
    else if (marketShare < 5) shareScore = 70;
    else if (marketShare <= 15) shareScore = 100;
    else if (marketShare <= 30) shareScore = 80;
    else shareScore = 60;

    const competitionMap = { 1: 100, 2: 85, 3: 70, 4: 50, 5: 30 };
    const competitionScore = competitionMap[form.competitionLevel] || 50;

    let revGrowthScore;
    if (form.revenueGrowthRate >= 15) revGrowthScore = 100;
    else if (form.revenueGrowthRate >= 10) revGrowthScore = 85;
    else if (form.revenueGrowthRate >= 5) revGrowthScore = 70;
    else if (form.revenueGrowthRate >= 0) revGrowthScore = 50;
    else revGrowthScore = 30;

    let marketScore = (mGrowthScore + shareScore + competitionScore + revGrowthScore) / 4;

    if (currentMode === 'expert') {
      const clvCacScore = form.customerAcquisitionCost > 0 && form.customerLifetimeValue > 0
        ? Math.min(100, (form.customerLifetimeValue / form.customerAcquisitionCost) * 20)
        : 50;
      const barrierScore = Math.max(0, 100 - (form.marketEntryBarrier - 1) * 25);
      const awarenessScore = form.brandAwareness;
      marketScore = marketScore * 0.6 + (clvCacScore + barrierScore + awarenessScore) / 3 * 0.4;
    }

    // Risk Score
    const avgRisk = (form.marketRisk + form.operationalRisk + form.financialRisk + form.regulatoryRisk) / 4;
    let riskScore = Math.max(0, 100 - ((avgRisk - 1) / 4) * 100);

    if (currentMode === 'expert') {
      const allRisks = [form.marketRisk, form.operationalRisk, form.financialRisk, form.regulatoryRisk, form.technologyRiskScore, form.reputationRiskScore, form.supplyChainRiskScore, form.competitionRiskScore, form.currencyRiskScore, form.geopoliticalRiskScore];
      const avgAllRisk = allRisks.reduce((a, b) => a + b, 0) / allRisks.length;
      riskScore = Math.max(0, 100 - ((avgAllRisk - 1) / 4) * 100);
      if (form.mitigationBudget > 0) riskScore += 5;
      if (form.regulatoryApprovalsNeeded > 5) riskScore -= 3;
      if (form.environmentalImpact >= 4) riskScore -= 5;
      riskScore = Math.min(100, Math.max(0, riskScore));
    }

    // Overall Score
    const overallScore = investmentScore * 0.25 + financeScore * 0.25 + marketScore * 0.25 + riskScore * 0.25;

    scores = {
      investment: Math.round(investmentScore),
      finance: Math.round(financeScore),
      market: Math.round(marketScore),
      risk: Math.round(riskScore),
      overall: Math.round(overallScore),
      metrics: {
        roi,
        profitMargin,
        paybackMonths,
        breakEvenRevenue,
        annualNetProfit
      }
    };
  }

  function renderScores() {
    const ids = [
      { key: 'investment', label: t.scores.investment },
      { key: 'finance', label: t.scores.finance },
      { key: 'market', label: t.scores.market },
      { key: 'risk', label: t.scores.risk }
    ];

    ids.forEach(item => {
      const score = scores[item.key];
      const level = scoreLevel(score);
      const valueEl = document.getElementById('score' + item.key.charAt(0).toUpperCase() + item.key.slice(1));
      const fillEl = document.getElementById('fill' + item.key.charAt(0).toUpperCase() + item.key.slice(1));
      const labelEl = document.getElementById('label' + item.key.charAt(0).toUpperCase() + item.key.slice(1));
      if (valueEl) {
        valueEl.textContent = score;
        valueEl.className = 'score-card__value score-' + level;
      }
      if (fillEl) {
        fillEl.style.width = score + '%';
        fillEl.className = 'score-card__fill fill-' + level;
      }
      if (labelEl) labelEl.textContent = item.label;
    });

    const overall = scores.overall;
    const overallLevel = scoreLevel(overall);
    const overallValue = document.getElementById('overallValue');
    const overallVerdict = document.getElementById('overallVerdict');
    if (overallValue) {
      overallValue.textContent = overall;
      overallValue.className = 'overall-score__value score-' + overallLevel;
    }
    if (overallVerdict) {
      overallVerdict.textContent = t.verdicts[overallLevel];
      overallVerdict.className = 'overall-score__verdict verdict-' + overallLevel;
    }

    const m = scores.metrics;
    document.getElementById('metricRoi').textContent = formatPercent(m.roi);
    document.getElementById('metricMargin').textContent = formatPercent(m.profitMargin);
    document.getElementById('metricPayback').textContent = formatMonths(m.paybackMonths);
    document.getElementById('metricBreakEven').textContent = formatMoney(m.breakEvenRevenue);
    document.getElementById('metricAnnualProfit').textContent = formatMoney(m.annualNetProfit);

    renderRecommendations(overallLevel);
  }

  function buildSyntheticEngineResult() {
    const totalInvestment = form.totalInvestment;
    const monthlyNetProfit = form.monthlyRevenue - form.monthlyFixedCosts - form.monthlyVariableCosts;
    const projectMonths = (form.projectDurationYears || 5) * 12;
    const roi = totalInvestment > 0 ? ((monthlyNetProfit * projectMonths) / totalInvestment) * 100 : 0;
    const paybackMonths = monthlyNetProfit > 0 ? totalInvestment / monthlyNetProfit : Infinity;
    const contribution = form.monthlyRevenue - form.monthlyVariableCosts;
    const breakEvenRevenue = contribution > 0 ? (form.monthlyFixedCosts / contribution) * form.monthlyRevenue : 0;
    const level = scoreLevel(scores.overall);
    const decisionKeyMap = {
      excellent: 'recommended',
      good: 'conditional',
      average: 'reconsider',
      poor: 'high_risk',
      bad: 'not_recommended'
    };

    return {
      success: true,
      metrics: {
        totalInvestment,
        monthlyNetCashFlow: monthlyNetProfit,
        projectMonths,
        roi,
        irr: roi / 100 * 0.8,
        npv: monthlyNetProfit * projectMonths - totalInvestment,
        paybackMonths,
        profitMargin: form.monthlyRevenue > 0 ? (monthlyNetProfit / form.monthlyRevenue) * 100 : 0,
        breakEvenRevenue,
        breakEvenUnits: 0,
        riskScore: scores.risk
      },
      recommendation: {
        decision: t.verdicts[level],
        decisionKey: decisionKeyMap[level] || 'conditional',
        color: scores.overall >= 65 ? '#22c55e' : scores.overall >= 50 ? '#3b82f6' : scores.overall >= 35 ? '#f59e0b' : '#ef4444',
        reasons: []
      }
    };
  }

  function mapWizardInputsToDecisionIntelligence() {
    const diInputs = { ...form };
    diInputs.marketRiskScore = form.marketRisk;
    diInputs.operationalRiskScore = form.operationalRisk;
    diInputs.financialRiskScore = form.financialRisk;
    diInputs.regulatoryRiskScore = form.regulatoryRisk;
    diInputs.technologyRiskScore = form.technologyRiskScore;
    diInputs.reputationRiskScore = form.reputationRiskScore;
    diInputs.supplyChainRiskScore = form.supplyChainRiskScore;
    diInputs.competitionRiskScore = form.competitionRiskScore;
    diInputs.currencyRiskScore = form.currencyRiskScore;
    diInputs.geopoliticalRiskScore = form.geopoliticalRiskScore;
    diInputs.projectDurationYears = diInputs.projectDurationYears || Math.max(1, Math.round((form.duration || 60) / 12));
    return diInputs;
  }

  function renderDecisionIntelligence() {
    if (!window.DecisionIntelligence || !window.DecisionIntelligence.analyze) return;
    const diInputs = mapWizardInputsToDecisionIntelligence();
    const engineResult = buildSyntheticEngineResult();
    const di = window.DecisionIntelligence.analyze(diInputs, engineResult, lang);
    window._lastWizardDecisionResult = di;

    document.getElementById('decisionIntelligencePanel').classList.remove('wizard-hidden');
    document.getElementById('execReportBtn').classList.remove('wizard-hidden');

    const conf = di.confidenceScore;
    document.getElementById('diConfidenceFill').style.width = conf.score + '%';
    document.getElementById('diConfidenceValue').textContent = conf.score + '/100';

    window.DecisionIntelligence.renderDecisionPanel('diVerdict', di.recommendation);
    window.DecisionIntelligence.renderSummary('diSummary', di.dataQuality, di.riskAnalysis, di.financingAnalysis, di.marketAnalysis, di.cashFlowAnalysis);
    window.DecisionIntelligence.renderGauge('diRiskGauge', di.riskAnalysis.score, lang === 'en' ? 'Risk Score' : 'درجة المخاطر', window.DecisionIntelligence.i18n[lang] || {});
    window.DecisionIntelligence.renderGauge('diMarketGauge', di.marketAnalysis.score, lang === 'en' ? 'Market Score' : 'درجة السوق', window.DecisionIntelligence.i18n[lang] || {});
    window.DecisionIntelligence.renderGauge('diCashFlowGauge', di.cashFlowAnalysis.score, lang === 'en' ? 'Cash Flow Score' : 'درجة التدفق النقدي', window.DecisionIntelligence.i18n[lang] || {});
    window.DecisionIntelligence.renderList('diRiskList', di.riskAnalysis.categories || [], 'risk');
    window.DecisionIntelligence.renderList('diKeyRisks', di.keyRisks, 'risk');
    window.DecisionIntelligence.renderList('diKeyOpportunities', di.keyOpportunities, 'opportunity');

    const finSummary = document.getElementById('diFinancingSummary');
    if (finSummary) {
      const i = window.DecisionIntelligence.i18n[lang];
      finSummary.innerHTML = `
        <div class="di-metric"><span class="di-metric__label">${i.debtEquityRatio}</span><span class="di-metric__value">${di.financingAnalysis.debtEquityRatio.toFixed(2)}</span></div>
        <div class="di-metric"><span class="di-metric__label">${i.collateralCoverage}</span><span class="di-metric__value">${di.financingAnalysis.collateralCoverage.toFixed(2)}</span></div>
        <div class="di-metric"><span class="di-metric__label">${i.dscrEstimate}</span><span class="di-metric__value">${di.financingAnalysis.dscr.toFixed(2)}</span></div>
        <div class="di-metric"><span class="di-metric__label">${i.selfFinanceRatio}</span><span class="di-metric__value">${di.financingAnalysis.selfFinanceRatio.toFixed(1)}%</span></div>
        <p class="di-summary-text">${di.financingAnalysis.summary}</p>
      `;
    }

    const marketSummary = document.getElementById('diMarketSummary');
    if (marketSummary) {
      marketSummary.innerHTML = `
        <p class="di-summary-text">${di.marketAnalysis.summary}</p>
        <div class="di-metric"><span class="di-metric__label">${lang === 'en' ? 'Market Share' : 'حصة السوق'}</span><span class="di-metric__value">${di.marketAnalysis.marketShare.toFixed(2)}%</span></div>
      `;
    }

    const cfSummary = document.getElementById('diCashFlowSummary');
    if (cfSummary) {
      const i = window.DecisionIntelligence.i18n[lang];
      const liquidityLabel = i[di.cashFlowAnalysis.liquidity] || di.cashFlowAnalysis.liquidity;
      cfSummary.innerHTML = `
        <p class="di-summary-text">${di.cashFlowAnalysis.summary}</p>
        <div class="di-metric"><span class="di-metric__label">${lang === 'en' ? 'Liquidity' : 'السيولة'}</span><span class="di-metric__value">${liquidityLabel}</span></div>
      `;
    }
  }

  function printExecutiveReport() {
    if (!window._lastWizardDecisionResult) {
      alert(t.calculateFirst);
      return;
    }
    const html = window._lastWizardDecisionResult.executiveReport;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert(lang === 'en' ? 'Popup blocked' : 'تم حظر النافذة المنبثقة');
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = function() {
      setTimeout(function() { printWindow.print(); }, 600);
    };
  }

  function renderRecommendations(level) {
    const list = document.getElementById('recommendationList');
    if (!list) return;
    list.innerHTML = '';

    const reasons = [];
    if (scores.investment < 50) reasons.push(lang === 'ar' ? 'زيادة رأس المال المتاح أو تقليل حجم الاستثمار الأولي لتحسين جاذبية المشروع.' : 'Increase available capital or reduce initial investment to improve project attractiveness.');
    if (scores.finance < 50) reasons.push(lang === 'ar' ? 'مراجعة التكاليف الثابتة والمتغيرة لرفع هامش الربح وتحسين التدفق النقدي.' : 'Review fixed and variable costs to raise profit margin and improve cash flow.');
    if (scores.market < 50) reasons.push(lang === 'ar' ? 'دراسة السوق بعمق والتركيز على نقاط التمايز لتقليل المنافسة.' : 'Deepen market research and focus on differentiation to reduce competition.');
    if (scores.risk < 50) reasons.push(lang === 'ar' ? 'وضع خطط للتخفيف من المخاطر التشغيلية والمالية والتنظيمية.' : 'Develop mitigation plans for operational, financial, and regulatory risks.');

    if (level === 'excellent' || level === 'good') {
      reasons.unshift(lang === 'ar' ? 'المشروع يمتلك مؤشرات قوية؛ يُنصح بالمضي قدماً مع خطة تنفيذية واضحة.' : 'The project shows strong indicators; proceed with a clear implementation plan.');
    } else if (level === 'average') {
      reasons.unshift(lang === 'ar' ? 'المشروع قابل للتنفيذ بعد إجراء تحسينات على الجوانب الضعيفة.' : 'The project is feasible after addressing weak areas.');
    } else {
      reasons.unshift(lang === 'ar' ? 'المشروع يحمل مخاطر عالية؛ يُفضل إعادة النظر في النموذج التجاري قبل الاستثمار.' : 'The project carries high risk; reconsider the business model before investing.');
    }

    reasons.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
  }

  function prepareEngineInputs() {
    let monthlyFixed = 0;
    let monthlyVariable = 0;

    if (currentMode === 'basic') {
      monthlyFixed = form.monthlyRevenue * (form.operatingExpenseRate / 100) * 0.6;
      monthlyVariable = form.monthlyRevenue * (form.operatingExpenseRate / 100) * 0.4;
    } else {
      monthlyFixed = (form.insuranceCostAnnual / 12) + (form.licenseRenewalCost / 12) + form.softwareSubscriptions + form.marketingBudget + form.digitalAdBudget + form.mitigationBudget;
      monthlyVariable = form.monthlyRevenue * (form.maintenanceCostRate / 100) + form.monthlyRevenue * (form.salesCommissionRate / 100);
    }

    form.monthlyFixedCosts = monthlyFixed;
    form.monthlyVariableCosts = monthlyVariable;
  }

  function nextStep() {
    if (currentStep < totalSteps) {
      if (!validateStep(currentStep)) return;
      currentStep++;
      if (currentStep === totalSteps) {
        collectFormData();
        prepareEngineInputs();
        if (!validateWizard()) {
          document.getElementById('step7').querySelector('.overall-score').classList.add('wizard-hidden');
          document.querySelector('.scores-grid').classList.add('wizard-hidden');
          document.querySelector('.metrics-summary').classList.add('wizard-hidden');
          document.querySelector('.recommendations').classList.add('wizard-hidden');
          document.getElementById('pdfBtn').classList.add('wizard-hidden');
          document.getElementById('decisionIntelligencePanel').classList.add('wizard-hidden');
          document.getElementById('execReportBtn').classList.add('wizard-hidden');
          updateStepUI();
          return;
        }
        document.getElementById('step7').querySelector('.overall-score').classList.remove('wizard-hidden');
        document.querySelector('.scores-grid').classList.remove('wizard-hidden');
        document.querySelector('.metrics-summary').classList.remove('wizard-hidden');
        document.querySelector('.recommendations').classList.remove('wizard-hidden');
        document.getElementById('pdfBtn').classList.remove('wizard-hidden');
        calculateScores();
        renderScores();
        renderDecisionIntelligence();
      }
      updateStepUI();
    } else {
      restartWizard();
    }
  }

  function prevStep() {
    if (currentStep > 1) {
      currentStep--;
      updateStepUI();
    }
  }

  function restartWizard() {
    currentStep = 1;
    document.getElementById('wizardForm')?.reset();
    document.getElementById('wizardValidationWarnings')?.classList.add('wizard-hidden');
    document.getElementById('decisionIntelligencePanel')?.classList.add('wizard-hidden');
    document.getElementById('execReportBtn')?.classList.add('wizard-hidden');
    lastValidationValid = false;
    updateStepUI();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function downloadPdf() {
    if (!lastValidationValid) {
      alert(t.fixWarningsBeforePdf);
      return;
    }
    const resultsSection = document.getElementById('step7');
    if (!resultsSection || typeof html2canvas === 'undefined' || typeof jspdf === 'undefined') {
      window.print();
      return;
    }

    const btn = document.getElementById('pdfBtn');
    if (btn) btn.textContent = lang === 'ar' ? 'جاري التحميل...' : 'Generating...';

    try {
      const canvas = await html2canvas(resultsSection, { scale: 2, backgroundColor: '#0a0f1a' });
      const imgData = canvas.toDataURL('image/png');
      const { jsPDF } = jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save('bonds-project-feasibility-report.pdf');
    } catch (e) {
      window.print();
    } finally {
      if (btn) btn.textContent = t.downloadPdf;
    }
  }

  function init() {
    const nextBtn = document.getElementById('wizardNext');
    const backBtn = document.getElementById('wizardBack');
    const pdfBtn = document.getElementById('pdfBtn');

    if (nextBtn) nextBtn.addEventListener('click', nextStep);
    if (backBtn) backBtn.addEventListener('click', prevStep);
    if (pdfBtn) pdfBtn.addEventListener('click', downloadPdf);
    const execBtn = document.getElementById('execReportBtn');
    if (execBtn) execBtn.addEventListener('click', printExecutiveReport);

    document.querySelectorAll('.wizard-input-group input, .wizard-input-group select, .wizard-input-group textarea').forEach(input => {
      input.addEventListener('focus', () => input.style.borderColor = '');
    });

    setMode('basic');
    updateStepUI();
  }

  window.WizardApp = { setMode };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
