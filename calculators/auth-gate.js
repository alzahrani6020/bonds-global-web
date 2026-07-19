// ===== Bonds Calculator Auth Gate =====
// Redirects anonymous visitors to the login page before they can use
// calculators or other protected tools. Marketing pages (homepage, blog,
// about, contact, pricing) should NOT load this script.
(function () {
  'use strict';

  // Never gate the auth pages themselves
  const path = window.location.pathname;
  const publicAuthPaths = [
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

  // Check for a stored session token (synchronous gate to avoid flash of content)
  const hasToken = !!window.localStorage.getItem('bonds-auth-token');
  if (hasToken) return;

  // No token: redirect to login, preserving the intended destination
  const returnUrl = encodeURIComponent(window.location.href);
  window.location.replace('/calculators/auth/?redirect=' + returnUrl);
})();
