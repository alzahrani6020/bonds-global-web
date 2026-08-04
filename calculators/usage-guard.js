// ===== Bonds Usage Guard (Passive) =====
// Displays a banner instead of blocking the page.
// Actual blocking happens server-side in API.

(function() {
  'use strict';

  let GLOBAL_LIMITS = { calc: 3, feas: 1 };

  function getAuthToken() {
    try { return localStorage.getItem('bonds-auth-token') || ''; } catch(e) { return ''; }
  }

  async function getUserId() {
    try {
      if (window.BondsAuth && window.BondsAuth.getSession) {
        const s = await window.BondsAuth.getSession();
        if (s?.session?.user?.id) return s.session.user.id;
      }
    } catch(e) {}
    return null;
  }

  async function fetchLimits() {
    try {
      const res = await fetch('/api/usage?action=settings');
      if (res.ok) {
        const data = await res.json();
        GLOBAL_LIMITS.calc = data.calc_limit || 3;
        GLOBAL_LIMITS.feas = data.feas_limit || 1;
      }
    } catch(e) {}
  }

  async function checkUserTier(userId) {
    try {
      const token = getAuthToken();
      const res = await fetch('/api/usage?action=check&calculator=restaurant' + (userId ? '&userId=' + userId : ''), {
        headers: token ? { 'Authorization': 'Bearer ' + token } : {}
      });
      if (!res.ok) return null;
      return await res.json();
    } catch(e) { return null; }
  }

  function showBanner(msg) {
    if (document.getElementById('bonds-usage-banner')) return;
    const div = document.createElement('div');
    div.id = 'bonds-usage-banner';
    div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:99999;background:rgba(212,168,83,0.12);border-bottom:1px solid var(--gold);color:var(--gold);text-align:center;padding:0.6rem;font-size:0.85rem;font-weight:700;';
    div.innerHTML = msg + ' <a href="/pricing.html" style="color:#f0c96a;text-decoration:underline;">ترقية الاشتراك</a>';
    document.body.appendChild(div);
  }

  async function init() {
    await fetchLimits();
    const userId = await getUserId();
    const server = await checkUserTier(userId);

    // Admins and paid users: no banner
    if (server?.admin || server?.tier === 'pro' || server?.tier === 'enterprise') return;

    // Free users: show remaining uses banner
    const calc = location.pathname.includes('feasibility') ? 'feasibility' : 'calc';
    const limit = calc === 'feasibility' ? GLOBAL_LIMITS.feas : GLOBAL_LIMITS.calc;
    const used = server?.used || 0;
    const remaining = Math.max(0, limit - used);

    if (remaining === 0) {
      showBanner("<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z\"/><path d=\"M12 9v4\"/><path d=\"M12 17h.01\"/></svg> لقد استنفدت محاولاتك المجانية.");
    } else if (remaining <= 2) {
      showBanner("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#FFAC33\" d=\"M32.938 15.651C32.792 15.26 32.418 15 32 15H19.925L26.89 1.458c.219-.426.106-.947-.271-1.243C26.437.071 26.218 0 26 0c-.233 0-.466.082-.653.243L18 6.588 3.347 19.243c-.316.273-.43.714-.284 1.105S3.582 21 4 21h12.075L9.11 34.542c-.219.426-.106.947.271 1.243.182.144.401.215.619.215.233 0 .466-.082.653-.243L18 29.412l14.653-12.655c.317-.273.43-.714.285-1.106z\"/></svg> تبقت " + remaining + ' محاول' + (remaining === 1 ? 'ة' : 'ات') + ' مجانية.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
