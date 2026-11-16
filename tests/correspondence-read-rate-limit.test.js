'use strict';

const fs = require('node:fs');
const path = require('node:path');

const platform = fs.readFileSync(path.resolve(__dirname, '../api/platform.js'), 'utf8');
const rateLimit = fs.readFileSync(path.resolve(__dirname, '../lib/api/rate-limit.js'), 'utf8');

describe('governed correspondence read/mutation throttling', () => {
  test('list/get/summary read traffic uses bounded authenticated read budget', () => {
    expect(platform).toContain("req.method === 'GET' ? 'admin_read' : 'auth'");
    expect(rateLimit).toMatch(/admin_read:\s*\{\s*limit:\s*60/);
  });

  test('write operations retain strict auth throttle and verification remains public', () => {
    expect(platform).toContain("corrAction === 'verify' || corrAction === 'qr'");
    expect(platform).toContain("await checkRateLimit(corrRateCategory, req, res)");
    expect(rateLimit).toMatch(/auth:\s*\{\s*limit:\s*10/);
    expect(platform).toContain('return await correspondence.handler(req, res)');
  });
});
