/**
 * Contact Form API
 * POST /api/contact
 * Body: { name, phone, email, sector, service, message, website? }
 *
 * - Validates input and blocks spam via honeypot.
 * - Saves submission to Supabase contact_messages table.
 * - Forwards to Formspree for email delivery.
 * - Notifies admin directly if an email service is configured.
 */

const getSupabase = require('../lib/api/supabase');
const { sendEmail } = require('../lib/api/email');
const { withRateLimit } = require('../lib/api/rate-limit');

const FORMSPREE_ID = process.env.FORMSPREE_CONTACT_FORM_ID || 'mykvdana';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase().trim());
}

function isValidPhone(phone) {
  const digits = String(phone).replace(/[\s\-\+\(\)]/g, '');
  return digits.length >= 8 && /^[0-9]+$/.test(digits);
}

function sanitize(str, maxLen = 5000) {
  return String(str || '').trim().replace(/[<>]/g, '').slice(0, maxLen);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const body = req.body || {};
  const name = sanitize(body.name, 200);
  const phone = sanitize(body.phone, 50);
  const email = sanitize(body.email, 200).toLowerCase();
  const sector = sanitize(body.sector, 100);
  const service = sanitize(body.service, 100);
  const message = sanitize(body.message, 2000);

  // Honeypot field — bots usually fill this.
  if (body.website) {
    return res.status(200).json({ success: true });
  }

  if (!name || name.length < 2) {
    return res.status(400).json({ success: false, error: 'الاسم مطلوب (2 أحرف على الأقل) / Name is required (at least 2 characters)' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ success: false, error: 'البريد الإلكتروني غير صالح / Invalid email address' });
  }
  if (!isValidPhone(phone)) {
    return res.status(400).json({ success: false, error: 'رقم الواتساب غير صالح / Invalid WhatsApp number' });
  }
  if (!message || message.length < 10) {
    return res.status(400).json({ success: false, error: 'تفاصيل الطلب مطلوبة (10 أحرف على الأقل) / Details are required (at least 10 characters)' });
  }

  const dbPayload = {
    name,
    phone,
    email: email || null,
    sector,
    service,
    message,
    source: 'contact-page',
    read: false
  };

  // 1) Persist to Supabase
  let savedId = null;
  let dbError = null;
  try {
    const supabase = getSupabase();
    let { data, error } = await supabase
      .from('contact_messages')
      .insert([dbPayload])
      .select()
      .single();

    // Retry without city if the column does not exist in this environment.
    if (error && /column.*city|city.*column|schema cache/i.test(error.message || '')) {
      const payloadNoCity = { ...dbPayload };
      delete payloadNoCity.city;
      const retry = await supabase.from('contact_messages').insert([payloadNoCity]).select().single();
      data = retry.data;
      error = retry.error;
    }

    if (error) {
      dbError = error.message;
      console.error('[Contact] Supabase error:', error.message);
    } else {
      savedId = data?.id;
    }
  } catch (err) {
    dbError = err.message;
    console.error('[Contact] DB error:', err.message);
  }

  // 2) Forward to Formspree
  let formspreeOk = false;
  let formspreeError = null;
  try {
    const formspreeRes = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        name,
        phone,
        email,
        sector,
        service,
        message,
        _subject: `طلب تواصل جديد من ${name} — بوندز`,
        _replyto: email
      })
    });
    formspreeOk = formspreeRes.ok;
    if (!formspreeOk) {
      const text = await formspreeRes.text().catch(() => '');
      formspreeError = `Formspree ${formspreeRes.status}: ${text.slice(0, 200)}`;
    }
  } catch (err) {
    formspreeError = err.message;
  }

  // 3) Notify admin directly
  if (ADMIN_EMAILS.length > 0) {
    try {
      const subject = `طلب تواصل جديد من ${name} — بوندز`;
      const textBody = [
        `اسم: ${name}`,
        `واتساب: ${phone}`,
        `بريد: ${email || '—'}`,
        `قطاع: ${sector || '—'}`,
        `خدمة: ${service || '—'}`,
        `رسالة:\n${message}`,
        '',
        `---`,
        `تم الاستلام عبر: bonds-global.com/contact`
      ].join('\n');

      const htmlBody = [
        '<div dir="rtl" style="font-family:Vazirmatn,system-ui,sans-serif;line-height:1.6;color:#1a1a1a;">',
        '<h2 style="color:#b8954e;">طلب تواصل جديد — بوندز</h2>',
        '<table style="width:100%;border-collapse:collapse;margin:1rem 0;">',
        `<tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الاسم</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${escapeHtml(name)}</td></tr>`,
        `<tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">واتساب</td><td style="padding:0.5rem;border-bottom:1px solid #eee;direction:ltr;text-align:right;">${escapeHtml(phone)}</td></tr>`,
        `<tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">البريد</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${escapeHtml(email || '—')}</td></tr>`,
        `<tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">القطاع</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${escapeHtml(sector || '—')}</td></tr>`,
        `<tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الخدمة</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${escapeHtml(service || '—')}</td></tr>`,
        '</table>',
        '<div style="background:#f8f9fa;padding:1rem;border-radius:8px;margin-top:1rem;">',
        '<p style="margin:0;font-weight:700;">الرسالة:</p>',
        `<p style="margin:0.5rem 0 0;">${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
        '</div>',
        '<p style="margin-top:1.5rem;font-size:0.85rem;color:#555555;">',
        '<a href="https://bonds-global.com/admin/messages.html" style="color:#b8954e;">فتح لوحة التحكم →</a>',
        '</p>',
        '</div>'
      ].join('\n');

      for (const adminEmail of ADMIN_EMAILS) {
        await sendEmail({ to: adminEmail, subject, text: textBody, html: htmlBody });
      }
    } catch (err) {
      console.error('[Contact] Admin email failed:', err.message);
    }
  }

  // If neither Formspree nor DB succeeded, surface an error.
  if (!formspreeOk && dbError) {
    console.error('[Contact] Formspree failed:', formspreeError);
    return res.status(502).json({
      success: false,
      error: 'تعذر حفظ الطلب حالياً. جرّب واتساب مباشرة. / Could not save request now. Try WhatsApp.'
    });
  }

  return res.status(200).json({ success: true, id: savedId });
}

module.exports = withRateLimit('auth', handler);
