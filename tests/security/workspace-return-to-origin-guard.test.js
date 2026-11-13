/** @jest-environment node */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('workspace return_to origin guard', () => {
  test('slash-backslash can navigate away from origin', () => {
    const malicious = '/' + String.fromCharCode(92) + 'evil.example';
    expect(new URL(malicious, 'https://bonds-global.com').origin).toBe('https://evil.example');
  });
  test.each(['components/deal-workspace.js', 'components/service-request.js'])('%s rejects backslash return targets', file => {
    expect(read(file)).toContain('!value.includes(');
  });
  test.each(['valuation/index.html', 'en/valuation/index.html', 'v3/project-readiness.html'])('%s rejects backslash return targets', file => {
    expect(read(file)).toContain('!returnTo.includes(');
  });
  test('correspondence frontend and API reject backslash return targets', () => {
    expect(read('components/letterhead-correspondence.js')).toContain('!explicit.includes(');
    expect(read('lib/api/correspondence.js')).toContain('value.includes(');
  });
});
