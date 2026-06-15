/**
 * Email helper for Bonds V3.
 * Uses nodemailer when SMTP is configured; otherwise logs to console.
 */
const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn('[Email] SMTP not configured — emails will be logged to console only');
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transporter;
}

async function sendEmail({ to, subject, text, html }) {
  const transport = getTransporter();
  const from = process.env.EMAIL_FROM || 'noreply@bonds-global.com';

  if (!transport) {
    console.log('[Email] Would send email:');
    console.log('  From:', from);
    console.log('  To:', to);
    console.log('  Subject:', subject);
    console.log('  Body:', text);
    return { success: true, demo: true };
  }

  try {
    const info = await transport.sendMail({
      from: `Bonds V3 <${from}>`,
      to,
      subject,
      text,
      html
    });
    console.log('[Email] Sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error('[Email] Failed:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = { sendEmail };
