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

function loadPage({ localStorageInitial = {}, fetchResponses = [], getUserResult = { user: null }, workspaces = [] } = {}) {
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
      json: async () => ({ projects: next?.projects || [], requests: next?.requests || [] })
    };
  });

  const BondsAuth = {
    getUser: jest.fn(async () => getUserResult),
    initSiteAuth: jest.fn(async () => {}),
    ensureEnv: jest.fn(async () => {}),
    getSupabase: jest.fn(() => ({
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(async () => ({ data: workspaces, error: null }))
          }))
        }))
      }))
    })),
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
  test('service requests provide a reference-scoped details action', async () => {
    const user = { id: 'u1', email: 'a@example.com' };
    const requests = [{
      id: 'request-1', request_reference: 'SR-ABC123',
      status: 'submitted', service: { name_ar: 'القيود اليومية', code: 'daily_entries' },
      created_at: '2026-10-25T12:00:00Z'
    }];
    const { elements, authenticatedFetch } = loadPage({
      getUserResult: { data: { user } },
      fetchResponses: [{ projects: [] }, { requests }]
    });
    await new Promise(r => setTimeout(r, 0));
    expect(authenticatedFetch).toHaveBeenCalledWith('/api/v3/services/requests',
      expect.objectContaining({ method: 'GET' }));
    expect(elements.serviceRequestsList.innerHTML).toContain('/my-bonds/request/?reference=SR-ABC123');
    expect(elements.serviceRequestsList.innerHTML).toContain('عرض الطلب');
    expect(elements.serviceRequestsList.innerHTML).toContain('القيود اليومية');
  });

  test('RLS-visible workspace appears as a CRM deep link', async () => {
    const { elements } = loadPage({
      getUserResult: { data: { user: { id: 'u1', email: 'a@example.com' } } },
      fetchResponses: [{ projects: [] }, { requests: [] }],
      workspaces: [{ id: '94c6dbfe-c53a-4686-ad42-eb01893a3e80', name: 'شركة الاختبار' }]
    });
    await new Promise(r => setTimeout(r, 0));
    expect(elements.workspacesSection.style.display).toBe('block');
    expect(elements.workspacesList.innerHTML).toContain('شركة الاختبار');
    expect(elements.workspacesList.innerHTML).toContain('/my-bonds/crm/?workspace_id=94c6dbfe-c53a-4686-ad42-eb01893a3e80');
  });

  test('request details page uses owner-scoped API readback, not browser storage', () => {
    const detailsPage = fs.readFileSync(path.join(__dirname, '..', 'my-bonds', 'request', 'index.html'), 'utf8');
    expect(detailsPage).toContain('/api/v3/services/requests?reference=');
    expect(detailsPage).toContain('request.request_reference !== reference');
    expect(detailsPage).toContain('BondsAuth.authenticatedFetch');
    expect(detailsPage).not.toContain('localStorage');
    expect(detailsPage).not.toContain("url.searchParams.set('request_id'");
  });

});
