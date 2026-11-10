'use strict';

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const { aiChatHandler } = require('../../v3/api/ai');

describe('assistant chat rate-limit ownership', () => {
  const root = path.resolve(__dirname, '..', '..');

  test('AI chat handler does not maintain a second in-memory rate limiter', () => {
    const source = fs.readFileSync(path.join(root, 'v3/api/ai.js'), 'utf8');
    expect(source).not.toMatch(/const\s+rateLimiter\s*=\s*new\s+Map/);
    expect(source).not.toMatch(/function\s+checkRateLimit\s*\(/);
    expect(source).toContain('MAX_CHAT_BODY_BYTES = 1_048_576');
  });

  test('outer V3 wrapper delegates ordinary routes without applying category rate limiting twice', () => {
    const rootRouter = fs.readFileSync(path.join(root, 'api/v3/index.js'), 'utf8');
    const v3Router = fs.readFileSync(path.join(root, 'v3/api/index.js'), 'utf8');

    expect(rootRouter).not.toContain('checkRateLimit(category, req, res)');
    expect(rootRouter).toContain("checkRateLimit('document_analysis', req, res, undefined, true)");
    expect(rootRouter).toContain('return v3Handler(req, res);');

    expect(v3Router).toContain("if (path === '/ai/chat') return 'ai';");
    expect(v3Router).toContain('checkRateLimit(category, req, res)');
  });

  function createRequestResponse(body) {
    const req = new EventEmitter();
    req.method = 'POST';
    req.headers = {};
    req.socket = { remoteAddress: '127.0.0.1' };
    req.destroyedByLimit = false;
    req.destroy = () => {
      req.destroyedByLimit = true;
    };

    const res = new EventEmitter();
    res.headers = {};
    res.headersSent = false;
    res.writableEnded = false;
    res.setHeader = (name, value) => {
      res.headers[String(name).toLowerCase()] = value;
    };

    const done = new Promise(resolve => {
      res.end = payload => {
        res.writableEnded = true;
        res.body = payload ? String(payload) : '';
        resolve();
      };
    });

    process.nextTick(() => {
      req.emit('data', Buffer.from(body, 'utf8'));
      req.emit('end');
    });

    return { req, res, done };
  }

  test('chat rejects a JSON body larger than 1 MiB with 413 before authentication', async () => {
    const body = JSON.stringify({
      messages: [{ role: 'user', content: 'x'.repeat(1_048_576) }]
    });
    const { req, res, done } = createRequestResponse(body);

    await aiChatHandler(req, res);
    await done;

    expect(res.statusCode).toBe(413);
    expect(req.destroyedByLimit).toBe(true);
    expect(JSON.parse(res.body)).toEqual({ error: 'Request body too large' });
  });

  test('small valid JSON passes body parsing and reaches the authentication gate', async () => {
    const body = JSON.stringify({
      messages: [{ role: 'user', content: 'hello' }]
    });
    const { req, res, done } = createRequestResponse(body);

    await aiChatHandler(req, res);
    await done;

    expect(req.destroyedByLimit).toBe(false);
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toBe('AUTHENTICATION_REQUIRED');
  });
});
