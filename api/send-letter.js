const nodemailer = require('nodemailer');
const { withRateLimit } = require('../lib/api/rate-limit');

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { to, subject, body, html, text } = req.body || {};

  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SENDER_EMAIL', 'MANAGER_EMAIL'];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length) {
    return res.status(500).json({ ok: false, error: 'Email service is not configured.' });
  }

  const recipient = to && String(to).trim() ? String(to).trim() : process.env.MANAGER_EMAIL;
  if (!recipient || !recipient.includes('@')) {
    return res.status(400).json({ ok: false, error: 'A valid recipient email is required.' });
  }

  const port = Number(process.env.SMTP_PORT);
  const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  try {
    await transporter.sendMail({
      from: process.env.SENDER_EMAIL,
      to: recipient,
      subject: subject || 'New letterhead submission',
      text: text || body || '',
      html: Array.isArray(html) ? html.join('<hr>') : (html || ''),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: 'Failed to send email.' });
  }
}

module.exports = withRateLimit('auth', handler);
