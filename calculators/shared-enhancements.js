/**
 * Bonds Calculator Shared Enhancements
 * Adds unified features to any calculator page that exposes window.getCalculatorData()
 */
(function() {
  'use strict';

  var ENHANCEMENT_CSS = `
    .bec-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-bottom: 1.5rem; }
    .bec-kpi-card { padding: 1rem; border-radius: 16px; border: 1px solid var(--border, rgba(197,160,40,0.15)); background: rgba(255,255,255,0.03); text-align: center; transition: transform 0.2s ease, box-shadow 0.2s ease; }
    .bec-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
    .bec-kpi-card--gold { border-color: rgba(212,168,83,0.35); background: rgba(212,168,83,0.08); }
    .bec-kpi-card--green { border-color: rgba(22,163,74,0.35); background: rgba(22,163,74,0.08); }
    .bec-kpi-card--blue { border-color: rgba(59,130,246,0.35); background: rgba(59,130,246,0.08); }
    .bec-kpi-card--purple { border-color: rgba(168,85,247,0.35); background: rgba(168,85,247,0.08); }
    .bec-kpi-card--red { border-color: rgba(220,38,38,0.35); background: rgba(220,38,38,0.08); }
    .bec-kpi-card__label { font-size: 0.8rem; color: var(--text-secondary, #94a3b8); margin-bottom: 0.4rem; }
    .bec-kpi-card__value { font-size: 1.35rem; font-weight: 800; color: var(--text, #e8ecf4); line-height: 1.2; }
    .bec-kpi-card__unit { font-size: 0.75rem; color: var(--text-secondary, #94a3b8); margin-top: 0.2rem; }
    .bec-smart-alerts { display: flex; flex-direction: column; gap: 0.6rem; }
    .bec-smart-alert { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.85rem 1rem; border-radius: 12px; border: 1px solid var(--border, rgba(197,160,40,0.15)); background: rgba(255,255,255,0.03); }
    .bec-smart-alert--danger { border-color: rgba(220,38,38,0.4); background: rgba(220,38,38,0.08); }
    .bec-smart-alert--warning { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.08); }
    .bec-smart-alert--success { border-color: rgba(22,163,74,0.4); background: rgba(22,163,74,0.08); }
    .bec-smart-alert__icon { font-size: 1.25rem; line-height: 1; }
    .bec-smart-alert__title { font-weight: 700; margin-bottom: 0.15rem; color: var(--text, #e8ecf4); }
    .bec-smart-alert__text { font-size: 0.9rem; color: var(--text-secondary, #94a3b8); }
    .bec-share-bar { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-top: 1rem; }
    .bec-modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; align-items: center; justify-content: center; padding: 1rem; overflow: auto; }
    .bec-modal-content { background: var(--bg-card, rgba(16,24,45,0.6)); border: 1px solid var(--border, rgba(197,160,40,0.15)); border-radius: 24px; max-width: 800px; width: 100%; padding: 1.5rem; box-shadow: 0 25px 80px rgba(0,0,0,0.5); }
    .bec-ai-result { max-height: 400px; overflow-y: auto; line-height: 1.8; }
    .bec-ai-result h4 { color: var(--gold, #d4a853); margin: 1rem 0 0.5rem; }
    .bec-ai-result ul { padding-right: 1.25rem; }
    .bec-ai-result li { margin-bottom: 0.35rem; }
    .bec-loading { color: var(--text-secondary, #94a3b8); font-style: italic; }
  `;

  function addStyles() {
    if (document.getElementById('bec-shared-styles')) return;
    var style = document.createElement('style');
    style.id = 'bec-shared-styles';
    style.textContent = ENHANCEMENT_CSS;
    document.head.appendChild(style);
  }

  function formatCurrency(n) {
    if (typeof window.formatCurrency === 'function') return window.formatCurrency(n);
    if (typeof window.formatNumberAR === 'function') return window.formatNumberAR(n) + ' ' + (window.getCurrencySymbol ? window.getCurrencySymbol() : '');
    return Number(n || 0).toLocaleString('ar-SA');
  }

  function formatNumber(n) {
    if (typeof window.formatNumberAR === 'function') return window.formatNumberAR(n);
    return Number(n || 0).toLocaleString('ar-SA');
  }

  function isRTL() {
    return document.documentElement.getAttribute('dir') === 'rtl';
  }

  function getLang() {
    return document.documentElement.getAttribute('lang') === 'en' ? 'en' : 'ar';
  }

  var T = {
    ar: {
      kpi: 'المؤشرات الرئيسية',
      alerts: 'الإنذارات الذكية',
      exportSheets: 'Google Sheets',
      shareImage: 'صورة للمشاركة',
      aiAdvisor: 'مستشار بوندز الذكي',
      aiBtn: 'استشر المستشار الذكي',
      scenarios: 'السيناريوهات المحفوظة',
      saveScenario: 'حفظ السيناريو',
      print: 'طباعة / PDF',
      close: 'إغلاق',
      download: 'تحميل الصورة',
      share: 'مشاركة',
      loading: 'جاري التحليل...',
      noData: 'لا توجد بيانات كافية لإظهار المؤشرات.',
      balanced: 'النموذج المالي يبدو متوازناً.',
      negativeCash: 'الرصيد النقدي سالب في أحد الأشهر — راجع التدفقات.',
      lowMargin: 'هامش الربح ضيق — راجع التكاليف.',
      highFixed: 'التكاليف الثابتة مرتفعة مقارنة بالإيرادات.'
    },
    en: {
      kpi: 'Key Metrics',
      alerts: 'Smart Alerts',
      exportSheets: 'Google Sheets',
      shareImage: 'Share Image',
      aiAdvisor: 'Bonds AI Advisor',
      aiBtn: 'Ask AI Advisor',
      scenarios: 'Saved Scenarios',
      saveScenario: 'Save Scenario',
      print: 'Print / PDF',
      close: 'Close',
      download: 'Download Image',
      share: 'Share',
      loading: 'Analyzing...',
      noData: 'Not enough data to display metrics.',
      balanced: 'The financial model looks balanced.',
      negativeCash: 'Cash balance is negative in some months — review cash flows.',
      lowMargin: 'Profit margin is narrow — review costs.',
      highFixed: 'Fixed costs are high relative to revenue.'
    }
  };

  function t(key) {
    return T[getLang()][key] || T.ar[key];
  }

  // ===== KPI Cards =====
  function initKpiCards(containerSelector, kpiDefinitions) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (document.getElementById('becKpiCards')) return;

    var kpiHTML = '<div id="becKpiCards" class="bec-kpi-grid" style="display:none;margin-bottom:1.5rem;">';
    kpiDefinitions.forEach(function(def, idx) {
      var colors = ['gold', 'green', 'blue', 'purple', 'red', 'orange'];
      var color = def.color || colors[idx % colors.length];
      kpiHTML += '<div class="bec-kpi-card bec-kpi-card--' + color + '">' +
        '<div class="bec-kpi-card__label">' + def.label + '</div>' +
        '<div id="' + def.id + '" class="bec-kpi-card__value">—</div>' +
        (def.unit ? '<div class="bec-kpi-card__unit">' + def.unit + '</div>' : '') +
        '</div>';
    });
    kpiHTML += '</div>';

    var wrapper = document.createElement('div');
    wrapper.innerHTML = kpiHTML;
    container.insertBefore(wrapper.firstElementChild, container.firstElementChild);
  }

  function updateKpiCards(values) {
    var grid = document.getElementById('becKpiCards');
    if (!grid) return;
    grid.style.display = 'grid';
    Object.keys(values).forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.textContent = values[id].text;
        if (values[id].color) el.style.color = values[id].color;
      }
    });
  }

  // ===== Smart Alerts =====
  function initSmartAlerts(containerSelector) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (document.getElementById('becSmartAlerts')) return;

    var section = document.createElement('div');
    section.id = 'becSmartAlertsSection';
    section.className = 'reveal calc-mt-12';
    section.innerHTML = '<div class="calc-panel">' +
      '<h2 class="calc-section-title">' + t('alerts') + '</h2>' +
      '<div id="becSmartAlerts" class="bec-smart-alerts"></div>' +
      '<button onclick="window.BondsEnhancements.refreshAlerts()" class="btn btn-outline calc-btn-sm" style="margin-top:0.75rem;">' + t('alerts') + '</button>' +
      '</div>';
    container.appendChild(section);
  }

  function generateSmartAlerts(data) {
    var alerts = [];
    var lang = getLang();
    var isAr = lang === 'ar';

    if (data.minBalance !== undefined && data.minBalance < 0) {
      alerts.push({ type: 'danger', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M34.16 28.812L31.244 2.678C31.074 1.153 29.785 0 28.251 0H7.664C6.119 0 4.825 1.168 4.667 2.704l-2.67 26.108H34.16z\"/><circle fill=\"#BE1931\" cx=\"18.069\" cy=\"14\" r=\"9.366\"/><path fill=\"#99AAB5\" d=\"M35.521 29.18H.479L0 34c0 2 2 2 2 2h32s2 0 2-2l-.479-4.82z\"/><path fill=\"#CCD6DD\" d=\"M35.594 29.912l-.073-.732C35.38 28.442 34.751 28 34 28H2c-.751 0-1.38.442-1.521 1.18l-.073.732h35.188z\"/><path fill=\"#EC9DAD\" d=\"M29.647 13.63l-7.668-1.248 4.539-6.308c.107-.148.091-.354-.039-.484-.131-.129-.336-.146-.484-.039l-6.309 4.538-1.247-7.667c-.029-.181-.187-.314-.37-.314s-.341.133-.37.314l-1.248 7.667-6.308-4.538c-.149-.107-.353-.09-.484.039-.13.131-.146.335-.039.484l4.538 6.308L6.49 13.63c-.181.029-.314.186-.314.37s.133.341.314.37l7.668 1.248-4.538 6.308c-.107.149-.091.354.039.484.131.129.335.146.484.039l6.308-4.538 1.248 7.667c.029.182.187.314.37.314s.341-.134.37-.314l1.247-7.667 6.308 4.538c.148.106.354.09.484-.039.13-.131.146-.335.039-.484l-4.538-6.308 7.668-1.248c.182-.029.314-.187.314-.37s-.132-.341-.314-.37z\"/></svg>", title: isAr ? 'رصيد نقدي سالب' : 'Negative Cash Balance', text: t('negativeCash') });
    }
    if (data.netFlow !== undefined && data.netFlow < 0) {
      alerts.push({ type: 'danger', icon: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>", title: isAr ? 'صافي التدفق السنوي سالب' : 'Negative Annual Net Cash Flow', text: isAr ? 'المصروفات تتجاوز الواردات خلال العام.' : 'Expenses exceed inflows during the year.' });
    }
    if (data.profitMargin !== undefined && data.profitMargin > 0 && data.profitMargin < 15) {
      alerts.push({ type: 'warning', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#CCD6DD\" d=\"M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z\"/><path fill=\"#E1E8ED\" d=\"M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z\"/><path fill=\"#3B94D9\" d=\"M31.002 33c-.721 0-1.416-.39-1.774-1.072l-9.738-18.59-6.076 6.076c-.446.447-1.076.66-1.705.564-.626-.092-1.171-.474-1.47-1.03l-7-13c-.524-.973-.16-2.186.813-2.709.975-.523 2.186-.16 2.709.812l5.726 10.633 6.1-6.099c.45-.45 1.089-.659 1.716-.563.629.096 1.175.485 1.47 1.049l11 21c.513.979.135 2.187-.844 2.699-.297.157-.614.23-.927.23z\"/></svg>", title: isAr ? 'هامش ربح ضيق' : 'Narrow Profit Margin', text: t('lowMargin') });
    }
    if (data.fixedCosts !== undefined && data.revenue > 0 && data.fixedCosts / data.revenue > 0.5) {
      alerts.push({ type: 'warning', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#BE1931\" d=\"M10.308 9H5.692l-.154 2h4.924zM10 5H6l-.154 2h4.308zm.615 8h-5.23l-.154 2h5.538zM5 18h6l-.077-1H5.077zm15.615-5h-5.23l-.154 2h5.538zM15 18h6l-.077-1h-5.846zm5.308-9h-4.616l-.154 2h4.924zM20 5h-4l-.154 2h4.308zm10.308 4h-4.616l-.154 2h4.924zm-5.231 8L25 18h6l-.077-1zm5.538-4h-5.23l-.154 2h5.538zM30 5h-4l-.154 2h4.308z\"/><path fill=\"#E6E7E8\" d=\"M10.462 11H5.538l-.153 2h5.23zm-.308-4H5.846l-.154 2h4.616zm-4.923 8l-.154 2h5.846l-.154-2zm15.231-4h-4.924l-.153 2h5.23zm-.308-4h-4.308l-.154 2h4.616zm-4.923 8l-.154 2h5.846l-.154-2zm15.231-4h-4.924l-.153 2h5.23zm.307 4h-5.538l-.154 2h5.846zm-.615-8h-4.308l-.154 2h4.616z\"/><path fill=\"#A0041E\" d=\"M35 34c0 1.104-.896 2-2 2H3c-1.104 0-2-.896-2-2V20c0-1.104.896-2 2-2h30c1.104 0 2 .896 2 2v14z\"/><path fill=\"#C1694F\" d=\"M1 20h34v2H1z\"/><path fill=\"#AAB8C2\" d=\"M6 24h4v4H6zm10 0h4v4h-4zm10 0h4v4h-4zM6 30h4v4H6zm10 0h4v4h-4zm10 0h4v4h-4z\"/><path fill=\"#D1D3D4\" d=\"M9 0C7.896 0 7 .896 7 2c0 .457.159.873.417 1.209C7.17 3.392 7 3.67 7 4c0 .552.448 1 1 1s1-.448 1-1c1.104 0 2-.896 2-2s-.896-2-2-2zm10 0c-1.104 0-2 .896-2 2 0 .457.159.873.417 1.209C17.17 3.392 17 3.67 17 4c0 .552.448 1 1 1s1-.448 1-1c1.104 0 2-.896 2-2s-.896-2-2-2zm10 0c-1.104 0-2 .896-2 2 0 .457.159.873.417 1.209C27.17 3.392 27 3.67 27 4c0 .552.447 1 1 1s1-.448 1-1c1.104 0 2-.896 2-2s-.896-2-2-2z\"/></svg>", title: isAr ? 'تكاليف ثابتة مرتفعة' : 'High Fixed Costs', text: t('highFixed') });
    }

    // Creditworthiness alerts
    if (data.totalScore !== undefined) {
      if (data.totalScore < 40) {
        alerts.push({ type: 'danger', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><circle fill=\"#DD2E44\" cx=\"18\" cy=\"18\" r=\"18\"/></svg>", title: isAr ? 'تصنيف ائتماني ضعيف جداً' : 'Very Weak Credit Rating', text: isAr ? 'الدرجة الإجمالية أقل من 40؛ المشروع/الشركة يُصنف عالي المخاطر.' : 'Total score below 40; the project/company is classified as high risk.' });
      } else if (data.totalScore < 60) {
        alerts.push({ type: 'warning', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><circle fill=\"#FDCB58\" cx=\"18\" cy=\"18\" r=\"18\"/></svg>", title: isAr ? 'تصنيف ائتماني ضعيف' : 'Weak Credit Rating', text: isAr ? 'الدرجة بين 40 و 60؛ جودة ائتمانية ضعيفة وتحتاج تحسين.' : 'Score between 40 and 60; credit quality is weak and needs improvement.' });
      } else if (data.totalScore < 70) {
        alerts.push({ type: 'warning', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><circle fill=\"#F4900C\" cx=\"18\" cy=\"18\" r=\"18\"/></svg>", title: isAr ? 'جودة ائتمانية مقبولة' : 'Adequate Credit Quality', text: isAr ? 'الدرجة بين 60 و 70؛ جودة ائتمانية مقبولة لكنها ليست ممتازة.' : 'Score between 60 and 70; credit quality is adequate but not strong.' });
      }
    }
    if (data.debtRatio !== undefined && data.debtRatio > 0.6) {
      alerts.push({ type: 'warning', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#CCD6DD\" d=\"M31 2H5C3.343 2 2 3.343 2 5v26c0 1.657 1.343 3 3 3h26c1.657 0 3-1.343 3-3V5c0-1.657-1.343-3-3-3z\"/><path fill=\"#E1E8ED\" d=\"M31 1H5C2.791 1 1 2.791 1 5v26c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V5c0-2.209-1.791-4-4-4zm0 2c1.103 0 2 .897 2 2v4h-6V3h4zm-4 16h6v6h-6v-6zm0-2v-6h6v6h-6zM25 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM17 3v6h-6V3h6zm-6 8h6v6h-6v-6zm0 8h6v6h-6v-6zM3 5c0-1.103.897-2 2-2h4v6H3V5zm0 6h6v6H3v-6zm0 8h6v6H3v-6zm2 14c-1.103 0-2-.897-2-2v-4h6v6H5zm6 0v-6h6v6h-6zm8 0v-6h6v6h-6zm12 0h-4v-6h6v4c0 1.103-.897 2-2 2z\"/><path fill=\"#3B94D9\" d=\"M31.002 33c-.721 0-1.416-.39-1.774-1.072l-9.738-18.59-6.076 6.076c-.446.447-1.076.66-1.705.564-.626-.092-1.171-.474-1.47-1.03l-7-13c-.524-.973-.16-2.186.813-2.709.975-.523 2.186-.16 2.709.812l5.726 10.633 6.1-6.099c.45-.45 1.089-.659 1.716-.563.629.096 1.175.485 1.47 1.049l11 21c.513.979.135 2.187-.844 2.699-.297.157-.614.23-.927.23z\"/></svg>", title: isAr ? 'المديونية مرتفعة' : 'High Debt Level', text: isAr ? 'نسبة الديون تتجاوز 60% من إجمالي الأصول.' : 'Debt ratio exceeds 60% of total assets.' });
    }
    if (data.currentRatio !== undefined && data.currentRatio < 1) {
      alerts.push({ type: 'danger', icon: "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg>", title: isAr ? 'سيولة ضعيفة' : 'Weak Liquidity', text: isAr ? 'الأصول المتداولة لا تغطي الالتزامات المتداولة.' : 'Current assets do not cover current liabilities.' });
    }
    if (data.interestCoverage !== undefined && data.interestCoverage < 2 && data.interestCoverage >= 0) {
      alerts.push({ type: 'warning', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#F4900C\" d=\"M35 19c0-2.062-.367-4.039-1.04-5.868-.46 5.389-3.333 8.157-6.335 6.868-2.812-1.208-.917-5.917-.777-8.164.236-3.809-.012-8.169-6.931-11.794 2.875 5.5.333 8.917-2.333 9.125-2.958.231-5.667-2.542-4.667-7.042-3.238 2.386-3.332 6.402-2.333 9 1.042 2.708-.042 4.958-2.583 5.208-2.84.28-4.418-3.041-2.963-8.333C2.52 10.965 1 14.805 1 19c0 9.389 7.611 17 17 17s17-7.611 17-17z\"/><path fill=\"#FFCC4D\" d=\"M28.394 23.999c.148 3.084-2.561 4.293-4.019 3.709-2.106-.843-1.541-2.291-2.083-5.291s-2.625-5.083-5.708-6c2.25 6.333-1.247 8.667-3.08 9.084-1.872.426-3.753-.001-3.968-4.007C7.352 23.668 6 26.676 6 30c0 .368.023.73.055 1.09C9.125 34.124 13.342 36 18 36s8.875-1.876 11.945-4.91c.032-.36.055-.722.055-1.09 0-2.187-.584-4.236-1.606-6.001z\"/></svg>", title: isAr ? 'تغطية الفوائد ضعيفة' : 'Weak Interest Coverage', text: isAr ? 'أرباح التشغيل لا تكفي لتغطية مصاريف الفوائد بأمان.' : 'Operating profit is insufficient to safely cover interest expense.' });
    }
    if (data.dscr !== undefined && data.dscr < 1) {
      alerts.push({ type: 'danger', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M34.16 28.812L31.244 2.678C31.074 1.153 29.785 0 28.251 0H7.664C6.119 0 4.825 1.168 4.667 2.704l-2.67 26.108H34.16z\"/><circle fill=\"#BE1931\" cx=\"18.069\" cy=\"14\" r=\"9.366\"/><path fill=\"#99AAB5\" d=\"M35.521 29.18H.479L0 34c0 2 2 2 2 2h32s2 0 2-2l-.479-4.82z\"/><path fill=\"#CCD6DD\" d=\"M35.594 29.912l-.073-.732C35.38 28.442 34.751 28 34 28H2c-.751 0-1.38.442-1.521 1.18l-.073.732h35.188z\"/><path fill=\"#EC9DAD\" d=\"M29.647 13.63l-7.668-1.248 4.539-6.308c.107-.148.091-.354-.039-.484-.131-.129-.336-.146-.484-.039l-6.309 4.538-1.247-7.667c-.029-.181-.187-.314-.37-.314s-.341.133-.37.314l-1.248 7.667-6.308-4.538c-.149-.107-.353-.09-.484.039-.13.131-.146.335-.039.484l4.538 6.308L6.49 13.63c-.181.029-.314.186-.314.37s.133.341.314.37l7.668 1.248-4.538 6.308c-.107.149-.091.354.039.484.131.129.335.146.484.039l6.308-4.538 1.248 7.667c.029.182.187.314.37.314s.341-.134.37-.314l1.247-7.667 6.308 4.538c.148.106.354.09.484-.039.13-.131.146-.335.039-.484l-4.538-6.308 7.668-1.248c.182-.029.314-.187.314-.37s-.132-.341-.314-.37z\"/></svg>", title: isAr ? 'تغطية خدمة الدين أقل من 1' : 'DSCR Below 1', text: isAr ? 'التدفق النقدي التشغيلي أقل من أقساط الديون السنوية.' : 'Operating cash flow is below annual debt service.' });
    }
    if (data.collateralCoverage !== undefined && data.collateralCoverage < 0.8) {
      alerts.push({ type: 'warning', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#AAB8C2\" d=\"M18 3C12.477 3 8 7.477 8 13v10h4V13c0-3.313 2.686-6 6-6s6 2.687 6 6v10h4V13c0-5.523-4.477-10-10-10z\"/><path fill=\"#FFAC33\" d=\"M31 32c0 2.209-1.791 4-4 4H9c-2.209 0-4-1.791-4-4V20c0-2.209 1.791-4 4-4h18c2.209 0 4 1.791 4 4v12z\"/></svg>", title: isAr ? 'الضمانات غير كافية' : 'Insufficient Collateral', text: isAr ? 'قيمة الضمانات تغطي أقل من 80% من مبلغ التمويل المطلوب.' : 'Collateral covers less than 80% of requested financing.' });
    }

    if (alerts.length === 0) {
      if (data.totalScore !== undefined && data.totalScore >= 70) {
        alerts.push({ type: 'success', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg>", title: isAr ? 'جودة ائتمانية جيدة' : 'Good Credit Quality', text: isAr ? 'التصنيف الائتماني قوي والمؤشرات الرئيسية في مستويات آمنة.' : 'Credit rating is strong and key indicators are at safe levels.' });
      } else {
        alerts.push({ type: 'success', icon: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg>", title: isAr ? 'النموذج المالي متوازن' : 'Balanced Financial Model', text: t('balanced') });
      }
    }
    return alerts;
  }

  function updateSmartAlerts(data) {
    var container = document.getElementById('becSmartAlerts');
    if (!container) return;
    var alerts = generateSmartAlerts(data);
    container.innerHTML = alerts.map(function(a) {
      return '<div class="bec-smart-alert bec-smart-alert--' + a.type + '">' +
        '<div class="bec-smart-alert__icon">' + a.icon + '</div>' +
        '<div><div class="bec-smart-alert__title">' + a.title + '</div>' +
        '<div class="bec-smart-alert__text">' + a.text + '</div></div></div>';
    }).join('');
  }

  // ===== Export Buttons =====
  function addExportButtons(containerSelector) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (container.querySelector('.bec-export-sheets')) return;

    var sheetsBtn = document.createElement('button');
    sheetsBtn.className = 'btn btn-outline calc-btn-sm bec-export-sheets';
    sheetsBtn.innerHTML = "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#C1694F\" d=\"M32 34c0 1.104-.896 2-2 2H6c-1.104 0-2-.896-2-2V7c0-1.104.896-2 2-2h24c1.104 0 2 .896 2 2v27z\"/><path fill=\"#FFF\" d=\"M29 32c0 .553-.447 1-1 1H8c-.552 0-1-.447-1-1V9c0-.552.448-1 1-1h20c.553 0 1 .448 1 1v23z\"/><path fill=\"#CCD6DD\" d=\"M25 3h-4c0-1.657-1.343-3-3-3s-3 1.343-3 3h-4c-1.104 0-2 .896-2 2v5h18V5c0-1.104-.896-2-2-2z\"/><circle fill=\"#292F33\" cx=\"18\" cy=\"3\" r=\"2\"/><path fill=\"#99AAB5\" d=\"M20 14c0 .552-.447 1-1 1h-9c-.552 0-1-.448-1-1s.448-1 1-1h9c.553 0 1 .448 1 1zm7 4c0 .552-.447 1-1 1H10c-.552 0-1-.448-1-1s.448-1 1-1h16c.553 0 1 .448 1 1zm0 4c0 .553-.447 1-1 1H10c-.552 0-1-.447-1-1 0-.553.448-1 1-1h16c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1H10c-.552 0-1-.447-1-1 0-.553.448-1 1-1h16c.553 0 1 .447 1 1zm0 4c0 .553-.447 1-1 1h-9c-.552 0-1-.447-1-1 0-.553.448-1 1-1h9c.553 0 1 .447 1 1z\"/></svg> " + t('exportSheets');
    sheetsBtn.onclick = window.BondsEnhancements.copyCsvAndOpenSheets;
    container.appendChild(sheetsBtn);

    var shareBtn = document.createElement('button');
    shareBtn.className = 'btn btn-outline calc-btn-sm bec-share-image-btn';
    shareBtn.innerHTML = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#D79E84\" d=\"M35 30c0 1.104-.896 2-2 2H3c-1.104 0-2-.896-2-2V6c0-1.104.896-2 2-2h30c1.104 0 2 .896 2 2v24z\"/><path fill=\"#BF6952\" d=\"M33 4H3c-1.104 0-2 .896-2 2v24c0 .389.116.748.307 1.055l33.33-26.198C34.276 4.34 33.679 4 33 4z\"/><path fill=\"#8CCAF7\" d=\"M31 22V9c0-.552-.447-1-1-1H6c-.552 0-1 .448-1 1v13h26z\"/><path fill=\"#5DADEC\" d=\"M6 28h13v-7H5v6c0 .553.448 1 1 1z\"/><path fill=\"#292F33\" d=\"M19 21v7h11c.553 0 1-.447 1-1v-6H19z\"/><path fill=\"#67757F\" d=\"M20 19c-.613 0-.852 1.127-1.405 2-.349.55-.822 1-1.595 1-2 0-2 3-3 3-1.256 0-2.512 1.578-3.273 3H19c.879-1.758 1.761-3.514 4-3.913.307-.055.638-.087 1-.087 3 0 3.106-1.553 4-2 1.358-.679 2.251-.437 3-.211V19H20z\"/><path fill=\"#E75A70\" d=\"M25 11l-4 4v4h8v-4z\"/><path fill=\"#292F33\" d=\"M29 16c-.256 0-.512-.098-.707-.293L25 12.414l-3.293 3.293c-.391.391-1.023.391-1.414 0s-.391-1.023 0-1.414l4-4c.391-.391 1.023-.391 1.414 0l4 4c.391.391.391 1.023 0 1.414-.195.195-.451.293-.707.293z\"/><path fill=\"#BB1A34\" d=\"M23 16h2v3h-2z\"/><path fill=\"#FFF\" d=\"M17.219 14.125c0-1.036-.839-1.875-1.875-1.875-.079 0-.155.014-.232.023.028-.129.044-.261.044-.398 0-1.036-.839-1.875-1.875-1.875-.668 0-1.251.352-1.583.878-.208-.08-.431-.128-.667-.128-.952 0-1.73.713-1.851 1.632-.211-.083-.439-.132-.68-.132-1.036 0-1.875.839-1.875 1.875S7.464 16 8.5 16c.041 0 .08-.01.121-.012l.004.012h6.75v-.003c1.021-.017 1.844-.847 1.844-1.872z\"/></svg> " + t('shareImage');
    shareBtn.onclick = window.BondsEnhancements.generateShareCard;
    container.appendChild(shareBtn);
  }

  function copyCsvAndOpenSheets() {
    var data = window.getCalculatorData ? window.getCalculatorData() : null;
    if (!data || !data.csvRows) {
      alert('لا توجد بيانات للتصدير.');
      return;
    }
    var csv = data.csvRows.map(function(row) { return row.join('\t'); }).join('\n');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(csv).then(function() {
        alert("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" aria-hidden=\"true\"><path d=\"M4 12l6 6 10-14\"/></svg> تم نسخ البيانات. سيتم فتح Google Sheets الآن.");
        window.open('https://sheets.new', '_blank');
      }).catch(function() {
        window.open('https://sheets.new', '_blank');
      });
    } else {
      window.open('https://sheets.new', '_blank');
    }
  }

  // ===== Share Card =====
  function initShareCardModal() {
    if (document.getElementById('becShareCardModal')) return;
    var modal = document.createElement('div');
    modal.id = 'becShareCardModal';
    modal.className = 'bec-modal-overlay';
    modal.setAttribute('onclick', 'if(event.target===this)window.BondsEnhancements.closeShareCardModal()');
    modal.innerHTML = '<div class="bec-modal-content" style="max-width:420px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">' +
      '<h3 style="margin:0;color:var(--gold);font-size:1.15rem;">' + t('shareImage') + '</h3>' +
      '<button onclick="window.BondsEnhancements.closeShareCardModal()" class="btn btn-outline btn-sm" style="padding:0.25rem 0.6rem;">×</button>' +
      '</div>' +
      '<div style="border-radius:12px;overflow:hidden;background:#0a0f1a;">' +
      '<canvas id="becShareCardCanvas" width="800" height="1000" style="width:100%;height:auto;display:block;"></canvas>' +
      '</div>' +
      '<div style="display:flex;gap:0.5rem;margin-top:1rem;flex-wrap:wrap;">' +
      '<button onclick="window.BondsEnhancements.downloadShareCard()" class="btn btn-primary btn-sm" style="flex:1;">' + t('download') + '</button>' +
      '<button onclick="window.BondsEnhancements.shareShareCard()" class="btn btn-outline btn-sm" style="flex:1;">' + t('share') + '</button>' +
      '</div>' +
      '</div>';
    document.body.appendChild(modal);
  }

  function generateShareCard() {
    var data = window.getCalculatorData ? window.getCalculatorData() : null;
    if (!data || !data.kpis) {
      alert('لا توجد بيانات لإنشاء الصورة.');
      return;
    }
    var canvas = document.getElementById('becShareCardCanvas');
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    var grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#0a0f1a');
    grad.addColorStop(1, '#10182d');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = '#d4a853';
    ctx.lineWidth = 6;
    ctx.strokeRect(12, 12, w - 24, h - 24);

    ctx.fillStyle = '#d4a853';
    ctx.font = 'bold 42px Vazirmatn, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BONDS', w / 2, 80);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px Vazirmatn, Arial';
    ctx.fillText(document.title.split('|')[0].trim(), w / 2, 120);

    var y = 190;
    data.kpis.forEach(function(kpi) {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(50, y - 32, w - 100, 54);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '20px Vazirmatn, Arial';
      ctx.textAlign = isRTL() ? 'right' : 'left';
      var labelX = isRTL() ? w - 70 : 70;
      ctx.fillText(kpi.label, labelX, y);
      ctx.fillStyle = kpi.color || '#e8ecf4';
      ctx.font = 'bold 24px Vazirmatn, Arial';
      ctx.textAlign = isRTL() ? 'left' : 'right';
      var valueX = isRTL() ? 70 : w - 70;
      ctx.fillText(kpi.value, valueX, y);
      y += 70;
    });

    ctx.fillStyle = '#d4a853';
    ctx.font = '22px Vazirmatn, Arial';
    ctx.textAlign = 'center';
    ctx.fillText('bonds-global.com', w / 2, y + 20);

    document.getElementById('becShareCardModal').style.display = 'flex';
  }

  function closeShareCardModal() {
    document.getElementById('becShareCardModal').style.display = 'none';
  }

  function downloadShareCard() {
    var canvas = document.getElementById('becShareCardCanvas');
    var link = document.createElement('a');
    link.download = 'bonds-summary.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  function shareShareCard() {
    var canvas = document.getElementById('becShareCardCanvas');
    canvas.toBlob(function(blob) {
      var file = new File([blob], 'bonds-summary.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: 'Bonds Summary', text: 'Check out this Bonds analysis' });
      } else {
        downloadShareCard();
      }
    });
  }

  // ===== AI Advisor =====
  function initAiAdvisor(containerSelector) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (document.getElementById('becAiAdvisorSection')) return;

    var section = document.createElement('div');
    section.id = 'becAiAdvisorSection';
    section.className = 'reveal calc-mt-12';
    section.innerHTML = '<div class="calc-panel">' +
      "<h2 class=\"calc-section-title\"><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><ellipse fill=\"#F4900C\" cx=\"33.5\" cy=\"14.5\" rx=\"2.5\" ry=\"3.5\"/><ellipse fill=\"#F4900C\" cx=\"2.5\" cy=\"14.5\" rx=\"2.5\" ry=\"3.5\"/><path fill=\"#FFAC33\" d=\"M34 19c0 .553-.447 1-1 1h-3c-.553 0-1-.447-1-1v-9c0-.552.447-1 1-1h3c.553 0 1 .448 1 1v9zM7 19c0 .553-.448 1-1 1H3c-.552 0-1-.447-1-1v-9c0-.552.448-1 1-1h3c.552 0 1 .448 1 1v9z\"/><path fill=\"#FFCC4D\" d=\"M28 5c0 2.761-4.478 4-10 4C12.477 9 8 7.761 8 5s4.477-5 10-5c5.522 0 10 2.239 10 5z\"/><path fill=\"#F4900C\" d=\"M25 4.083C25 5.694 21.865 7 18 7c-3.866 0-7-1.306-7-2.917 0-1.611 3.134-2.917 7-2.917 3.865 0 7 1.306 7 2.917z\"/><path fill=\"#269\" d=\"M30 5.5C30 6.881 28.881 7 27.5 7h-19C7.119 7 6 6.881 6 5.5S7.119 3 8.5 3h19C28.881 3 30 4.119 30 5.5z\"/><path fill=\"#55ACEE\" d=\"M30 6H6c-1.104 0-2 .896-2 2v26h28V8c0-1.104-.896-2-2-2z\"/><path fill=\"#3B88C3\" d=\"M35 33v-1c0-1.104-.896-2-2-2H22.071l-3.364 3.364c-.391.391-1.023.391-1.414 0L13.929 30H3c-1.104 0-2 .896-2 2v1c0 1.104-.104 2 1 2h32c1.104 0 1-.896 1-2z\"/><circle fill=\"#FFF\" cx=\"24.5\" cy=\"14.5\" r=\"4.5\"/><circle fill=\"#DD2E44\" cx=\"24.5\" cy=\"14.5\" r=\"2.721\"/><circle fill=\"#FFF\" cx=\"11.5\" cy=\"14.5\" r=\"4.5\"/><path fill=\"#F5F8FA\" d=\"M29 25.5c0 1.381-1.119 2.5-2.5 2.5h-17C8.119 28 7 26.881 7 25.5S8.119 23 9.5 23h17c1.381 0 2.5 1.119 2.5 2.5z\"/><path fill=\"#CCD6DD\" d=\"M17 23h2v5h-2zm-5 0h2v5h-2zm10 0h2v5h-2zM7 25.5c0 1.21.859 2.218 2 2.45v-4.9c-1.141.232-2 1.24-2 2.45zm20-2.45v4.899c1.141-.232 2-1.24 2-2.45s-.859-2.217-2-2.449z\"/><circle fill=\"#DD2E44\" cx=\"11.5\" cy=\"14.5\" r=\"2.721\"/></svg> " + t('aiAdvisor') + '</h2>' +
      '<button onclick="window.BondsEnhancements.askAiAdvisor()" id="becAiAdvisorBtn" class="btn btn-primary" style="margin-top:0.75rem;">' + t('aiBtn') + '</button>' +
      '<div id="becAiAdvisorResult" style="margin-top:1rem;"></div>' +
      '</div>';
    container.appendChild(section);
  }

  function askAiAdvisor() {
    var btn = document.getElementById('becAiAdvisorBtn');
    var resultBox = document.getElementById('becAiAdvisorResult');
    var data = window.getCalculatorData ? window.getCalculatorData() : null;
    if (!data) {
      resultBox.innerHTML = '<p class="calc-hint">لا توجد بيانات.</p>';
      return;
    }

    if (window.BondsAuth && window.BondsAuth.requireAuth) {
      window.BondsAuth.requireAuth(window.location.href);
      return;
    }

    btn.textContent = t('loading');
    btn.disabled = true;
    resultBox.innerHTML = '<p class="bec-loading">' + t('loading') + '</p>';

    var payload = Object.assign({
      country: data.country || 'SA',
      currency: window.getCurrencySymbol ? window.getCurrencySymbol() : (getLang() === 'en' ? 'SAR' : 'ريال')
    }, data.aiPayload || data.inputs || {});

    fetch('/api/v3/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ type: data.aiType || 'financial_analysis', payload: payload })
    })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      btn.textContent = t('aiBtn');
      btn.disabled = false;
      if (data.error) {
        resultBox.innerHTML = '<p class="calc-hint">' + (data.error.message || data.error) + '</p>';
        return;
      }
      var html = data.analysis || data.report || data.advice || JSON.stringify(data, null, 2);
      resultBox.innerHTML = '<div class="bec-ai-result">' + html.replace(/\n/g, '<br>') + '</div>';
    })
    .catch(function(err) {
      btn.textContent = t('aiBtn');
      btn.disabled = false;
      resultBox.innerHTML = '<p class="calc-hint">حدث خطأ: ' + err.message + '</p>';
    });
  }

  // ===== Scenario Manager =====
  function initScenarioManager(containerSelector, calcType) {
    var container = document.querySelector(containerSelector);
    if (!container) return;
    if (document.getElementById('becScenarioSection')) return;

    var key = 'bonds_' + (calcType || 'generic') + '_scenarios';
    window.BEC_SCENARIO_KEY = key;

    var section = document.createElement('div');
    section.id = 'becScenarioSection';
    section.className = 'reveal calc-mt-12';
    section.innerHTML = '<div class="calc-panel">' +
      "<h2 class=\"calc-section-title\"><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#31373D\" d=\"M4 36s-4 0-4-4V4s0-4 4-4h26c1 0 2 1 2 1l3 3s1 1 1 2v26s0 4-4 4H4z\"/><path fill=\"#55ACEE\" d=\"M5 19v-1s0-2 2-2h21c2 0 2 2 2 2v1H5z\"/><path fill=\"#E1E8ED\" d=\"M5 32.021V19h25v13s0 2-2 2H7c-2 0-2-1.979-2-1.979zM10 3s0-1 1-1h18c1.048 0 1 1 1 1v10s0 1-1 1H11s-1 0-1-1V3zm12 10h5V3h-5v10z\"/></svg> " + t('scenarios') + '</h2>' +
      '<div style="display:flex;gap:0.5rem;margin:0.75rem 0;flex-wrap:wrap;">' +
      '<input type="text" id="becScenarioName" class="bonds-input" placeholder="' + (getLang() === 'en' ? 'Scenario name' : 'اسم السيناريو') + '" style="flex:1;min-width:160px;" />' +
      '<button onclick="window.BondsEnhancements.saveScenario()" class="btn btn-primary calc-btn-sm">' + t('saveScenario') + '</button>' +
      '</div>' +
      '<div id="becScenarioList"></div>' +
      '</div>';
    container.appendChild(section);
    renderScenarios();
  }

  function getScenarios() {
    try {
      return JSON.parse(localStorage.getItem(window.BEC_SCENARIO_KEY) || '[]');
    } catch (e) { return []; }
  }

  function setScenarios(list) {
    localStorage.setItem(window.BEC_SCENARIO_KEY, JSON.stringify(list.slice(0, 20)));
  }

  function saveScenario() {
    var nameInput = document.getElementById('becScenarioName');
    var name = (nameInput.value || '').trim();
    if (!name) {
      var now = new Date().toLocaleString(getLang() === 'en' ? 'en-US' : 'ar-SA', { hour: '2-digit', minute: '2-digit' });
      name = (getLang() === 'en' ? 'Scenario ' : 'سيناريو ') + now;
    }
    var data = window.getCalculatorData ? window.getCalculatorData() : null;
    if (!data) return;

    var scenarios = getScenarios();
    scenarios.unshift({ id: 'sc_' + Date.now(), name: name, date: new Date().toISOString(), data: data });
    setScenarios(scenarios);
    nameInput.value = '';
    renderScenarios();
  }

  function deleteScenario(id) {
    var scenarios = getScenarios().filter(function(s) { return s.id !== id; });
    setScenarios(scenarios);
    renderScenarios();
  }

  function loadScenario(id) {
    var scenario = getScenarios().find(function(s) { return s.id === id; });
    if (!scenario || !window.loadCalculatorData) return;
    window.loadCalculatorData(scenario.data);
  }

  function renderScenarios() {
    var container = document.getElementById('becScenarioList');
    if (!container) return;
    var scenarios = getScenarios();
    if (scenarios.length === 0) {
      container.innerHTML = '<p class="calc-hint">' + (getLang() === 'en' ? 'No saved scenarios.' : 'لا توجد سيناريوهات محفوظة.') + '</p>';
      return;
    }
    container.innerHTML = scenarios.map(function(s) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:0.6rem 0.8rem;background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:10px;margin-bottom:0.5rem;">' +
        '<span style="font-weight:600;">' + s.name + '</span>' +
        '<div style="display:flex;gap:0.4rem;">' +
        '<button onclick="window.BondsEnhancements.loadScenario(\'' + s.id + '\')" class="btn btn-outline calc-btn-sm">' + (getLang() === 'en' ? 'Load' : 'تحميل') + '</button>' +
        '<button onclick="window.BondsEnhancements.deleteScenario(\'' + s.id + '\')" class="btn btn-outline calc-btn-sm" style="color:#dc2626">×</button>' +
        '</div></div>';
    }).join('');
  }

  // ===== Public API =====
  window.BondsEnhancements = {
    init: function(config) {
      config = config || {};
      addStyles();
      if (config.kpiContainer && config.kpis) initKpiCards(config.kpiContainer, config.kpis);
      if (config.alertsContainer) initSmartAlerts(config.alertsContainer);
      if (config.exportContainer) addExportButtons(config.exportContainer);
      initShareCardModal();
      if (config.aiContainer) initAiAdvisor(config.aiContainer);
      if (config.scenarioContainer) initScenarioManager(config.scenarioContainer, config.calcType);
    },
    updateKpiCards: updateKpiCards,
    updateSmartAlerts: updateSmartAlerts,
    copyCsvAndOpenSheets: copyCsvAndOpenSheets,
    generateShareCard: generateShareCard,
    closeShareCardModal: closeShareCardModal,
    downloadShareCard: downloadShareCard,
    shareShareCard: shareShareCard,
    askAiAdvisor: askAiAdvisor,
    saveScenario: saveScenario,
    loadScenario: loadScenario,
    deleteScenario: deleteScenario,
    refreshAlerts: function() {
      var data = window.getCalculatorData ? window.getCalculatorData() : {};
      updateSmartAlerts(data);
    }
  };
})();
