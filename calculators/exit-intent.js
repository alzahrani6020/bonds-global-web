// Bonds Global — Exit-intent prompt for calculators
// Shows auth CTA + optional email capture when user tries to leave with results.
(function() {
  'use strict';

  var hasTriggered = false;

  function isRTL() {
    var html = document.documentElement;
    return html.getAttribute('dir') === 'rtl' || html.lang === 'ar';
  }

  function getCalcName() {
    return (window.__bondsCalcConfig && window.__bondsCalcConfig.name) || 'calculator';
  }

  function getSessionId() {
    try { return sessionStorage.getItem('bonds_session_id') || ''; } catch (e) { return ''; }
  }

  function getCountry() {
    var el = document.getElementById('country');
    return el ? el.value : '';
  }

  function track(name, props) {
    if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
      window.BondsAnalytics.trackEvent(name, props || {});
    }
  }

  function captureEmail(email, source) {
    return fetch('/api/capture-lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        calculator: getCalcName(),
        country: getCountry(),
        lang: isRTL() ? 'ar' : 'en',
        session_id: getSessionId(),
        source: source,
        url: window.location.href
      })
    });
  }

  function injectStyles() {
    if (document.getElementById('bonds-exit-styles')) return;
    var style = document.createElement('style');
    style.id = 'bonds-exit-styles';
    style.textContent = [
      '.bonds-exit-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.75); z-index:10001; display:flex; align-items:center; justify-content:center; opacity:0; transition:opacity 0.2s ease; }',
      '.bonds-exit-overlay.active { opacity:1; }',
      '.bonds-exit-modal { background:var(--bg-card, rgba(16,24,45,0.95)); border:1px solid var(--border, rgba(197,160,40,0.2)); border-radius:16px; padding:2rem; max-width:460px; width:90%; text-align:center; box-shadow:0 24px 70px rgba(0,0,0,0.55); transform:translateY(20px); transition:transform 0.2s ease; }',
      '.bonds-exit-overlay.active .bonds-exit-modal { transform:translateY(0); }',
      '.bonds-exit-modal__icon { font-size:2.5rem; margin-bottom:0.75rem; }',
      '.bonds-exit-modal__title { font-size:1.25rem; font-weight:800; color:var(--gold, #d4a853); margin:0 0 0.5rem; }',
      '.bonds-exit-modal__text { color:var(--text-secondary, #94a3b8); margin-bottom:1.25rem; line-height:1.6; font-size:0.95rem; }',
      '.bonds-exit-modal__email { width:100%; padding:0.75rem 1rem; border-radius:10px; border:1px solid var(--border, rgba(197,160,40,0.25)); background:rgba(255,255,255,0.03); color:var(--text, #e8ecf4); margin-bottom:0.75rem; font-size:0.95rem; text-align:inherit; }',
      '.bonds-exit-modal__email::placeholder { color:var(--text-secondary, #94a3b8); }',
      '.bonds-exit-modal__actions { display:flex; gap:0.75rem; justify-content:center; flex-wrap:wrap; }',
      '.bonds-exit-modal__btn { padding:0.75rem 1.25rem; border-radius:10px; font-weight:700; cursor:pointer; border:none; font-size:0.95rem; transition:transform 0.1s ease, opacity 0.15s ease; }',
      '.bonds-exit-modal__btn:hover { transform:translateY(-1px); opacity:0.92; }',
      '.bonds-exit-modal__btn--primary { background:linear-gradient(135deg, #d4a853, #f0c96a); color:#0c0c1c; }',
      '.bonds-exit-modal__btn--secondary { background:transparent; color:var(--text-secondary, #94a3b8); border:1px solid var(--border, rgba(197,160,40,0.25)); }',
      '.bonds-exit-modal__note { color:var(--text-secondary, #94a3b8); font-size:0.75rem; margin-top:1rem; }'
    ].join('');
    document.head.appendChild(style);
  }

  function showExitModal() {
    if (hasTriggered) return;
    hasTriggered = true;
    var rtl = isRTL();
    injectStyles();

    var overlay = document.createElement('div');
    overlay.className = 'bonds-exit-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = '<div class="bonds-exit-modal">' +
      '<div class="bonds-exit-modal__icon">💾</div>' +
      '<h3 class="bonds-exit-modal__title">' + (rtl ? 'لا تفقد نتائجك!' : 'Don\'t lose your results!') + '</h3>' +
      '<p class="bonds-exit-modal__text">' + (rtl ? 'أدخل بريدك لنرسل لك رابطًا سريعًا يحتوي على نتائجك، أو سجّل دخولك لحفظ المشروع كاملًا.' : 'Enter your email and we\'ll send you a quick link with your results, or sign in to save the full project.') + '</p>' +
      '<input type="email" class="bonds-exit-modal__email" placeholder="' + (rtl ? 'بريدك الإلكتروني' : 'Your email address') + '" aria-label="' + (rtl ? 'بريدك الإلكتروني' : 'Your email address') + '" />' +
      '<div class="bonds-exit-modal__actions">' +
        '<button class="bonds-exit-modal__btn bonds-exit-modal__btn--primary" data-action="email">' + (rtl ? '📧 أرسل لي النتائج' : '📧 Email me results') + '</button>' +
        '<button class="bonds-exit-modal__btn bonds-exit-modal__btn--secondary" data-action="save">' + (rtl ? 'تسجيل الدخول' : 'Sign in') + '</button>' +
        '<button class="bonds-exit-modal__btn bonds-exit-modal__btn--secondary" data-action="close">' + (rtl ? 'لاحقًا' : 'Later') + '</button>' +
      '</div>' +
      '<p class="bonds-exit-modal__note">' + (rtl ? 'لا نرسل رسائل مزعجة. يمكنك إلغاء الاشتراك في أي وقت.' : 'No spam. Unsubscribe anytime.') + '</p>' +
    '</div>';
    document.body.appendChild(overlay);

    function close() {
      overlay.classList.remove('active');
      setTimeout(function() { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 200);
    }

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        track('exit_intent_dismissed', { calculator: getCalcName() });
        close();
      }
    });

    var input = overlay.querySelector('.bonds-exit-modal__email');

    overlay.querySelector('[data-action="email"]').addEventListener('click', function() {
      var email = input.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        input.style.borderColor = '#ef4444';
        return;
      }
      input.style.borderColor = '';
      captureEmail(email, 'exit_intent');
      track('email_captured', { calculator: getCalcName(), source: 'exit_intent' });
      if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(rtl ? '✅ تم إرسال الرابط إلى بريدك' : '✅ Link sent to your email', 'success');
      close();
    });

    overlay.querySelector('[data-action="save"]').addEventListener('click', function() {
      track('exit_intent_signup_clicked', { calculator: getCalcName() });
      close();
      if (typeof window.checkAuthForAction === 'function') {
        window.checkAuthForAction('save', function() { if (window.saveBondsProject) window.saveBondsProject(); });
      } else {
        sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search);
        window.location.href = '/calculators/auth/index.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
      }
    });

    overlay.querySelector('[data-action="close"]').addEventListener('click', function() {
      track('exit_intent_dismissed', { calculator: getCalcName(), via: 'close' });
      close();
    });

    requestAnimationFrame(function() { overlay.classList.add('active'); });
    track('exit_intent_shown', { calculator: getCalcName() });
  }

  // Desktop: detect mouse leaving viewport toward top
  document.addEventListener('mouseout', function(e) {
    if (e.clientY < 12 && !hasTriggered && window._calcCompleted) {
      showExitModal();
    }
  });

  // Mobile / all devices: warn before leaving with unsaved results
  window.addEventListener('beforeunload', function(e) {
    if (window._calcCompleted && !hasTriggered) {
      var rtl = isRTL();
      var msg = rtl
        ? 'لديك نتائج لم تحفظها. هل أنت متأكد من المغادرة؟'
        : 'You have unsaved results. Are you sure you want to leave?';
      e.returnValue = msg;
      return msg;
    }
  });
})();
