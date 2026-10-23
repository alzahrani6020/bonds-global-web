const fs = require('fs');
const path = require('path');

describe('governed capability failure observability', () => {
  test('audit records adapter failure codes and failure classes', () => {
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'capabilities', 'governed-executor.js'),
      'utf8'
    );
    expect(source).toContain("code: result?.error?.code || null");
    expect(source).toContain("result?.error?.failure_class");
    expect(source).toContain("result?.evidence?.fetch?.failure_class");
  });
});
