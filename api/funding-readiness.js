// ============================================
// Free Funding Readiness Score API
// POST /api/funding-readiness
// Stores lead and sends email with score summary
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

function isValidPhone(phone) {
  return /^(05\d{8}|\+\d{7,15})$/.test(String(phone).trim());
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
      name,
      email,
      phone,
      city,
      sector,
      investmentRange,
      revenueRange,
      experienceLevel,
      collateral,
      score,
      verdict,
      summary,
      utmCampaign
    } = body;

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ success: false, error: 'Invalid phone number' });
    }
    if (email && !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email' });
    }

    const scoreNum = Math.max(0, Math.min(100, Number(score) || 0));

    const payload = {
      name: String(name).slice(0, 200),
      email: email ? String(email).slice(0, 200) : null,
      phone: String(phone).trim().slice(0, 50),
      city: city ? String(city).slice(0, 100) : null,
      sector: sector ? String(sector).slice(0, 100) : null,
      investment_range: investmentRange ? String(investmentRange).slice(0, 100) : null,
      revenue_range: revenueRange ? String(revenueRange).slice(0, 100) : null,
      experience_level: experienceLevel ? String(experienceLevel).slice(0, 100) : null,
      collateral: collateral ? String(collateral).slice(0, 100) : null,
      score: scoreNum,
      verdict: verdict ? String(verdict).slice(0, 100) : '',
      summary: summary || {},
      utm_campaign: utmCampaign ? String(utmCampaign).slice(0, 100) : null
    };

    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('funding_readiness_leads')
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error('[funding-readiness] Supabase error:', error.message);
      return res.status(500).json({ success: false, error: 'Failed to save lead' });
    }

    // Send summary email to user if email provided
    if (email) {
      const subject = `درجة جاهزية تمويل مشروعك — ${scoreNum}/100`;
      const html = `
        <div dir="rtl" style="font-family:Vazirmatn,system-ui,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;">
          <div style="background:#0a0f1a;color:#d4a853;padding:1.5rem;text-align:center;">
            <h2 style="margin:0;">بوندز — درجة جاهزية التمويل</h2>
          </div>
          <div style="padding:1.5rem;border:1px solid #e5e5e5;">
            <p>مرحباً ${escapeHtml(name)}،</p>
            <p>شكراً لاستخدامك أداة قياس جاهزية التمويل. إليك النتيجة:</p>
            <div style="text-align:center;margin:2rem 0;">
              <div style="font-size:3rem;font-weight:900;color:#0a0f1a;">${scoreNum}<span style="font-size:1.5rem;color:#666;">/100</span></div>
              <div style="font-size:1.2rem;font-weight:700;color:#d4a853;margin-top:0.5rem;">${escapeHtml(verdict || '')}</div>
            </div>
            <p style="background:#f8f4e8;padding:1rem;border-radius:8px;">${escapeHtml(summary?.text || 'نتيجتك الأولية تُظهر مدى استعداد مشروعك للتمويل. للحصول على تحليل AI مفصل ومراجعة استشارية، يمكنك ترقية حسابك.')}</p>
            <div style="text-align:center;margin:2rem 0;">
              <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com'}/pricing.html" style="display:inline-block;background:#d4a853;color:#0a0f1a;padding:0.875rem 1.5rem;border-radius:8px;text-decoration:none;font-weight:700;">احصل على تحليل AI كامل</a>
            </div>
            <p style="font-size:0.85rem;color:#666;">هذه النتيجة تقديرية وليست قرضاً مضموناً. للاستشارة المخصصة تواصل مع فريقنا.</p>
          </div>
        </div>
      `;
      await sendEmail({ to: email, subject, html });
    }

    // Notify admin
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (adminEmails.length > 0) {
      const adminSubject = `Lead جديد — درجة جاهزية التمويل — ${escapeHtml(name)}`;
      const adminText = `
اسم: ${escapeHtml(name)}
بريد: ${email || '-'}
جوال: ${escapeHtml(phone)}
مدينة: ${escapeHtml(city || '-')}
قطاع: ${escapeHtml(sector || '-')}
الدرجة: ${scoreNum}/100
التقييم: ${escapeHtml(verdict || '-')}
      `.trim();
      await sendEmail({ to: adminEmails, subject: adminSubject, text: adminText });
    }

    res.status(200).json({ success: true, id: data.id, score: scoreNum });
  } catch (err) {
    console.error('[funding-readiness] Error:', err);
    res.status(500).json({ success: false, error: 'Server error' });
  }
}

module.exports = withRateLimit('auth', handler);
