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
      title: cfg.title || (rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#FFAC33\" d=\"M34.347 16.893l-8.899-3.294-3.323-10.891c-.128-.42-.517-.708-.956-.708-.439 0-.828.288-.956.708l-3.322 10.891-8.9 3.294c-.393.146-.653.519-.653.938 0 .418.26.793.653.938l8.895 3.293 3.324 11.223c.126.424.516.715.959.715.442 0 .833-.291.959-.716l3.324-11.223 8.896-3.293c.391-.144.652-.518.652-.937 0-.418-.261-.792-.653-.938z\"/><path fill=\"#FFCC4D\" d=\"M14.347 27.894l-2.314-.856-.9-3.3c-.118-.436-.513-.738-.964-.738-.451 0-.846.302-.965.737l-.9 3.3-2.313.856c-.393.145-.653.52-.653.938 0 .418.26.793.653.938l2.301.853.907 3.622c.112.444.511.756.97.756.459 0 .858-.312.97-.757l.907-3.622 2.301-.853c.393-.144.653-.519.653-.937 0-.418-.26-.793-.653-.937zM10.009 6.231l-2.364-.875-.876-2.365c-.145-.393-.519-.653-.938-.653-.418 0-.792.26-.938.653l-.875 2.365-2.365.875c-.393.146-.653.52-.653.938 0 .418.26.793.653.938l2.365.875.875 2.365c.146.393.52.653.938.653.418 0 .792-.26.938-.653l.875-2.365 2.365-.875c.393-.146.653-.52.653-.938 0-.418-.26-.792-.653-.938z\"/></svg> نتائجك جاهزة" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#FFAC33\" d=\"M34.347 16.893l-8.899-3.294-3.323-10.891c-.128-.42-.517-.708-.956-.708-.439 0-.828.288-.956.708l-3.322 10.891-8.9 3.294c-.393.146-.653.519-.653.938 0 .418.26.793.653.938l8.895 3.293 3.324 11.223c.126.424.516.715.959.715.442 0 .833-.291.959-.716l3.324-11.223 8.896-3.293c.391-.144.652-.518.652-.937 0-.418-.261-.792-.653-.938z\"/><path fill=\"#FFCC4D\" d=\"M14.347 27.894l-2.314-.856-.9-3.3c-.118-.436-.513-.738-.964-.738-.451 0-.846.302-.965.737l-.9 3.3-2.313.856c-.393.145-.653.52-.653.938 0 .418.26.793.653.938l2.301.853.907 3.622c.112.444.511.756.97.756.459 0 .858-.312.97-.757l.907-3.622 2.301-.853c.393-.144.653-.519.653-.937 0-.418-.26-.793-.653-.937zM10.009 6.231l-2.364-.875-.876-2.365c-.145-.393-.519-.653-.938-.653-.418 0-.792.26-.938.653l-.875 2.365-2.365.875c-.393.146-.653.52-.653.938 0 .418.26.793.653.938l2.365.875.875 2.365c.146.393.52.653.938.653.418 0 .792-.26.938-.653l.875-2.365 2.365-.875c.393-.146.653-.52.653-.938 0-.418-.26-.792-.653-.938z\"/></svg> Your results are ready"),
      subtitle: cfg.subtitle || (rtl ? 'احفظها أو حوّلها لمشروع V3 كامل.' : 'Save them or convert to a full V3 project.'),
      saveText: cfg.saveText || (rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#31373D\" d=\"M4 36s-4 0-4-4V4s0-4 4-4h26c1 0 2 1 2 1l3 3s1 1 1 2v26s0 4-4 4H4z\"/><path fill=\"#55ACEE\" d=\"M5 19v-1s0-2 2-2h21c2 0 2 2 2 2v1H5z\"/><path fill=\"#E1E8ED\" d=\"M5 32.021V19h25v13s0 2-2 2H7c-2 0-2-1.979-2-1.979zM10 3s0-1 1-1h18c1.048 0 1 1 1 1v10s0 1-1 1H11s-1 0-1-1V3zm12 10h5V3h-5v10z\"/></svg> احفظ" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#31373D\" d=\"M4 36s-4 0-4-4V4s0-4 4-4h26c1 0 2 1 2 1l3 3s1 1 1 2v26s0 4-4 4H4z\"/><path fill=\"#55ACEE\" d=\"M5 19v-1s0-2 2-2h21c2 0 2 2 2 2v1H5z\"/><path fill=\"#E1E8ED\" d=\"M5 32.021V19h25v13s0 2-2 2H7c-2 0-2-1.979-2-1.979zM10 3s0-1 1-1h18c1.048 0 1 1 1 1v10s0 1-1 1H11s-1 0-1-1V3zm12 10h5V3h-5v10z\"/></svg> Save"),
      v3Text: cfg.v3Text || (rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#A0041E\" d=\"M1 17l8-7 16 1 1 16-7 8s.001-5.999-6-12-12-6-12-6z\"/><path fill=\"#FFAC33\" d=\"M.973 35s-.036-7.979 2.985-11S15 21.187 15 21.187 14.999 29 11.999 32c-3 3-11.026 3-11.026 3z\"/><circle fill=\"#FFCC4D\" cx=\"8.999\" cy=\"27\" r=\"4\"/><path fill=\"#55ACEE\" d=\"M35.999 0s-10 0-22 10c-6 5-6 14-4 16s11 2 16-4c10-12 10-22 10-22z\"/><path d=\"M26.999 5c-1.623 0-3.013.971-3.641 2.36.502-.227 1.055-.36 1.641-.36 2.209 0 4 1.791 4 4 0 .586-.133 1.139-.359 1.64 1.389-.627 2.359-2.017 2.359-3.64 0-2.209-1.791-4-4-4z\"/><path fill=\"#A0041E\" d=\"M8 28s0-4 1-5 13.001-10.999 14-10-9.001 13-10.001 14S8 28 8 28z\"/></svg> V3" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#A0041E\" d=\"M1 17l8-7 16 1 1 16-7 8s.001-5.999-6-12-12-6-12-6z\"/><path fill=\"#FFAC33\" d=\"M.973 35s-.036-7.979 2.985-11S15 21.187 15 21.187 14.999 29 11.999 32c-3 3-11.026 3-11.026 3z\"/><circle fill=\"#FFCC4D\" cx=\"8.999\" cy=\"27\" r=\"4\"/><path fill=\"#55ACEE\" d=\"M35.999 0s-10 0-22 10c-6 5-6 14-4 16s11 2 16-4c10-12 10-22 10-22z\"/><path d=\"M26.999 5c-1.623 0-3.013.971-3.641 2.36.502-.227 1.055-.36 1.641-.36 2.209 0 4 1.791 4 4 0 .586-.133 1.139-.359 1.64 1.389-.627 2.359-2.017 2.359-3.64 0-2.209-1.791-4-4-4z\"/><path fill=\"#A0041E\" d=\"M8 28s0-4 1-5 13.001-10.999 14-10-9.001 13-10.001 14S8 28 8 28z\"/></svg> V3"),
      shareText: cfg.shareText || (rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#8899A6\" d=\"M15 9l6-6s6-6 12 0 0 12 0 12l-8 8s-6 6-12 0c-1.125-1.125-1.822-2.62-1.822-2.62l3.353-3.348S14.396 18.396 16 20c0 0 3 3 6 0l8-8s3-3 0-6-6 0-6 0l-3.729 3.729s-1.854-1.521-5.646-.354L15 9z\"/><path fill=\"#8899A6\" d=\"M20.845 27l-6 6s-6 6-12 0 0-12 0-12l8-8s6-6 12 0c1.125 1.125 1.822 2.62 1.822 2.62l-3.354 3.349s.135-1.365-1.469-2.969c0 0-3-3-6 0l-8 8s-3 3 0 6 6 0 6 0l3.729-3.729s1.854 1.521 5.646.354l-.374.375z\"/></svg> نسخ الرابط" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#8899A6\" d=\"M15 9l6-6s6-6 12 0 0 12 0 12l-8 8s-6 6-12 0c-1.125-1.125-1.822-2.62-1.822-2.62l3.353-3.348S14.396 18.396 16 20c0 0 3 3 6 0l8-8s3-3 0-6-6 0-6 0l-3.729 3.729s-1.854-1.521-5.646-.354L15 9z\"/><path fill=\"#8899A6\" d=\"M20.845 27l-6 6s-6 6-12 0 0-12 0-12l8-8s6-6 12 0c1.125 1.125 1.822 2.62 1.822 2.62l-3.354 3.349s.135-1.365-1.469-2.969c0 0-3-3-6 0l-8 8s-3 3 0 6 6 0 6 0l3.729-3.729s1.854 1.521 5.646.354l-.374.375z\"/></svg> Copy link"),
      emailText: cfg.emailText || (rtl ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#CCD6DD\" d=\"M36 27c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V9c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v18z\"/><path fill=\"#99AAB5\" d=\"M11.95 17.636L.637 28.949c-.027.028-.037.063-.06.091.34.57.814 1.043 1.384 1.384.029-.023.063-.033.09-.06L13.365 19.05c.39-.391.39-1.023 0-1.414-.392-.391-1.024-.391-1.415 0M35.423 29.04c-.021-.028-.033-.063-.06-.09L24.051 17.636c-.392-.391-1.024-.391-1.415 0s-.391 1.023 0 1.414l11.313 11.314c.026.026.062.037.09.06.571-.34 1.044-.814 1.384-1.384\"/><path fill=\"#99AAB5\" d=\"M32 5H4C1.791 5 0 6.791 0 9v1.03l14.528 14.496c1.894 1.893 4.988 1.893 6.884 0L36 10.009V9c0-2.209-1.791-4-4-4z\"/><path fill=\"#E1E8ED\" d=\"M32 5H4C2.412 5 1.051 5.934.405 7.275l14.766 14.767c1.562 1.562 4.096 1.562 5.657 0L35.595 7.275C34.949 5.934 33.589 5 32 5z\"/><path fill=\"#66757F\" d=\"M15 9.27c0-.73.365-1.27 1-1.27h3.62c.839 0 1.174.49 1.174 1 0 .496-.349 1-1.035 1h-2.708v2h2.533c.716 0 1.065.489 1.065 1 0 .496-.366 1-1.065 1h-2.533v2h2.84c.699 0 1.037.489 1.037 1 0 .496-.353 1-1.037 1h-3.766C15.482 18 15 17.469 15 16.812V9.27z\"/></svg> بريدي" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#CCD6DD\" d=\"M36 27c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V9c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v18z\"/><path fill=\"#99AAB5\" d=\"M11.95 17.636L.637 28.949c-.027.028-.037.063-.06.091.34.57.814 1.043 1.384 1.384.029-.023.063-.033.09-.06L13.365 19.05c.39-.391.39-1.023 0-1.414-.392-.391-1.024-.391-1.415 0M35.423 29.04c-.021-.028-.033-.063-.06-.09L24.051 17.636c-.392-.391-1.024-.391-1.415 0s-.391 1.023 0 1.414l11.313 11.314c.026.026.062.037.09.06.571-.34 1.044-.814 1.384-1.384\"/><path fill=\"#99AAB5\" d=\"M32 5H4C1.791 5 0 6.791 0 9v1.03l14.528 14.496c1.894 1.893 4.988 1.893 6.884 0L36 10.009V9c0-2.209-1.791-4-4-4z\"/><path fill=\"#E1E8ED\" d=\"M32 5H4C2.412 5 1.051 5.934.405 7.275l14.766 14.767c1.562 1.562 4.096 1.562 5.657 0L35.595 7.275C34.949 5.934 33.589 5 32 5z\"/><path fill=\"#66757F\" d=\"M15 9.27c0-.73.365-1.27 1-1.27h3.62c.839 0 1.174.49 1.174 1 0 .496-.349 1-1.035 1h-2.708v2h2.533c.716 0 1.065.489 1.065 1 0 .496-.366 1-1.065 1h-2.533v2h2.84c.699 0 1.037.489 1.037 1 0 .496-.353 1-1.037 1h-3.766C15.482 18 15 17.469 15 16.812V9.27z\"/></svg> Email"),
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
    '<button class="bonds-sticky-fab__main" aria-label="' + cfg.title + "\"><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#FFAC33\" d=\"M34.347 16.893l-8.899-3.294-3.323-10.891c-.128-.42-.517-.708-.956-.708-.439 0-.828.288-.956.708l-3.322 10.891-8.9 3.294c-.393.146-.653.519-.653.938 0 .418.26.793.653.938l8.895 3.293 3.324 11.223c.126.424.516.715.959.715.442 0 .833-.291.959-.716l3.324-11.223 8.896-3.293c.391-.144.652-.518.652-.937 0-.418-.261-.792-.653-.938z\"/><path fill=\"#FFCC4D\" d=\"M14.347 27.894l-2.314-.856-.9-3.3c-.118-.436-.513-.738-.964-.738-.451 0-.846.302-.965.737l-.9 3.3-2.313.856c-.393.145-.653.52-.653.938 0 .418.26.793.653.938l2.301.853.907 3.622c.112.444.511.756.97.756.459 0 .858-.312.97-.757l.907-3.622 2.301-.853c.393-.144.653-.519.653-.937 0-.418-.26-.793-.653-.937zM10.009 6.231l-2.364-.875-.876-2.365c-.145-.393-.519-.653-.938-.653-.418 0-.792.26-.938.653l-.875 2.365-2.365.875c-.393.146-.653.52-.653.938 0 .418.26.793.653.938l2.365.875.875 2.365c.146.393.52.653.938.653.418 0 .792-.26.938-.653l.875-2.365 2.365-.875c.393-.146.653-.52.653-.938 0-.418-.26-.792-.653-.938z\"/></svg></button>";
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
              if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(cfg.lang === 'ar' ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم نسخ الرابط" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> Link copied", 'success');
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
          emailBtn.textContent = cfg.lang === 'ar' ? '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFE8B6" d="M21 18c0-2.001 3.246-3.369 5-6 2-3 2-10 2-10H8s0 7 2 10c1.754 2.631 5 3.999 5 6s-3.246 3.369-5 6c-2 3-2 10-2 10h20s0-7-2-10c-1.754-2.631-5-3.999-5-6z"/><path fill="#FFAC33" d="M18 2h-8s0 4 1 7c1.304 3.912 6 4.999 6 9s0 13 1 13 1-9 1-13 4.697-5.088 6-9c1-3 1-7 1-7h-8z"/><path fill="#3B88C3" d="M30 34c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2s.896-2 2-2h20c1.104 0 2 .896 2 2zm0-32c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2s.896-2 2-2h20c1.104 0 2 .896 2 2z"/></svg> جاري...' : '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFE8B6" d="M21 18c0-2.001 3.246-3.369 5-6 2-3 2-10 2-10H8s0 7 2 10c1.754 2.631 5 3.999 5 6s-3.246 3.369-5 6c-2 3-2 10-2 10h20s0-7-2-10c-1.754-2.631-5-3.999-5-6z"/><path fill="#FFAC33" d="M18 2h-8s0 4 1 7c1.304 3.912 6 4.999 6 9s0 13 1 13 1-9 1-13 4.697-5.088 6-9c1-3 1-7 1-7h-8z"/><path fill="#3B88C3" d="M30 34c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2s.896-2 2-2h20c1.104 0 2 .896 2 2zm0-32c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2s.896-2 2-2h20c1.104 0 2 .896 2 2z"/></svg> Sending...';
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
              if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(cfg.lang === 'ar' ? "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم إرسال الرابط" : "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> Link sent", 'success');
            } else {
              if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(cfg.lang === 'ar' ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> لم نتمكن من الإرسال" : "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> Could not send", 'error');
            }
          }).catch(function() {
            emailBtn.disabled = false;
            emailBtn.textContent = originalText;
            if (window.BondsUI && window.BondsUI.toast) BondsUI.toast(cfg.lang === 'ar' ? "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> خطأ في الشبكة" : "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> Network error", 'error');
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
