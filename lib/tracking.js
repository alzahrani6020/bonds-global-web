/**
 * Bonds Universal Visitor Tracking
 * Tracks presence, page views, and user journey for the Online Users dashboard.
 */
(function () {
  'use strict';

  if (window.__BONDS_TRACKING__) return;
  window.__BONDS_TRACKING__ = true;

  const HEARTBEAT_INTERVAL = 30000; // 30 seconds
  const HEARTBEAT_ENDPOINT = '/api/site?action=heartbeat';
  const LEAVE_ENDPOINT = '/api/site?action=heartbeat-leave';

  function generateSessionId() {
    return 'bs_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-6);
  }

  function getSessionId() {
    try {
      let sid = sessionStorage.getItem('bonds_session_id');
      if (!sid) {
        sid = generateSessionId();
        sessionStorage.setItem('bonds_session_id', sid);
      }
      return sid;
    } catch (e) {
      return generateSessionId();
    }
  }

  let cachedUserId = null;

  async function resolveUserId() {
    if (cachedUserId) return cachedUserId;
    try {
      if (window.BondsAuth && window.BondsAuth.getUser) {
        const result = await window.BondsAuth.getUser();
        if (result?.data?.user?.id) {
          cachedUserId = result.data.user.id;
          return cachedUserId;
        }
      }
      const sb = window.supabaseClient || (window.supabase && window.supabase.client);
      if (sb && sb.auth) {
        const { data } = await sb.auth.getSession();
        if (data?.session?.user?.id) {
          cachedUserId = data.session.user.id;
          return cachedUserId;
        }
      }
    } catch (e) {}
    return null;
  }

  function getUserId() {
    return cachedUserId;
  }

  function getSection() {
    const meta = document.querySelector('meta[name="section"]');
    if (meta) return meta.content;
    const p = location.pathname;
    if (p.includes('/admin/')) return 'admin';
    if (p.includes('/v3/')) return 'v3';
    if (p.includes('/calculators/') || p.includes('/en/calculators/')) return 'calculator';
    if (p.includes('/blog/')) return 'blog';
    if (p === '/' || p === '/index.html') return 'home';
    if (p === '/calculator.html' || p === '/calculator-v2.html') return 'app';
    if (p.includes('/about')) return 'about';
    if (p.includes('/contact')) return 'contact';
    if (p.includes('/faq')) return 'faq';
    if (p.includes('/pricing')) return 'pricing';
    if (p.includes('auth')) return 'auth';
    return p;
  }

  function buildPayload(event) {
    return {
      session_id: getSessionId(),
      user_id: getUserId(),
      page: location.pathname,
      section: getSection(),
      url: location.href,
      referrer: document.referrer || '',
      lang: document.documentElement.lang || '',
      screen: (typeof screen !== 'undefined') ? (screen.width + 'x' + screen.height) : '',
      user_agent: navigator.userAgent || '',
      event: event || 'heartbeat',
      started_at: window.__BONDS_SESSION_START__ || new Date().toISOString()
    };
  }

  function send(endpoint, data) {
    try {
      const payload = JSON.stringify(data);
      if (navigator.sendBeacon) {
        // Blob ensures the server receives Content-Type: application/json
        navigator.sendBeacon(endpoint, new Blob([payload], { type: 'application/json' }));
      } else {
        fetch(endpoint, {
          method: 'POST',
          body: payload,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {
      // Silent fail — tracking must not break user experience
    }
  }

  async function trackView() {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    await resolveUserId();
    send(HEARTBEAT_ENDPOINT, buildPayload('view'));
  }

  async function heartbeat() {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    await resolveUserId();
    send(HEARTBEAT_ENDPOINT, buildPayload('heartbeat'));
  }

  function trackLeave() {
    if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;
    const started = window.__BONDS_SESSION_START__ ? new Date(window.__BONDS_SESSION_START__).getTime() : Date.now();
    const duration = Math.round((Date.now() - started) / 1000);
    const payload = buildPayload('leave');
    payload.duration_seconds = duration;
    send(LEAVE_ENDPOINT, payload);
  }

  window.__BONDS_SESSION_START__ = window.__BONDS_SESSION_START__ || new Date().toISOString();

  // Pre-resolve user id as early as possible
  resolveUserId();

  // Initial view
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackView);
  } else {
    trackView();
  }

  // Heartbeat while active
  setInterval(function () {
    if (document.visibilityState !== 'hidden') heartbeat();
  }, HEARTBEAT_INTERVAL);

  // Track navigation within SPA-like pages or hash changes
  let lastPath = location.pathname + location.hash;
  function checkNavigation() {
    const current = location.pathname + location.hash;
    if (current !== lastPath) {
      lastPath = current;
      trackView();
    }
  }
  window.addEventListener('popstate', checkNavigation);
  window.addEventListener('hashchange', checkNavigation);

  // Periodically check for pushState/replaceState changes
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  history.pushState = function () {
    originalPushState.apply(this, arguments);
    setTimeout(checkNavigation, 50);
  };
  history.replaceState = function () {
    originalReplaceState.apply(this, arguments);
    setTimeout(checkNavigation, 50);
  };

  // Leave events
  window.addEventListener('beforeunload', trackLeave);
  window.addEventListener('pagehide', trackLeave);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') heartbeat();
  });

  // Re-resolve user id once auth is ready (for pages where BondsAuth loads after tracking)
  window.addEventListener('admin-auth-ready', function () {
    resolveUserId();
  });
  window.addEventListener('bonds-auth-ready', function () {
    resolveUserId();
  });
})();
