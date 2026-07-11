// ===== Bonds Unified Auth System =====
// Replaces: supabase-client.js + auth-guard.js + admin-auth-v2.js
// Usage: <script src="/bonds-auth.js"></script> (after /api/env and supabase library)

(function() {
  'use strict';

  const SUPABASE_URL = window.__ENV?.SUPABASE_URL || '';
  const SUPABASE_KEY = window.__ENV?.SUPABASE_ANON_KEY || '';
  const ADMIN_EMAIL = window.__ENV?.ADMIN_EMAIL || '';
  let _supabase = null;

  function getSupabase() {
    if (_supabase) return _supabase;
    if (typeof supabase === 'undefined') return null;
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      // Missing env config (e.g. local dev without .env); gracefully degrade auth features
      return null;
    }
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
    return _supabase;
  }

  // ── Auth helpers ──────────────────────────────────────────
  async function getUser() {
    const sb = getSupabase();
    if (!sb) return { data: { user: null }, error: new Error('Not initialized') };
    return sb.auth.getUser();
  }

  async function getSession() {
    const sb = getSupabase();
    if (!sb) return { data: { session: null }, error: new Error('Not initialized') };
    return sb.auth.getSession();
  }

  function decodeJwtAal(token) {
    try {
      const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
      const payload = JSON.parse(atob(padded));
      return payload.aal || 'aal1';
    } catch (e) {
      return 'aal1';
    }
  }

  async function checkAdminMfa(token) {
    try {
      const aal = decodeJwtAal(token);
      const enforceMfa = window.__ENV?.ADMIN_ENFORCE_MFA === 'true';
      if (enforceMfa && aal !== 'aal2') {
        return { ok: false, aal };
      }
      return { ok: true };
    } catch (e) {
      return { ok: true };
    }
  }

  async function getProfile(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return { data: null, error: new Error('Not initialized') };
    return sb.from('profiles').select('*').eq('id', userId).single();
  }

  async function updateProfile(userId, fields) {
    const sb = getSupabase();
    if (!sb || !userId) return { data: null, error: new Error('Not initialized') };
    const payload = { ...fields, id: userId, updated_at: new Date().toISOString() };
    return sb.from('profiles').upsert(payload, { onConflict: 'id' });
  }

  async function getSubscription(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return { data: null, error: new Error('Not initialized') };
    return sb.from('subscriptions').select('*').eq('user_id', userId).single();
  }

  async function getAdminRole(userId) {
    const sb = getSupabase();
    if (!sb || !userId) return { data: null, error: new Error('Not initialized') };
    return sb.from('admin_roles').select('role').eq('user_id', userId).single();
  }

  function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('redirect');
    const fallback = (typeof window !== 'undefined' && window.location ? window.location.origin : '') + '/calculator.html';
    if (fromParam) {
      try { sessionStorage.setItem('auth_redirect', fromParam); } catch(e) {}
      return fromParam;
    }
    try {
      let stored = sessionStorage.getItem('auth_redirect');
      if (stored) {
        try { stored = decodeURIComponent(stored); } catch(e) {}
      }
      if (stored && stored.startsWith('/') && !stored.startsWith('//')) {
        stored = (typeof window !== 'undefined' && window.location ? window.location.origin : '') + stored;
      }
      return stored || fallback;
    } catch(e) { return fallback; }
  }

  function clearRedirectUrl() {
    sessionStorage.removeItem('auth_redirect');
  }

  // ── Phone validation helpers ──────────────────────────────
  function normalizePhone(phone) {
    return String(phone || '').replace(/[\s\-\(\)\.]*/g, '');
  }

  function isValidPhone(phone, country) {
    const p = normalizePhone(phone);
    if (!p) return false;
    if (country === 'SA') {
      return /^(05\d{8}|\+9665\d{8}|9665\d{8})$/.test(p);
    }
    // International / local: optional + or leading 0, 7-15 significant digits
    return /^(\+|0{0,2})?[1-9]\d{6,14}$/.test(p);
  }

  async function signUp(email, password, metadata) {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.signUp({ email, password, options: { data: metadata || {}, emailRedirectTo: 'https://bonds-global.com/calculators/auth/confirmed.html' } });
  }

  async function signIn(email, password) {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.signInWithPassword({ email, password });
  }

  async function signInWithOTP(email, options) {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.signInWithOtp({ email, options: options || {} });
  }

  async function verifyOTP(email, token, type) {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.verifyOtp({ email, token, type: type || 'email' });
  }

  async function updateUser(attributes) {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.updateUser(attributes || {});
  }

  function normalizeUrl(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    const origin = (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://bonds-global.com');
    return origin + (url.startsWith('/') ? url : '/' + url);
  }

  async function signInWithOAuth(provider, options) {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    const redirectTo = normalizeUrl(options?.redirectTo) || 'https://bonds-global.com/calculators/auth/confirmed.html';
    return sb.auth.signInWithOAuth({ provider, options: { ...(options || {}), redirectTo } });
  }

  async function resendConfirmation(email) {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.resend({ email, type: 'signup' });
  }

  async function signOut() {
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    localStorage.removeItem('bonds_avatar_url');
    localStorage.removeItem('bonds_restaurant_name');
    localStorage.removeItem('bonds_session_type');
    return sb.auth.signOut();
  }

  // ── Feature access ────────────────────────────────────────
  const ROLE_PERMISSIONS = {
    super_admin: ['users', 'subscriptions', 'messages', 'roles', 'analytics', 'users_write', 'export'],
    admin: ['users', 'subscriptions', 'messages', 'analytics', 'users_write', 'export'],
    support: ['users', 'messages', 'analytics'],
    viewer: ['analytics']
  };

  async function checkFeatureAccess(feature) {
    const { data: userData } = await getUser();
    const user = userData?.user;
    if (!user) return { allowed: false, reason: 'not_logged_in', tier: 'none' };

    // Admin bypass
    const { data: adminRole } = await getAdminRole(user.id);
    if (adminRole?.role) return { allowed: true, tier: 'admin', admin: adminRole.role };

    const [{ data: profile }, { data: sub }] = await Promise.all([
      getProfile(user.id),
      getSubscription(user.id)
    ]);

    let tier = profile?.tier || sub?.tier || 'free';
    if (profile?.tier_expires_at && new Date(profile.tier_expires_at) < new Date()) {
      tier = 'free';
    }
    let status = sub?.status || 'inactive';
    if (status === 'active' && sub?.current_period_end && new Date(sub.current_period_end) < new Date()) {
      status = 'inactive';
    }

    const limits = tier === 'enterprise' ? { maxScenarios: Infinity, pdfExport: true, healthHistory: true, apiAccess: true, webhooks: true } :
                   tier === 'pro' ? { maxScenarios: Infinity, pdfExport: true, healthHistory: true, apiAccess: true } :
                   { maxScenarios: 3, pdfExport: false, healthHistory: false, apiAccess: false };

    const allowed = status === 'active' && (limits[feature] === true || limits[feature] > 0);
    return { allowed, tier, status, limits, reason: allowed ? null : 'tier_limit' };
  }

  // ── UI: Site header avatar/login ──────────────────────────
  function initSiteAuth(containerId) {
    const container = document.getElementById(containerId || 'authContainer');
    if (!container) return;

    getUser().then(({ data: userData }) => {
      const user = userData?.user;
      if (!user) {
        const isEn = location.pathname.startsWith('/en/');
        const authUrl = isEn ? '/en/calculators/auth/index.html' : '/calculators/auth/index.html';
        container.innerHTML = `<a href="${authUrl}" class="btn btn-secondary" style="font-size:0.85rem;padding:0.5rem 1rem;" onclick="sessionStorage.setItem('auth_redirect',location.pathname)">تسجيل الدخول</a>`;
        return;
      }

      getProfile(user.id).then(({ data: profile }) => {
        const name = profile?.restaurant_name || user.user_metadata?.restaurant_name || user.email?.split('@')[0] || 'مستخدم';
        const initial = name.charAt(0).toUpperCase();
        const isEn = location.pathname.startsWith('/en/');
        const profileUrl = isEn ? '/en/calculators/auth/profile.html' : '/calculators/auth/profile.html';
        const subUrl = isEn ? '/en/calculators/auth/subscription.html' : '/calculators/auth/subscription.html';

        container.innerHTML = `
          <div class="bonds-user-menu" style="position:relative;display:flex;align-items:center;gap:0.75rem;cursor:pointer;" onclick="event.stopPropagation();this.querySelector('.bonds-dropdown').style.display=this.querySelector('.bonds-dropdown').style.display==='block'?'none':'block';">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--gold);color:#0c0c0c;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;border:2px solid var(--gold);">${initial}</div>
            <span style="color:var(--gold);font-weight:700;font-size:0.9rem;white-space:nowrap;">${name}</span>
            <span style="color:var(--text-secondary);font-size:0.7rem;">▼</span>
            <div class="bonds-dropdown" style="position:absolute;top:calc(100% + 8px);left:0;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:8px 0;min-width:180px;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:9999;">
              <a href="${profileUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;">👤 الملف الشخصي</a>
              <a href="${subUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;">💎 الاشتراك</a>
              <div style="height:1px;background:var(--border);margin:6px 0;"></div>
              <a href="#" onclick="window.BondsAuth.signOut().then(()=>location.reload());return false;" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#ff8a8a;text-decoration:none;font-size:0.85rem;">🚪 تسجيل الخروج</a>
            </div>
          </div>`;
      });
    });

    document.addEventListener('click', () => {
      const dd = container.querySelector('.bonds-dropdown');
      if (dd) dd.style.display = 'none';
    });
  }

  // ── UI: Admin guard ───────────────────────────────────────
  function initAdminGuard() {
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', initAdminGuard);
      return;
    }
    const overlayId = 'bonds-admin-overlay';
    if (document.getElementById(overlayId)) return;

    const div = document.createElement('div');
    div.id = overlayId;
    div.innerHTML = `
      <div id="${overlayId}-box" style="position:fixed;inset:0;background:#1a1a1a;z-index:9999;display:flex;align-items:center;justify-content:center;font-family:Vazirmatn,system-ui,sans-serif;">
        <div style="text-align:center;max-width:400px;padding:2rem;">
          <div style="font-size:3rem;margin-bottom:1rem;">🔒</div>
          <h2 style="color:#ffffff;margin-bottom:0.5rem;">التحقق من الصلاحيات...</h2>
          <p id="${overlayId}-status" style="color:#bbbbbb;">جارِ التحقق</p>
          <button id="${overlayId}-login" style="display:none;margin-top:1.5rem;padding:0.75rem 2rem;border-radius:10px;border:none;background:linear-gradient(135deg,#d4a853,#f0c96a);color:#1a1a1a;font-weight:800;cursor:pointer;" onclick="location.href='/calculators/auth/index.html?redirect='+encodeURIComponent(location.href)">تسجيل الدخول</button>
        </div>
      </div>`;
    document.body.appendChild(div);

    getSession().then(async ({ data: sessionData, error }) => {
      const session = sessionData?.session;
      const user = session?.user;
      const token = session?.access_token || '';
      const statusEl = document.getElementById(`${overlayId}-status`);
      const loginBtn = document.getElementById(`${overlayId}-login`);

      if (error || !user) {
        if (statusEl) statusEl.textContent = 'يجب تسجيل الدخول للوصول إلى لوحة التحكم';
        if (loginBtn) loginBtn.style.display = 'inline-block';
        return;
      }

      function finishAdminAccess(role) {
        window.__ADMIN_ROLE = role;
        window.__ADMIN_PERMS = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
        window.__ADMIN_TOKEN = token;
        document.getElementById(overlayId)?.remove();
        window.dispatchEvent(new Event('admin-auth-ready'));
      }

      function redirectToMfaSetup() {
        const redirect = encodeURIComponent(location.pathname + location.search);
        location.href = '/admin/mfa-setup.html?redirect=' + redirect;
      }

      const isMfaSetupPage = location.pathname.includes('/admin/mfa-setup.html');

      if (ADMIN_EMAIL && user.email === ADMIN_EMAIL) {
        const mfa = await checkAdminMfa(token);
        if (!mfa.ok) {
          if (isMfaSetupPage) return finishAdminAccess('super_admin');
          return redirectToMfaSetup();
        }
        finishAdminAccess('super_admin');
        return;
      }

      getAdminRole(user.id).then(async ({ data: roleRow }) => {
        if (!roleRow || !['super_admin','admin','support'].includes(roleRow.role)) {
          if (statusEl) statusEl.textContent = 'ليس لديك صلاحية الوصول الإداري';
          return;
        }
        const mfa = await checkAdminMfa(token);
        if (!mfa.ok) {
          if (isMfaSetupPage) return finishAdminAccess(roleRow.role);
          return redirectToMfaSetup();
        }
        finishAdminAccess(roleRow.role);
      });
    });
  }

  // ── Auto-init site auth header ────────────────────────────
  (function autoInitSiteAuth() {
    function inject() {
      const headerActions = document.querySelector('.header-actions');
      if (!headerActions || document.getElementById('authContainer')) return;
      const authContainer = document.createElement('div');
      authContainer.id = 'authContainer';
      headerActions.insertBefore(authContainer, headerActions.firstChild);
      initSiteAuth('authContainer');
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', inject);
    } else {
      inject();
    }
  })();

  // ── Exports ───────────────────────────────────────────────
  window.BondsAuth = {
    getSupabase, getUser, getSession, getProfile, updateProfile, getSubscription, getAdminRole,
    signUp, signIn, signInWithOTP, verifyOTP, updateUser, signInWithOAuth, resendConfirmation, signOut, checkFeatureAccess,
    getRedirectUrl, clearRedirectUrl,
    normalizePhone, isValidPhone,
    initSiteAuth, initAdminGuard
  };

})();
