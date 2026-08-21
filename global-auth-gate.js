// ===== Bonds Global Auth Gate =====
// Allows public browsing of marketing/content pages, but requires login
// before using calculators, intelligence dashboards, admin, client, pro,
// reports, valuation, advisor, or any other protected tool/section.
(function () {
  'use strict';

  const path = window.location.pathname;

  // Public auth/login pages must remain accessible without authentication.
  const PUBLIC_AUTH_PATHS = [
    '/auth.html',
    '/auth-v2.html',
    '/verify.html',
    '/calculators/auth',
    '/calculators/auth/',
    '/en/calculators/auth',
    '/en/calculators/auth/',
    '/client/login.html',
    '/en/client/login.html',
    '/client/funding-case-lookup.html',
    '/en/client/funding-case-lookup.html',
    '/pro/login.html'
  ];

  // Protected sections/tools that require login.
  const PROTECTED_PATHS = [
    '/calculators/',
    '/en/calculators/',
    '/v3/',
    '/en/v3/',
    '/admin/',
    '/en/admin/',
    '/client/',
    '/en/client/',
    '/pro/',
    '/reports/',
    '/en/reports/',
    '/valuation/',
    '/en/valuation/',
    '/advisor/',
    '/en/advisor/',
    '/wave4/',
    '/en/wave4/',
    '/calculator-wizard',
    '/calculator-v2',
    '/en/calculator-wizard',
    '/en/calculator-v2'
  ];

  function isPublicAuthPage() {
    return PUBLIC_AUTH_PATHS.some(function (p) {
      return path === p || path.startsWith(p);
    });
  }

  function isProtectedPage() {
    return PROTECTED_PATHS.some(function (p) {
      return path === p || path.startsWith(p);
    });
  }

  // Public pages (homepage, about, services, blog, pricing, etc.) are allowed.
  if (isPublicAuthPage() || !isProtectedPage()) return;

  const TOKEN_KEY = 'bonds-auth-token';
  let redirectTimer = null;

  function getStoredToken() {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  function redirectToLogin() {
    const returnPath = window.location.pathname + window.location.search + window.location.hash;
    const returnUrl = encodeURIComponent(returnPath);
    const isEn = path.startsWith('/en/');
    const loginUrl = isEn ? '/en/calculators/auth/?redirect=' + returnUrl : '/calculators/auth/?redirect=' + returnUrl;
    window.location.replace(loginUrl);
  }

  function cancelPendingRedirect() {
    if (redirectTimer) {
      clearTimeout(redirectTimer);
      redirectTimer = null;
    }
  }

  async function waitForBondsAuth(maxMs) {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      if (window.BondsAuth && window.BondsAuth.getSession && window.BondsAuth.getUser) {
        return true;
      }
      await new Promise(function (resolve) { setTimeout(resolve, 100); });
    }
    return !!(window.BondsAuth && window.BondsAuth.getSession && window.BondsAuth.getUser);
  }

  async function hasValidSession() {
    const ok = await waitForBondsAuth(6000);
    if (!ok) return false;

    const B = window.BondsAuth;
    try {
      // Fast path: recover from localStorage first (also refreshes an expired access token)
      const { data: sessionData } = await B.getSession();
      if (sessionData?.session?.user) return true;

      // Fallback: validate with the server
      const { data: userData } = await B.getUser();
      return !!userData?.user;
    } catch (e) {
      return false;
    }
  }

  async function enforce() {
    const token = getStoredToken();
    if (!token) {
      redirectToLogin();
      return;
    }

    // Try several times: the auth library and session recovery can race on first load.
    let attempts = 0;
    const maxAttempts = 4;
    while (attempts < maxAttempts) {
      const ok = await hasValidSession();
      if (ok) {
        cancelPendingRedirect();
        return;
      }
      attempts++;
      if (attempts < maxAttempts) {
        await new Promise(function (resolve) { setTimeout(resolve, 800); });
      }
    }

    redirectToLogin();
  }

  // If another tab/page recovers the session, abort the redirect.
  window.addEventListener('bonds:session-recovered', function (e) {
    if (e.detail?.session?.user) {
      cancelPendingRedirect();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforce);
  } else {
    enforce();
  }
})();
