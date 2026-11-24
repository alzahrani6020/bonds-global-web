'use strict';

const fs = require('fs');
const path = require('path');

const OWNER_ID = '50ca4eaa-8362-46eb-98b7-5fe5b3006f4e';
const OTHER_ID = 'bfb54793-4e8d-452f-9831-537dd68d03f6';
const SOURCE = fs.readFileSync(path.join(__dirname, '../../lib/api/correspondence.js'), 'utf8');

function subject(userId) {
  const db = {
    auth: {
      getUser: jest.fn(async token => ({
        data: { user: { id: userId } },
        error: null
      }))
    },
    from: jest.fn(() => { throw new Error('Unauthorized request reached database'); })
  };
  const m = { exports: {} };
  const mockedRequire = id => {
    if (id === './supabase') return () => db;
    if (id === './email') return { sendEmail: jest.fn() };
    return require(id);
  };
  new Function('require', 'module', 'exports', SOURCE)(mockedRequire, m, m.exports);
  const res = {
    statusCode: null,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    setHeader: jest.fn()
  };
  return { handler: m.exports.handler, db, res };
}

function request(action, method = 'GET') {
  const query = new URLSearchParams({ action, id: '26832075-73f5-4bd1-abd7-e1cc50722e47' });
  return {
    method,
    headers: { host: 'bonds-global.com', authorization: 'Bearer isolated-fake-test-token' },
    url: '/api/correspondence?' + query.toString(),
    query: Object.fromEntries(query),
    body: { id: '26832075-73f5-4bd1-abd7-e1cc50722e47', target: 'approved' }
  };
}

describe('owner-only governed correspondence boundary', () => {
  let originalServiceKey;
  beforeAll(() => {
    originalServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-placeholder-not-a-credential';
  });
  afterAll(() => {
    if (originalServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceKey;
  });

  test.each([
    ['list', 'GET'], ['summary', 'GET'], ['my-work', 'GET'],
    ['issue-ledger', 'GET'], ['get', 'GET'],
    ['create', 'POST'], ['save-version', 'POST'],
    ['import-device', 'POST'], ['artifact-download-url', 'POST'],
    ['artifact-upload-url', 'POST'], ['artifact-finalize', 'POST'],
    ['transition', 'POST'], ['mark-signature', 'POST'],
    ['mark-stamp', 'POST'], ['send', 'POST'], ['revoke-issue', 'POST']
  ])('rejects non-owner %s / %s before database or document mutation', async (action, method) => {
    const { handler, db, res } = subject(OTHER_ID);
    await handler(request(action, method), res);
    expect(res.statusCode).toBe(403);
    expect(res.body).toMatchObject({ code: 'CORRESPONDENCE_OWNER_ONLY' });
    expect(db.from).not.toHaveBeenCalled();
  });

  test('rejects non-owner official PDF preview without touching correspondence records', async () => {
    const { handler, db, res } = subject(OTHER_ID);
    await handler(request('official-preview'), res);
    expect(res.statusCode).toBe(403);
    expect(db.from).not.toHaveBeenCalled();
  });

  test('authorized owner passes owner-only boundary and reaches normal server authorization', async () => {
    const { handler, db, res } = subject(OWNER_ID);
    await expect(handler(request('list'), res)).rejects.toThrow('Unauthorized request reached database');
    expect(db.from).toHaveBeenCalledWith('admin_roles');
  });

  test('browser hides editor and download surfaces if owner authorization fails', () => {
    const browser = fs.readFileSync(path.join(__dirname, '../../components/letterhead-correspondence.js'), 'utf8');
    const init = browser.slice(browser.indexOf('async function initialize()'));
    expect(init.indexOf("await api('list', { query: { page: 1, page_size: 1 } })")).toBeGreaterThan(0);
    expect(init.indexOf("await api('list', { query: { page: 1, page_size: 1 } })")).toBeLessThan(init.indexOf('buildGovernanceBar()'));
    expect(init).toContain('document.body.replaceChildren(screen)');
  });
});
