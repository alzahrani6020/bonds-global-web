'use strict';

const fs = require('fs');
const path = require('path');

describe('assistant chat rate-limit ownership', () => {
  const root = path.resolve(__dirname, '..', '..');

  test('AI chat handler does not maintain a second in-memory rate limiter', () => {
    const source = fs.readFileSync(path.join(root, 'v3/api/ai.js'), 'utf8');
    expect(source).not.toMatch(/const\s+rateLimiter\s*=\s*new\s+Map/);
    expect(source).not.toMatch(/function\s+checkRateLimit\s*\(/);
    expect(source).toContain('request body too large');
  });

  test('both V3 router boundaries classify /ai/chat for central rate limiting', () => {
    const rootRouter = fs.readFileSync(path.join(root, 'api/v3/index.js'), 'utf8');
    const v3Router = fs.readFileSync(path.join(root, 'v3/api/index.js'), 'utf8');

    expect(rootRouter).toContain("if (path === '/ai/chat') return 'ai';");
    expect(v3Router).toContain("if (path === '/ai/chat') return 'ai';");
    expect(rootRouter).toContain('checkRateLimit(category, req, res)');
    expect(v3Router).toContain('checkRateLimit(category, req, res)');
  });
});
