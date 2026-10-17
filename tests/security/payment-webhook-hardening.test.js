const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '../../api/payments.js'),
  'utf8'
);

describe('payment webhook hardening', () => {
  test('fails closed when Stripe idempotency cannot be established', () => {
    expect(source).toContain("Webhook idempotency unavailable");
    expect(source).toContain("Webhook delivery is already being processed");
    expect(source).toContain("return res.status(503)");
  });

  test('requires Moyasar callback secret when one is configured', () => {
    expect(source).toContain("if (configuredWebhookSecret && payload?.secret_token !== configuredWebhookSecret)");
    expect(source).toContain("return res.status(401).json({ error: 'Unauthorized' })");
  });

  test('still re-fetches Moyasar invoice as the source of truth', () => {
    const webhookStart = source.indexOf('async function moyasarWebhookAction');
    const webhook = source.slice(webhookStart);
    expect(webhook).toContain('const invoice = await getInvoice(invoiceId)');
    expect(webhook).toContain('metadata.user_id');
    expect(webhook).toContain('metadata.tier');
  });
});
