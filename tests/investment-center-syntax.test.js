/**
 * Regression test for investment-center templates that previously contained
 * inline JavaScript syntax errors (unescaped HTML quotes inside innerHTML,
 * regex literals split across lines, literal newlines inside CSV strings).
 *
 * Parses every inline <script> block in the investment-center HTML files and
 * fails if any block has a syntax error.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const dirs = [
  path.resolve(__dirname, '..', 'calculators', 'investment-center'),
  path.resolve(__dirname, '..', 'en', 'calculators', 'investment-center')
];

function discoverHtmlFiles(dir) {
  const files = [];
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      files.push(path.join(dir, entry.name));
    }
  }
  return files;
}

function extractInlineScripts(html) {
  const scripts = [];
  const re = /<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(html)) !== null) {
    const openTag = match[0].slice(0, match[0].indexOf('>') + 1);
    const typeMatch = openTag.match(/\btype\s*=\s*["']([^"']+)["']/i);
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'text/javascript';
    if (type !== 'text/javascript' && !type.includes('javascript')) continue;
    const code = match[1].trim();
    if (code) scripts.push(code);
  }
  return scripts;
}

describe('investment-center HTML inline scripts parse without syntax errors', () => {
  const files = dirs.flatMap(discoverHtmlFiles);
  test('discovered at least one investment-center HTML file', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    const rel = path.relative(path.resolve(__dirname, '..'), file).replace(/\\/g, '/');
    describe(rel, () => {
      const html = fs.readFileSync(file, 'utf-8');
      const scripts = extractInlineScripts(html);
      test('has at least one inline script', () => {
        expect(scripts.length).toBeGreaterThan(0);
      });
      scripts.forEach((code, index) => {
        test(`inline script block #${index + 1} is syntactically valid`, () => {
          expect(() => new vm.Script(code)).not.toThrow();
        });
      });
    });
  }
});
