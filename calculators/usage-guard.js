/**
 * Bonds Global — Usage Guard System
 * Enforces free usage limits dynamically from site_settings
 */

(function() {
  'use strict';

  let GLOBAL_LIMITS = { calc: 3, feas: 1 };

  function getCalcName() {
    const path = location.pathname;
    if (path.includes('/feasibility') && !path.includes('template')) return 'feasibility';
    const m = path.match(/\/calculators\/([^/]+)\.html/);
    return m ? m[1] : 'unknown';
  }

  function getLocalKey(calc) {
    return 'bonds_uses_' + calc;
  }

  function getLocalUses(calc) {
    return parseInt(localStorage.getItem(getLocalKey(calc)) || '0', 10);
  }

  function setLocalUses(calc, n) {
    localStorage.setItem(getLocalKey(calc), String(n));
  }

  async function getUserId() {
    try {
      if (window.BondsAuth && window.BondsAuth.getSession) {
        const s = await window.BondsAuth.getSession();
        if (s?.session?.user?.id) return s.session.user.id;
      }
      if (window.supabaseClient) {
        const { data } = await window.supabaseClient.auth.getSession();
        if (data?.session?.user?.id) return data.session.user.id;
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

  async function checkServer(calc, userId) {
    try {
      const url = '/api/usage?action=check&calculator=' + encodeURIComponent(calc);
      const res = await fetch(url + (userId ? '&userId=' + userId : ''));
      if (!res.ok) return null;
      return await res.json();
    } catch(e) { return null; }
  }

  function showBlockOverlay(calc, isFeas) {
    if (document.getElementById('bonds-usage-block')) return;

    const title = isFeas ? '🔒 دراسة الجدوى' : '🔒 هذه الحاسبة';
    const msg = isFeas
      ? 'لقد استخدمت دراسة الجدوى المجانية. التفعيل يتطلب اشتراك.'
      : 'لقد استنفدت محاولاتك المجانية. التفعيل يتطلب اشتراك.';

    const overlay = document.createElement('div');
    overlay.id = 'bonds-usage-block';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,26,0.85);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    overlay.innerHTML = `
      <div style="background:linear-gradient(135deg, #141c2f 0%, #0f1729 100%);border:1px solid rgba(212,168,83,0.2);border-radius:24px;max-width:420px;width:100%;padding:2.5rem;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg, #d4a853, #c8a45c, #d4a853);"></div>
        <div style="font-size:4rem;margin-bottom:1rem;filter:drop-shadow(0 4px 12px rgba(212,168,83,0.3));">🔒</div>
        <h2 style="font-family:'Vazirmatn',system-ui;font-size:1.5rem;font-weight:800;color:#d4a853;margin-bottom:1rem;">${title}</h2>
        <p style="color:#94a3b8;font-size:1rem;line-height:1.8;margin-bottom:2rem;">${msg}</p>
        <a href="/pricing.html" style="display:inline-block;background:linear-gradient(135deg, #d4a853, #c8a45c);color:#0a0f1a;padding:1rem 2.5rem;border-radius:14px;text-decoration:none;font-weight:800;font-size:1.05rem;transition:all 0.3s;box-shadow:0 4px 20px rgba(212,168,83,0.3);">💎 ترقية الاشتراك</a>
        <p style="color:#64748b;font-size:0.8rem;margin-top:1.5rem;">Pro: ${isFeas ? 1 : GLOBAL_LIMITS.calc} مجانية ثم اشتراك</p>
      </div>
    `;
    document.body.appendChild(overlay);
  }

  async function enforceLimit() {
    const calc = getCalcName();
    if (calc === 'unknown' || calc === 'dashboard') return;

    await fetchLimits();
    const isFeas = calc === 'feasibility';
    const limit = isFeas ? GLOBAL_LIMITS.feas : GLOBAL_LIMITS.calc;
    const userId = await getUserId();

    const server = await checkServer(calc, userId);
    if (server?.admin) return; // Admins bypass all limits
    if (server) {
      if (!server.allowed) { showBlockOverlay(calc, isFeas); return; }
      if (server.used > getLocalUses(calc)) setLocalUses(calc, server.used);
    }

    const localUses = getLocalUses(calc);
    if (localUses >= limit && !server?.allowed) {
      showBlockOverlay(calc, isFeas);
      return;
    }

    // DO NOT increment on page load — only when user actually calculates
    // setLocalUses(calc, localUses + 1);
    if (userId) {
      fetch('/api/usage?action=log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, calculator: calc }),
      }).catch(() => {});
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enforceLimit);
  } else {
    enforceLimit();
  }
})();
