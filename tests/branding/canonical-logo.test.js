/**
 * Canonical Bonds logo contract.
 *
 * Public web pages must use the current v2 brand assets. Legacy 2026 assets
 * are prohibited so old lobby/box artwork cannot reappear in templates.
 *
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SKIP = new Set(['.git', 'node_modules', 'coverage', '.vercel', 'tmp', 'tmp-crawler']);
const TEXT_EXT = /\.(html|js|css|json|md|yml|yaml|txt)$/i;

const LEGACY = [
  'assets/bonds-logo-2026-sm.webp',
  '/assets/bonds-logo-2026-sm.webp',
  '../assets/bonds-logo-2026-sm.webp',
  'assets/bonds-logo-2026.webp',
  '/assets/bonds-logo-2026.webp',
  '../assets/bonds-logo-2026.webp',
  'assets/bonds-logo-2026-header.webp',
  '/assets/bonds-logo-2026-header.webp',
  '../assets/bonds-logo-2026-header.webp'
];

function collectFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFiles(full, out);
    else if (entry.isFile() && TEXT_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

describe('canonical Bonds logo', () => {
  test('legacy logo assets are not referenced anywhere in web source', () => {
    const offenders = [];
    for (const file of collectFiles(ROOT)) {
      const rel = path.relative(ROOT, file).replace(/\\/g, '/');
      if (rel === 'tests/branding/canonical-logo.test.js') continue;
      const source = fs.readFileSync(file, 'utf8');
      const matches = LEGACY.filter(token => source.includes(token));
      if (matches.length) offenders.push({ file: rel, matches });
    }
    expect(offenders).toEqual([]);
  });

  test('canonical current interface logo exists', () => {
    expect(fs.existsSync(path.join(ROOT, 'assets', 'bonds-logo-2026-v2-sm.webp'))).toBe(true);
  });
});
