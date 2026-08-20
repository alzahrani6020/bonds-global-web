// ===== Bonds Unified Auth System =====
// Replaces: supabase-client.js + auth-guard.js + admin-auth-v2.js
// Usage: <script src="/bonds-auth-2026.js?v=3.0.8"></script> (after /api/env and supabase library)

(function() {
  'use strict';

  let _supabase = null;
  let _envPromise = null;
  let _supabaseLibPromise = null;

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

  function loadSupabaseLibrary() {
    return new Promise((resolve, reject) => {
      if (typeof document === 'undefined') return reject(new Error('No document'));
      if (typeof supabase !== 'undefined') return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load Supabase library'));
      document.head.appendChild(script);
    });
  }

  async function ensureSupabaseLibrary(retries = 3) {
    if (typeof supabase !== 'undefined') return;
    if (!_supabaseLibPromise) {
      _supabaseLibPromise = (async () => {
        for (let i = 0; i < retries; i++) {
          if (typeof supabase !== 'undefined') return;
          try {
            await loadSupabaseLibrary();
            if (typeof supabase !== 'undefined') return;
          } catch (e) {
            console.warn('[BondsAuth] Supabase library load attempt failed:', e.message);
          }
          await new Promise(r => setTimeout(r, 300 * (i + 1)));
        }
      })();
    }
    return _supabaseLibPromise;
  }

  async function ensureEnv(retries = 5) {
    await ensureSupabaseLibrary();
    const current = getEnv();
    if (current.SUPABASE_URL && current.SUPABASE_ANON_KEY) {
      return current;
    }
    if (!_envPromise) {
      _envPromise = (async () => {
        for (let i = 0; i < retries; i++) {
          const loopEnv = getEnv();
          if (loopEnv.SUPABASE_URL && loopEnv.SUPABASE_ANON_KEY) {
            return loopEnv;
          }
          try {
            await loadEnvScript();
            const afterLoad = getEnv();
            if (afterLoad.SUPABASE_URL && afterLoad.SUPABASE_ANON_KEY) {
              return afterLoad;
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
    if (typeof supabase === 'undefined') {
      console.warn('[BondsAuth] supabase global not available');
      return null;
    }
    const env = getEnv();
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      // Env not ready yet; gracefully degrade. Caller should await ensureEnv() first.
      console.warn('[BondsAuth] getSupabase missing env:', { url: env.SUPABASE_URL ? 'set' : 'missing', key: env.SUPABASE_ANON_KEY ? 'set' : 'missing' });
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
    const fallback = origin + '/my-bonds/';
    if (fromParam) {
      const safe = fromParam.startsWith('/') && !fromParam.startsWith('//') ? fromParam : '/my-bonds/';
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

  // ── Server-proxy OTP endpoints ────────────────────────────
  // These bypass Supabase's public rate limits by sending the OTP from the
  // Vercel server using the service role key. Use them for signup and magic
  // link flows to avoid blocking international users.

  async function sendOtpViaProxy(email, options) {
    await ensureEnv();
    const payload = {
      email,
      shouldCreateUser: !!(options && options.shouldCreateUser),
      metadata: (options && options.data) || {},
      language: (options && options.language) || 'ar'
    };
    const origin = (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://bonds-global.com');
    const res = await fetch(origin + '/api/v3/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: new Error(json.error || 'Failed to send verification email') };
    }
    return { data: json, error: null };
  }

  async function verifyOtpViaProxy(email, token, options) {
    await ensureEnv();
    const payload = {
      email,
      token,
      type: (options && options.type) || 'email',
      pendingPassword: (options && options.pendingPassword) || undefined
    };
    const origin = (typeof window !== 'undefined' && window.location ? window.location.origin : 'https://bonds-global.com');
    const res = await fetch(origin + '/api/v3/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: new Error(json.error || 'Invalid or expired token') };
    }
    // Persist the returned session into the Supabase client so the rest of the
    // app (getUser, getSession, signOut) continues to work transparently.
    const sb = getSupabase();
    if (sb && json.session) {
      await sb.auth.setSession({
        access_token: json.session.access_token,
        refresh_token: json.session.refresh_token
      });
    }
    return { data: json, error: null };
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

    const limits = tier === 'enterprise' ? { maxScenarios: Infinity, pdfExport: true, healthHistory: true, apiAccess: true, webhooks: true, paidCalculators: true } :
                   tier === 'pro' ? { maxScenarios: Infinity, pdfExport: true, healthHistory: true, apiAccess: true, paidCalculators: true } :
                   { maxScenarios: 3, pdfExport: false, healthHistory: false, apiAccess: false, paidCalculators: false };

    const allowed = status === 'active' && (limits[feature] === true || limits[feature] > 0);
    return { allowed, tier, status, limits, reason: allowed ? null : 'tier_limit' };
  }

  // ── UI: Site header avatar/login ──────────────────────────
  let _authHeaderListener = null;
  let _initSiteAuthRunning = false;
  async function initSiteAuth(containerId, force) {
    if (_initSiteAuthRunning && !force) return;
    _initSiteAuthRunning = true;
    try {
      await ensureEnv();
      const container = document.getElementById(containerId || 'authContainer');
      if (!container) {
        console.warn('[BondsAuth] initSiteAuth: container not found', containerId);
        return;
      }


    function toggleAuthButtons(showAuthButtons) {
      ['headerLoginBtn', 'headerSignupBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = showAuthButtons ? '' : 'none';
      });
    }

    function render(user, source) {
      if (!user) {
        // Defensive: don't overwrite a known logged-in user with a null from an initial race
        if (_lastKnownUser && source === 'onAuthStateChange_INITIAL_SESSION') {

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
        const myBondsUrl = isEn ? '/en/my-bonds/' : '/my-bonds/';
        const myBondsLabel = isEn ? 'My Bonds' : 'مساحتي';
        const faUrl = isEn ? '/en/' : '/';
        const faLabel = isEn ? 'Financial Advisory' : 'الاستشارات المالية';

        container.innerHTML = `
          <div class="bonds-user-menu" style="position:relative;display:flex;align-items:center;gap:0.75rem;cursor:pointer;" onclick="event.stopPropagation();this.querySelector('.bonds-dropdown').style.display=this.querySelector('.bonds-dropdown').style.display==='block'?'none':'block';">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--gold);color:#0c0c0c;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;border:2px solid var(--gold);">${initial}</div>
            <span style="color:var(--gold);font-weight:700;font-size:0.9rem;white-space:nowrap;">${name}</span>
            <span style="color:var(--text-secondary);font-size:0.7rem;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg></span>
            <div class="bonds-dropdown" style="position:absolute;top:calc(100% + 8px);left:0;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:8px 0;min-width:180px;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:9999;">
              <a href="${myBondsUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#A0041E" d="M9.344 14.702h-2c-.276 0-.5-.224-.5-.5v-7c0-.276.224-.5.5-.5h2c.276 0 .5.224.5.5v7c0 .276-.224.5-.5.5z"/><path fill="#FFE8B6" d="M5 16L18 3l13 13v17H5z"/><path fill="#FFCC4D" d="M18 16h1v16h-1z"/><path fill="#66757F" d="M31 17c-.256 0-.512-.098-.707-.293L18 4.414 5.707 16.707c-.391.391-1.023.391-1.414 0s-.391-1.023 0-1.414l13-13c.391-.391 1.023-.391 1.414 0l13 13c.391.391.391 1.023 0 1.414-.195.195-.451.293-.707.293z"/><path fill="#66757F" d="M18 17c-.256 0-.512-.098-.707-.293-.391-.391-.391-1.023 0-1.414l6.5-6.5c.391-.391 1.023-.391 1.414 0s.391 1.023 0 1.414l-6.5 6.5c-.195.195-.451.293-.707.293z"/><path fill="#C1694F" d="M10 26h4v6h-4z"/><path fill="#55ACEE" d="M10 17h4v4h-4zm12.5 0h4v4h-4zm0 9h4v4h-4z"/><path fill="#5C913B" d="M33.5 33.5c0 .828-.672 1.5-1.5 1.5H4c-.828 0-1.5-.672-1.5-1.5S3.172 32 4 32h28c.828 0 1.5.672 1.5 1.5z"/></svg> ${myBondsLabel}</a>
              <a href="${faUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#9A4E1C" d="M32 8h-6V4c0-2.209-1.791-4-4-4h-8c-2.209 0-4 1.791-4 4v4H4c-2.209 0-4 1.791-4 4v20c0 2.209 1.791 4 4 4h28c2.209 0 4-1.791 4-4V12c0-2.209-1.791-4-4-4zM12 6c0-1.104.896-2 2-2h8c1.104 0 2 .896 2 2v2H12V6z"/><path fill="#662113" d="M36 20c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-8c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v8z"/><path fill="#9A4E1C" d="M36 18c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-6c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v6z"/><path fill="#CCD6DD" d="M22 18c0 1.104-.896 2-2 2h-4c-1.104 0-2-.896-2-2s.896-2 2-2h4c1.104 0 2 .896 2 2"/></svg> ${faLabel}</a>
              <a href="${profileUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#269" d="M24 26.799v-2.566c2-1.348 4.08-3.779 4.703-6.896.186.103.206.17.413.17.991 0 1.709-1.287 1.709-2.873 0-1.562-.823-2.827-1.794-2.865.187-.674.293-1.577.293-2.735C29.324 5.168 26 .527 18.541.527c-6.629 0-10.777 4.641-10.777 8.507 0 1.123.069 2.043.188 2.755-.911.137-1.629 1.352-1.629 2.845 0 1.587.804 2.873 1.796 2.873.206 0 .025-.067.209-.17C8.952 20.453 11 22.885 13 24.232v2.414c-5 .645-12 3.437-12 6.23v1.061C1 35 2.076 35 3.137 35h29.725C33.924 35 35 35 35 33.938v-1.061c0-2.615-6-5.225-11-6.078z"/></svg> الملف الشخصي</a>
              <a href="${subUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#BDDDF4" d="M13 3H7l-7 9h10z"/><path fill="#5DADEC" d="M36 12l-7-9h-6l3 9z"/><path fill="#4289C1" d="M26 12h10L18 33z"/><path fill="#8CCAF7" d="M10 12H0l18 21zm3-9l-3 9h16l-3-9z"/><path fill="#5DADEC" d="M18 33l-8-21h16z"/></svg> الاشتراك</a>
              <div style="height:1px;background:var(--border);margin:6px 0;"></div>
              <a href="#" onclick="window.BondsAuth.signOut().then(()=>location.reload());return false;" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#ff8a8a;text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#BF6952" d="M29 34c0 1.105-.895 2-2 2H9c-1.105 0-2-.895-2-2V2c0-1.105.895-2 2-2h18c1.105 0 2 .895 2 2v32z"/><circle fill="#FFAC33" cx="11" cy="18" r="1.5"/><path fill="#AC5640" d="M25 3c-.552 0-1 .448-1 1v9H11c-.552 0-1 .448-1 1s.448 1 1 1h14c.552 0 1-.448 1-1V4c0-.552-.448-1-1-1zm0 25c.552 0 1 .448 1 1v3c0 .552-.448 1-1 1H11c-.552 0-1-.448-1-1s.448-1 1-1h13v-2c0-.552.448-1 1-1z"/><path fill="#854836" d="M11 33c-.552 0-1-.448-1-1v-3c0-.552.448-1 1-1h14c.552 0 1 .448 1 1s-.448 1-1 1H12v2c0 .552-.448 1-1 1z"/><path fill="#AC5640" d="M25 21c.552 0 1 .448 1 1v3c0 .552-.448 1-1 1H11c-.552 0-1-.448-1-1s.448-1 1-1h13v-2c0-.552.448-1 1-1z"/><path fill="#854836" d="M11 26c-.552 0-1-.448-1-1v-3c0-.552.448-1 1-1h14c.552 0 1 .448 1 1s-.448 1-1 1H12v2c0 .552-.448 1-1 1zm0-11c-.552 0-1-.448-1-1V4c0-.552.448-1 1-1h14c.552 0 1 .448 1 1s-.448 1-1 1H12v9c0 .552-.448 1-1 1z"/></svg> تسجيل الخروج</a>
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
        const myBondsUrl = isEn ? '/en/my-bonds/' : '/my-bonds/';
        const myBondsLabel = isEn ? 'My Bonds' : 'مساحتي';
        const faUrl = isEn ? '/en/' : '/';
        const faLabel = isEn ? 'Financial Advisory' : 'الاستشارات المالية';
        container.innerHTML = `
          <div class="bonds-user-menu" style="position:relative;display:flex;align-items:center;gap:0.75rem;cursor:pointer;" onclick="event.stopPropagation();this.querySelector('.bonds-dropdown').style.display=this.querySelector('.bonds-dropdown').style.display==='block'?'none':'block';">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--gold);color:#0c0c0c;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;border:2px solid var(--gold);">${initial}</div>
            <span style="color:var(--gold);font-weight:700;font-size:0.9rem;white-space:nowrap;">${name}</span>
            <span style="color:var(--text-secondary);font-size:0.7rem;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg></span>
            <div class="bonds-dropdown" style="position:absolute;top:calc(100% + 8px);left:0;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:8px 0;min-width:180px;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:9999;">
              <a href="${myBondsUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#A0041E" d="M9.344 14.702h-2c-.276 0-.5-.224-.5-.5v-7c0-.276.224-.5.5-.5h2c.276 0 .5.224.5.5v7c0 .276-.224.5-.5.5z"/><path fill="#FFE8B6" d="M5 16L18 3l13 13v17H5z"/><path fill="#FFCC4D" d="M18 16h1v16h-1z"/><path fill="#66757F" d="M31 17c-.256 0-.512-.098-.707-.293L18 4.414 5.707 16.707c-.391.391-1.023.391-1.414 0s-.391-1.023 0-1.414l13-13c.391-.391 1.023-.391 1.414 0l13 13c.391.391.391 1.023 0 1.414-.195.195-.451.293-.707.293z"/><path fill="#66757F" d="M18 17c-.256 0-.512-.098-.707-.293-.391-.391-.391-1.023 0-1.414l6.5-6.5c.391-.391 1.023-.391 1.414 0s.391 1.023 0 1.414l-6.5 6.5c-.195.195-.451.293-.707.293z"/><path fill="#C1694F" d="M10 26h4v6h-4z"/><path fill="#55ACEE" d="M10 17h4v4h-4zm12.5 0h4v4h-4zm0 9h4v4h-4z"/><path fill="#5C913B" d="M33.5 33.5c0 .828-.672 1.5-1.5 1.5H4c-.828 0-1.5-.672-1.5-1.5S3.172 32 4 32h28c.828 0 1.5.672 1.5 1.5z"/></svg> ${myBondsLabel}</a>
              <a href="${faUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#9A4E1C" d="M32 8h-6V4c0-2.209-1.791-4-4-4h-8c-2.209 0-4 1.791-4 4v4H4c-2.209 0-4 1.791-4 4v20c0 2.209 1.791 4 4 4h28c2.209 0 4-1.791 4-4V12c0-2.209-1.791-4-4-4zM12 6c0-1.104.896-2 2-2h8c1.104 0 2 .896 2 2v2H12V6z"/><path fill="#662113" d="M36 20c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-8c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v8z"/><path fill="#9A4E1C" d="M36 18c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-6c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v6z"/><path fill="#CCD6DD" d="M22 18c0 1.104-.896 2-2 2h-4c-1.104 0-2-.896-2-2s.896-2 2-2h4c1.104 0 2 .896 2 2"/></svg> ${faLabel}</a>
              <a href="${profileUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#269" d="M24 26.799v-2.566c2-1.348 4.08-3.779 4.703-6.896.186.103.206.17.413.17.991 0 1.709-1.287 1.709-2.873 0-1.562-.823-2.827-1.794-2.865.187-.674.293-1.577.293-2.735C29.324 5.168 26 .527 18.541.527c-6.629 0-10.777 4.641-10.777 8.507 0 1.123.069 2.043.188 2.755-.911.137-1.629 1.352-1.629 2.845 0 1.587.804 2.873 1.796 2.873.206 0 .025-.067.209-.17C8.952 20.453 11 22.885 13 24.232v2.414c-5 .645-12 3.437-12 6.23v1.061C1 35 2.076 35 3.137 35h29.725C33.924 35 35 35 35 33.938v-1.061c0-2.615-6-5.225-11-6.078z"/></svg> الملف الشخصي</a>
              <a href="${subUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#BDDDF4" d="M13 3H7l-7 9h10z"/><path fill="#5DADEC" d="M36 12l-7-9h-6l3 9z"/><path fill="#4289C1" d="M26 12h10L18 33z"/><path fill="#8CCAF7" d="M10 12H0l18 21zm3-9l-3 9h16l-3-9z"/><path fill="#5DADEC" d="M18 33l-8-21h16z"/></svg> الاشتراك</a>
              <div style="height:1px;background:var(--border);margin:6px 0;"></div>
              <a href="#" onclick="window.BondsAuth.signOut().then(()=>location.reload());return false;" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#ff8a8a;text-decoration:none;font-size:0.85rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#BF6952" d="M29 34c0 1.105-.895 2-2 2H9c-1.105 0-2-.895-2-2V2c0-1.105.895-2 2-2h18c1.105 0 2 .895 2 2v32z"/><circle fill="#FFAC33" cx="11" cy="18" r="1.5"/><path fill="#AC5640" d="M25 3c-.552 0-1 .448-1 1v9H11c-.552 0-1 .448-1 1s.448 1 1 1h14c.552 0 1-.448 1-1V4c0-.552-.448-1-1-1zm0 25c.552 0 1 .448 1 1v3c0 .552-.448 1-1 1H11c-.552 0-1-.448-1-1s.448-1 1-1h13v-2c0-.552.448-1 1-1z"/><path fill="#854836" d="M11 33c-.552 0-1-.448-1-1v-3c0-.552.448-1 1-1h14c.552 0 1 .448 1 1s-.448 1-1 1H12v2c0 .552-.448 1-1 1z"/><path fill="#AC5640" d="M25 21c.552 0 1 .448 1 1v3c0 .552-.448 1-1 1H11c-.552 0-1-.448-1-1s.448-1 1-1h13v-2c0-.552.448-1 1-1z"/><path fill="#854836" d="M11 26c-.552 0-1-.448-1-1v-3c0-.552.448-1 1-1h14c.552 0 1 .448 1 1s-.448 1-1 1H12v2c0 .552-.448 1-1 1zm0-11c-.552 0-1-.448-1-1V4c0-.552.448-1 1-1h14c.552 0 1 .448 1 1s-.448 1-1 1H12v9c0 .552-.448 1-1 1z"/></svg> تسجيل الخروج</a>
            </div>
          </div>`;
      });
    }

    getUser()
      .then(({ data: userData, error: userError }) => {
        if (userError) console.warn('[BondsAuth] getUser error:', userError.message);

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
          <div style="font-size:3rem;margin-bottom:1rem;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#AAB8C2" d="M18 3C12.477 3 8 7.477 8 13v10h4V13c0-3.313 2.686-6 6-6s6 2.687 6 6v10h4V13c0-5.523-4.477-10-10-10z"/><path fill="#FFAC33" d="M31 32c0 2.209-1.791 4-4 4H9c-2.209 0-4-1.791-4-4V20c0-2.209 1.791-4 4-4h18c2.209 0 4 1.791 4 4v12z"/></svg></div>
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
      // Hardcoded owner fallbacks (safety net if ADMIN_EMAIL env var is not set)
      const OWNER_EMAIL_FALLBACKS = ['iiffund.dev@gmail.com'];
      const configuredOwner = getEnv().ADMIN_EMAIL || '';
      const ownerEmails = [...OWNER_EMAIL_FALLBACKS];
      if (configuredOwner) ownerEmails.push(configuredOwner);

      if (ownerEmails.some(e => user.email.toLowerCase() === e.toLowerCase())) {
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
    signUp, signIn, signInWithOTP, verifyOTP, sendOtpViaProxy, verifyOtpViaProxy, updateUser, signInWithOAuth, resendConfirmation, signOut, checkFeatureAccess,
    getRedirectUrl, clearRedirectUrl,
    normalizePhone, isValidPhone,
    initSiteAuth, initAdminGuard
  };

})();
