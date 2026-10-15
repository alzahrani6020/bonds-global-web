const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = p => fs.readFileSync(path.join(__dirname, '..', '..', p), 'utf8');

test('V3 project creation never inserts null metadata', () => {
  const source = read('v3/api/projects.js');
  assert.match(source, /metadata: metadata && typeof metadata === 'object' && !Array\.isArray\(metadata\) \? metadata : \{\}/);
  assert.doesNotMatch(source, /metadata: metadata \|\| null/);
});

test('pricing scroll-to-top handler contains valid JavaScript', () => {
  const html = read('calculators/pricing.html');
  assert.match(html, /onclick="window\.scrollTo\(\{top:0,behavior:'smooth'\}\)"/);
});

test('menu matrix validates status and content type before parsing JSON', () => {
  const source = read('calculators/menu-engineering.html');
  const start = source.indexOf('async function loadMatrix()');
  const segment = source.slice(start, start + 1100);
  assert.ok(start >= 0);
  assert.ok(segment.indexOf('!res.ok') < segment.indexOf('await res.json()'));
  assert.ok(segment.indexOf("contentType.includes('application/json')") < segment.indexOf('await res.json()'));
});
