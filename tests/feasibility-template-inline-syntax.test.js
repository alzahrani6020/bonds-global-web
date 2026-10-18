const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

function inlineScripts(rel) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  return [...html.matchAll(/<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>/gi)]
    .map((match, index) => ({
      index,
      code: match[1],
      type: (match[0].match(/type="([^"]+)"/i) || [])[1] || 'text/javascript'
    }))
    .filter(script => script.type !== 'application/ld+json');
}

describe.each([
  ['AR', 'calculators/feasibility-template.html'],
  ['EN', 'en/calculators/feasibility-template.html']
])('%s feasibility template inline scripts', (_lang, rel) => {
  test('all executable inline scripts parse successfully', () => {
    for (const script of inlineScripts(rel)) {
      expect(() => new Function(script.code)).not.toThrow();
    }
  });

  test('benchmark expressions do not contain injected class attributes', () => {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    expect(html).not.toMatch(/payback\\s*<=\\s*class=/);
    expect(html).toContain('payback > 0 && payback <= 18');
    expect(html).toContain('payback > 0 && payback <= 36');
  });

  test('top toolbar handlers remain defined in executable inline scripts', () => {
    const source = inlineScripts(rel).map(script => script.code).join('\n');
    for (const fn of ['clearAll','saveDraft','loadDraft','scrollToDashboard','openResearchModal']) {
      expect(source).toContain('function ' + fn + '(');
    }
  });
});
