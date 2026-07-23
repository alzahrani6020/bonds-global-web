// Bonds Global — Auth prompt modal for calculators
// Usage: showAuthModal(action, onLogin, onGuest, options)
// Supports A/B copy variants via session-based assignment.
(function() {
  'use strict';

  function isRTL() {
    var html = document.documentElement;
    return html.getAttribute('dir') === 'rtl' || html.lang === 'ar';
  }

  function getSessionId() {
    try {
      var sid = sessionStorage.getItem('bonds_session_id');
      if (sid) return sid;
      sid = 'bs_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem('bonds_session_id', sid);
      return sid;
    } catch (e) { return String(Date.now()); }
  }

  function getVariant() {
    try {
      var stored = sessionStorage.getItem('bonds_auth_modal_variant');
      if (stored && ['control','benefit','urgency'].indexOf(stored) >= 0) return stored;
    } catch (e) {}
    var sid = getSessionId();
    var hash = 0;
    for (var i = 0; i < sid.length; i++) hash = ((hash << 5) - hash) + sid.charCodeAt(i);
    var variants = ['control', 'benefit', 'urgency'];
    var variant = variants[Math.abs(hash) % variants.length];
    try { sessionStorage.setItem('bonds_auth_modal_variant', variant); } catch (e) {}
    return variant;
  }

  function getCalcMeta(options) {
    options = options || {};
    var calcName = options.calculator || window.__bondsCalcConfig && window.__bondsCalcConfig.name || '';
    var calcLabel = options.calculatorLabel || '';
    if (!calcLabel && calcName) {
      var map = isRTL() ? AR_LABELS : EN_LABELS;
      calcLabel = map[calcName] || calcName;
    }
    return { name: calcName, label: calcLabel };
  }

  var EN_LABELS = {
    feasibility: 'restaurant feasibility',
    pricing: 'pricing study',
    loan: 'loan analysis',
    roi: 'ROI analysis',
    'cash-flow': 'cash flow plan',
    factorycost: 'factory cost study',
    restaurant: 'restaurant study',
    'menu-engineering': 'menu engineering',
    'menu-engineering-simple': 'menu analysis',
    'dish-margin': 'dish margin analysis',
    'real-project-analysis': 'project analysis',
    creditworthiness: 'creditworthiness analysis',
    'medical-viability': 'medical viability study',
    'manufacturing-feasibility': 'manufacturing feasibility',
    'invoice-analyzer': 'invoice analysis',
    dashboard: ' Bonds dashboard'
  };

  var AR_LABELS = {
    feasibility: 'دراسة جدوى المطعم',
    pricing: 'دراسة التسعير',
    loan: 'تحليل القرض',
    roi: 'تحليل العائد',
    'cash-flow': 'خطة التدفق النقدي',
    factorycost: 'دراسة تكلفة المصنع',
    restaurant: 'دراسة المطعم',
    'menu-engineering': 'هندسة المنيو',
    'menu-engineering-simple': 'تحليل المنيو',
    'dish-margin': 'هامش الطبق',
    'real-project-analysis': 'تحليل المشروع',
    creditworthiness: 'تحليل الائتمان',
    'medical-viability': 'دراسة جدوى طبية',
    'manufacturing-feasibility': 'دراسة جدوى التصنيع',
    'invoice-analyzer': 'تحليل الفواتير',
    dashboard: 'لوحة بوندز'
  };

  function variantCopy(action, calcLabel, rtl) {
    var baseTitles = {
      save: rtl ? 'احفظ مشروعك' : 'Save your project',
      excel: rtl ? 'صدّر إلى Excel' : 'Export to Excel',
      pdf: rtl ? 'صدّر إلى PDF' : 'Export to PDF',
      v3: rtl ? 'حوّل إلى مشروع V3' : 'Convert to V3 project',
      print: rtl ? 'اطبع نتائجك' : 'Print your results'
    };
    var title = baseTitles[action] || (rtl ? 'واصل مع حسابك' : 'Continue with your account');
    var calcPart = calcLabel ? (rtl ? ' لـ ' + calcLabel : ' for ' + calcLabel) : '';
    title += calcPart;

    var variant = getVariant();
    var text, loginText, guestText;

    if (variant === 'benefit') {
      text = rtl
        ? 'أنشئ حساباً مجاناً واحفظ نتائجك، وصدر تقارير PDF، وتابع خطة استثمارية كاملة على بوندز V3.'
        : 'Create a free account to save your results, export PDF reports, and continue with a full investment plan on Bonds V3.';
      loginText = rtl ? 'أنشئ حساباً مجاناً' : 'Create free account';
      guestText = rtl ? 'استمر كزائر' : 'Continue as guest';
    } else if (variant === 'urgency') {
      text = rtl
        ? 'إذا لم تسجّل الدخول الآن، ستفقد نتائجك عند إغلاق الصفحة. سجّل دخولك في أقل من دقيقة واحفظ عملك.'
        : 'If you don\'t sign in now, you\'ll lose your results when you close this page. Sign in in under a minute and save your work.';
      loginText = rtl ? 'احفظ نتائجي الآن' : 'Save my results now';
      guestText = rtl ? 'أخذ المخاطرة' : 'I\'ll risk it';
    } else {
      text = rtl
        ? 'سجّل دخولك لتتمكن من ' + (baseTitles[action] || 'متابعة العمل') + '. يستغرق الأمر أقل من دقيقة، ويمكنك متابعة العمل من حيث توقفت.'
        : 'Sign in to ' + (title.toLowerCase()) + '. It takes less than a minute, and you can continue right where you left off.';
      loginText = rtl ? 'تسجيل الدخول' : 'Sign In';
      guestText = rtl ? 'استمر كزائر' : 'Continue as guest';
    }

    return { title, text, loginText, guestText, variant };
  }

  function injectStyles() {
    if (document.getElementById('bonds-auth-modal-styles')) return;
    var style = document.createElement('style');
    style.id = 'bonds-auth-modal-styles';
    style.textContent = [
      '.bonds-auth-modal-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.72); z-index:10000; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s ease; }',
      '.bonds-auth-modal-overlay.active { opacity:1; }',
      '.bonds-auth-modal { background:var(--bg-card, rgba(16,24,45,0.95)); border:1px solid var(--border, rgba(197,160,40,0.2)); border-radius:16px; padding:2rem; max-width:440px; width:90%; text-align:center; box-shadow:0 24px 70px rgba(0,0,0,0.55); transform:translateY(20px); transition:transform 0.2s ease; }',
      '.bonds-auth-modal-overlay.active .bonds-auth-modal { transform:translateY(0); }',
      '.bonds-auth-modal__icon { font-size:2.5rem; margin-bottom:0.75rem; }',
      '.bonds-auth-modal__title { font-size:1.25rem; font-weight:800; color:var(--gold, #d4a853); margin:0 0 0.5rem; line-height:1.3; }',
      '.bonds-auth-modal__text { color:var(--text-secondary, #94a3b8); margin-bottom:1.25rem; line-height:1.6; font-size:0.95rem; }',
      '.bonds-auth-modal__actions { display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; margin-bottom:1rem; }',
      '.bonds-auth-modal__btn { padding:0.75rem 1.25rem; border-radius:10px; font-weight:700; cursor:pointer; border:none; font-size:0.95rem; transition:transform 0.1s ease, opacity 0.15s ease; }',
      '.bonds-auth-modal__btn:hover { transform:translateY(-1px); opacity:0.92; }',
      '.bonds-auth-modal__btn--primary { background:linear-gradient(135deg, #d4a853, #f0c96a); color:#0c0c1c; }',
      '.bonds-auth-modal__btn--secondary { background:transparent; color:var(--text-secondary, #94a3b8); border:1px solid var(--border, rgba(197,160,40,0.25)); }',
      '.bonds-auth-modal__social { font-size:0.8rem; color:var(--text-secondary, #94a3b8); opacity:0.85; display:flex; align-items:center; justify-content:center; gap:0.35rem; flex-wrap:wrap; }',
      '.bonds-auth-modal__social strong { color:var(--gold, #d4a853); font-weight:700; }'
    ].join('');
    document.head.appendChild(style);
  }

  function createModal(title, text, loginText, guestText, socialText, onLogin, onGuest) {
    injectStyles();
    var overlay = document.createElement('div');
    overlay.className = 'bonds-auth-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    var socialHtml = socialText ? '<div class="bonds-auth-modal__social">' + socialText + '</div>' : '';
    overlay.innerHTML = '<div class="bonds-auth-modal">' +
      '<div class="bonds-auth-modal__icon">🔒</div>' +
      '<h3 class="bonds-auth-modal__title">' + title + '</h3>' +
      '<p class="bonds-auth-modal__text">' + text + '</p>' +
      '<div class="bonds-auth-modal__actions">' +
        '<button class="bonds-auth-modal__btn bonds-auth-modal__btn--primary" data-action="login">' + loginText + '</button>' +
        '<button class="bonds-auth-modal__btn bonds-auth-modal__btn--secondary" data-action="guest">' + guestText + '</button>' +
      '</div>' +
      socialHtml +
    '</div>';
    document.body.appendChild(overlay);

    function close() {
      overlay.classList.remove('active');
      setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
    }

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) window.BondsAnalytics.trackEvent('calc_modal_dismissed', { action: action, calculator: meta.name });
        close();
      }
    });

    overlay.querySelector('[data-action="login"]').addEventListener('click', function() {
      close();
      if (typeof onLogin === 'function') onLogin();
    });

    overlay.querySelector('[data-action="guest"]').addEventListener('click', function() {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) window.BondsAnalytics.trackEvent('calc_modal_dismissed', { action: action, calculator: meta.name, via: 'guest' });
      close();
      if (typeof onGuest === 'function') onGuest();
    });

    requestAnimationFrame(function() { overlay.classList.add('active'); });
  }

  var meta = { name: '' };
  var action = '';

  window.showAuthModal = function(_action, onLogin, onGuest, options) {
    action = _action;
    meta = getCalcMeta(options);
    var rtl = isRTL();
    var copy = variantCopy(action, meta.label, rtl);

    if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
      window.BondsAnalytics.trackEvent('calc_signup_prompt_shown', {
        action: action,
        calculator: meta.name,
        variant: copy.variant,
        lang: rtl ? 'ar' : 'en'
      });
    }

    var socialText = rtl
      ? '✅ <strong>+12,000</strong> ريادي استخدموا بوندز هذا الشهر'
      : '✅ <strong>12,000+</strong> entrepreneurs used Bonds this month';

    createModal(copy.title, copy.text, copy.loginText, copy.guestText, socialText, function() {
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('calc_signup_prompt_confirmed', {
          action: action,
          calculator: meta.name,
          variant: copy.variant
        });
      }
      if (typeof onLogin === 'function') onLogin();
    }, onGuest);
  };
})();
