// Bonds Global — Sticky conversion CTA for calculators
// Shows after the user calculates results, prompting save / V3 conversion.
// Usage: BondsStickyCTA.init({ name: 'pricing', lang: 'ar', hasResults: () => ... })
(function() {
  'use strict';

  function isRTL() {
    var html = document.documentElement;
    return html.getAttribute('dir') === 'rtl' || html.lang === 'ar';
  }

  function isMobile() {
    return window.matchMedia('(max-width: 640px)').matches || 'ontouchstart' in window;
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function getConfig(cfg) {
    cfg = cfg || {};
    var rtl = cfg.lang === 'ar' || (!cfg.lang && isRTL());
    return {
      name: cfg.name || 'calculator',
      lang: rtl ? 'ar' : 'en',
      hasResults: typeof cfg.hasResults === 'function' ? cfg.hasResults : function() { return !!window._calcCompleted; },
      delay: cfg.delay || 1200,
      title: cfg.title || (rtl ? '✨ نتائجك جاهزة' : '✨ Your results are ready'),
      subtitle: cfg.subtitle || (rtl ? 'احفظها أو حوّلها لمشروع V3 كامل.' : 'Save them or convert to a full V3 project.'),
      saveText: cfg.saveText || (rtl ? '💾 احفظ' : '💾 Save'),
      v3Text: cfg.v3Text || (rtl ? '🚀 V3' : '🚀 V3'),
      shareText: cfg.shareText || (rtl ? '🔗 نسخ الرابط' : '🔗 Copy link'),
      emailText: cfg.emailText || (rtl ? '📧 بريدي' : '📧 Email'),
      closeText: cfg.closeText || (rtl ? 'لاحقًا' : 'Later'),
      showOncePerSession: cfg.showOncePerSession !== false
    };
  }

  function injectStyles() {
    if (document.getElementById('bonds-sticky-cta-styles')) return;
    var style = document.createElement('style');
    style.id = 'bonds-sticky-cta-styles';
    style.textContent = [
      '.bonds-sticky-cta { position:fixed; left:0; right:0; bottom:0; z-index:9999; background:linear-gradient(180deg, rgba(10,15,26,0.98), rgba(16,24,45,0.98)); border-top:1px solid rgba(197,160,40,0.25); padding:0.75rem 1rem; box-shadow:0 -10px 40px rgba(0,0,0,0.45); transform:translateY(120%); transition:transform 0.35s cubic-bezier(0.22,1,0.36,1); }',
      '.bonds-sticky-cta.active { transform:translateY(0); }',
      '.bonds-sticky-cta__inner { max-width:1200px; margin:0 auto; display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }',
      '.bonds-sticky-cta__text { flex:1 1 200px; }',
      '.bonds-sticky-cta__title { color:var(--gold, #d4a853); font-weight:800; font-size:0.95rem; margin:0 0 0.15rem; }',
      '.bonds-sticky-cta__subtitle { color:var(--text-secondary, #94a3b8); font-size:0.8rem; margin:0; }',
      '.bonds-sticky-cta__actions { display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap; }',
      '.bonds-sticky-cta__btn { padding:0.55rem 1rem; border-radius:8px; font-weight:700; font-size:0.85rem; border:none; cursor:pointer; transition:transform 0.1s ease, opacity 0.15s ease; white-space:nowrap; }',
      '.bonds-sticky-cta__btn:hover { transform:translateY(-1px); opacity:0.92; }',
      '.bonds-sticky-cta__btn--primary { background:linear-gradient(135deg, #d4a853, #f0c96a); color:#0c0c1c; }',
      '.bonds-sticky-cta__btn--secondary { background:transparent; color:var(--text, #e8ecf4); border:1px solid var(--border, rgba(197,160,40,0.25)); }',
      '.bonds-sticky-cta__close { background:transparent; border:none; color:var(--text-secondary, #94a3b8); font-size:1.1rem; cursor:pointer; padding:0.25rem; line-height:1; }',
      // Mobile FAB variant
      '.bonds-sticky-fab { position:fixed; right:1rem; bottom:1rem; z-index:9999; display:flex; flex-direction:column; gap:0.5rem; align-items:flex-end; }',
      'html[dir="rtl"] .bonds-sticky-fab { right:auto; left:1rem; align-items:flex-start; }',
      '.bonds-sticky-fab__main { width:56px; height:56px; border-radius:50%; background:linear-gradient(135deg, #d4a853, #f0c96a); color:#0c0c1c; border:none; font-size:1.5rem; cursor:pointer; box-shadow:0 6px 20px rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; }',
      '.bonds-sticky-fab__menu { display:flex; flex-direction:column; gap:0.4rem; transform:scale(0); transform-origin:bottom right; transition:transform 0.2s ease; }',
      'html[dir="rtl"] .bonds-sticky-fab__menu { transform-origin:bottom left; }',
      '.bonds-sticky-fab__menu.active { transform:scale(1); }',
      '.bonds-sticky-fab__menu button { padding:0.5rem 0.85rem; border-radius:20px; font-weight:700; font-size:0.8rem; border:none; cursor:pointer; white-space:nowrap; background:var(--bg-card, rgba(16,24,45,0.95)); color:var(--text, #e8ecf4); border:1px solid var(--border, rgba(197,160,40,0.25)); box-shadow:0 4px 12px rgba(0,0,0,0.3); }',
      '.bonds-sticky-fab__menu button.bonds-sticky-fab__v3 { background:linear-gradient(135deg, #d4a853, #f0c96a); color:#0c0c1c; border:none; }',
      '@media (max-width:640px) { .bonds-sticky-cta__inner { flex-direction:column; align-items:stretch; text-align:center; } .bonds-sticky-cta__actions { justify-content:center; } }'
    ].join('');
    document.head.appendChild(style);
  }

  function createBar(cfg) {
    injectStyles();
    if (document.getElementById('bonds-sticky-cta')) return;
    var bar = document.createElement('div');
    bar.id = 'bonds-sticky-cta';
    bar.className = 'bonds-sticky-cta';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', cfg.lang === 'ar' ? 'شريط الإجراءات' : 'Action bar');
    bar.innerHTML = '<div class="bonds-sticky-cta__inner">' +
      '<div class="bonds-sticky-cta__text">' +
        '<p class="bonds-sticky-cta__title">' + cfg.title + '</p>' +
        '<p class="bonds-sticky-cta__subtitle">' + cfg.subtitle + '</p>' +
      '</div>' +
      '<div class="bonds-sticky-cta__actions">' +
        '<button class="bonds-sticky-cta__btn bonds-sticky-cta__btn--secondary" data-action="share">' + cfg.shareText + '</button>' +
        '<button class="bonds-sticky-cta__btn bonds-sticky-cta__btn--secondary" data-action="save">' + cfg.saveText + '</button>' +
        '<button class="bonds-sticky-cta__btn bonds-sticky-cta__btn--primary" data-action="v3">' + cfg.v3Text + '</button>' +
        '<button class="bonds-sticky-cta__close" data-action="close" aria-label="' + cfg.closeText + '">×</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(bar);
    attachActions(bar, cfg, false);
    return bar;
  }

  function createFab(cfg) {
    injectStyles();
    if (document.getElementById('bonds-sticky-fab')) return;
    var fab = document.createElement('div');
    fab.id = 'bonds-sticky-fab';
    fab.className = 'bonds-sticky-fab';
    fab.innerHTML = '<div class="bonds-sticky-fab__menu">' +
      '<button data-action="v3">' + cfg.v3Text + '</button>' +
      '<button data-action="save">' + cfg.saveText + '</button>' +
      '<button data-action="share">' + cfg.shareText + '</button>' +
      '<button data-action="email">' + cfg.emailText + '</button>' +
    '</div>' +
    '<button class="bonds-sticky-fab__main" aria-label="' + cfg.title + '">✨</button>';
    document.body.appendChild(fab);

    var menu = fab.querySelector('.bonds-sticky-fab__menu');
    var main = fab.querySelector('.bonds-sticky-fab__main');
    var open = false;

    main.addEventListener('click', function() {
      open = !open;
      menu.classList.toggle('active', open);
    });

    attachActions(fab, cfg, true);
    return fab;
  }

  function attachActions(container, cfg, isFab) {
    container.querySelector('[data-action="save"]').addEventListener('click', function() {
      if (typeof window.checkAuthForAction === 'function') {
        window.checkAuthForAction('save', function() { if (window.saveBondsProject) window.saveBondsProject(); });
      }
    });

    container.querySelector('[data-action="v3"]').addEventListener('click', function() {
      if (typeof window.checkAuthForAction === 'function') {
        window.checkAuthForAction('v3', function() { if (window.convertBondsToV3) window.convertBondsToV3(); });
      }
    });

    var shareBtn = container.querySelector('[data-action="share"]');
    if (shareBtn) {
      shareBtn.addEventListener('click', function() {
        try {
          var url = window.location.href;
          if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(function() {
              if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(cfg.lang === 'ar' ? '✅ تم نسخ الرابط' : '✅ Link copied', 'success');
            });
          }
        } catch (e) {}
      });
    }

    var emailBtn = container.querySelector('[data-action="email"]');
    if (emailBtn) {
      emailBtn.addEventListener('click', function() {
        var email = prompt(cfg.lang === 'ar' ? 'أدخل بريدك لإرسال النتائج:' : 'Enter your email to send results:');
        if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          emailBtn.disabled = true;
          var originalText = emailBtn.textContent;
          emailBtn.textContent = cfg.lang === 'ar' ? '⏳ جاري...' : '⏳ Sending...';
          fetch('/api/capture-lead', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: email,
              calculator: cfg.name,
              country: document.getElementById('country')?.value || '',
              lang: cfg.lang,
              source: 'sticky_cta',
              url: window.location.href
            })
          }).then(function(res) {
            emailBtn.disabled = false;
            emailBtn.textContent = originalText;
            if (res.ok) {
              if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
                window.BondsAnalytics.trackEvent('email_captured', { calculator: cfg.name, source: 'sticky_cta' });
              }
              if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(cfg.lang === 'ar' ? '✅ تم إرسال الرابط' : '✅ Link sent', 'success');
            } else {
              if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(cfg.lang === 'ar' ? '⚠️ لم نتمكن من الإرسال' : '⚠️ Could not send', 'error');
            }
          }).catch(function() {
            emailBtn.disabled = false;
            emailBtn.textContent = originalText;
            if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(cfg.lang === 'ar' ? '⚠️ خطأ في الشبكة' : '⚠️ Network error', 'error');
          });
        }
      });
    }

    var closeBtn = container.querySelector('[data-action="close"]');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        container.classList.remove('active');
        try { sessionStorage.setItem('bonds_sticky_cta_closed_' + cfg.name, '1'); } catch (e) {}
      });
    }
  }

  function init(rawCfg) {
    var cfg = getConfig(rawCfg);
    if (cfg.showOncePerSession) {
      try {
        if (sessionStorage.getItem('bonds_sticky_cta_closed_' + cfg.name)) return;
      } catch (e) {}
    }

    var el;
    var shown = false;

    function show() {
      if (shown) return;
      if (!cfg.hasResults()) return;
      shown = true;
      if (isMobile()) el = createFab(cfg);
      else el = createBar(cfg);
      if (el && el.classList.contains('bonds-sticky-cta')) {
        requestAnimationFrame(function() { el.classList.add('active'); });
      }
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('sticky_cta_shown', { calculator: cfg.name, lang: cfg.lang, device: isMobile() ? 'mobile' : 'desktop' });
      }
    }

    setTimeout(show, cfg.delay);

    document.querySelectorAll('button[onclick*="calculate" i], button[onclick*="run" i], .bonds-btn, .btn-primary').forEach(function(btn) {
      btn.addEventListener('click', function() { setTimeout(show, 400); });
    });
  }

  window.BondsStickyCTA = { init: init };
})();
