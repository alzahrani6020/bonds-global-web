const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXPECTED_VERSION = '3.1.3';
const EXPECTED_SUFFIX = `?v=${EXPECTED_VERSION}`;
// Match bonds-auth-2026.js references inside quoted strings (src, href, imports, etc.)
const FILE_RE = /["']([^"']*bonds-auth-2026\.js(?:\?v=[^"'\s]*)?)["']/g;

const EXCLUDED_DIR_PARTS = new Set([
  'node_modules',
  '.git',
  '.vercel',
  '.next',
  '.archive',
  'templates',
  'test-results',
  'playwright-report',
  'coverage',
  '.cache',
  '__pycache__',
  'supabase',
  'tests',
]);

const EXCLUDED_FILE_PARTS = [
  'node_modules',
  '.git',
  '.vercel',
  '.next',
  '.archive',
  'templates',
  '/tests/',
  'test-results',
  'playwright-report',
  'coverage',
  '.cache',
  '__pycache__',
  'supabase/.temp',
];

const EXTENSIONS = new Set(['.html', '.js']);

let examined = 0;
const issues = [];

function isAllowed(filePath) {
  const rel = path.relative(ROOT, filePath).replace(/\\/g, '/');
  const lower = rel.toLowerCase();
  if (!EXTENSIONS.has(path.extname(filePath).toLowerCase())) return false;
  for (const part of EXCLUDED_FILE_PARTS) {
    if (lower.includes(part)) return false;
  }
  for (const part of filePath.split(path.sep)) {
    if (EXCLUDED_DIR_PARTS.has(part)) return false;
  }
  return true;
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIR_PARTS.has(entry.name)) continue;
      walk(full);
    } else if (entry.isFile() && isAllowed(full)) {
      examined++;
      const text = fs.readFileSync(full, 'utf8');
      let match;
      while ((match = FILE_RE.exec(text)) !== null) {
        const reference = match[1] || '';
        const suffix = reference.includes('?') ? reference.slice(reference.indexOf('?')) : '';
        if (suffix !== EXPECTED_SUFFIX) {
          issues.push({
            file: path.relative(ROOT, full).replace(/\\/g, '/'),
            line: text.slice(0, match.index).split('\n').length,
            reference
          });
        }
      }
    }
  }
}

walk(ROOT);

if (issues.length === 0) {
  console.log(`✅ All ${examined} examined files use bonds-auth-2026.js${EXPECTED_SUFFIX}`);
  process.exit(0);
} else {
  console.error(`❌ Found ${issues.length} outdated/missing version reference(s) in ${examined} examined files:`);
  for (const issue of issues) {
    console.error(`  ${issue.file}:${issue.line} → ${issue.reference}`);
  }
  process.exit(1);
}
