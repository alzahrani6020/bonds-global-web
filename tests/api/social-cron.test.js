/**
 * @jest-environment node
 */

const mockSupabaseClient = {
  from: jest.fn(),
  auth: { getUser: jest.fn() }
};

jest.mock('../../lib/api/supabase', () => jest.fn(() => mockSupabaseClient));

const mockPublishToPlatforms = jest.fn();
jest.mock('../../lib/social', () => ({
  publishToPlatforms: (...args) => mockPublishToPlatforms(...args)
}));

const v3Handler = require('../../api/v3/index.js');

function mockReq(overrides = {}) {
  return {
    method: 'GET',
    url: '/api/v3',
    headers: {},
    query: {},
    body: {},
    socket: {},
    ...overrides
  };
}

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    _json: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end() { return this; },
    json(data) { this._json = data; return this; }
  };
}

describe('/api/social-cron', () => {
  const originalCron = process.env.CRON_SECRET;

  beforeAll(() => { process.env.CRON_SECRET = 'test-cron-secret'; });
  afterAll(() => { process.env.CRON_SECRET = originalCron; });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects missing cron secret', async () => {
    const res = mockRes();
    await v3Handler(mockReq({ query: { __route: 'social-cron' } }), res);
    expect(res.statusCode).toBe(401);
  });

  test('processes empty due posts list', async () => {
    mockSupabaseClient.from.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      then: cb => cb({ data: [], error: null })
    }));
    const res = mockRes();
    await v3Handler(mockReq({ query: { __route: 'social-cron', cronSecret: 'test-cron-secret' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res._json.processed).toBe(0);
  });

  test('publishes a due post and updates status', async () => {
    const duePost = {
      id: 'post-1',
      platforms: ['x'],
      content: 'Hello',
      media_url: null,
      media_type: 'image',
      scheduled_at: new Date().toISOString(),
    };
    mockPublishToPlatforms.mockResolvedValue({ success: true, results: [{ platform: 'x', success: true, id: '123' }] });
    mockSupabaseClient.from.mockImplementation((table) => {
      if (table === 'social_scheduled_posts') {
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          lte: jest.fn().mockReturnThis(),
          order: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          update: jest.fn().mockReturnThis(),
          then: cb => cb({ data: [duePost], error: null })
        };
      }
      return {};
    });
    const res = mockRes();
    await v3Handler(mockReq({ query: { __route: 'social-cron', cronSecret: 'test-cron-secret' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res._json.processed).toBe(1);
    expect(mockPublishToPlatforms).toHaveBeenCalledWith(['x'], { text: 'Hello', mediaUrl: null, mediaType: 'image' });
  });
});
