'use strict';

// Local fail-closed mitigation for CVE-2026-112366.
// Based on upstream proposal micromatch/picomatch#235 (unmerged as of 2026-11-18).
// Scope: exact npm-installed dev copies. Never alter package versions or audit metadata.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');
const root = path.resolve(__dirname, '../..');
const candidates = [
  ['node_modules/picomatch', '4.0.7'],
  ['node_modules/micromatch/node_modules/picomatch', '2.3.2'],
  ['node_modules/anymatch/node_modules/picomatch', '2.3.2']
];
const addition = String.raw`const branchContainsGlobStar = branch => {
  let escaped = false;
  let bracket = 0;
  for (let i = 0; i < branch.length; i++) {
    const ch = branch[i];
    if (escaped === true) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '[') { bracket++; continue; }
    if (ch === ']' && bracket > 0) { bracket--; continue; }
    if (bracket === 0 && ch === '*' && branch[i + 1] !== '(') return true;
  }
  return false;
};

`;
const original = [
  'const hasRepeatedCharPrefixOverlap = branches => {',
  '  const values = branches.map(normalizeSimpleBranch).filter(Boolean);',
  '',
  '  for (let i = 0; i < values.length; i++) {',
  '    for (let j = i + 1; j < values.length; j++) {',
  '      const a = values[i];',
  '      const b = values[j];',
  '      const char = a[0];',
  '',
  '      if (!char || a !== char.repeat(a.length) || b !== char.repeat(b.length)) {',
  '        continue;',
  '      }',
  '',
  '      if (a === b || a.startsWith(b) || b.startsWith(a)) {',
  '        return true;',
  '      }',
  '    }',
  '  }',
  '',
  '  return false;',
  '};'
].join('\n');
const fixed = [
  'const hasBranchRepetitionOverlap = branches => {',
  '  const values = branches.map(normalizeSimpleBranch).filter(Boolean);',
  '',
  '  for (let i = 0; i < values.length; i++) {',
  '    for (let j = i + 1; j < values.length; j++) {',
  '      const a = values[i];',
  '      const b = values[j];',
  '      const [short, long] = a.length <= b.length ? [a, b] : [b, a];',
  '      if (short.length > 0 && long.length % short.length === 0',
  '        && long === short.repeat(long.length / short.length)) return true;',
  '    }',
  '  }',
  '',
  '  return false;',
  '};'
].join('\n');
function replaceOnce(source, search, replacement) {
  const at = source.indexOf(search);
  if (at < 0 || source.indexOf(search, at + search.length) !== -1) {
    throw new Error('Unexpected picomatch source or duplicate patch anchor: ' + search.slice(0, 55));
  }
  return source.slice(0, at) + replacement + source.slice(at + search.length);
}
function transform(source) {
  let updated = replaceOnce(source, 'const normalizeSimpleBranch = branch => {', addition + 'const normalizeSimpleBranch = branch => {');
  updated = replaceOnce(updated, original, fixed);
  updated = replaceOnce(updated, '  const branches = splitTopLevel(body).map(branch => branch.trim());',
    '  const branches = splitTopLevel(body).map(branch => branch.trim());\n\n' +
    '  if (branches.some(branchContainsGlobStar)) return { risky: true };');
  updated = replaceOnce(updated, '      hasRepeatedCharPrefixOverlap(branches)',
    '      hasBranchRepetitionOverlap(branches)');
  return updated;
}
function verifySource(source) {
  assert(source.includes(addition), 'missing exact glob-star guard');
  assert(source.includes(fixed), 'missing exact repetition-overlap guard');
  assert(source.includes('if (branches.some(branchContainsGlobStar)) return { risky: true };'), 'missing call in risk analysis');
  assert(source.includes('hasBranchRepetitionOverlap(branches)'), 'missing new overlap call');
  assert(!source.includes('hasRepeatedCharPrefixOverlap'), 'old vulnerable logic still present');
}
const verifyOnly = process.argv.includes('--verify');
const ifPresent = process.argv.includes('--if-present');
const installedCount = candidates.filter(([dir]) => fs.existsSync(path.join(root, dir, 'package.json'))).length;
if (ifPresent && installedCount === 0) {
  console.log('PICOMATCH_DEV_COPIES_ABSENT: nothing to patch');
  process.exit(0);
}
assert.strictEqual(installedCount, candidates.length,
  'Partial picomatch dependency installation is not accepted');
const actual = [];
for (const [dir, expectedVersion] of candidates) {
  const base = path.join(root, dir);
  const pkg = JSON.parse(fs.readFileSync(path.join(base, 'package.json'), 'utf8'));
  assert.strictEqual(pkg.name, 'picomatch');
  assert.strictEqual(pkg.version, expectedVersion, 'unexpected version at ' + dir);
  const target = path.join(base, 'lib/parse.js');
  const before = fs.readFileSync(target, 'utf8');
  if (!verifyOnly && !before.includes('const branchContainsGlobStar = branch => {')) {
    const patched = transform(before);
    verifySource(patched);
    fs.writeFileSync(target, patched);
  }
  verifySource(fs.readFileSync(target, 'utf8'));
  actual.push({ dir, version: pkg.version });
}
// Run each installed copy in an isolated, bounded subprocess to detect ReDoS and compatibility regressions.
for (const { dir } of actual) {
  const code = String.raw`
const assert = require('assert');
const pm = require(process.argv[1]);
for (const pattern of ['+(*)','+(*a)','+(a*)','*(a*|b)','+(ab|abab)']) {
  assert.strictEqual(pm.isMatch(pattern,pattern),true, pattern+' should match literal self');
  assert.strictEqual(pm.isMatch('a'.repeat(90)+'!',pattern),false, pattern+' should not match attack');
}
assert.strictEqual(pm.isMatch('jsjsx','+(js|jsx)'),true);
assert.strictEqual(pm.isMatch('fff','*(f)'),true);
assert.strictEqual(pm.isMatch('abc.js','*.js'),true);
assert.strictEqual(pm.isMatch('x/y.js','**/*.js'),true);
`;
  const child = spawnSync(process.execPath, ['-e', code, path.join(root, dir)], {
    timeout: 2500, encoding: 'utf8'
  });
  assert.strictEqual(child.status, 0, dir + ' regression failure: ' + (child.error?.message || child.stderr || 'nonzero exit'));
}
console.log('PICOMATCH_CVE_2026_112366_PATCH_VERIFIED ' + JSON.stringify({ verified: actual.length, copies: actual }));
