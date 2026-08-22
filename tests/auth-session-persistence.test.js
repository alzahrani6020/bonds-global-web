const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    get length() { return values.size; },
    key(index) { return Array.from(values.keys())[index] || null; },
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); }
  };
}

function createMockAuth(localStorage, overrides = {}) {
  function readSession() {
    try {
      const raw = localStorage.getItem('bonds-auth-token');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed?.session || parsed || null;
    } catch (e) {
      return null;
    }
  }
  function saveSession(session) {
    localStorage.setItem('bonds-auth-token', JSON.stringify(session));
  }
  const auth = {
    signInWithPassword: jest.fn(async ({ email, password }) => {
      if (email === 'user@example.com' && password === 'password') {
        const session = {
          access_token: 'valid-access',
          refresh_token: 'valid-refresh',
          user: { id: 'user-1', email, user_metadata: { restaurant_name: 'Test' } }
        };
        saveSession(session);
        return { data: { session, user: session.user }, error: null };
      }
      return { data: { session: null, user: null }, error: new Error('Invalid credentials') };
    }),
    getSession: jest.fn(async () => {
      const session = readSession();
      return { data: { session }, error: null };
    }),
    setSession: jest.fn(async (tokens) => {
      const session = { ...readSession(), ...tokens };
      saveSession(session);
      return { data: { session }, error: null };
    }),
    getUser: jest.fn(async () => {
      const session = readSession();
      if (!session?.access_token) {
        return { data: { user: null }, error: { message: 'no session' } };
      }
      if (session.access_token === 'expired-access') {
        return { data: { user: null }, error: { message: 'token expired', status: 401 } };
      }
      return { data: { user: session.user || { id: 'user-1' } }, error: null };
    }),
    refreshSession: jest.fn(async () => {
      const session = readSession();
      if (session?.refresh_token === 'valid-refresh') {
        const refreshed = {
          access_token: 'refreshed-access',
          refresh_token: 'valid-refresh',
          user: session.user || { id: 'user-1' }
        };
        saveSession(refreshed);
        return { data: { session: refreshed }, error: null };
      }
      return { data: { session: null }, error: { message: 'refresh failed' } };
    }),
    signOut: jest.fn(async () => {
      localStorage.removeItem('bonds-auth-token');
      return { error: null };
    }),
    onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } }))
  };
  return { ...auth, ...overrides };
}

function loadAuth({ search = '', initialStorage = {}, authOverrides = {}, fetchMock = jest.fn() } = {}) {
  const localStorage = createStorage(initialStorage);
  const sessionStorage = createStorage();
  const auth = createMockAuth(localStorage, authOverrides);
  const client = { auth };
  const document = {
    readyState: 'loading',
    addEventListener: jest.fn(),
    getElementById: jest.fn(() => null),
    querySelector: jest.fn(() => null),
    head: { appendChild: jest.fn() },
    createElement: jest.fn(() => ({}))
  };
  const window = {
    __ENV: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' },
    location: {
      origin: 'https://bonds-global.com',
      pathname: '/calculators/auth/',
      search,
      hash: '',
      href: 'https://bonds-global.com/calculators/auth/'
    },
    localStorage,
    document,
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
    fetch: fetchMock
  };
  window.document = document;
  const context = {
    window,
    localStorage,
    sessionStorage,
    supabase: { createClient: jest.fn(() => client) },
    document,
    URL,
    URLSearchParams,
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
    atob,
    setTimeout,
    clearTimeout,
    console,
    fetch: fetchMock,
    location: window.location
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', 'bonds-auth-2026.js'), 'utf8'),
    context
  );
  return { window, localStorage, sessionStorage, client, auth, createClient: context.supabase.createClient };
}

// ── Existing redirect tests ────────────────────────────────────────────────

test('keeps a same-origin destination after login', () => {
  const destination = 'https://bonds-global.com/en/calculators/loan.html?mode=quick#results';
  const { window, sessionStorage } = loadAuth({ search: '?redirect=' + encodeURIComponent(destination) });

  expect(window.BondsAuth.getRedirectUrl()).toBe(destination);
  expect(sessionStorage.getItem('auth_redirect')).toBe('/en/calculators/loan.html?mode=quick#results');
});

test('rejects an external post-login redirect', () => {
  const { window } = loadAuth({ search: '?redirect=' + encodeURIComponent('https://example.com/steal') });
  expect(window.BondsAuth.getRedirectUrl()).toBe('https://bonds-global.com/my-bonds/');
});

