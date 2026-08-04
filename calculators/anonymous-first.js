// Bonds Global — Anonymous-first UX / conversion helper for calculators
// Include after shared-analytics.js, auth-modal.js, exit-intent.js
(function () {
  'use strict';

  var C = window.__bondsCalcConfig || {};
  var calcName = C.name || 'calculator';
  var lang = C.lang || (document.documentElement.lang === 'ar' ? 'ar' : 'en');
  var rtl = lang === 'ar';
  var loginPath = '/calculators/auth/index.html';

  function getEl(id) { return document.getElementById(id); }

  function getCountry() { return (getEl('country') && getEl('country').value) || C.country || 'SA'; }

  function parseText(sel) {
    var el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return 0;
    var raw = (el.textContent || el.value || '0');
    var n = parseFloat(raw.replace(/[^\d.\-]/g, '').replace(/,/g, ''));
    return isNaN(n) ? 0 : n;
  }

  function getCurrency(code) {
    if (C.v3 && C.v3.currency) return C.v3.currency;
    if (typeof BondsPlatforms !== 'undefined' && BondsPlatforms.getCountryMeta) {
      try { var m = BondsPlatforms.getCountryMeta(code); if (m && m.currency) return m.currency; } catch (e) {}
    }
    var map = { SA: 'SAR', AE: 'AED', EG: 'EGP', JO: 'JOD', IQ: 'IQD', LB: 'LBP', SY: 'SYP', TN: 'TND', DZ: 'DZD', MA: 'MAD', LY: 'LYD', SD: 'SDG', YE: 'YER', BH: 'BHD', KW: 'KWD', QA: 'QAR', OM: 'OMR', PS: 'ILS', DJ: 'DJF', SO: 'SOS', MR: 'MRO', KM: 'KMF' };
    return map[code] || 'SAR';
  }

  function collectInputs() {
    var payload = {};
    try {
      document.querySelectorAll('input, select, textarea').forEach(function (el) {
        if (!el.id) return;
        if (el.type === 'checkbox' || el.type === 'radio') payload[el.id] = el.checked ? true : false;
        else payload[el.id] = el.value;
      });
    } catch (e) {}
    return payload;
  }

  function storeCurrentInputs() {
    try { sessionStorage.setItem('bonds_' + calcName + '_draft', JSON.stringify(collectInputs())); } catch (e) {}
  }

  function track(name, props) {
    if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
      window.BondsAnalytics.trackEvent(name, props || {});
    }
  }

  function isLoggedIn() {
    return new Promise(function (resolve) {
      if (window.BondsAuth && window.BondsAuth.getUser) {
        window.BondsAuth.getUser().then(function (d) { resolve(!!(d && d.user)); }).catch(function () { resolve(false); });
      } else resolve(false);
    });
  }

  function redirectToLogin() {
    sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search);
    window.location.href = loginPath + '?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
  }

  window.checkAuthForAction = async function (action, onAllowed) {
    storeCurrentInputs();
    track('calc_action_clicked', { action: action, source: calcName, country: getCountry() });
    if (await isLoggedIn()) {
      if (typeof onAllowed === 'function') onAllowed();
      return true;
    }
    sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search);
    sessionStorage.setItem('bonds_pending_action', JSON.stringify({ source: window.location.pathname, action: action }));
    if (typeof showAuthModal === 'function') {
      showAuthModal(action, function () {
        track('calc_signup_prompt_confirmed', { action: action, source: calcName });
        redirectToLogin();
      }, function () {
        track('calc_guest_continued', { action: action, source: calcName });
      }, { calculator: calcName, lang: lang });
    } else {
      redirectToLogin();
    }
    return false;
  };

  window.saveBondsProject = function () {
    try {
      track('calc_project_saved', { source: calcName, country: getCountry() });
      var title = C.saveTitle || (rtl ? 'مشروع محفوظ' : 'Saved Project');
      var summary = '';
      if (typeof C.saveSummary === 'function') summary = C.saveSummary();
      else if (C.saveSummarySelector) {
        var el = document.querySelector(C.saveSummarySelector);
        summary = el ? el.textContent.trim() : '';
      }
      var projects = JSON.parse(localStorage.getItem('bonds_guest_projects') || '[]');
      projects.unshift({
        title: title,
        summary: summary,
        href: window.location.pathname + window.location.search,
        createdAt: new Date().toISOString(),
        source: calcName
      });
      localStorage.setItem('bonds_guest_projects', JSON.stringify(projects.slice(0, 20)));
      if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم حفظ المشروع" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> Project saved", 'success');
    } catch (e) {
      if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(rtl ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> لم يتم الحفظ" : "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> Could not save", 'warning');
    }
  };

  window.convertBondsToV3 = async function () {
    try {
      if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(rtl ? 'جاري إنشاء مشروع V3...' : 'Creating V3 project...', 'info');
      var v3 = C.v3 || {};
      var capital = v3.capital ? parseText(v3.capital) : 0;
      var revenue = v3.revenue ? parseText(v3.revenue) : 0;
      var profit = v3.profit ? parseText(v3.profit) : null;
      var cost = v3.cost ? parseText(v3.cost) : null;
      var annualProfit = profit !== null ? profit : (revenue - (cost || 0) * 12);

      var sectorVal = '';
      if (v3.sector) {
        var sEl = document.querySelector(v3.sector);
        sectorVal = sEl ? (sEl.options && sEl.selectedIndex >= 0 ? sEl.options[sEl.selectedIndex].text : (sEl.value || sEl.textContent)) : '';
      }
      var activityVal = '';
      if (v3.activity) {
        var aEl = document.querySelector(v3.activity);
        activityVal = aEl ? (aEl.options && aEl.selectedIndex >= 0 ? aEl.options[aEl.selectedIndex].text : (aEl.value || aEl.textContent)) : '';
      }
      var name = v3.name || (activityVal ? activityVal + (rtl ? ' - دراسة' : ' - Study') : (rtl ? 'دراسة مالية' : 'Financial Study'));
      var sector = sectorVal || (rtl ? 'أعمال' : 'Business');
      var activity = activityVal || (rtl ? 'نشاط تجاري' : 'Commercial Activity');
      var currency = getCurrency(getCountry());

      var metadata = {
        source: 'calculator',
        calculator: calcName,
        country: getCountry(),
        language: lang,
        url: window.location.href,
        createdAt: new Date().toISOString()
      };
      if (typeof v3.metadata === 'function') {
        try { var customMeta = v3.metadata(); for (var mk in customMeta) metadata[mk] = customMeta[mk]; } catch (e) {}
      } else if (v3.metadata && typeof v3.metadata === 'object') {
        for (var mk2 in v3.metadata) metadata[mk2] = v3.metadata[mk2];
      }
      // Auto-capture visible result summary
      try {
        var summaryEl = document.querySelector('.feas-summary, .calc-summary, #resultPanel, .results-panel, .result-card');
        if (summaryEl) metadata.resultSummary = summaryEl.textContent.trim().slice(0, 1000);
      } catch (e) {}

      var payload = {
        name: name,
        sector: sector,
        activity: activity,
        cityCode: null,
        currency: currency,
        capital: capital,
        revenue: revenue,
        annualProfit: annualProfit,
        language: lang,
        metadata: metadata
      };

      var token = '';
      if (window.BondsAuth && window.BondsAuth.getSession) {
        try { var sd = await window.BondsAuth.getSession(); token = (sd && sd.session && sd.session.access_token) || ''; } catch (e) {}
      }
      var res = await fetch('/api/v3/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': 'Bearer ' + token } : {}) },
        body: JSON.stringify(payload)
      });
      var json = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        if (window.BondsUI && window.BondsUI.toast) BondsUI.toast("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> " + (json.error || (rtl ? 'فشل إنشاء المشروع' : 'Failed to create project')), 'error');
        return;
      }
      if (json.project && json.project.id) {
        window.location.href = (lang === 'ar' ? '/v3/project?id=' : '/en/v3/project?id=') + encodeURIComponent(json.project.id);
      } else {
        if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(rtl ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> لم يتم استلام رابط المشروع" : "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> Project link not received", 'error');
      }
    } catch (e) {
      if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(rtl ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> فشل الاتصال بمشروع V3" : "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> Failed to connect to V3 project", 'error');
    }
  };

  function extractHandlerName(onclick) {
    var m = onclick.match(/([a-zA-Z0-9_]+)\s*\(/);
    return m ? m[1] : '';
  }

  function wireButtons() {
    var custom = C.buttonMap;
    if (custom && custom.length) {
      custom.forEach(function (item) {
        var el = document.querySelector(item.selector);
        if (!el) return;
        var existing = el.getAttribute('onclick');
        el.removeAttribute('onclick');
        el.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.checkAuthForAction(item.action, function () {
            if (existing) { try { (new Function(existing)).call(el); } catch (err) {} }
            else if (item.handler && typeof window[item.handler] === 'function') window[item.handler]();
          });
        });
      });
      return;
    }

    var rules = [
      { action: 'save', keywords: ['save', 'saveSession', 'saveAnalysis', 'saveDraft', 'saveCurrentInvoice', 'saveIngredients', 'saveCorrection'] },
      { action: 'pdf', keywords: ['exportpdf', 'generateprofessionalpdf', 'exportplatformpdf', 'window.print'] },
      { action: 'excel', keywords: ['exportexcel', 'exporttoexcel', 'exportexcelsettings', 'exportplatformexcel', 'exportallData'] },
      { action: 'v3', keywords: ['converttov3', 'convertprojecttov3'] }
    ];

    document.querySelectorAll('button[onclick], a[onclick]').forEach(function (btn) {
      var oc = (btn.getAttribute('onclick') || '').toLowerCase().replace(/\s+/g, '');
      var text = (btn.textContent || '').toLowerCase().replace(/\s+/g, '');
      if (oc.indexOf('checkauthforaction') >= 0) return;
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        for (var k = 0; k < rule.keywords.length; k++) {
          var kw = rule.keywords[k];
          if (oc.indexOf(kw) >= 0 || text.indexOf(kw) >= 0) {
            var handler;
            if (kw === 'window.print') {
              handler = 'function(){ window.print(); }';
            } else {
              handler = extractHandlerName(btn.getAttribute('onclick') || '');
            }
            if (handler) {
              if (handler.indexOf('function') === 0) {
                btn.setAttribute('onclick', "checkAuthForAction('" + rule.action + "', " + handler + ")");
              } else {
                btn.setAttribute('onclick', "checkAuthForAction('" + rule.action + "', " + handler + ")");
              }
            }
            return;
          }
        }
      }
    });
  }

  function addV3Button() {
    if (C.skipV3Button) return;
    if (document.querySelector('[data-bonds-v3]')) return;
    var container = C.v3ButtonContainer ? document.querySelector(C.v3ButtonContainer) : null;
    if (!container) container = document.querySelector('.share-bar, .calc-actions, .page-actions, .toolbar, .results-actions');
    if (!container) {
      // Find a likely action toolbar by looking for existing export/save/print buttons
      var ref = document.querySelector('button[onclick*="export" i], button[onclick*="save" i], button[onclick*="print" i], button[onclick*="PDF" i], button[onclick*="Excel" i]');
      if (ref && ref.parentElement) container = ref.parentElement;
    }
    if (!container) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-bonds-v3', '1');
    btn.className = 'btn btn-primary hidden-print';
    btn.style.cssText = 'background:linear-gradient(135deg,#d4a853,#f0c96a);color:#0c0c1c;border:none;border-radius:8px;padding:0.65rem 1.1rem;font-weight:700;margin:0.25rem;';
    btn.innerHTML = rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#A0041E\" d=\"M1 17l8-7 16 1 1 16-7 8s.001-5.999-6-12-12-6-12-6z\"/><path fill=\"#FFAC33\" d=\"M.973 35s-.036-7.979 2.985-11S15 21.187 15 21.187 14.999 29 11.999 32c-3 3-11.026 3-11.026 3z\"/><circle fill=\"#FFCC4D\" cx=\"8.999\" cy=\"27\" r=\"4\"/><path fill=\"#55ACEE\" d=\"M35.999 0s-10 0-22 10c-6 5-6 14-4 16s11 2 16-4c10-12 10-22 10-22z\"/><path d=\"M26.999 5c-1.623 0-3.013.971-3.641 2.36.502-.227 1.055-.36 1.641-.36 2.209 0 4 1.791 4 4 0 .586-.133 1.139-.359 1.64 1.389-.627 2.359-2.017 2.359-3.64 0-2.209-1.791-4-4-4z\"/><path fill=\"#A0041E\" d=\"M8 28s0-4 1-5 13.001-10.999 14-10-9.001 13-10.001 14S8 28 8 28z\"/></svg> حوّل إلى مشروع V3" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#A0041E\" d=\"M1 17l8-7 16 1 1 16-7 8s.001-5.999-6-12-12-6-12-6z\"/><path fill=\"#FFAC33\" d=\"M.973 35s-.036-7.979 2.985-11S15 21.187 15 21.187 14.999 29 11.999 32c-3 3-11.026 3-11.026 3z\"/><circle fill=\"#FFCC4D\" cx=\"8.999\" cy=\"27\" r=\"4\"/><path fill=\"#55ACEE\" d=\"M35.999 0s-10 0-22 10c-6 5-6 14-4 16s11 2 16-4c10-12 10-22 10-22z\"/><path d=\"M26.999 5c-1.623 0-3.013.971-3.641 2.36.502-.227 1.055-.36 1.641-.36 2.209 0 4 1.791 4 4 0 .586-.133 1.139-.359 1.64 1.389-.627 2.359-2.017 2.359-3.64 0-2.209-1.791-4-4-4z\"/><path fill=\"#A0041E\" d=\"M8 28s0-4 1-5 13.001-10.999 14-10-9.001 13-10.001 14S8 28 8 28z\"/></svg> Convert to V3 Project";
    btn.onclick = function () { window.checkAuthForAction('v3', window.convertBondsToV3); };
    container.appendChild(btn);
  }

  var _calcStartTime = null;

  function trackFirstInteraction() {
    var tracked = false;
    function once() {
      if (tracked) return;
      tracked = true;
      _calcStartTime = Date.now();
      try { sessionStorage.setItem('bonds_calc_start_' + calcName, String(_calcStartTime)); } catch (e) {}
      track('calc_started', { source: calcName, country: getCountry() });
    }
    document.querySelectorAll('input, select, textarea').forEach(function (el) {
      el.addEventListener('input', function() { once(); updateUrlParams(); });
      el.addEventListener('change', function() { once(); updateUrlParams(); });
    });
  }

  function trackCompleted() {
    var selectors = C.completeSelectors || [
      'button[onclick*="calculate" i]',
      'button[onclick*="calculateAll" i]',
      'button[onclick*="calculateInvoice" i]',
      'button[onclick*="runSmartAnalysis" i]',
      'button[onclick*="runPromoSim" i]',
      'button[onclick*="runOmnichannel" i]'
    ];
    selectors.forEach(function (sel) {
      var btn = document.querySelector(sel);
      if (btn) {
        btn.addEventListener('click', function () {
          window._calcCompleted = true;
          var duration = null;
          try {
            var start = sessionStorage.getItem('bonds_calc_start_' + calcName);
            if (start) duration = Math.round((Date.now() - parseInt(start, 10)) / 1000);
          } catch (e) {}
          track('calc_completed', { source: calcName, country: getCountry(), durationSeconds: duration });
          if (duration !== null) {
            track('calc_time_to_result', { source: calcName, country: getCountry(), durationSeconds: duration });
          }
        });
      }
    });
  }

  function applyUrlParams() {
    if (C.skipUrlParams) return;
    try {
      var params = new URLSearchParams(window.location.search);
      var hasAny = false;
      params.forEach(function(value, key) {
        if (key === 'bonds_share') return;
        var el = getEl(key);
        if (!el) return;
        hasAny = true;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = value === '1' || value === 'true' || value === 'on';
        else if (el.tagName === 'SELECT') el.value = value;
        else el.value = value;
      });
      if (hasAny && window.BondsUI && window.BondsUI.toast) {
        BondsUI.toast(rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم استعادة المدخلات من الرابط" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> Inputs restored from link", 'success');
      }
    } catch (e) {}
  }

  var _urlUpdateTimer = null;
  function updateUrlParams() {
    if (C.skipUrlParams) return;
    try {
      if (_urlUpdateTimer) clearTimeout(_urlUpdateTimer);
      _urlUpdateTimer = setTimeout(function() {
        var params = new URLSearchParams();
        document.querySelectorAll('input, select, textarea').forEach(function(el) {
          if (!el.id) return;
          if (el.type === 'checkbox' || el.type === 'radio') {
            if (el.checked) params.set(el.id, '1');
          } else if (el.value) {
            params.set(el.id, el.value);
          }
        });
        if (params.toString()) params.set('bonds_share', '1');
        var newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
        window.history.replaceState({}, '', newUrl);
      }, 600);
    } catch (e) {}
  }

  function restoreDraft() {
    if (C.skipDraftRestore) return;
    try {
      var raw = sessionStorage.getItem('bonds_' + calcName + '_draft');
      if (!raw) return;
      var draft = JSON.parse(raw);
      Object.keys(draft).forEach(function (id) {
        var el = getEl(id);
        if (!el) return;
        if (el.type === 'checkbox' || el.type === 'radio') el.checked = draft[id] === true || draft[id] === 'on';
        else if (el.tagName === 'SELECT') el.value = draft[id];
        else el.value = draft[id];
      });
      sessionStorage.removeItem('bonds_' + calcName + '_draft');
      if (typeof window.initUniversalDropdowns === 'function') window.initUniversalDropdowns();
    } catch (e) {}
  }

  function handlePendingAction() {
    if (!window.BondsAuth || !window.BondsAuth.getUser) return;
    window.BondsAuth.getUser().then(function (userData) {
      if (!userData || !userData.user) return;
      try {
        var raw = sessionStorage.getItem('bonds_pending_action');
        if (!raw) return;
        var pending = JSON.parse(raw);
        if (pending.source !== window.location.pathname) return;
        sessionStorage.removeItem('bonds_pending_action');
        if (pending.action === 'save' && window.saveBondsProject) window.saveBondsProject();
        else if (pending.action === 'v3' && window.convertBondsToV3) window.convertBondsToV3();
      } catch (e) {}
    });
  }

  function loadStickyCTA() {
    if (typeof BondsStickyCTA !== 'undefined') {
      BondsStickyCTA.init({ name: calcName, lang: lang, hasResults: function() { return !!window._calcCompleted; } });
      return;
    }
    var base = document.currentScript && document.currentScript.src ? document.currentScript.src.replace(/anonymous-first\.js$/, '') : '';
    var src = base + 'sticky-cta.js';
    var existing = document.querySelector('script[src*="sticky-cta.js"]');
    if (!existing) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = function() {
        if (typeof BondsStickyCTA !== 'undefined') BondsStickyCTA.init({ name: calcName, lang: lang, hasResults: function() { return !!window._calcCompleted; } });
      };
      document.body.appendChild(s);
    }
  }

  function run() {
    applyUrlParams();
    restoreDraft();
    wireButtons();
    addV3Button();
    trackFirstInteraction();
    trackCompleted();
    handlePendingAction();
    loadStickyCTA();
  }

  function exposeAliases() {
    var name = calcName || 'calculator';
    var camel = name.replace(/-([a-z])/g, function (m, g) { return g.toUpperCase(); });
    var suffix = camel.charAt(0).toUpperCase() + camel.slice(1);
    window['convert' + suffix + 'ToV3'] = window.convertBondsToV3;
    window['save' + suffix + 'Project'] = window.saveBondsProject;
  }

  function init(cfg) {
    if (cfg) { for (var k in cfg) C[k] = cfg[k]; }
    exposeAliases();
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  }

  window.BondsAnonymousFirst = { init: init, config: C };
})();
