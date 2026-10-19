const { execFileSync } = require('child_process');
const path = require('path');

describe('tools registry contract', () => {
  test('canonical tools registry matches current navigation and investment center sources', () => {
    expect(() => execFileSync(
      process.execPath,
      [path.join(__dirname, '..', 'scripts', 'validate-tools-registry.js')],
      { stdio: 'pipe' }
    )).not.toThrow();
  });
});
