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

async function sendEmail({ to, subject, text, html, attachments, idempotencyKey }) {
  const from = process.env.SENDER_EMAIL || process.env.EMAIL_FROM || 'noreply@bonds-global.com';
  const attach = normalizeAttachments(attachments);

  // 1. Try Resend first. If it fails, continue to SMTP instead of returning
  // a false terminal result while a working fallback may exist.
  const resend = getResend();
  let resendFailure = null;
  if (resend && !resend.missing && !resend.initError) {
    try {
      const { data, error } = await resend.emails.send({
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
      }, idempotencyKey ? { idempotencyKey } : undefined);
      if (error) throw error;
      return { success: true, provider: 'resend', messageId: data?.id || null };
    } catch (err) {
      if (!isSilentEnv()) {
        console.error('[Email] Resend failed:', err.message);
      }
      resendFailure = err;
    }
  }

  // 2. Governed/idempotent sends must never fall through to SMTP after a Resend attempt,
  // because SMTP cannot honor the same idempotency key and could duplicate delivery.
  if (idempotencyKey && resendFailure) {
    return { success: false, error: resendFailure.message, reason: 'resend_idempotent_failed' };
  }
  if (idempotencyKey && (resend?.missing || resend?.initError)) {
    return { success: false, error: 'Idempotent delivery requires the Resend provider', reason: 'idempotent_provider_unavailable' };
  }

  // 2. Try SMTP whenever Resend is unavailable, failed to initialize, or failed to send for non-idempotent mail.
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
      return { success: true, provider: 'smtp', messageId: info.messageId };
    } catch (err) {
      if (!isSilentEnv()) {
        console.error('[Email] SMTP failed:', err.message);
      }
      return { success: false, error: err.message, reason: 'smtp_failed', smtpError: err.message };
    }
  }

  // 3. Explicit non-delivery result. Never report a successful send when no provider delivered it.
  if (!isSilentEnv()) {
    console.log('[Email] Would send email (no mailer configured):', { to, subject, attachments: attach.length });
  }
  const resendError = resendFailure?.message || resend?.initError || null;
  return {
    success: false,
    demo: true,
    reason: resendError ? 'email_providers_unavailable' : 'no_mailer_configured',
    resendError,
    attachments: attach.length
  };
}

module.exports = { sendEmail, getEmailConfigStatus };
