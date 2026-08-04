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
      "<div class=\"bonds-exit-modal__icon\"><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#31373D\" d=\"M4 36s-4 0-4-4V4s0-4 4-4h26c1 0 2 1 2 1l3 3s1 1 1 2v26s0 4-4 4H4z\"/><path fill=\"#55ACEE\" d=\"M5 19v-1s0-2 2-2h21c2 0 2 2 2 2v1H5z\"/><path fill=\"#E1E8ED\" d=\"M5 32.021V19h25v13s0 2-2 2H7c-2 0-2-1.979-2-1.979zM10 3s0-1 1-1h18c1.048 0 1 1 1 1v10s0 1-1 1H11s-1 0-1-1V3zm12 10h5V3h-5v10z\"/></svg></div>" +
      '<h3 class="bonds-exit-modal__title">' + (rtl ? 'لا تفقد نتائجك!' : 'Don\'t lose your results!') + '</h3>' +
      '<p class="bonds-exit-modal__text">' + (rtl ? 'أدخل بريدك لنرسل لك رابطًا سريعًا يحتوي على نتائجك، أو سجّل دخولك لحفظ المشروع كاملًا.' : 'Enter your email and we\'ll send you a quick link with your results, or sign in to save the full project.') + '</p>' +
      '<input type="email" class="bonds-exit-modal__email" placeholder="' + (rtl ? 'بريدك الإلكتروني' : 'Your email address') + '" aria-label="' + (rtl ? 'بريدك الإلكتروني' : 'Your email address') + '" />' +
      '<div class="bonds-exit-modal__actions">' +
        '<button class="bonds-exit-modal__btn bonds-exit-modal__btn--primary" data-action="email">' + (rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#CCD6DD\" d=\"M36 27c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V9c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v18z\"/><path fill=\"#99AAB5\" d=\"M11.95 17.636L.637 28.949c-.027.028-.037.063-.06.091.34.57.814 1.043 1.384 1.384.029-.023.063-.033.09-.06L13.365 19.05c.39-.391.39-1.023 0-1.414-.392-.391-1.024-.391-1.415 0M35.423 29.04c-.021-.028-.033-.063-.06-.09L24.051 17.636c-.392-.391-1.024-.391-1.415 0s-.391 1.023 0 1.414l11.313 11.314c.026.026.062.037.09.06.571-.34 1.044-.814 1.384-1.384\"/><path fill=\"#99AAB5\" d=\"M32 5H4C1.791 5 0 6.791 0 9v1.03l14.528 14.496c1.894 1.893 4.988 1.893 6.884 0L36 10.009V9c0-2.209-1.791-4-4-4z\"/><path fill=\"#E1E8ED\" d=\"M32 5H4C2.412 5 1.051 5.934.405 7.275l14.766 14.767c1.562 1.562 4.096 1.562 5.657 0L35.595 7.275C34.949 5.934 33.589 5 32 5z\"/><path fill=\"#66757F\" d=\"M15 9.27c0-.73.365-1.27 1-1.27h3.62c.839 0 1.174.49 1.174 1 0 .496-.349 1-1.035 1h-2.708v2h2.533c.716 0 1.065.489 1.065 1 0 .496-.366 1-1.065 1h-2.533v2h2.84c.699 0 1.037.489 1.037 1 0 .496-.353 1-1.037 1h-3.766C15.482 18 15 17.469 15 16.812V9.27z\"/></svg> أرسل لي النتائج" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#CCD6DD\" d=\"M36 27c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V9c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v18z\"/><path fill=\"#99AAB5\" d=\"M11.95 17.636L.637 28.949c-.027.028-.037.063-.06.091.34.57.814 1.043 1.384 1.384.029-.023.063-.033.09-.06L13.365 19.05c.39-.391.39-1.023 0-1.414-.392-.391-1.024-.391-1.415 0M35.423 29.04c-.021-.028-.033-.063-.06-.09L24.051 17.636c-.392-.391-1.024-.391-1.415 0s-.391 1.023 0 1.414l11.313 11.314c.026.026.062.037.09.06.571-.34 1.044-.814 1.384-1.384\"/><path fill=\"#99AAB5\" d=\"M32 5H4C1.791 5 0 6.791 0 9v1.03l14.528 14.496c1.894 1.893 4.988 1.893 6.884 0L36 10.009V9c0-2.209-1.791-4-4-4z\"/><path fill=\"#E1E8ED\" d=\"M32 5H4C2.412 5 1.051 5.934.405 7.275l14.766 14.767c1.562 1.562 4.096 1.562 5.657 0L35.595 7.275C34.949 5.934 33.589 5 32 5z\"/><path fill=\"#66757F\" d=\"M15 9.27c0-.73.365-1.27 1-1.27h3.62c.839 0 1.174.49 1.174 1 0 .496-.349 1-1.035 1h-2.708v2h2.533c.716 0 1.065.489 1.065 1 0 .496-.366 1-1.065 1h-2.533v2h2.84c.699 0 1.037.489 1.037 1 0 .496-.353 1-1.037 1h-3.766C15.482 18 15 17.469 15 16.812V9.27z\"/></svg> Email me results") + '</button>' +
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
      var btn = overlay.querySelector('[data-action="email"]');
      var originalText = btn.textContent;
      btn.disabled = true;
      btn.textContent = rtl ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFE8B6" d="M21 18c0-2.001 3.246-3.369 5-6 2-3 2-10 2-10H8s0 7 2 10c1.754 2.631 5 3.999 5 6s-3.246 3.369-5 6c-2 3-2 10-2 10h20s0-7-2-10c-1.754-2.631-5-3.999-5-6z"/><path fill="#FFAC33" d="M18 2h-8s0 4 1 7c1.304 3.912 6 4.999 6 9s0 13 1 13 1-9 1-13 4.697-5.088 6-9c1-3 1-7 1-7h-8z"/><path fill="#3B88C3" d="M30 34c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2s.896-2 2-2h20c1.104 0 2 .896 2 2zm0-32c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2s.896-2 2-2h20c1.104 0 2 .896 2 2z"/></svg> جاري الإرسال...' : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFE8B6" d="M21 18c0-2.001 3.246-3.369 5-6 2-3 2-10 2-10H8s0 7 2 10c1.754 2.631 5 3.999 5 6s-3.246 3.369-5 6c-2 3-2 10-2 10h20s0-7-2-10c-1.754-2.631-5-3.999-5-6z"/><path fill="#FFAC33" d="M18 2h-8s0 4 1 7c1.304 3.912 6 4.999 6 9s0 13 1 13 1-9 1-13 4.697-5.088 6-9c1-3 1-7 1-7h-8z"/><path fill="#3B88C3" d="M30 34c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2s.896-2 2-2h20c1.104 0 2 .896 2 2zm0-32c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2s.896-2 2-2h20c1.104 0 2 .896 2 2z"/></svg> Sending...';

      captureEmail(email, 'exit_intent')
        .then(function(res) {
          btn.disabled = false;
          btn.textContent = originalText;
          if (res.ok) {
            track('email_captured', { calculator: getCalcName(), source: 'exit_intent' });
            if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم إرسال الرابط إلى بريدك" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> Link sent to your email", 'success');
            close();
          } else {
            if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(rtl ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> لم نتمكن من الإرسال، حاول مجددًا" : "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> Could not send, please try again", 'error');
          }
        })
        .catch(function() {
          btn.disabled = false;
          btn.textContent = originalText;
          if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(rtl ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> خطأ في الشبكة" : "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> Network error", 'error');
        });
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

  // Mobile exit-intent: detect quick upward scroll near top of page
  // (user reaching for the browser chrome/address bar to leave)
  (function initMobileExitIntent() {
    var isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    if (!isTouch) return;

    var lastScrollY = window.scrollY || 0;
    var lastScrollTime = Date.now();
    var minVelocity = 1.8; // px/ms upward
    var topThreshold = 180; // px from top
    var mobileTriggered = false;

    window.addEventListener('scroll', function() {
      if (mobileTriggered || hasTriggered || !window._calcCompleted) return;
      var now = Date.now();
      var scrollY = window.scrollY || 0;
      var deltaY = scrollY - lastScrollY;
      var deltaT = now - lastScrollTime;

      if (deltaT > 0 && deltaY < 0 && scrollY < topThreshold) {
        var velocity = Math.abs(deltaY) / deltaT;
        if (velocity >= minVelocity) {
          mobileTriggered = true;
          hasTriggered = true;
          track('exit_intent_shown', { calculator: getCalcName(), device: 'mobile' });
          showExitModal();
        }
      }

      lastScrollY = scrollY;
      lastScrollTime = now;
    }, { passive: true });
  })();

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
