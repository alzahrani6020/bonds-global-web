const fs = require('fs');
const path = require('path');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return /\.(?:js|mjs|cjs|ts)$/.test(entry.name) ? [full] : [];
  });
}

// Keep this guard aligned with the Vercel Hobby 12-function deployment ceiling.
describe('Vercel Hobby serverless function budget', () => {
  test('api entry files stay at or below the 12-function deployment limit', () => {
    const apiDir = path.join(process.cwd(), 'api');
    const functions = walk(apiDir).map((file) => path.relative(process.cwd(), file)).sort();

    expect(functions.length).toBeLessThanOrEqual(12);
  });
});
