// ===== Bonds Usage Guard (Passive) =====
// Displays a banner instead of blocking the page.
// Actual blocking happens server-side in API.

(function() {
  'use strict';

  let GLOBAL_LIMITS = { calc: 3, feas: 1 };

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
      const res = await fetch('/api/usage?action=check&calculator=restaurant' + (userId ? '&userId=' + userId : ''));
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
    // Marketing period: calculators are free; no usage banner is shown.
    return;

    // await fetchLimits();
    // const userId = await getUserId();
    // const server = await checkUserTier(userId);
    //
    // // Admins and paid users: no banner
    // if (server?.admin || server?.tier === 'pro' || server?.tier === 'enterprise') return;
    //
    // // Free users: show remaining uses banner
    // const calc = location.pathname.includes('feasibility') ? 'feasibility' : 'calc';
    // const limit = calc === 'feasibility' ? GLOBAL_LIMITS.feas : GLOBAL_LIMITS.calc;
    // const used = server?.used || 0;
    // const remaining = Math.max(0, limit - used);
    //
    // if (remaining === 0) {
    //   showBanner('⚠️ لقد استنفدت محاولاتك المجانية.');
    // } else if (remaining <= 2) {
    //   showBanner('⚡ تبقت ' + remaining + ' محاول' + (remaining === 1 ? 'ة' : 'ات') + ' مجانية.');
    // }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
