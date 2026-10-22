const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const needles = [
  'feasibility-report.pdf',
  'food-manufacturing-jeddah-feasibility.pdf',
];

const allowed = new Set([
  '.gitignore',
  'docs/GENERATED_ARTIFACT_RETENTION_POLICY.md',
  'scripts/generate-report.js',
  'scripts/generate-feasibility-pdf.js',
  'scripts/verify-generated-pdf-references.js',
  'calculator-wizard.js', // client-side jsPDF download filename; does not reference a repository binary
]);

const ignoredDirs = new Set([
  '.git',
  'node_modules',
  '.vercel',
  'test-results',
  'playwright-report',
  'coverage',
  '.cache',
]);

const textExtensions = new Set([
  '.html', '.htm', '.js', '.mjs', '.cjs', '.json', '.css', '.md', '.txt',
  '.yml', '.yaml', '.xml', '.csv', '.sql', '.py', '.ps1', '.bat', '.sh',
]);

const violations = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }

    const rel = path.relative(root, full).split(path.sep).join('/');
    if (allowed.has(rel)) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!textExtensions.has(ext) && entry.name !== '.gitignore' && entry.name !== '.vercelignore') continue;

    let content;
    try {
      content = fs.readFileSync(full, 'utf8');
    } catch {
      continue;
    }

    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      for (const needle of needles) {
        if (lines[i].includes(needle)) {
          violations.push({ file: rel, line: i + 1, needle, text: lines[i].trim() });
        }
      }
    }
  }
}

walk(root);

if (violations.length) {
  console.error('Unexpected generated PDF references found:');
  for (const v of violations) {
    console.error(`- ${v.file}:${v.line} [${v.needle}] ${v.text}`);
  }
  process.exit(1);
}

console.log('Generated PDF reference audit passed: no unexpected runtime/source references found.');
