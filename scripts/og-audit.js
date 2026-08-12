/**
 * Audit Open Graph / Twitter Card / canonical tags across public HTML pages.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

const PATTERNS = [
  '*.html',
  'en/**/*.html',
  'blog/**/*.html',
  'calculators/**/*.html',
  'sectors/**/*.html',
  'v3/**/*.html',
  'wave4/**/*.html',
];

const files = PATTERNS.flatMap((p) => {
  try {
    return fs.globSync(p, { cwd: ROOT, absolute: true });
  } catch {
    return [];
  }
}).filter((f) => !f.includes('node_modules') && !f.includes('.vercel') && !path.basename(f).startsWith('google') && !path.basename(f).startsWith('BingSiteAuth'));

const requiredMeta = [
  { name: 'description', attr: 'name' },
  { name: 'og:title', attr: 'property' },
  { name: 'og:description', attr: 'property' },
  { name: 'og:image', attr: 'property' },
  { name: 'og:url', attr: 'property' },
  { name: 'og:type', attr: 'property' },
  { name: 'twitter:card', attr: 'name' },
  { name: 'twitter:title', attr: 'name' },
  { name: 'twitter:description', attr: 'name' },
  { name: 'twitter:image', attr: 'name' },
];

let exitCode = 0;

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const relPath = path.relative(ROOT, file).replace(/\\/g, '/');
  const issues = [];

  for (const meta of requiredMeta) {
    const regex = new RegExp(
      `<meta\\s+${meta.attr}=["']${meta.name}["']\\s+content=["']([^"']*)["']`,
      'i'
    );
    const match = html.match(regex);
    if (!match || !match[1].trim()) {
      issues.push(`missing ${meta.name}`);
    } else if ((meta.name === 'og:image' || meta.name === 'twitter:image') && !match[1].startsWith('https://')) {
      issues.push(`${meta.name} must be absolute URL`);
    }
  }

  if (!html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)) {
    issues.push('missing canonical');
  }

  if (!html.match(/<html[^>]+lang=["'][a-zA-Z]{2}(?:-[a-zA-Z]+)?["']/i)) {
    issues.push('missing html lang');
  }

  if (issues.length) {
    console.log(` ${relPath}: ${issues.join(', ')}`);
    exitCode = 1;
  } else {
    console.log(` ${relPath}`);
  }
}

if (exitCode) {
  console.error("\n Open Graph audit failed.");
} else {
  console.log("\n All audited pages have complete Open Graph / Twitter tags.");
}
process.exit(exitCode);
