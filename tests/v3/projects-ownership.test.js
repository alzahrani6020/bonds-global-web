/**
 * @jest-environment node
 */

const user = { id: 'user-a', email: 'a@example.test' };

function projectChain(row) {
  const filters = [];
  const chain = {
    filters,
    select: jest.fn(() => chain),
    eq: jest.fn((k, v) => { filters.push([k, v]); return chain; }),
    order: jest.fn(() => chain),
    single: jest.fn(async () => {
      const id = filters.find(([k]) => k === 'id')?.[1];
      const owner = filters.find(([k]) => k === 'user_id')?.[1];
      if (id === 'project-b' && owner === 'user-a') return { data: null, error: { message: 'not found' } };
      return { data: row || { id: id || 'project-a', user_id: owner || 'user-a', name: 'A' }, error: null };
    }),
    delete: jest.fn(() => chain),
    insert: jest.fn(() => chain),
    then: (resolve) => Promise.resolve({ data: [row].filter(Boolean), error: null }).then(resolve)
  };
  return chain;
}

let lastProjectChain;
const mockServiceClient = {
  from: jest.fn((table) => {
    if (table === 'bonds_projects') {
      lastProjectChain = projectChain();
      return lastProjectChain;
    }
    return projectChain();
  })
};

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => mockServiceClient)
}));

jest.mock('../../lib/enterprise-lifecycle', () => ({
  LifecycleEngine: class {
    async initialize() { return this; }
    async createInstance() {}
  }
}));

jest.mock('../../lib/ecc/role-guard', () => ({
  getUserRole: jest.fn(),
  can: jest.fn()
}));

const { projectsRouter } = require('../../v3/api/projects');

function req(method='GET') {
  return { method, headers: {}, on() { return this; } };
}
function res() {
  return {
    statusCode: 200,
    body: null,
    setHeader() {},
    end(payload) { this.body = payload ? JSON.parse(payload) : null; }
  };
}

describe('V3 project ownership boundary with service-role client', () => {
  beforeEach(() => jest.clearAllMocks());

  test('A can GET A project and query is scoped to A', async () => {
    const response = res();
    await projectsRouter(req('GET'), response, '/projects/project-a', user);
    expect(response.statusCode).toBe(200);
    expect(lastProjectChain.filters).toEqual(expect.arrayContaining([
      ['id', 'project-a'],
      ['user_id', 'user-a']
    ]));
  });

  test('A cannot GET B project', async () => {
    const response = res();
    await projectsRouter(req('GET'), response, '/projects/project-b', user);
    expect(response.statusCode).toBe(404);
    expect(lastProjectChain.filters).toEqual(expect.arrayContaining([
      ['id', 'project-b'],
      ['user_id', 'user-a']
    ]));
  });

  test('A delete is scoped to A before service-role delete', async () => {
    const response = res();
    await projectsRouter(req('DELETE'), response, '/projects/project-b', user);
    expect(response.statusCode).toBe(200);
    expect(lastProjectChain.filters).toEqual(expect.arrayContaining([
      ['id', 'project-b'],
      ['user_id', 'user-a']
    ]));
  });
});
