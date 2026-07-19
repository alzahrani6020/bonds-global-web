/**
 * Bonds V3 — Shared UI utilities
 * Back-to-top button, focus management, reduced motion helpers.
 */
(function () {
  'use strict';

  // Back to top button
  function initBackToTop() {
    let btn = document.getElementById('backToTop');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'backToTop';
      btn.setAttribute('aria-label', 'العودة للأعلى');
      btn.innerHTML = '↑';
      btn.style.cssText = 'position:fixed;bottom:80px;right:20px;width:44px;height:44px;border-radius:50%;background:var(--gold,#d4a853);color:var(--bg,#0a0f1a);border:none;font-size:1.2rem;cursor:pointer;z-index:9999;opacity:0;visibility:hidden;transition:all 0.3s;box-shadow:0 4px 12px rgba(212,168,83,0.4);';
      document.body.appendChild(btn);
    }
    btn.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    window.addEventListener('scroll', function () {
      if (window.scrollY > 400) {
        btn.style.opacity = '1';
        btn.style.visibility = 'visible';
      } else {
        btn.style.opacity = '0';
        btn.style.visibility = 'hidden';
      }
    }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBackToTop);
  } else {
    initBackToTop();
  }
})();
