/**
 * Bonds Page Tracker — Standalone (no dependencies)
 * Tracks page views and session duration via /api/track
 */
(function() {
  'use strict';

  // Sentry error tracking (loads if DSN is available)
  const SENTRY_DSN = window.__ENV?.SENTRY_DSN || 'https://623c9a5455e3452ead250190551e8806@o4511546038681600.ingest.us.sentry.io/4511546102054912';
  if (SENTRY_DSN && typeof window.Sentry === 'undefined') {
    try {
      const sentryPublicKey = new URL(SENTRY_DSN).username;
      if (sentryPublicKey) {
        const sentryScript = document.createElement('script');
        sentryScript.src = 'https://js.sentry-cdn.com/' + sentryPublicKey + '.min.js';
        sentryScript.crossOrigin = 'anonymous';
        sentryScript.onload = function() {
          if (window.Sentry) window.Sentry.init({ dsn: SENTRY_DSN, environment: 'production' });
        };
        document.head.appendChild(sentryScript);
      }
    } catch (error) {
      console.warn('[page-tracker] Invalid Sentry DSN; error tracking is disabled.');
    }
  }

  const TRACK_ENDPOINT = '/api/track';
  let sessionStart = Date.now();
  let currentPage = location.pathname;
  let sessionSent = false;

  function getSection() {
    const meta = document.querySelector('meta[name="section"]');
    if (meta) return meta.content;
    // Infer from pathname
    const p = location.pathname;
    if (p.includes('/calculators/') || p.includes('/en/calculators/')) return 'calculator';
    if (p.includes('/blog/')) return 'blog';
    if (p.includes('/admin/')) return 'admin';
    if (p === '/' || p === '/index.html') return 'home';
    if (p === '/calculator.html' || p === '/calculator-v2.html') return 'app';
    if (p === '/about.html' || p === '/en/about.html') return 'about';
    if (p === '/contact.html' || p === '/en/contact.html') return 'contact';
    if (p === '/faq.html' || p === '/en/faq.html') return 'faq';
    if (p === '/pricing.html' || p === '/en/pricing.html') return 'pricing';
    if (p === '/auth-v2.html' || p.includes('auth')) return 'auth';
    return p;
  }

  function send(data) {
    try {
      const payload = JSON.stringify(data);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(TRACK_ENDPOINT, payload);
      } else {
        fetch(TRACK_ENDPOINT, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true
        }).catch(function(){});
      }
    } catch (e) {}
  }

  // Send page view on load
  function trackPageView() {
    send({
      page: currentPage,
      section: getSection(),
      url: location.href,
      referrer: document.referrer || '',
      lang: document.documentElement.lang || '',
      screen: (typeof screen !== 'undefined') ? (screen.width + 'x' + screen.height) : ''
    });
  }

  // Track session duration
  function endSession() {
    if (sessionSent) return;
    sessionSent = true;
    const duration = Math.round((Date.now() - sessionStart) / 1000);
    // Send a special session event
    send({
      page: currentPage,
      section: getSection(),
      url: location.href,
      referrer: document.referrer || '',
      lang: document.documentElement.lang || '',
      screen: (typeof screen !== 'undefined') ? (screen.width + 'x' + screen.height) : '',
      duration_seconds: duration,
      started_at: new Date(sessionStart).toISOString(),
      event: 'session_end'
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackPageView);
  } else {
    trackPageView();
  }

  window.addEventListener('beforeunload', endSession);
  window.addEventListener('pagehide', endSession);

})();
