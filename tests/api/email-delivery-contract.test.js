/**
 * @jest-environment node
 */

describe('email delivery contract', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  test('does not report delivery success when no provider is configured', async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASS;

    jest.doMock('nodemailer', () => ({ createTransport: jest.fn() }));
    const { sendEmail } = require('../../lib/api/email');

    const result = await sendEmail({
      to: 'manager@example.com',
      subject: 'test',
      text: 'test'
    });

    expect(result.success).toBe(false);
    expect(result.demo).toBe(true);
    expect(result.reason).toBe('no_mailer_configured');
  });

  test('uses SMTP when Resend is not configured', async () => {
    delete process.env.RESEND_API_KEY;
    process.env.SMTP_HOST = 'smtp.example.test';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    process.env.SMTP_PORT = '587';

    const sendMail = jest.fn().mockResolvedValue({ messageId: 'smtp-message-1' });
    jest.doMock('nodemailer', () => ({
      createTransport: jest.fn(() => ({ sendMail }))
    }));

    const { sendEmail } = require('../../lib/api/email');
    const result = await sendEmail({
      to: 'manager@example.com',
      subject: 'test',
      text: 'test'
    });

    expect(result.success).toBe(true);
    expect(result.messageId).toBe('smtp-message-1');
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
});
