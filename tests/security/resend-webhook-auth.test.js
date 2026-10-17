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
    expect(handler).toContain("req.headers['svix-id']");
    expect(handler).toContain("req.headers['svix-timestamp']");
    expect(handler).toContain("req.headers['svix-signature']");
    expect(handler).toContain('bodyParser: false');
  });
});
