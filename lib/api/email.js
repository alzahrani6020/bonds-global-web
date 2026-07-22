// ============================================
// Email Helper
// Uses Resend if RESEND_API_KEY is set, otherwise nodemailer SMTP.
// Falls back to a safe log line if neither is configured.
// ============================================

const nodemailer = require('nodemailer');

let transporter = null;
let resendClient = null;

function isSilentEnv() {
  return process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test';
}

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) return null;

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });

  return transporter;
}

function getResend() {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) return { missing: true };
  try {
    const { Resend } = require('resend');
    resendClient = new Resend(process.env.RESEND_API_KEY);
    return resendClient;
  } catch (err) {
    if (!isSilentEnv()) {
      console.warn('[Email] Resend init failed:', err.message);
    }
    return { initError: err.message };
  }
}

async function sendEmail({ to, subject, text, html }) {
  const from = process.env.SENDER_EMAIL || process.env.EMAIL_FROM || 'noreply@bonds-global.com';

  // 1. Try Resend
  const resend = getResend();
  if (resend && !resend.missing && !resend.initError) {
    try {
      const { error } = await resend.emails.send({
        from,
        to,
        subject,
        text,
        html
      });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      if (!isSilentEnv()) {
        console.error('[Email] Resend failed:', err.message);
      }
      return { success: true, demo: true, reason: 'resend_failed', resendError: err.message };
    }
  }

  if (resend?.missing) {
    return { success: true, demo: true, reason: 'resend_key_missing' };
  }
  if (resend?.initError) {
    return { success: true, demo: true, reason: 'resend_init_failed', resendError: resend.initError };
  }

  // 2. Try SMTP
  const transport = getTransporter();
  if (transport) {
    try {
      const info = await transport.sendMail({
        from: `Bonds Global <${from}>`,
        to,
        subject,
        text,
        html
      });
      if (!isSilentEnv()) {
        console.log('[Email] Sent via SMTP:', info.messageId);
      }
      return { success: true, messageId: info.messageId };
    } catch (err) {
      if (!isSilentEnv()) {
        console.error('[Email] SMTP failed:', err.message);
      }
      return { success: true, demo: true, reason: 'smtp_failed', smtpError: err.message };
    }
  }

  // 3. Console fallback (no PII in production)
  if (!isSilentEnv()) {
    console.log('[Email] Would send email (no mailer configured):', { to, subject });
  }
  return { success: true, demo: true, reason: 'no_mailer_configured' };
}

module.exports = { sendEmail };
