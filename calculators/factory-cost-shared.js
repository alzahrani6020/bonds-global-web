/**
 * Shared factory cost data and helpers for country-specific factory-cost pages.
 * Loads ARAB_COUNTRIES_GEO (via BondsGeo if available) and provides city rate defaults.
 */
(function() {
  'use strict';

  // Fallback base rent rates (currency per m2 per year) by country code.
  // These are rough defaults used when a country-specific page does not override them.
  const DEFAULT_COUNTRY_BASE_RENT = {
    SA: 180,
    AE: 320,
    KW: 90,
    QA: 280,
    BH: 95,
    OM: 85,
    EG: 45,
    JO: 55,
    IQ: 35,
    LB: 60,
    SY: 25,
    PS: 50,
    TN: 35,
    DZ: 30,
    MA: 40,
    LY: 30,
    SD: 20,
    YE: 15,
    DJ: 25,
    SO: 15,
    MR: 20,
    KM: 18
  };

  function getData() {
    if (window.BondsGeo && window.BondsGeo.getData) return window.BondsGeo.getData();
    return (typeof window !== 'undefined' && window.ARAB_COUNTRIES_GEO) ? window.ARAB_COUNTRIES_GEO : {};
  }

  function ensureData() {
    if (window.BondsGeo && window.BondsGeo.ensureMasterData) {
      return window.BondsGeo.ensureMasterData();
    }
    return Promise.resolve(getData());
  }

  function getCountryCities(countryCode, rateOverrides) {
    const data = getData();
    const country = data[countryCode];
    if (!country || !country.governorates) return null;
    const baseRent = DEFAULT_COUNTRY_BASE_RENT[countryCode] || 30;
    const cities = {};
    country.governorates.forEach((gov, govIdx) => {
      gov.cities.forEach((city, cityIdx) => {
        const variation = 1 + ((govIdx + cityIdx) % 5) * 0.05;
        const override = rateOverrides && rateOverrides[city.code];
        cities[city.code] = {
          name: city.name,
          nameEn: city.nameEn,
          rent: override !== undefined ? override : Math.round(baseRent * variation)
        };
      });
    });
    return cities;
  }

  function populateCitySelect(countryCode, selectId, selected, rateOverrides) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const isEn = document.documentElement.lang && document.documentElement.lang.startsWith('en');
    select.innerHTML = `<option value="">${isEn ? 'Select city' : 'اختر المدينة'}</option>`;
    const cities = getCountryCities(countryCode, rateOverrides);
    if (!cities) return;
    Object.keys(cities).forEach(code => {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = isEn && cities[code].nameEn ? cities[code].nameEn : cities[code].name;
      select.appendChild(opt);
    });
    if (selected) select.value = selected;
  }

  window.FactoryCostShared = {
    getCountryCities,
    populateCitySelect,
    DEFAULT_COUNTRY_BASE_RENT,
    ensureData
  };
})();

/**
 * Factory Cost Calculator Engine
 * Shared calculation logic for all factory-cost country pages.
 */
