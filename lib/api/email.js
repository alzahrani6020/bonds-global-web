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

function getEmailConfigStatus() {
  const hasResend = !!process.env.RESEND_API_KEY;
  const hasSmtp = !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
  const sender = process.env.SENDER_EMAIL || process.env.EMAIL_FROM || 'noreply@bonds-global.com';
  return { hasResend, hasSmtp, sender };
}

function normalizeAttachments(attachments) {
  if (!Array.isArray(attachments) || attachments.length === 0) return [];
  return attachments
    .filter(a => a && (a.filename || a.name) && (a.content || a.path))
    .map(a => ({
      filename: a.filename || a.name,
      contentType: a.contentType || a.content_type || a.type,
      content: a.content
    }));
}

async function sendEmail({ to, subject, text, html, attachments }) {
  const from = process.env.SENDER_EMAIL || process.env.EMAIL_FROM || 'noreply@bonds-global.com';
  const attach = normalizeAttachments(attachments);

  // 1. Try Resend
  const resend = getResend();
  if (resend && !resend.missing && !resend.initError) {
    try {
      const { error } = await resend.emails.send({
        from,
        to,
        subject,
        text,
        html,
        attachments: attach.map(a => ({
          filename: a.filename,
          content: a.content,
          content_type: a.contentType
        }))
      });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      if (!isSilentEnv()) {
        console.error('[Email] Resend failed:', err.message);
      }
      const isDomainError = /domain|verified|sender/i.test(err.message || '');
      return {
        success: false,
        error: err.message,
        reason: isDomainError ? 'resend_domain_not_verified' : 'resend_failed',
        resendError: err.message,
        help: isDomainError
          ? 'Add a verified sender domain in Resend and set SENDER_EMAIL to an address on that domain.'
          : 'Check RESEND_API_KEY and Resend dashboard.'
      };
    }
  }

  if (resend?.missing) {
    return { success: true, demo: true, reason: 'resend_key_missing', help: 'Set RESEND_API_KEY environment variable.' };
  }
  if (resend?.initError) {
    return { success: true, demo: true, reason: 'resend_init_failed', resendError: resend.initError };
  }

  // 2. Try SMTP
  const transport = getTransporter();
  if (transport) {
    try {
      const mailAttachments = attach.map(a => {
        const item = { filename: a.filename };
        if (a.contentType) item.contentType = a.contentType;
        if (typeof a.content === 'string') {
          item.content = Buffer.from(a.content, 'base64');
        } else if (Buffer.isBuffer(a.content)) {
          item.content = a.content;
        } else if (a.content) {
          item.content = a.content;
        }
        return item;
      });
      const info = await transport.sendMail({
        from: `Bonds Global <${from}>`,
        to,
        subject,
        text,
        html,
        attachments: mailAttachments
      });
      if (!isSilentEnv()) {
        console.log('[Email] Sent via SMTP:', info.messageId);
      }
      return { success: true, messageId: info.messageId };
    } catch (err) {
      if (!isSilentEnv()) {
        console.error('[Email] SMTP failed:', err.message);
      }
      return { success: false, error: err.message, reason: 'smtp_failed', smtpError: err.message };
    }
  }

  // 3. Console fallback (no PII in production)
  if (!isSilentEnv()) {
    console.log('[Email] Would send email (no mailer configured):', { to, subject, attachments: attach.length });
  }
  return { success: true, demo: true, reason: 'no_mailer_configured', attachments: attach.length };
}

module.exports = { sendEmail, getEmailConfigStatus };
