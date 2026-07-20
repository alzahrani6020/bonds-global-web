// ===== Bonds Unified Auth System =====
// Replaces: supabase-client.js + auth-guard.js + admin-auth-v2.js
// Usage: <script src="/bonds-auth-2026.js?v=3.0.4"></script> (after /api/env and supabase library)

(function() {
  'use strict';

  let _supabase = null;
  let _envPromise = null;

  function getEnv() {
    if (typeof window !== 'undefined' && window.__ENV) {
      return window.__ENV;
    }
    return {};
  }

  function loadEnvScript() {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') return reject(new Error('No document'));
      const script = document.createElement('script');
      script.src = '/api/env?_=' + Date.now();
      script.async = true;
      script.onload = () => resolve(getEnv());
      script.onerror = () => reject(new Error('Failed to load /api/env'));
      document.head.appendChild(script);
    });
  }

  async function ensureEnv(retries = 5) {
    if (getEnv().SUPABASE_URL && getEnv().SUPABASE_ANON_KEY) {
      return getEnv();
    }
    if (!_envPromise) {
      _envPromise = (async () => {
        for (let i = 0; i < retries; i++) {
          if (getEnv().SUPABASE_URL && getEnv().SUPABASE_ANON_KEY) {
            return getEnv();
          }
          try {
            await loadEnvScript();
            if (getEnv().SUPABASE_URL && getEnv().SUPABASE_ANON_KEY) {
              return getEnv();
            }
          } catch (e) {
            console.warn('[BondsAuth] env load attempt failed:', e.message);
          }
          await new Promise(r => setTimeout(r, 200 * (i + 1)));
        }
        return getEnv();
      })();
    }
    return _envPromise;
  }

  function getSupabase() {
    if (_supabase) return _supabase;
    if (typeof supabase === 'undefined') return null;
    const env = getEnv();
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      // Env not ready yet; gracefully degrade. Caller should await ensureEnv() first.
      return null;
    }
    _supabase = supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: 'bonds-auth-token',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined
      }
    });
    return _supabase;
  }

  // ── Auth helpers ──────────────────────────────────────────
  async function getUser() {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb) return { data: { user: null }, error: new Error('Not initialized') };
    // Try to recover session first so a stale access token gets refreshed from localStorage
    const { data: sessionData, error: sessionError } = await sb.auth.getSession();
    if (sessionData?.session?.user) {
      return { data: { user: sessionData.session.user }, error: null };
    }
    // Fallback to direct getUser (validates token with server)
    const result = await sb.auth.getUser();
    return result;
  }

  let _lastKnownUser = null;

  async function getSession() {
    await ensureEnv();
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
    await ensureEnv();
    try {
      const aal = decodeJwtAal(token);
      const enforceMfa = getEnv().ADMIN_ENFORCE_MFA === 'true';
      if (enforceMfa && aal !== 'aal2') {
        return { ok: false, aal };
      }
      return { ok: true };
    } catch (e) {
      return { ok: true };
    }
  }

  async function getProfile(userId) {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb || !userId) return { data: null, error: new Error('Not initialized') };
    return sb.from('profiles').select('*').eq('id', userId).single();
  }

  async function updateProfile(userId, fields) {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb || !userId) return { data: null, error: new Error('Not initialized') };
    const payload = { ...fields, id: userId, updated_at: new Date().toISOString() };
    return sb.from('profiles').upsert(payload, { onConflict: 'id' });
  }

  async function getSubscription(userId) {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb || !userId) return { data: null, error: new Error('Not initialized') };
    return sb.from('subscriptions').select('*').eq('user_id', userId).single();
  }

  async function getAdminRole(userId) {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb || !userId) return { data: null, error: new Error('Not initialized') };
    return sb.from('admin_roles').select('role').eq('user_id', userId).single();
  }

  function getRedirectUrl() {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('redirect');
    const origin = (typeof window !== 'undefined' && window.location ? window.location.origin : '');
    const fallback = origin + '/index.html';
    if (fromParam) {
      const safe = fromParam.startsWith('/') && !fromParam.startsWith('//') ? fromParam : '/index.html';
      try { sessionStorage.setItem('auth_redirect', safe); } catch(e) {}
      return origin + safe;
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
    await ensureEnv();
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.signUp({ email, password, options: { data: metadata || {}, emailRedirectTo: 'https://bonds-global.com/calculators/auth/confirmed.html' } });
  }

  async function signIn(email, password) {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.signInWithPassword({ email, password });
  }

  async function signInWithOTP(email, options) {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.signInWithOtp({ email, options: options || {} });
  }

  async function verifyOTP(email, token, type) {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.verifyOtp({ email, token, type: type || 'email' });
  }

  async function updateUser(attributes) {
    await ensureEnv();
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
    await ensureEnv();
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    const redirectTo = normalizeUrl(options?.redirectTo) || 'https://bonds-global.com/calculators/auth/confirmed.html';
    return sb.auth.signInWithOAuth({ provider, options: { ...(options || {}), redirectTo } });
  }

  async function resendConfirmation(email) {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb) return { error: new Error('Not initialized') };
    return sb.auth.resend({ email, type: 'signup' });
  }

  async function signOut() {
    await ensureEnv();
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
  let _authHeaderListener = null;
  let _initSiteAuthRunning = false;
  async function initSiteAuth(containerId) {
    if (_initSiteAuthRunning) return;
    _initSiteAuthRunning = true;
    try {
      await ensureEnv();
      const container = document.getElementById(containerId || 'authContainer');
      if (!container) {
        console.warn('[BondsAuth] initSiteAuth: container not found', containerId);
        return;
      }
      console.log('[BondsAuth] initSiteAuth running for', containerId);

    function toggleAuthButtons(showAuthButtons) {
      ['headerLoginBtn', 'headerSignupBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = showAuthButtons ? '' : 'none';
      });
    }

    function render(user, source) {
      console.log('[BondsAuth] render called, user:', user?.id || 'null', 'source:', source || 'unknown');
      if (!user) {
        // Defensive: don't overwrite a known logged-in user with a null from an initial race
        if (_lastKnownUser && source === 'onAuthStateChange_INITIAL_SESSION') {
          console.log('[BondsAuth] ignoring INITIAL_SESSION null because we already have a user');
          return;
        }
        container.innerHTML = '';
        toggleAuthButtons(true);
        _lastKnownUser = null;
        return;
      }

      _lastKnownUser = user;
      toggleAuthButtons(false);

      getProfile(user.id).then(({ data: profile, error: profileError }) => {
        if (profileError) console.warn('[BondsAuth] getProfile error:', profileError.message);
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
      }).catch(err => {
        console.error('[BondsAuth] getProfile failed:', err);
        // Still show user with email fallback
        const name = user.email?.split('@')[0] || 'مستخدم';
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
    }

    getUser()
      .then(({ data: userData, error: userError }) => {
        if (userError) console.warn('[BondsAuth] getUser error:', userError.message);
        console.log('[BondsAuth] getUser result:', userData?.user?.id || 'null');
        render(userData?.user || null, 'getUser');
      })
      .catch(err => {
        console.error('[BondsAuth] initSiteAuth failed:', err);
        container.innerHTML = '';
        toggleAuthButtons(true);
      });

    // Subscribe to auth state changes so header updates when user logs in/out
    const sb = getSupabase();
    if (sb && !_authHeaderListener) {
      const { data: listener } = sb.auth.onAuthStateChange((event, session) => {
        console.log('[BondsAuth] onAuthStateChange:', event, 'session user:', session?.user?.id || 'null');
        render(session?.user || null, 'onAuthStateChange_' + event);
      });
      _authHeaderListener = listener;
    }

    // Only add document click listener once
    if (!container.dataset.clickBound) {
      container.dataset.clickBound = '1';
      document.addEventListener('click', () => {
        const dd = container.querySelector('.bonds-dropdown');
        if (dd) dd.style.display = 'none';
      });
    }
    } finally {
      _initSiteAuthRunning = false;
    }
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
      // Hardcoded owner fallback (safety net if ADMIN_EMAIL env var is not set)
      const OWNER_EMAIL_FALLBACK = 'hmd.dev@gmail.com';

      if ((getEnv().ADMIN_EMAIL && user.email === getEnv().ADMIN_EMAIL) || user.email === OWNER_EMAIL_FALLBACK) {
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

  // ── Session recovery when user returns to the tab/device ──
  let _recovering = false;
  async function recoverSession({ force = false } = {}) {
    await ensureEnv();
    const sb = getSupabase();
    if (!sb) return Promise.resolve();
    if (_recovering) return Promise.resolve();
    _recovering = true;

    async function attempt() {
      // 1. getSession refreshes an expired access token from localStorage
      let { data: sessionData, error: sessionError } = await sb.auth.getSession();
      // 2. If still missing or forced, validate with server
      if ((!sessionData?.session && !sessionError) || force) {
        const userResult = await sb.auth.getUser();
        if (userResult.data?.user && !userResult.error) {
          sessionData = { session: { user: userResult.data.user } };
          sessionError = null;
        } else if (userResult.error) {
          sessionError = userResult.error;
        }
      }
      return { data: sessionData, error: sessionError };
    }

    return attempt()
      .catch(err => ({ data: null, error: err }))
      .then(({ data, error }) => {
        if (error) {
          // Network/down errors: retry once after a short delay
          const isNetworkError = !error.status || error.status >= 500 || error.message?.toLowerCase().includes('network');
          if (isNetworkError) {
            return new Promise(resolve => setTimeout(resolve, 800)).then(() => attempt().catch(err => ({ data: null, error: err })));
          }
        }
        return { data, error };
      })
      .then(({ data, error }) => {
        _recovering = false;
        if (error) console.warn('[BondsAuth] Session recovery error:', error);
        if (data?.session) {
          // Refresh the header UI if it exists
          const container = document.getElementById('authContainer');
          if (container) initSiteAuth('authContainer');
        }
        // Notify guarded pages so they re-check auth state
        window.dispatchEvent(new CustomEvent('bonds:session-recovered', {
          detail: { session: data?.session || null, error: error || null }
        }));
      })
      .catch(err => {
        _recovering = false;
        console.warn('[BondsAuth] recoverSession exception:', err);
        window.dispatchEvent(new CustomEvent('bonds:session-recovered', {
          detail: { session: null, error: err }
        }));
      });
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') recoverSession();
    });
    window.addEventListener('focus', () => recoverSession());
    // bfcache restore: fires when user navigates back to this page
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) recoverSession({ force: true });
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
    getSupabase, ensureEnv, getUser, getSession, getProfile, updateProfile, getSubscription, getAdminRole,
    signUp, signIn, signInWithOTP, verifyOTP, updateUser, signInWithOAuth, resendConfirmation, signOut, checkFeatureAccess,
    getRedirectUrl, clearRedirectUrl,
    normalizePhone, isValidPhone,
    initSiteAuth, initAdminGuard
  };

})();
