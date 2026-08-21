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

function loadAuth(search, authOverrides = {}) {
  const localStorage = createStorage();
  const sessionStorage = createStorage();
  const auth = {
    signInWithPassword: jest.fn(),
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    setSession: jest.fn().mockResolvedValue({ data: { session: {} }, error: null }),
    ...authOverrides
  };
  const client = { auth };
  const window = {
    __ENV: { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'anon' },
    location: {
      origin: 'https://bonds-global.com',
      pathname: '/calculators/auth/',
      search,
      hash: ''
    },
    localStorage,
    addEventListener: jest.fn(),
    dispatchEvent: jest.fn()
  };
  const context = {
    window,
    localStorage,
    sessionStorage,
    supabase: { createClient: jest.fn(() => client) },
    document: {
      readyState: 'loading',
      addEventListener: jest.fn(),
      getElementById: jest.fn(() => null),
      querySelector: jest.fn(() => null),
      head: { appendChild: jest.fn() },
      createElement: jest.fn(() => ({}))
    },
    URL,
    URLSearchParams,
    CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
    atob,
    setTimeout,
    clearTimeout,
    console
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', 'bonds-auth-2026.js'), 'utf8'),
    context
  );
  return { window, sessionStorage, client, auth, createClient: context.supabase.createClient };
}

test('keeps a same-origin destination after login', () => {
  const destination = 'https://bonds-global.com/en/calculators/loan.html?mode=quick#results';
  const { window, sessionStorage } = loadAuth('?redirect=' + encodeURIComponent(destination));

  expect(window.BondsAuth.getRedirectUrl()).toBe(destination);
  expect(sessionStorage.getItem('auth_redirect')).toBe('/en/calculators/loan.html?mode=quick#results');
});

test('rejects an external post-login redirect', () => {
  const { window } = loadAuth('?redirect=' + encodeURIComponent('https://example.com/steal'));

  expect(window.BondsAuth.getRedirectUrl()).toBe('https://bonds-global.com/my-bonds/');
});

test('uses one persistent Supabase client and repairs a missing stored session', async () => {
  const session = { access_token: 'access', refresh_token: 'refresh', user: { id: 'user-1' } };
  const { window, auth, createClient } = loadAuth('', {
    signInWithPassword: jest.fn().mockResolvedValue({ data: { session, user: session.user }, error: null })
  });

  const first = window.BondsAuth.getSupabase();
  const second = window.BondsAuth.getSupabase();
  const result = await window.BondsAuth.signIn('user@example.com', 'password');

  expect(first).toBe(second);
  expect(window.__BONDS_SUPABASE_CLIENT__).toBe(first);
  expect(createClient).toHaveBeenCalledTimes(1);
  expect(auth.setSession).toHaveBeenCalledWith({ access_token: 'access', refresh_token: 'refresh' });
  expect(result.error).toBeNull();
});

