const fs = require('fs');
const path = require('path');

const handler = fs.readFileSync(
  path.join(__dirname, '../../api/email-webhook.mjs'),
  'utf8'
);

describe('Resend webhook authenticity', () => {
  test('verifies raw payload signatures and fails closed on invalid signatures', () => {
    expect(handler).toContain('RESEND_WEBHOOK_SECRET');
    expect(handler).toContain('resend.webhooks.verify');
    expect(handler).toContain("request.headers.get('svix-id')");
    expect(handler).toContain("request.headers.get('svix-timestamp')");
    expect(handler).toContain("request.headers.get('svix-signature')");
    expect(handler).toContain("return json(401, { error: 'Invalid webhook signature' })");
  });
});
