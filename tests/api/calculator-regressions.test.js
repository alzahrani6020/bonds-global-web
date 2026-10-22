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

test('menu matrix reads user-scoped scores without missing API route', () => {
  const source = read('calculators/menu-engineering.html');
  const start = source.indexOf('async function loadMatrix()');
  const segment = source.slice(start, start + 1800);
  assert.ok(start >= 0);
  assert.match(segment, /sb\.from\('menu_engineering_scores'\)/);
  assert.match(segment, /\.eq\('user_id', currentUser\.id\)/);
  assert.doesNotMatch(segment, /fetch\(\`\/api\/menu-engineering/);
});


test('calculator geography prefers the live production catalog and keeps static fallback', () => {
  const source = read('calculators/shared-geo.js');
  assert.match(source, /const LIVE_CITIES_API = '\/api\/v3\/catalog\/cities'/);
  assert.match(source, /fetch\(\s*LIVE_CITIES_API \+ '\?country='/);
  assert.match(source, /cache: 'no-store'/);
  assert.match(source, /return loadLiveCountry\(upper\)\.catch/);
  assert.match(source, /return loadCountryChunk\(upper\)/);
  assert.match(source, /newly promoted\/added cities appear automatically/);
});


test('factory cost calculator merges live geography with configured city pricing', () => {
  const page = read('calculators/factory-cost.html');
  const shared = read('calculators/factory-cost-shared.js');
  assert.match(page, /shared-geo\.js\?v=8/);
  assert.match(shared, /mergeConfiguredWithLive/);
  assert.match(shared, /window\.BondsGeo\.ensureCountry\(liveCountryCode\)/);
  assert.match(shared, /live geography unavailable; using configured cities/);
});
