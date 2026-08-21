/**
 * BONDS Funding Hub — shared behaviors
 * - Hydrates ECC icons (data-ecc-icon)
 * - Tracks data-track clicks and section views
 * - Sticky mobile CTA
 */
(function () {
  'use strict';

  const isEn = document.documentElement.lang === 'en';
  const DNT = navigator.doNotTrack === '1' || window.doNotTrack === '1';

  /* ---------- ECC icon hydration ---------- */
  function hydrateIcons() {
    if (!window.EccIcons) return;
    document.querySelectorAll('[data-ecc-icon]').forEach(function (el) {
      const name = el.getAttribute('data-ecc-icon');
      if (!name) return;
      const svg = window.EccIcons.get(name);
      if (svg && el.innerHTML.trim() !== svg.trim()) {
        el.innerHTML = svg;
      }
    });
  }

  function ensureIconsAndHydrate() {
    if (window.EccIcons) {
      hydrateIcons();
      return;
    }
    const script = document.createElement('script');
    script.src = '/components/ecc-icons.js';
    script.defer = true;
    script.onload = hydrateIcons;
    document.head.appendChild(script);
  }

  /* ---------- Analytics ---------- */
  function trackEvent(name, params) {
    if (DNT) return;
    const payload = {
      type: 'event',
      name: name,
      data: Object.assign({}, params, {
        page: location.pathname,
        lang: document.documentElement.lang || 'ar',
        url: location.href,
        t: Date.now()
      })
    };

    try {
      if (typeof gtag === 'function') {
        gtag('event', name, params || {});
      }
    } catch (e) { /* noop */ }

    try {
      if (typeof window.dataLayer !== 'undefined') {
        window.dataLayer.push(Object.assign({ event: name }, params || {}));
      }
    } catch (e) { /* noop */ }

    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', JSON.stringify(payload));
      } else {
        fetch('/api/track', {
          method: 'POST',
          body: JSON.stringify(payload),
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) { /* noop */ }
  }

  function attachClickTracking() {
    document.addEventListener('click', function (e) {
      const trigger = e.target.closest('[data-track]');
      if (!trigger) return;
      const name = trigger.getAttribute('data-track');
      if (!name) return;
      let props = {};
      try {
        const raw = trigger.getAttribute('data-track-props');
        if (raw) props = JSON.parse(raw);
      } catch (err) {
        props = {};
      }
      props.href = trigger.getAttribute('href') || '';
      trackEvent(name, props);
    });
  }

  function attachViewTracking() {
    const views = document.querySelectorAll('[data-analytics-view]');
    if (!views.length || !('IntersectionObserver' in window)) return;
    const seen = new Set();
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && !seen.has(entry.target)) {
          seen.add(entry.target);
          trackEvent(entry.target.getAttribute('data-analytics-view'));
        }
      });
    }, { threshold: 0.3 });
    views.forEach(function (el) { observer.observe(el); });
  }

  /* ---------- Sticky CTA ---------- */
  function initStickyCta() {
    const sticky = document.querySelector('.funding-hub__sticky-cta');
    if (!sticky) return;
    let visible = false;
    const showAt = 300;

    function update() {
      const shouldShow = window.scrollY > showAt;
      if (shouldShow === visible) return;
      visible = shouldShow;
      sticky.classList.toggle('is-visible', shouldShow);
    }

    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  /* ---------- Init ---------- */
  function init() {
    ensureIconsAndHydrate();
    attachClickTracking();
    attachViewTracking();
    initStickyCta();
    trackEvent('funding_hub_view');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
