/**
 * BONDS Global — Shared page behaviors
 *
 * Responsibilities:
 * - Animate stat counters when they scroll into view
 * - Reveal animations for .reveal elements
 * - Header scroll state
 * - Scroll progress bar
 * - Hero particle canvas (if present)
 * - Current year in footer #y
 *
 * Theme toggle and mobile nav are handled by site-layout.js to avoid duplication.
 */
(function () {
  'use strict';

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Header scroll state ---------- */
  const header = document.getElementById('header');
  if (header) {
    let ticking = false;
    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        header.classList.toggle('scrolled', window.scrollY > 20);
        ticking = false;
      });
    }, { passive: true });
  }

  /* ---------- Scroll progress bar ---------- */
  const progress = document.createElement('div');
  progress.id = 'scrollProgress';
  document.body.appendChild(progress);

  let progressTicking = false;
  function updateScrollProgress() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + '%' : '0%';
  }
  window.addEventListener('scroll', function () {
    if (progressTicking) return;
    progressTicking = true;
    requestAnimationFrame(function () {
      updateScrollProgress();
      progressTicking = false;
    });
  }, { passive: true });
  updateScrollProgress();

  /* ---------- Stat counters ---------- */
  function animateCounter(el) {
    const target = parseInt(el.getAttribute('data-target'), 10);
    if (isNaN(target)) return;
    const suffix = el.getAttribute('data-suffix') || '';
    const prefix = el.getAttribute('data-prefix') || '';

    if (prefersReducedMotion) {
      el.textContent = prefix + target.toLocaleString('en') + suffix;
      return;
    }

    const start = performance.now();
    const duration = 1800;

    function step(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const value = Math.round(target * eased);
      el.textContent = prefix + value.toLocaleString('en') + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  const counters = document.querySelectorAll('.stat-num[data-target]');
  if (counters.length && 'IntersectionObserver' in window) {
    const counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          animateCounter(entry.target);
          counterObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(function (c) { counterObserver.observe(c); });
  }

  /* ---------- Reveal on scroll ---------- */
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (r) { revealObserver.observe(r); });
  }

  /* ---------- Current year ---------- */
  const yearEl = document.getElementById('y');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- Hero particles canvas ---------- */
  const hero = document.querySelector('.hero');
  if (hero && !prefersReducedMotion) {
    const canvas = document.createElement('canvas');
    canvas.id = 'particlesCanvas';
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    hero.insertBefore(canvas, hero.firstChild);
    const ctx = canvas.getContext('2d');
    const particles = [];
    const count = window.innerWidth < 768 ? 30 : 60;

    function resizeCanvas() {
      canvas.width = hero.offsetWidth;
      canvas.height = hero.offsetHeight;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: 0.3 * (Math.random() - 0.5),
        vy: 0.3 * (Math.random() - 0.5),
        size: 2 * Math.random() + 1,
        color: Math.random() > 0.5 ? 'rgba(212,168,83,' : 'rgba(59,130,246,',
        opacity: 0.5 * Math.random() + 0.2
      });
    }

    (function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(function (p) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, 2 * Math.PI);
        ctx.fillStyle = p.color + p.opacity + ')';
        ctx.fill();
      });
      requestAnimationFrame(draw);
    })();
  }

  /* ---------- Service Worker update notification (zero perf impact) ---------- */
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.addEventListener('message', function (event) {
      if (event.data && event.data.type === 'SW_ACTIVATED') {
        showUpdateBanner();
      }
    });
  }

  function showUpdateBanner() {
    if (document.getElementById('bonds-sw-update-banner')) return;

    const isEn = document.documentElement.lang === 'en';
    const banner = document.createElement('div');
    banner.id = 'bonds-sw-update-banner';
    banner.setAttribute('role', 'status');
    banner.setAttribute('aria-live', 'polite');
    banner.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'right:0',
      'z-index:2147483647',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'gap:12px',
      'padding:10px 16px',
      'font-family:inherit',
      'font-size:14px',
      'line-height:1.4',
      'color:#0a0f1a',
      'background:linear-gradient(90deg,#f0c96a,#d4a853)',
      'box-shadow:0 4px 12px rgba(0,0,0,0.25)',
      'direction:' + (isEn ? 'ltr' : 'rtl')
    ].join(';');

    banner.innerHTML =
      '<span>' + (isEn ? 'A new version is available.' : 'يتوفر إصدار جديد من الموقع.') + '</span>' +
      '<button id="bonds-sw-update-btn" type="button" style="padding:4px 12px;border:0;border-radius:6px;background:#0a0f1a;color:#f0c96a;font-weight:700;cursor:pointer;">' +
      (isEn ? 'Update' : 'تحديث') +
      '</button>' +
      '<button id="bonds-sw-update-dismiss" type="button" aria-label="' + (isEn ? 'Dismiss' : 'تجاهل') + '" style="margin-' + (isEn ? 'left' : 'right') + ':8px;padding:0 4px;border:0;background:transparent;color:#0a0f1a;font-size:18px;line-height:1;cursor:pointer;">×</button>';

    banner.querySelector('#bonds-sw-update-btn').addEventListener('click', function () {
      window.location.reload();
    });
    banner.querySelector('#bonds-sw-update-dismiss').addEventListener('click', function () {
      banner.remove();
    });

    document.body.appendChild(banner);
  }

  /* ---------- Core Web Vitals monitoring ---------- */
  (function observeWebVitals() {
    if (!window.PerformanceObserver) return;

    const metrics = {};

    function sendMetrics() {
      if (!navigator.sendBeacon) return;
      const payload = JSON.stringify({
        type: 'web-vitals',
        url: location.href,
        metrics: metrics
      });
      navigator.sendBeacon('/api/track', payload);
    }

    // LCP
    try {
      new PerformanceObserver(function (list) {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          metrics.lcp = Math.round(last.startTime);
          sendMetrics();
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) { /* ignore */ }

    // CLS
    let clsValue = 0;
    try {
      new PerformanceObserver(function (list) {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) clsValue += entry.value;
        }
        metrics.cls = Math.round(clsValue * 1000) / 1000;
      }).observe({ entryTypes: ['layout-shift'] });
      window.addEventListener('beforeunload', sendMetrics);
    } catch (e) { /* ignore */ }

    // FID / INP
    try {
      new PerformanceObserver(function (list) {
        const first = list.getEntries()[0];
        if (first) {
          metrics.fid = Math.round(first.processingStart - first.startTime);
          sendMetrics();
        }
      }).observe({ entryTypes: ['first-input'] });
    } catch (e) { /* ignore */ }
  })();

  /* ---------- Lightweight loading indicator ---------- */
  (function loadingIndicator() {
    const style = document.createElement('style');
    style.textContent = '#bondsLoadingIndicator{position:fixed;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;background:rgba(10,15,26,0.55);backdrop-filter:blur(2px);z-index:9999;opacity:0;visibility:hidden;transition:opacity .18s,visibility .18s;pointer-events:none}#bondsLoadingIndicator.visible{opacity:1;visibility:visible;pointer-events:auto}#bondsLoadingIndicator .spinner{width:44px;height:44px;border:3px solid rgba(212,168,83,0.2);border-top-color:var(--gold);border-radius:50%;animation:bondsSpin .75s linear infinite}@keyframes bondsSpin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);

    const wrap = document.createElement('div');
    wrap.id = 'bondsLoadingIndicator';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(wrap);

    let shown = false;
    function show() {
      if (shown) return;
      shown = true;
      wrap.classList.add('visible');
    }
    function hide() {
      shown = false;
      wrap.classList.remove('visible');
    }

    window.BondsLoading = { show: show, hide: hide };

    function isInternalLink(a) {
      if (!a || !a.href) return false;
      if (a.getAttribute('href') && a.getAttribute('href').startsWith('#')) return false;
      if (a.getAttribute('target') === '_blank') return false;
      if (a.href.match(/^mailto:|^tel:|^javascript:/i)) return false;
      try {
        return new URL(a.href).origin === window.location.origin;
      } catch (e) {
        return false;
      }
    }

    document.addEventListener('click', function (e) {
      const a = e.target.closest('a');
      if (isInternalLink(a)) show();
    });

    window.addEventListener('pageshow', hide);
    window.addEventListener('pagehide', hide);
    document.addEventListener('DOMContentLoaded', hide);
  })();

  /* ---------- Site version indicator (async, for debugging only) ---------- */
  (function loadSiteVersion() {
    if (!('fetch' in window)) return;
    fetch('/sw.js', { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (text) {
        const match = text.match(/const\s+CACHE_VERSION\s*=\s*['"]([^'"]+)['"];/);
        const version = match ? match[1] : 'unknown';
        let meta = document.querySelector('meta[name="bonds-version"]');
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', 'bonds-version');
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', version);
        window.BONDS_VERSION = version;
      })
      .catch(function () { /* silent fail — this is debugging metadata only */ });
  })();
})();
