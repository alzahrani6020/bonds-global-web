/** @jest-environment node */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { withinRoot, ROOT, DEST, APPROVED_ORIGIN, EXPECTED_SHA } =
  require('../../scripts/capture-approved-production-visuals');
test('visual evidence stays inside BONDS repository and never overwrites baselines', () => {
  expect(DEST.startsWith(ROOT + path.sep)).toBe(true);
  expect(withinRoot(path.join(DEST,'desktop','index-ar.png'))).toContain('production-reference');
  expect(() => withinRoot(path.resolve(ROOT, '..', 'outside.png'))).toThrow('OUTSIDE_BONDS_ROOT');
  const content=fs.readFileSync(path.join(ROOT,'scripts/capture-approved-production-visuals.js'),'utf8');
  expect(content).toContain("flag: 'wx'");
  expect(content).not.toContain('tests/visual/baselines/');
  expect(APPROVED_ORIGIN).toBe('https://bonds-global.com');
  expect(EXPECTED_SHA).toMatch(/^[a-f0-9]{40}$/);
  for(const rule of ['.gitignore','.vercelignore']) {
    expect(fs.readFileSync(path.join(ROOT,rule),'utf8')).toMatch(/^\/tests\/visual\/production-reference\/$/m);
  }
});
