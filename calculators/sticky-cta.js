// Bonds Global — Sticky conversion CTA for calculators
// Shows after the user calculates results, prompting save / V3 conversion.
// Usage: BondsStickyCTA.init({ name: 'pricing', lang: 'ar', hasResults: () => ... })
(function() {
  'use strict';

  function isRTL() {
    var html = document.documentElement;
    return html.getAttribute('dir') === 'rtl' || html.lang === 'ar';
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
      saveText: cfg.saveText || (rtl ? '💾 احفظ المشروع' : '💾 Save Project'),
      v3Text: cfg.v3Text || (rtl ? '🚀 حوّل إلى V3' : '🚀 Convert to V3'),
      closeText: cfg.closeText || (rtl ? 'لاحقًا' : 'Later'),
      showOncePerSession: cfg.showOncePerSession !== false
    };
  }

  function injectStyles() {
    if (document.getElementById('bonds-sticky-cta-styles')) return;
    var style = document.createElement('style');
    style.id = 'bonds-sticky-cta-styles';
    style.textContent = [
      '.bonds-sticky-cta { position:fixed; left:0; right:0; bottom:0; z-index:9999; transform:translateY(120%); transition:transform 0.35s cubic-bezier(0.22,1,0.36,1); background:linear-gradient(180deg, rgba(10,15,26,0.98), rgba(16,24,45,0.98)); border-top:1px solid rgba(197,160,40,0.25); padding:0.75rem 1rem; box-shadow:0 -10px 40px rgba(0,0,0,0.45); }',
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
        '<button class="bonds-sticky-cta__btn bonds-sticky-cta__btn--secondary" data-action="save">' + cfg.saveText + '</button>' +
        '<button class="bonds-sticky-cta__btn bonds-sticky-cta__btn--primary" data-action="v3">' + cfg.v3Text + '</button>' +
        '<button class="bonds-sticky-cta__close" data-action="close" aria-label="' + cfg.closeText + '">×</button>' +
      '</div>' +
    '</div>';
    document.body.appendChild(bar);

    bar.querySelector('[data-action="save"]').addEventListener('click', function() {
      if (typeof window.checkAuthForAction === 'function') {
        window.checkAuthForAction('save', function() { if (window.saveBondsProject) window.saveBondsProject(); });
      }
    });

    bar.querySelector('[data-action="v3"]').addEventListener('click', function() {
      if (typeof window.checkAuthForAction === 'function') {
        window.checkAuthForAction('v3', function() { if (window.convertBondsToV3) window.convertBondsToV3(); });
      }
    });

    bar.querySelector('[data-action="close"]').addEventListener('click', function() {
      bar.classList.remove('active');
      try { sessionStorage.setItem('bonds_sticky_cta_closed_' + cfg.name, '1'); } catch (e) {}
    });

    return bar;
  }

  function init(rawCfg) {
    var cfg = getConfig(rawCfg);
    if (cfg.showOncePerSession) {
      try {
        if (sessionStorage.getItem('bonds_sticky_cta_closed_' + cfg.name)) return;
      } catch (e) {}
    }

    var bar;
    var shown = false;

    function show() {
      if (shown) return;
      if (!cfg.hasResults()) return;
      shown = true;
      if (!bar) bar = createBar(cfg);
      requestAnimationFrame(function() { bar.classList.add('active'); });
      if (window.BondsAnalytics && window.BondsAnalytics.trackEvent) {
        window.BondsAnalytics.trackEvent('sticky_cta_shown', { calculator: cfg.name, lang: cfg.lang });
      }
    }

    // Show after delay if results already present
    setTimeout(function() { show(); }, cfg.delay);

    // Also re-check when calculate buttons are clicked
    document.querySelectorAll('button[onclick*="calculate" i], button[onclick*="run" i], .bonds-btn, .btn-primary').forEach(function(btn) {
      btn.addEventListener('click', function() {
        setTimeout(show, 400);
      });
    });
  }

  window.BondsStickyCTA = { init: init };
})();
