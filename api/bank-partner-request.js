// ============================================
// Bank / Fintech Partner Inquiry API
// POST /api/bank-partner-request
// Stores B2B inquiry and notifies admin
// ============================================

const getSupabase = require('../lib/api/supabase');
const { sendEmail } = require('../lib/api/email');
const { withRateLimit } = require('../lib/api/rate-limit');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const {
      organizationName,
      contactName,
      email,
      phone,
      country,
      organizationType,
      useCase,
      estimatedVolume
    } = body;

    if (!organizationName || !contactName || !email) {
      return res.status(400).json({ success: false, error: 'Organization name, contact name, and email are required' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email' });
    }

    const payload = {
      organization_name: String(organizationName).slice(0, 200),
      contact_name: String(contactName).slice(0, 200),
      email: String(email).slice(0, 200),
      phone: phone ? String(phone).slice(0, 50) : null,
      country: country ? String(country).slice(0, 100) : null,
      organization_type: organizationType || 'other',
      use_case: useCase ? String(useCase).slice(0, 2000) : null,
      estimated_volume: estimatedVolume ? String(estimatedVolume).slice(0, 100) : null
    };

    const supabase = getSupabase();
    const { data, error } = await supabase.from('bank_partner_requests').insert([payload]).select().single();
    if (error) throw error;

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (adminEmails.length > 0) {
      const subject = `طلب شراكة بنكية/تمويلية جديد — ${escapeHtml(payload.organization_name)}`;
      const text = `
اسم الجهة: ${escapeHtml(payload.organization_name)}
الشخص المسؤول: ${escapeHtml(payload.contact_name)}
البريد: ${escapeHtml(payload.email)}
الجوال: ${escapeHtml(payload.phone || '-')}
الدولة: ${escapeHtml(payload.country || '-')}
نوع الجهة: ${escapeHtml(payload.organization_type)}
حجم التمويل المتوقع: ${escapeHtml(payload.estimated_volume || '-')}

حالة الاستخدام:
${escapeHtml(payload.use_case || '-')}
      `.trim();
      await sendEmail({ to: adminEmails, subject, text });
    }

    res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('[bank-partner-request] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit request' });
  }
}

module.exports = withRateLimit('auth', handler);
