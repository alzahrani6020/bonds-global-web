/** @jest-environment node */
'use strict';
const fs = require('fs');
const path = require('path');

describe('approved production visual baseline integrity', () => {
  const source = fs.readFileSync(path.join(__dirname, 'visual-tests.js'), 'utf8');
  test('ordinary visual CI refuses missing approved screenshots', () => {
    expect(source).toContain('APPROVED_BASELINE_MISSING');
    expect(source).toMatch(/if \(!fs\.existsSync\(baselinePath\)\) \{[\s\S]*?failed\+\+;[\s\S]*?continue;/);
    expect(source).not.toContain('baseline created:');
  });
  test('explicit reviewed updates remain separate from normal execution', () => {
    expect(source).toContain("process.argv.includes('--update')");
    expect(source).toContain('fs.copyFileSync(snapshotPath, baselinePath)');
    expect(source).toContain('diffRatio > TOLERANCE');
  });
});
