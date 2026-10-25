'use strict';

const fs = require('fs');
const path = require('path');

describe('V3 subpath routing through Vercel', () => {
  test('preserves the V3 subpath in the rewrite', () => {
    const config = JSON.parse(
      fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8')
    );
    const rewrite = (config.rewrites || []).find(
      item => item.source === '/api/v3/(.*)'
    );
    expect(rewrite).toBeDefined();
    expect(rewrite.destination).toBe('/api/v3?__path=$1');
  });

  test('api/v3 gateway reconstructs the original subpath from __path', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../api/v3/index.js'),
      'utf8'
    );
    expect(source).toContain("req.query?.__path");
    expect(source).toContain("url.searchParams.get('__path')");
    expect(source).toContain("'/' + rewrittenPath.replace(/^\\/+/, '')");
  });

  test('accounting entities route remains a governed compute route', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '../../v3/api/index.js'),
      'utf8'
    );
    expect(source).toContain("path.startsWith('/services/accounting/')");
    expect(source).toContain("return servicesRouter(req, res, path, supabase, user)");
  });
});