test('uses one persistent Supabase client and persists session after login', async () => {
  const { window, localStorage, createClient } = loadAuth();

  const first = window.BondsAuth.getSupabase();
  const second = window.BondsAuth.getSupabase();
  const result = await window.BondsAuth.signIn('user@example.com', 'password');

  expect(first).toBe(second);
  expect(window.__BONDS_SUPABASE_CLIENT__).toBe(first);
  expect(createClient).toHaveBeenCalledTimes(1);
  expect(localStorage.getItem('bonds-auth-token')).toContain('user-1');
  expect(result.error).toBeNull();
});

// ── Session storage migration & conflict tests ─────────────────────────────

test('session lives only in bonds-auth-token', async () => {
  const session = {
    access_token: 'valid-access',
    refresh_token: 'valid-refresh',
    user: { id: 'user-1', email: 'a@example.com' }
  };
  const { window } = loadAuth({ initialStorage: { 'bonds-auth-token': JSON.stringify(session) } });
  const { data } = await window.BondsAuth.getSession();
  expect(data.session?.user?.id).toBe('user-1');
});

test('session in legacy Supabase key is migrated to bonds-auth-token', async () => {
  const session = {
    access_token: 'legacy-access',
    refresh_token: 'valid-refresh',
    user: { id: 'user-legacy', email: 'legacy@example.com' }
  };
  const { window, localStorage } = loadAuth({
    initialStorage: { 'sb-example-auth-token': JSON.stringify(session) }
  });
  const { data } = await window.BondsAuth.getSession();
  expect(data.session?.user?.id).toBe('user-legacy');
  expect(localStorage.getItem('bonds-auth-token')).toContain('legacy-access');
});

test('when both keys exist, bonds-auth-token wins and legacy key is ignored', async () => {
  const newSession = {
    access_token: 'new-access',
    refresh_token: 'valid-refresh',
    user: { id: 'user-new', email: 'new@example.com' }
  };
  const oldSession = {
    access_token: 'old-access',
    refresh_token: 'old-refresh',
    user: { id: 'user-old', email: 'old@example.com' }
  };
  const { window } = loadAuth({
    initialStorage: {
      'bonds-auth-token': JSON.stringify(newSession),
      'sb-example-auth-token': JSON.stringify(oldSession)
    }
  });
  const { data } = await window.BondsAuth.getSession();
  expect(data.session?.user?.id).toBe('user-new');
});

test('expired session with valid refresh token is refreshed once on 401', async () => {
  const session = {
    access_token: 'expired-access',
    refresh_token: 'valid-refresh',
    user: { id: 'user-1' }
  };
  const fetchMock = jest.fn()
    .mockResolvedValueOnce({ status: 401, ok: false })
    .mockResolvedValueOnce({ status: 200, ok: true, headers: new Map() });
  const { window, auth } = loadAuth({
    initialStorage: { 'bonds-auth-token': JSON.stringify(session) },
    fetchMock
  });
  const res = await window.BondsAuth.authenticatedFetch('/api/test');
  expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(res.ok).toBe(true);
  expect(res.status).toBe(200);
});

test('expired session with invalid refresh token is not recoverable', async () => {
  const session = {
    access_token: 'expired-access',
    refresh_token: 'invalid-refresh',
    user: { id: 'user-1' }
  };
  const fetchMock = jest.fn().mockResolvedValue({ status: 401, ok: false });
  const { window, auth } = loadAuth({
    initialStorage: { 'bonds-auth-token': JSON.stringify(session) },
    fetchMock
  });
  const res = await window.BondsAuth.authenticatedFetch('/api/test');
  expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  expect(res.status).toBe(401);
  expect(res.__authError).toBe('AUTH_REQUIRED');
});

test('no session returns null user without error', async () => {
  const { window } = loadAuth();
  const { data: userData, error } = await window.BondsAuth.getUser();
  expect(userData.user).toBeNull();
  expect(error).toBeDefined();
});

test('site auth header renders from resolved session, not a hardcoded admin label', async () => {
  const session = {
    access_token: 'valid-access',
    refresh_token: 'valid-refresh',
    user: { id: 'user-1', email: 'a@example.com' }
  };
  const { window } = loadAuth({
    initialStorage: { 'bonds-auth-token': JSON.stringify(session) }
  });
  const container = { innerHTML: '', dataset: {}, querySelector: () => null };
  window.document.getElementById = (id) => (id === 'authContainer' ? container : null);
  await window.BondsAuth.initSiteAuth('authContainer', true);
  await new Promise(r => setTimeout(r, 0));
  // getSession/getUser must resolve before render; the fallback name from email is 'a', never 'ادمن'.
  expect(container.innerHTML).not.toContain('ادمن');
  expect(container.innerHTML).toContain('a');
});
