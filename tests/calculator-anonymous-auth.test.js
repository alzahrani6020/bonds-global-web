const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createStorage() {
  const values = new Map();
  return {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

function loadAnonymousFirst(getUserResult) {
  const sessionStorage = createStorage();
  const localStorage = createStorage();
  const showAuthModal = jest.fn();
  const document = {
    documentElement: { lang: 'ar' },
    readyState: 'loading',
    currentScript: null,
    body: { appendChild: jest.fn() },
    addEventListener: jest.fn(),
    getElementById: jest.fn(() => null),
    querySelector: jest.fn(() => null),
    querySelectorAll: jest.fn(() => []),
    createElement: jest.fn(() => ({}))
  };
  const window = {
    __bondsCalcConfig: { name: 'feasibility', lang: 'ar' },
    BondsAuth: { getUser: jest.fn(async () => getUserResult) },
    BondsAnalytics: { trackEvent: jest.fn() },
    location: {
      pathname: '/calculators/feasibility-template',
      search: '',
      href: 'https://bonds-global.com/calculators/feasibility-template'
    },
    history: { replaceState: jest.fn() },
    document,
    sessionStorage,
    localStorage
  };
  const context = {
    window,
    document,
    sessionStorage,
    localStorage,
    showAuthModal,
    URLSearchParams,
    console,
    setTimeout,
    clearTimeout
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '..', 'calculators', 'anonymous-first.js'), 'utf8'),
    context
  );
  return { window, sessionStorage, showAuthModal };
}

describe('calculator anonymous-first auth detection', () => {
  test('allows authenticated BondsAuth result shaped as data.user without showing login modal', async () => {
    const { window, sessionStorage, showAuthModal } = loadAnonymousFirst({
      data: { user: { id: 'admin-user', email: 'admin@example.com' } },
      error: null
    });
    const allowed = jest.fn();

    await expect(window.checkAuthForAction('excel', allowed)).resolves.toBe(true);

    expect(allowed).toHaveBeenCalledTimes(1);
    expect(showAuthModal).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('bonds_pending_action')).toBeNull();
  });

  test('still prompts when BondsAuth returns no authenticated user', async () => {
    const { window, showAuthModal } = loadAnonymousFirst({
      data: { user: null },
      error: null
    });
    const allowed = jest.fn();

    await expect(window.checkAuthForAction('pdf', allowed)).resolves.toBe(false);

    expect(allowed).not.toHaveBeenCalled();
    expect(showAuthModal).toHaveBeenCalledTimes(1);
  });

  test('pending-action auth path uses the same normalized user shape', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', 'calculators', 'anonymous-first.js'),
      'utf8'
    );
    expect(source).toContain('if (!getAuthUser(userData)) return;');
    expect(source).not.toContain('if (!userData || !userData.user) return;');
  });
});
