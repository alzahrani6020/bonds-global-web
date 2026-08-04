// ===== Bonds Calculator Auth Gate =====
// Redirects anonymous visitors to the login page before they can use
// calculators or other protected tools. Marketing pages (homepage, blog,
// about, contact, pricing) should NOT load this script.
(function () {
  'use strict';

  // Never gate the auth pages themselves
  const path = window.location.pathname;
  const publicAuthPaths = [
    '/calculators/auth',
    '/calculators/auth/',
    '/calculators/auth/index.html',
    '/calculators/auth/confirmed.html',
    '/calculators/auth/verify-otp.html',
    '/calculators/auth/verify-email.html',
    '/calculators/auth/onboarding.html',
    '/calculators/auth/profile.html',
    '/calculators/auth/account.html',
    '/calculators/auth/subscription.html',
    '/calculators/auth/diagnose.html',
    '/calculators/auth/debug.html',
    '/en/calculators/auth',
    '/en/calculators/auth/',
    '/en/calculators/auth/index.html',
    '/en/calculators/auth/confirmed.html',
    '/en/calculators/auth/verify-otp.html',
    '/en/calculators/auth/verify-email.html',
    '/en/calculators/auth/onboarding.html',
    '/en/calculators/auth/profile.html',
    '/en/calculators/auth/account.html',
    '/en/calculators/auth/subscription.html'
  ];

  if (publicAuthPaths.some(function (p) { return path === p || path.startsWith(p); })) {
    return;
  }

  const TOKEN_KEY = 'bonds-auth-token';
  const REDIRECT_URL = '/calculators/auth/?redirect=' + encodeURIComponent(window.location.href);

  function getStoredToken() {
    try {
      return window.localStorage.getItem(TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  // Fast path: a stored token means the user is (almost certainly) logged in.
  if (!!getStoredToken()) {
    return;
  }

  // If the URL carries OAuth/magic-link tokens, Supabase needs a moment to
  // extract them and persist the session. Don't redirect immediately.
  const search = window.location.search || '';
  const looksLikeOAuthCallback = /[?&](code=|access_token=|refresh_token=|type=|redirect=)/.test(search);

  function redirectToLogin() {
    window.location.replace(REDIRECT_URL);
  }

  // Try to recover the session asynchronously. This prevents false logouts when
  // the token hasn't been written to localStorage yet (race on navigation) or
  // when the session is being extracted from the URL after OAuth/magic link.
  function tryRecoverSession() {
    return new Promise(function (resolve) {
      // If BondsAuth is already loaded, ask it for the session.
      if (window.BondsAuth && typeof window.BondsAuth.getSession === 'function') {
        window.BondsAuth.getSession()
          .then(function (result) {
            resolve(!!(result && result.data && result.data.session));
          })
          .catch(function () {
            resolve(false);
          });
        return;
      }

      // Otherwise wait a short moment for the auth library to load, then check
      // localStorage again (Supabase writes the token there once initialized).
      var attempts = 0;
      var maxAttempts = looksLikeOAuthCallback ? 50 : 30; // up to ~2.5s for OAuth, ~1.5s otherwise
      var interval = setInterval(function () {
        attempts++;
        if (getStoredToken()) {
          clearInterval(interval);
          resolve(true);
          return;
        }
        if (window.BondsAuth && typeof window.BondsAuth.getSession === 'function') {
          clearInterval(interval);
          window.BondsAuth.getSession()
            .then(function (result) {
              resolve(!!(result && result.data && result.data.session));
            })
            .catch(function () {
              resolve(false);
            });
          return;
        }
        if (attempts >= maxAttempts) {
          clearInterval(interval);
          resolve(false);
        }
      }, 50);
    });
  }

  tryRecoverSession().then(function (hasSession) {
    if (!hasSession) {
      redirectToLogin();
    }
  });
})();
