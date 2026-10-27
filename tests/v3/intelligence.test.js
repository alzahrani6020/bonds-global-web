/**
 * @jest-environment node
 */

const mockSupabaseClient = {
  from: jest.fn(() => ({
    insert: jest.fn(() => Promise.resolve({ error: null }))
  }))
};

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => mockSupabaseClient)
}));

jest.mock('../../lib/api/rate-limit', () => ({
  checkRateLimit: jest.fn(() => false)
}));

const handler = require('../../v3/api/index.js');

function mockReq(overrides = {}) {
  const body = overrides.body;
  const chunks = body ? [JSON.stringify(body)] : [];
  return {
    method: 'GET',
    headers: { host: 'localhost' },
    url: '/api/v3/intelligence/engines',
    socket: { remoteAddress: '127.0.0.1' },
    on(event, cb) {
      if (event === 'data') chunks.forEach(cb);
      if (event === 'end') cb();
      return this;
    },
    ...overrides
  };
}

function mockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    _json: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(key, value) { this.headers[key] = value; return this; },
    end(data) {
      if (data) {
        try { this._json = JSON.parse(data); } catch { /* ignore non-JSON */ }
      }
      return this;
    },
    json(data) { this._json = data; return this; }
  };
  return res;
}

describe('/api/v3/intelligence', () => {
  test('GET /intelligence/engines lists engines', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/intelligence/engines' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res._json.engines)).toBe(true);
    expect(res._json.engines.length).toBeGreaterThan(0);
  });

  test('GET /intelligence/engines/:code returns metadata', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/intelligence/engines/risk' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.engine.code).toBe('risk');
  });

  test('POST /intelligence/run returns unified result', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/intelligence/run',
      body: {
        intent: 'unknown',
        engines: ['recommendation', 'blind_spot', 'decision_graph', 'recommendation_synthesizer'],
        sector: 'restaurant',
        country: 'SA',
        language: 'ar',
        persist: false
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.engines.blind_spot).toBeDefined();
    expect(res._json.engines.decision_graph).toBeDefined();
    expect(typeof res._json.confidence).toBe('number');
  });

  test('anonymous intelligence run cannot attribute or persist as an arbitrary user', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '../../v3/api/intelligence.js'), 'utf8');
    expect(source).toContain('userId: user?.id || null');
    expect(source).toContain('persist: Boolean(user) && body.persist !== false');
    expect(source).not.toContain('user?.id || body.userId');
  });

  test('POST /intelligence/adapt runs a single engine', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/intelligence/adapt',
      body: {
        engine: 'recommendation',
        sector: 'restaurant',
        country: 'SA',
        decisionType: 'feasibility',
        language: 'ar'
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res._json.engine).toBe('recommendation');
  });

  test('POST /intelligence/synthesize returns actions', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/intelligence/synthesize',
      body: {
        sector: 'restaurant',
        country: 'SA',
        language: 'ar',
        engineResults: {
          recommendation: { confidence: 70, output: { recommendations: [{ title: 'A', action: 'B', confidence: 70, source: 'x' }] } }
        }
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res._json.output.actions)).toBe(true);
  });


  test('POST /intelligence/outcomes requires authentication', async () => {
    const req = mockReq({
      method: 'POST',
      url: '/api/v3/intelligence/outcomes',
      body: {
        decisionId: '00000000-0000-0000-0000-000000000001',
        actualOutcome: { revenue: 100 }
      }
    });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(res._json.error).toBe('Unauthorized');
  });

  test('unknown intelligence endpoint returns 404', async () => {
    const req = mockReq({ method: 'GET', url: '/api/v3/intelligence/unknown' });
    const res = mockRes();
    await handler(req, res);
    expect(res.statusCode).toBe(404);
  });
});


describe('V3 AI chat runtime wiring', () => {
  test('requires authentication and routes signed-in chat through the planner-first universal orchestrator', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(path.join(__dirname, '../../v3/api/ai.js'), 'utf8');
    expect(source).toContain("require('../../lib/services/service-execution-router')");
    expect(source).toContain("require('../../lib/assistant/universal-orchestrator')");
    expect(source).toContain("error: 'AUTHENTICATION_REQUIRED'");
    expect(source).toContain('requires_authentication: true');
    expect(source).toContain('runUniversalOrchestrator(messages, enrichedContext, {');
    expect(source).not.toContain('const deterministicReply =');
    expect(source).toContain('generateNativeReply(messages, enrichedContext, {');
    expect(source).not.toContain("source: 'data-driven'");
    expect(source).not.toContain("source: aiResult ? 'bonds-assistant-ai' : 'data-driven-fallback'");
    expect(source).toContain("source: 'bonds-assistant-ai'");
    expect(source).toContain("provider: aiResult.provider || 'BONDS'");
    expect(source).toContain("action: 'ai_reason'");
  });
});
