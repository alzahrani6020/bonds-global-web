const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

function read(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

describe('admin reset link safety', () => {
  test('generated recovery links are restricted to configured Supabase origin', () => {
    const admin = read('api/admin.js');

    expect(admin).toContain(
      "actionUrl.protocol === 'https:'"
    );

    expect(admin).toContain(
      'actionUrl.origin === supabaseUrl.origin'
    );

    expect(admin).toContain(
      "process.env.NEXT_PUBLIC_SUPABASE_URL ||"
    );

    expect(admin).toContain(
      "process.env.SUPABASE_URL ||"
    );

    expect(admin).toContain(
      "throw new Error('Invalid recovery link generated')"
    );
  });
});