(function() {
  'use strict';

  const TYPE_MULTIPLIERS = {
    land: 1,
    hangar: 1.3,
    ready: 1.8,
    build: 2.5
  };

  const INDUSTRY_PROFILES = {
    food: { rawMatPct: 35, elecMult: 1.0, nameAr: 'غذائية', nameEn: 'Food & Beverage' },
    plastic: { rawMatPct: 50, elecMult: 1.4, nameAr: 'بلاستيك', nameEn: 'Plastic & Petrochemicals' },
    metal: { rawMatPct: 42, elecMult: 1.6, nameAr: 'معدنية', nameEn: 'Metal & Steel' },
    electronics: { rawMatPct: 32, elecMult: 0.8, nameAr: 'إلكترونيات', nameEn: 'Electronics & Technology' },
    textile: { rawMatPct: 36, elecMult: 1.0, nameAr: 'نسيج', nameEn: 'Textile & Clothing' },
    furniture: { rawMatPct: 30, elecMult: 0.7, nameAr: 'أثاث', nameEn: 'Furniture & Wood' },
    pharma: { rawMatPct: 28, elecMult: 0.9, nameAr: 'أدوية', nameEn: 'Pharmaceuticals' },
    building: { rawMatPct: 38, elecMult: 1.3, nameAr: 'مواد بناء', nameEn: 'Building Materials' }
  };

  const LABELS = {
    ar: {
      rent: 'إيجار',
      electricity: 'كهرباء',
      water: 'ماء',
      localSalaries: 'رواتب محلية',
      expatSalaries: 'رواتب وافدة',
      socialInsurance: 'تأمين اجتماعي',
      expatFees: 'رسوم إقامة وافدين',
      rawMaterials: 'مواد خام',
      maintenance: 'صيانة',
      propertyInsurance: 'تأمين ممتلكات',
      supervisionLicense: 'إشراف + رخصة',
      wasteAndIncidentals: 'الهدر والنثريات',
      total: 'الإجمالي',
      planApproval: 'رسوم اعتماد مخططات',
      deposit: 'تأمين/وديعة (شهرين)',
      electricityConnection: 'رسوم توصيل كهرباء',
      civilDefense: 'فحص الدفاع المدني',
      buildingPermit: 'رسوم تصريح بناء',
      basicInsurance: 'تأمين أساسي',
      miscSetup: 'مصاريف متنوعة',
      totalSetup: 'إجمالي التأسيس',
      pessimistic: 'تشاؤم',
      expected: 'متوقع',
      optimistic: 'تفاؤل',
      yearly: 'سنوي',
      monthly: 'الشهري',
      yearlyLabel: 'السنوي',
      costPerUnit: 'تكلفة الوحدة',
      setupCost: 'تكلفة التأسيس',
      breakEvenUnits: 'نقطة التعادل (وحدة/شهر)',
      breakEvenRevenue: 'إيراد التعادل (شهري)',
      profitMargin: 'هامش الربح المتوقع',
      paybackMonths: 'فترة استرداد رأس المال (شهر)',
      unitPerMonth: 'وحدة/شهر',
      kwh: 'ك.و.س',
      cubicMeter: 'م³',
      selectCityFirst: 'اختر المدينة أولاً',
      workers: 'عامل',
      min: 'حد أدنى',
      max: 'أعلى',
      basedOnConsumption: 'حسب الاستهلاك',
      fixed: 'ثابت',
      ofFacilityValue: 'من قيمة المنشأة',
      furnitureIT: 'تجهيزات، أثاث، IT...'
    },
    en: {
      rent: 'Rent',
      electricity: 'Electricity',
      water: 'Water',
      localSalaries: 'Local Salaries',
      expatSalaries: 'Expat Salaries',
      socialInsurance: 'Social Insurance',
      expatFees: 'Expat Visa Fees',
      rawMaterials: 'Raw Materials',
      maintenance: 'Maintenance',
      propertyInsurance: 'Property Insurance',
      supervisionLicense: 'Supervision + License',
      wasteAndIncidentals: 'Waste &amp; Incidentals',
      total: 'Total',
      planApproval: 'Plan Approval Fees',
      deposit: 'Security Deposit (2 months)',
      electricityConnection: 'Electricity Connection',
      civilDefense: 'Civil Defense Inspection',
      buildingPermit: 'Building Permit Fees',
      basicInsurance: 'Basic Insurance',
      miscSetup: 'Miscellaneous Setup',
      totalSetup: 'Total Setup Cost',
      pessimistic: 'Pessimistic',
      expected: 'Expected',
      optimistic: 'Optimistic',
      yearly: 'Yearly',
      monthly: 'Monthly',
      yearlyLabel: 'Yearly',
      costPerUnit: 'Cost Per Unit',
      setupCost: 'Setup Cost',
      breakEvenUnits: 'Break-even (units/month)',
      breakEvenRevenue: 'Break-even Revenue (monthly)',
      profitMargin: 'Expected Profit Margin',
      paybackMonths: 'Payback Period (months)',
      unitPerMonth: 'units/month',
      kwh: 'kWh',
      cubicMeter: 'm³',
      selectCityFirst: 'Please select a city first',
      workers: 'workers',
      min: 'min',
      max: 'max',
      basedOnConsumption: 'Based on consumption',
      fixed: 'Fixed',
      ofFacilityValue: 'of facility value',
      furnitureIT: 'Furniture, IT, fixtures...'
    }
  };

  function getEl(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const el = getEl(id);
    if (el) el.textContent = text;
  }

  function getNum(id) {
    const el = getEl(id);
    return el ? (parseFloat(el.value) || 0) : 0;
  }

  function getInt(id) {
    const el = getEl(id);
    return el ? (parseInt(el.value, 10) || 0) : 0;
  }

  let _config = null;
  let _costPieChart = null;
  let _scenarioBarChart = null;

  function fmt(n, locale) {
    return Math.round(n).toLocaleString(locale || 'en-US');
  }

  function t(key) {
    const lang = (_config && _config.lang) || document.documentElement.lang || 'ar';
    return (LABELS[lang] && LABELS[lang][key]) || key;
  }

  function populateCitySelect() {
    const select = getEl('city');
    if (!select) return;

    let cities = _config.cities;
    if (!cities && _config.countryCode && window.FactoryCostShared) {
      cities = window.FactoryCostShared.getCountryCities(_config.countryCode);
    }
    if (!cities) return;

    const currentValue = select.value;
    const isEn = _config.lang === 'en';
    select.innerHTML = `<option value="">${isEn ? 'Select city' : 'اختر المدينة'}</option>`;
    Object.keys(cities).forEach(code => {
      const city = cities[code];
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = (isEn && city.nameEn) ? city.nameEn : (city.name || city.nameAr || code);
      select.appendChild(opt);
    });
    if (currentValue && cities[currentValue]) {
      select.value = currentValue;
    } else if (Object.keys(cities).length > 0) {
      select.value = Object.keys(cities)[0];
    }
  }

  function bindEvents() {
    const btn = document.querySelector('button[onclick*="calculate"]') || document.querySelector('.btn-primary');
    if (btn) {
      btn.removeAttribute('onclick');
      btn.addEventListener('click', calculate);
    }

    const inputs = document.querySelectorAll('#area, #type, #localWorkers, #expatWorkers, #localSalary, #expatSalary, #electricity, #water, #monthlyProduction, #rawMaterialPct, #unitPrice, #maintenancePct, #insurancePct, #wasteAndIncidentalsPct, #voltage, #city, #industry');
    inputs.forEach(input => {
      input.addEventListener('change', () => {
        if (_config.autoCalculate) calculate();
      });
    });
  }

  function getCityData(cityKey) {
    let cities = _config.cities;
    if (!cities && _config.countryCode && window.FactoryCostShared) {
      cities = window.FactoryCostShared.getCountryCities(_config.countryCode);
    }
    return cities ? cities[cityKey] : null;
  }

  function calculate() {
    const cityKey = getEl('city') ? getEl('city').value : '';
    const industryKey = getEl('industry') ? getEl('industry').value : 'food';
    const area = getNum('area');
    const type = getEl('type') ? getEl('type').value : 'ready';
    const localWorkers = getInt('localWorkers');
    const expatWorkers = getInt('expatWorkers');
    const localSalary = getNum('localSalary');
    const expatSalary = getNum('expatSalary');
    const electricity = getNum('electricity');
    const water = getNum('water');
    const monthlyProduction = getNum('monthlyProduction');
    const maintenancePct = getNum('maintenancePct');
    const insurancePct = getNum('insurancePct');
    const rawMaterialPct = getNum('rawMaterialPct');
    const unitPrice = getNum('unitPrice');
    const wasteAndIncidentalsPct = getNum('wasteAndIncidentalsPct');

    const city = getCityData(cityKey);
    if (!city) {
      alert(t('selectCityFirst'));
      return;
    }

    const mult = TYPE_MULTIPLIERS[type] || 1;
    const industry = INDUSTRY_PROFILES[industryKey] || INDUSTRY_PROFILES.food;
    const effectiveRawMatPct = rawMaterialPct > 0 ? rawMaterialPct : industry.rawMatPct;

    // Rent
    let rentPerM2 = city.rent || 0;
    if (city.land !== undefined) {
      if (type === 'land') rentPerM2 = city.land;
      else if (type === 'hangar') rentPerM2 = city.warehouse || city.hangar || city.ready || city.rent || 0;
      else if (type === 'ready') rentPerM2 = city.ready || city.rent || 0;
      else rentPerM2 = city.land;
    }
    const rentMonthly = rentPerM2 * area * mult / 12;

    // Electricity
    let elecRate = 0.20;
    if (city.elecLow !== undefined) {
      const voltageEl = getEl('voltage');
      elecRate = voltageEl && voltageEl.value === 'medium' ? (city.elecMed || city.elecLow) : city.elecLow;
    }
    const electricityMonthly = electricity * elecRate * industry.elecMult;

    // Water
    let waterRate = 1.5;
    if (city.water !== undefined) waterRate = city.water;
    const waterMonthly = water * waterRate;

    // Supervision & license
    const supervisionMonthly = area * 0.20 / 12;
    const licenseMonthly = area * 0.05 / 12 / 5;

    // Labor
    const localPayroll = localWorkers * localSalary;
    const expatPayroll = expatWorkers * expatSalary;
    const gosiLocal = localPayroll * (_config.gosiRate || 0);
    const gosiExpat = expatPayroll * (_config.gosiExpatRate || 0);
    const expatFees = expatWorkers * (_config.expatFeePerWorker || 0);
    const totalLabor = localPayroll + expatPayroll + gosiLocal + gosiExpat + expatFees;
    const totalWorkers = localWorkers + expatWorkers;

    // Facility value and maintenance/insurance
    const facilityValue = area * rentPerM2 * mult * 10;
    const maintenanceMonthly = (facilityValue * maintenancePct / 100) / 12;
    const insuranceMonthly = (facilityValue * insurancePct / 100) / 12;

    // Raw materials
    const monthlyRevenue = monthlyProduction * unitPrice;
    const rawMaterialMonthly = monthlyRevenue * (effectiveRawMatPct / 100);

    // Totals
    let totalMonthly = rentMonthly + electricityMonthly + waterMonthly + supervisionMonthly + licenseMonthly + totalLabor + maintenanceMonthly + insuranceMonthly + rawMaterialMonthly;
    const wasteAndIncidentalsMonthly = totalMonthly * (wasteAndIncidentalsPct / 100);
    totalMonthly += wasteAndIncidentalsMonthly;
    const totalYearly = totalMonthly * 12;

    // Setup costs
    const planApproval = Math.min(Math.max(area * 1, 5000), 25000);
    const deposit = area * rentPerM2 * mult * 2;
    const electricityConnection = Math.min(Math.max(electricity * 0.5, 3000), 50000);
    const civilDefense = 2000;
    const buildingPermit = area * 2;
    const basicInsurance = facilityValue * 0.05;
    const miscSetup = 15000;
    const setupCost = planApproval + deposit + electricityConnection + civilDefense + buildingPermit + basicInsurance + miscSetup;

    // Scenarios
    const pessimistic = totalYearly * 1.25;
    const optimistic = totalYearly * 0.85;

    // Break-even
    const unitCost = monthlyProduction > 0 ? totalMonthly / monthlyProduction : 0;
    const breakEvenUnits = (unitPrice > unitCost && unitCost > 0) ? Math.ceil(totalMonthly / (unitPrice - unitCost)) : 0;
    const breakEvenRevenue = breakEvenUnits * unitPrice;
    const profitMargin = monthlyRevenue > 0 ? ((monthlyRevenue - totalMonthly) / monthlyRevenue * 100) : 0;
    const paybackMonths = (monthlyRevenue > totalMonthly && totalMonthly > 0) ? Math.ceil(setupCost / (monthlyRevenue - totalMonthly)) : 0;

    const currency = _config.currency || '';
    const locale = _config.locale || 'en-US';
    const pct = v => totalMonthly > 0 ? (v / totalMonthly * 100).toFixed(1) + '%' : '0%';

    // Update scenario cards (support both yearly and simple IDs)
    setText('pessimisticYearly', fmt(pessimistic, locale) + (currency ? ' ' + currency : ''));
    setText('expectedYearly', fmt(totalYearly, locale) + (currency ? ' ' + currency : ''));
    setText('optimisticYearly', fmt(optimistic, locale) + (currency ? ' ' + currency : ''));
    setText('pessimistic', fmt(pessimistic, locale) + (currency ? ' ' + currency : ''));
    setText('expected', fmt(totalYearly, locale) + (currency ? ' ' + currency : ''));
    setText('optimistic', fmt(optimistic, locale) + (currency ? ' ' + currency : ''));

    // Update summary boxes
    setText('totalMonthly', fmt(totalMonthly, locale) + (currency ? ' ' + currency : ''));
    setText('totalYearly', fmt(totalYearly, locale) + (currency ? ' ' + currency : ''));
    setText('setupCost', fmt(setupCost, locale) + (currency ? ' ' + currency : ''));
    setText('costPerUnit', unitCost > 0 ? fmt(unitCost, locale) + (currency ? ' ' + currency : '') : '—');

    // Update break-even boxes if they exist
    setText('breakEvenUnits', breakEvenUnits > 0 ? fmt(breakEvenUnits, locale) : '—');
    setText('breakEvenRevenue', breakEvenRevenue > 0 ? fmt(breakEvenRevenue, locale) + (currency ? ' ' + currency : '') : '—');
    setText('profitMargin', profitMargin > 0 ? profitMargin.toFixed(1) + '%' : '—');
    setText('paybackMonths', paybackMonths > 0 ? fmt(paybackMonths, locale) : '—');

    // Update breakdown table
    const tbody = getEl('breakdownTable');
    if (tbody) {
      tbody.innerHTML = `
        <tr><td><strong>${t('rent')} ${city.name || city.nameAr || ''}</strong></td><td>${fmt(rentMonthly, locale)}</td><td>${fmt(rentMonthly * 12, locale)}</td><td>${pct(rentMonthly)}</td></tr>
        <tr><td>${t('electricity')} (${fmt(electricity, locale)} ${t('kwh')})</td><td>${fmt(electricityMonthly, locale)}</td><td>${fmt(electricityMonthly * 12, locale)}</td><td>${pct(electricityMonthly)}</td></tr>
        <tr><td>${t('water')} (${fmt(water, locale)} ${t('cubicMeter')})</td><td>${fmt(waterMonthly, locale)}</td><td>${fmt(waterMonthly * 12, locale)}</td><td>${pct(waterMonthly)}</td></tr>
        <tr><td>${t('localSalaries')} (${fmt(localWorkers, locale)} ${t('workers')})</td><td>${fmt(localPayroll, locale)}</td><td>${fmt(localPayroll * 12, locale)}</td><td>${pct(localPayroll)}</td></tr>
        <tr><td>${t('expatSalaries')} (${fmt(expatWorkers, locale)} ${t('workers')})</td><td>${fmt(expatPayroll, locale)}</td><td>${fmt(expatPayroll * 12, locale)}</td><td>${pct(expatPayroll)}</td></tr>
        <tr><td>${t('socialInsurance')}</td><td>${fmt(gosiLocal + gosiExpat, locale)}</td><td>${fmt((gosiLocal + gosiExpat) * 12, locale)}</td><td>${pct(gosiLocal + gosiExpat)}</td></tr>
        <tr><td>${t('expatFees')}</td><td>${fmt(expatFees, locale)}</td><td>${fmt(expatFees * 12, locale)}</td><td>${pct(expatFees)}</td></tr>
        <tr><td>${t('rawMaterials')} (${_config.lang === 'en' ? industry.nameEn : industry.nameAr})</td><td>${fmt(rawMaterialMonthly, locale)}</td><td>${fmt(rawMaterialMonthly * 12, locale)}</td><td>${pct(rawMaterialMonthly)}</td></tr>
        <tr><td>${t('maintenance')} (${maintenancePct}%)</td><td>${fmt(maintenanceMonthly, locale)}</td><td>${fmt(maintenanceMonthly * 12, locale)}</td><td>${pct(maintenanceMonthly)}</td></tr>
        <tr><td>${t('propertyInsurance')} (${insurancePct}%)</td><td>${fmt(insuranceMonthly, locale)}</td><td>${fmt(insuranceMonthly * 12, locale)}</td><td>${pct(insuranceMonthly)}</td></tr>
        <tr><td>${t('supervisionLicense')}</td><td>${fmt(supervisionMonthly + licenseMonthly, locale)}</td><td>${fmt((supervisionMonthly + licenseMonthly) * 12, locale)}</td><td>${pct(supervisionMonthly + licenseMonthly)}</td></tr>
        ${wasteAndIncidentalsMonthly > 0 ? `<tr><td>${t('wasteAndIncidentals')} (${wasteAndIncidentalsPct.toFixed(1)}%)</td><td>${fmt(wasteAndIncidentalsMonthly, locale)}</td><td>${fmt(wasteAndIncidentalsMonthly * 12, locale)}</td><td>${pct(wasteAndIncidentalsMonthly)}</td></tr>` : ''}
        <tr class="total-row"><td><strong>${t('total')}</strong></td><td><strong>${fmt(totalMonthly, locale)}</strong></td><td><strong>${fmt(totalYearly, locale)}</strong></td><td><strong>100%</strong></td></tr>
      `;
    }

    // Update setup table
    const stbody = getEl('setupTable');
    if (stbody) {
      stbody.innerHTML = `
        <tr><td>${t('planApproval')}</td><td>${fmt(planApproval, locale)} ${currency}</td><td>${area} m² × 1 ${currency} (${t('min')} 5,000 – ${t('max')} 25,000)</td></tr>
        <tr><td>${t('deposit')}</td><td>${fmt(deposit, locale)} ${currency}</td><td>2 ${t('monthly')}</td></tr>
        <tr><td>${t('electricityConnection')}</td><td>${fmt(electricityConnection, locale)} ${currency}</td><td>${t('basedOnConsumption')}</td></tr>
        <tr><td>${t('civilDefense')}</td><td>${fmt(civilDefense, locale)} ${currency}</td><td>${t('fixed')}</td></tr>
        <tr><td>${t('buildingPermit')}</td><td>${fmt(buildingPermit, locale)} ${currency}</td><td>${area} m² × 2 ${currency}</td></tr>
        <tr><td>${t('basicInsurance')}</td><td>${fmt(basicInsurance, locale)} ${currency}</td><td>5% ${t('ofFacilityValue')}</td></tr>
        <tr><td>${t('miscSetup')}</td><td>${fmt(miscSetup, locale)} ${currency}</td><td>${t('furnitureIT')}</td></tr>
        <tr class="total-row"><td><strong>${t('totalSetup')}</strong></td><td><strong>${fmt(setupCost, locale)} ${currency}</strong></td><td></td></tr>
      `;
    }

    // Update charts if canvases exist
    if (getEl('costPieChart') && getEl('scenarioBarChart')) {
      updateCharts({
        rentMonthly, electricityMonthly, waterMonthly,
        localPayroll, expatPayroll, gosiLocal, gosiExpat, expatFees,
        rawMaterialMonthly, maintenanceMonthly, insuranceMonthly,
        supervisionMonthly, licenseMonthly, wasteAndIncidentalsMonthly,
        pessimistic, totalYearly, optimistic
      });
    }

    // Show results
    const results = getEl('results');
    if (results) results.classList.add('show');

    // Tracking
    if (typeof trackCalculation === 'function') {
      const pageId = _config.countryCode ? `factory-cost-${_config.countryCode.toLowerCase()}` : 'factory-cost';
      trackCalculation(pageId, _config.countryCode || 'UNKNOWN',
        { area: area, workers: totalWorkers, industry: industryKey },
        { monthly: Math.round(totalMonthly), yearly: Math.round(totalYearly) },
        'expected'
      );
    }
    if (typeof window !== 'undefined') {
      window._calcCompleted = true;
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_completed', { source: 'factory-cost', country: _config.countryCode || 'SA' });
      }
    }
  }

  function updateCharts(data) {
    if (typeof Chart === 'undefined') return;

    const locale = _config.locale || 'en-US';
    const labels = [
      t('rent'), t('electricity'), t('water'),
      t('localSalaries'), t('expatSalaries'), t('socialInsurance'),
      t('expatFees'), t('rawMaterials'), t('maintenance'),
      t('propertyInsurance'), t('supervisionLicense'), t('wasteAndIncidentals')
    ];
    const values = [
      data.rentMonthly, data.electricityMonthly, data.waterMonthly,
      data.localPayroll, data.expatPayroll, data.gosiLocal + data.gosiExpat,
      data.expatFees, data.rawMaterialMonthly, data.maintenanceMonthly,
      data.insuranceMonthly, data.supervisionMonthly + data.licenseMonthly,
      data.wasteAndIncidentalsMonthly || 0
    ];
    const colors = ['#b8954e', '#d4b87a', '#555555', '#22c55e', '#16a34a', '#3b82f6', '#ef4444', '#eab308', '#a855f7', '#ec4899', '#888888', '#f97316'];

    const pieCtx = getEl('costPieChart').getContext('2d');
    if (_costPieChart) _costPieChart.destroy();
    _costPieChart = new Chart(pieCtx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data: values, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#555555', font: { size: 11 } } } }
      }
    });

    const barCtx = getEl('scenarioBarChart').getContext('2d');
    if (_scenarioBarChart) _scenarioBarChart.destroy();
    _scenarioBarChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: [t('pessimistic'), t('expected'), t('optimistic')],
        datasets: [{
          label: t('yearlyLabel'),
          data: [data.pessimistic, data.totalYearly, data.optimistic],
          backgroundColor: ['rgba(239,68,68,0.7)', 'rgba(212,168,83,0.7)', 'rgba(34,197,94,0.7)'],
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { color: '#555555' } },
          x: { grid: { display: false }, ticks: { color: '#555555' } }
        }
      }
    });
  }

  function init(config) {
    _config = Object.assign({
      lang: document.documentElement.lang || 'ar',
      currency: '',
      locale: 'en-US',
      gosiRate: 0,
      gosiExpatRate: 0,
      expatFeePerWorker: 0,
      autoCalculate: false,
      cities: null,
      countryCode: null
    }, config);

    populateCitySelect();
    bindEvents();

    // Run calculation if area has a value
    if (getNum('area') > 0) {
      calculate();
    }
  }

  window.FactoryCostCalculator = {
    init,
    calculate,
    updateCharts,
    fmt,
    labels: LABELS
  };
})();
