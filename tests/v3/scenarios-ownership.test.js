/**
 * @jest-environment node
 */

const mockUser = { id: 'user-a', email: 'a@example.test' };

function makeChain(result) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    maybeSingle: jest.fn(() => Promise.resolve(result)),
    insert: jest.fn(() => chain),
    then: (resolve) => Promise.resolve(result).then(resolve)
  };
  return chain;
}

const mockServiceClient = {
  from: jest.fn(() => makeChain({ data: null, error: null }))
};

let userProjectResult = { data: { id: 'project-a' }, error: null };
let insertedRecords = null;
const mockUserClient = {
  from: jest.fn((table) => {
    if (table === 'user_projects') return makeChain(userProjectResult);
    if (table === 'project_scenarios') {
      const chain = makeChain({ data: [{ id: 'scenario-1', name: 'Base', created_at: '2026-10-17T00:00:00Z' }], error: null });
      chain.insert = jest.fn((records) => {
        insertedRecords = records;
        return chain;
      });
      return chain;
    }
    return makeChain({ data: null, error: null });
  })
};

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => mockServiceClient)
}));

jest.mock('../../v3/lib/auth', () => ({
  getUserFromToken: jest.fn(async () => mockUser)
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockUserClient)
}));

jest.mock('../../v3/engine/loader', () => ({
  loadProjectModel: jest.fn(async () => ({ projectModel: {}, assumptions: [], risks: [] }))
}));

jest.mock('../../v3/engine/ScenarioEngine', () => ({
  normalizeScenario: jest.fn((s) => s),
  runScenarios: jest.fn(() => ({
    baseline: { summary: {} },
    scenarios: [{ name: 'Base', shocks: [], result: { summary: {} }, comparison: {} }]
  }))
}));

const { scenariosRouter } = require('../../v3/api/scenarios');

function req(body) {
  const payload = JSON.stringify(body);
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'x-forwarded-for': '198.51.100.10' },
    socket: { remoteAddress: '198.51.100.10' },
    on(event, cb) {
      if (event === 'data') cb(payload);
      if (event === 'end') cb();
      return this;
    }
  };
}

function res() {
  return {
    statusCode: 200,
    body: null,
    setHeader() {},
    end(payload) { this.body = payload ? JSON.parse(payload) : null; }
  };
}

const baseBody = {
  projectModelCode: 'model-1',
  scenarios: [{ name: 'Base', shocks: [] }],
  save: true
};

describe('scenario project ownership boundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userProjectResult = { data: { id: 'project-a' }, error: null };
    insertedRecords = null;
  });

  test('A + A project saves', async () => {
    const response = res();
    await scenariosRouter(req({ ...baseBody, projectId: 'project-a' }), response, '/calculate/scenarios');
    expect(response.statusCode).toBe(200);
    expect(insertedRecords).not.toBeNull();
    expect(insertedRecords[0].project_id).toBe('project-a');
  });

  test('A + B project is denied before scenario insert', async () => {
    userProjectResult = { data: null, error: null };
    const response = res();
    await scenariosRouter(req({ ...baseBody, projectId: 'project-b' }), response, '/calculate/scenarios');
    expect(response.statusCode).toBe(404);
    expect(response.body.error).toBe('Project not found');
    expect(insertedRecords).toBeNull();
  });

  test('A + nonexistent project is denied before scenario insert', async () => {
    userProjectResult = { data: null, error: null };
    const response = res();
    await scenariosRouter(req({ ...baseBody, projectId: '00000000-0000-0000-0000-000000000099' }), response, '/calculate/scenarios');
    expect(response.statusCode).toBe(404);
    expect(insertedRecords).toBeNull();
  });

  test('null project preserves unlinked scenario behavior', async () => {
    const response = res();
    await scenariosRouter(req(baseBody), response, '/calculate/scenarios');
    expect(response.statusCode).toBe(200);
    expect(insertedRecords).not.toBeNull();
    expect(insertedRecords[0].project_id).toBeNull();
  });
});
