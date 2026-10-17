/**
 * @jest-environment node
 */

const fs = require('fs');
const path = require('path');

describe('V3 alerts service-role authorization', () => {
  test('mark-read mutation requires admin authorization', () => {
    const source = fs.readFileSync(path.join(__dirname, '../../v3/api/alerts.js'), 'utf8');
    expect(source).toContain("const alertReadMatch = path.match(/^\\/alerts\\/([^\\/]+)\\/read$/);");
    expect(source).toContain('const authError = requireAdmin(req);');
    expect(source).toContain('return handleMarkRead(req, res, alertReadMatch[1]);');
  });
});
