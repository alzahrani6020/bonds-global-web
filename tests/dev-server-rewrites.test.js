const fs = require('fs');
const path = require('path');
const { applyVercelApiRewrite, loadVercelApiRewrites, resolveApiRoute } = require('../scripts/dev-server');

describe('local dev server mirrors vercel.json API routing', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));

  test('every exact /api rewrite in vercel.json resolves to an existing handler locally', () => {
    const unresolved = [];
    for (const [source] of loadVercelApiRewrites()) {
      const target = applyVercelApiRewrite(source);
      if (!resolveApiRoute(target)) unresolved.push(`${source} -> ${target}`);
    }
    expect(unresolved).toEqual([]);
  });

  test('previously unrouted production endpoints now resolve', () => {
    expect(resolveApiRoute(applyVercelApiRewrite('/api/capture-lead'))).toBe('platform.js');
    expect(resolveApiRoute(applyVercelApiRewrite('/api/funding-request'))).toBe('funding.js');
    expect(resolveApiRoute(applyVercelApiRewrite('/api/market-intelligence'))).toBe('reference-data.js');
    expect(resolveApiRoute(applyVercelApiRewrite('/api/social-feed'))).toBe('v3/index.js');
  });

  test('destination query is merged with the original query string', () => {
    expect(applyVercelApiRewrite('/api/social-feed?limit=5')).toBe('/api/v3?__route=social-feed&limit=5');
    expect(applyVercelApiRewrite('/api/funding-request')).toBe('/api/funding?action=funding-request');
  });

  test('non-rewritten and regex rules are left untouched', () => {
    expect(applyVercelApiRewrite('/api/health')).toBe('/api/health');
    expect(applyVercelApiRewrite('/api/v3/ai/chat')).toBe('/api/v3/ai/chat');
  });

  test('loads a meaningful number of rewrites from vercel.json', () => {
    const exact = config.rewrites.filter(rule =>
      rule.source.startsWith('/api/') && rule.destination.startsWith('/api/') &&
      !/[()*:]/.test(rule.source) && rule.source !== rule.destination);
    expect(loadVercelApiRewrites().size).toBeGreaterThanOrEqual(exact.length - 5);
  });
});