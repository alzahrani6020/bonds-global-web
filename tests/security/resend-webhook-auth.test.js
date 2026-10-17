const fs = require('fs');
const path = require('path');

const handler = fs.readFileSync(
  path.join(__dirname, '../../api/email-webhook.js'),
  'utf8'
);
const vercel = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8')
);

describe('Resend webhook authenticity', () => {
  test('requires raw-body signature verification and a signing secret', () => {
    expect(handler).toContain('RESEND_WEBHOOK_SECRET');
    expect(handler).toContain('resend.webhooks.verify');
    expect(handler).toContain("req.headers['svix-id']");
    expect(handler).toContain("req.headers['svix-timestamp']");
    expect(handler).toContain("req.headers['svix-signature']");
    expect(handler).toContain('bodyParser: false');
    expect(handler).not.toContain("Bounce recorded for:");
    expect(handler).not.toContain("Complaint recorded for:");
  });

  test('routes email webhooks to the dedicated verifier', () => {
    const rules = vercel.rewrites.filter(rule =>
      rule.source === '/api/email-webhook' || rule.source === '/api/email-webhook/'
    );
    expect(rules).toHaveLength(2);
    expect(rules.every(rule => rule.destination === '/api/email-webhook')).toBe(true);
  });
});
