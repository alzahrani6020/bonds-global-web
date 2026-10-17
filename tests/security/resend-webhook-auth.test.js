const fs = require('fs');
const path = require('path');

const handler = fs.readFileSync(
  path.join(__dirname, '../../api/email-webhook.mjs'),
  'utf8'
);

describe('Resend webhook authenticity', () => {
  test('requires raw-body signature verification and a signing secret', () => {
    expect(handler).toContain('RESEND_WEBHOOK_SECRET');
    expect(handler).toContain('webhooks.verify');
    expect(handler).toContain("request.headers.get('svix-id')");
    expect(handler).toContain("request.headers.get('svix-timestamp')");
    expect(handler).toContain("request.headers.get('svix-signature')");
      });
});
