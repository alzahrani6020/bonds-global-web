const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key)
  };
}

function createElement(tag) {
  return {
    tagName: tag,
    style: { display: '' },
    textContent: '',
    innerHTML: '',
    dataset: {},
    children: [],
    addEventListener: jest.fn(),
    appendChild: jest.fn(function (c) { this.children.push(c); return c; }),
    remove: jest.fn()
  };
}

function extractInlineScript(html) {
  // Return the last inline <script> block (the page logic, not the deferred layout loader).
  const matches = html.match(/<script>([\s\S]*?)<\/script>/g);
  if (!matches) throw new Error('No inline script found');
  const last = matches[matches.length - 1];
  return last.replace(/<script>|<\/script>/g, '');
}

function loadPage({ localStorageInitial = {}, fetchResponses = [], getUserResult = { user: null } } = {}) {
  const html = fs.readFileSync(path.join(__dirname, '..', 'my-bonds', 'index.html'), 'utf8');
  const script = extractInlineScript(html);
  const localStorage = createStorage(localStorageInitial);
  const elements = {};
  function getEl(id) {
    if (!elements[id]) elements[id] = createElement('div');
    return elements[id];
  }

  let fetchIndex = 0;
  const authenticatedFetch = jest.fn(async () => {
    const next = fetchResponses[fetchIndex++];
    if (next && next.authError) {
      return { ok: false, status: 401, authError: 'AUTH_REQUIRED', __authError: 'AUTH_REQUIRED' };
    }
    if (next && next.serverError) {
      return { ok: false, status: 500, serverError: true, __serverError: true, json: async () => ({ error: 'server error' }) };
    }
    if (next && next.forbidden) {
      return { ok: false, status: 403, __authError: 'FORBIDDEN', json: async () => ({ error: 'forbidden' }) };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({ projects: next?.projects || [] })
    };
  });

  const BondsAuth = {
    getUser: jest.fn(async () => getUserResult),
    initSiteAuth: jest.fn(async () => {}),
    authenticatedFetch
  };

  const document = {
    readyState: 'complete',
    addEventListener: jest.fn(),
    getElementById: getEl,
    createElement: (tag) => createElement(tag),
    body: createElement('body')
  };

  const window = {
    localStorage,
    document,
    BondsAuth,
    BondsCommon: {
      escapeHtml: (str) => String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    },
    location: { href: 'https://bonds-global.com/my-bonds/' }
  };

  const context = {
    window,
    document,
    localStorage,
    BondsCommon: window.BondsCommon,
    setTimeout,
    clearTimeout,
    console
  };

  vm.runInNewContext(script, context);

  return { window, elements, authenticatedFetch, localStorage, getUserResult };
}

describe('my-bonds page behaviour', () => {
  test('guest user sees guest CTA and local projects', async () => {
    const guestProjects = [
      { id: 'g1', title: 'مشروع محلي', summary: 'ملخص', href: '#', createdAt: '2026-01-01', source: 'local' }
    ];
    const { window, elements } = loadPage({
      localStorageInitial: { bonds_guest_projects: JSON.stringify(guestProjects) },
      getUserResult: { data: { user: null } }
    });
    await new Promise(r => setTimeout(r, 0));
    expect(elements.guestCta.style.display).toBe('block');
    expect(elements.userWelcome.style.display).toBe('none');
    expect(elements.projectsList.innerHTML).toContain('مشروع محلي');
  });

  test('logged-in user with projects shows count and list', async () => {
    const user = { id: 'u1', email: 'a@example.com', user_metadata: { restaurant_name: 'مطعمي' } };
    const projects = [
      { id: 'p1', name: 'مشروع سحابي', sector: 'تجارة', activity: 'تجزئة', created_at: '2026-02-01', metadata: {} }
    ];
    const { elements, authenticatedFetch } = loadPage({
      getUserResult: { data: { user } },
      fetchResponses: [{ projects }]
    });
    await new Promise(r => setTimeout(r, 0));
    expect(authenticatedFetch).toHaveBeenCalledWith('/api/v3/projects', expect.objectContaining({ method: 'GET' }));
    expect(elements.userWelcome.style.display).toBe('flex');
    expect(elements.guestCta.style.display).toBe('none');
    expect(elements.projectCount.textContent).toBe('1');
    expect(elements.projectsList.innerHTML).toContain('مشروع سحابي');
  });

  test('logged-in user with empty projects shows empty state', async () => {
    const user = { id: 'u1', email: 'a@example.com' };
    const { elements } = loadPage({
      getUserResult: { data: { user } },
      fetchResponses: [{ projects: [] }]
    });
    await new Promise(r => setTimeout(r, 0));
    expect(elements.projectCount.textContent).toBe('0');
    expect(elements.projectsList.innerHTML).toContain('لا توجد مشاريع محفوظة بعد');
  });

  test('401 hides both sections (auth required)', async () => {
    const user = { id: 'u1', email: 'a@example.com' };
    const { elements, authenticatedFetch } = loadPage({
      getUserResult: { data: { user } },
      fetchResponses: [{ authError: true }]
    });
    await new Promise(r => setTimeout(r, 0));
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
    expect(elements.userWelcome.style.display).toBe('none');
    expect(elements.guestCta.style.display).toBe('none');
  });

  test('403 shows retryable error without logout', async () => {
    const user = { id: 'u1', email: 'a@example.com' };
    const { elements } = loadPage({
      getUserResult: { data: { user } },
      fetchResponses: [{ forbidden: true }]
    });
    await new Promise(r => setTimeout(r, 0));
    expect(elements.userWelcome.style.display).toBe('none');
    expect(elements.projectsList.innerHTML).toContain('retryProjects');
  });

  test('500 shows server error without logout', async () => {
    const user = { id: 'u1', email: 'a@example.com' };
    const { elements } = loadPage({
      getUserResult: { data: { user } },
      fetchResponses: [{ serverError: true }]
    });
    await new Promise(r => setTimeout(r, 0));
    expect(elements.userWelcome.style.display).toBe('none');
    expect(elements.projectsList.innerHTML).toContain('تعذر تحميل المشاريع');
  });
});
