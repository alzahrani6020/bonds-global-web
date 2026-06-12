// ============================================
// Contact / Lead Form API
// Stores calculator lead submissions in Supabase
// Sends email notification to admin
// ============================================

const getSupabase = require('../lib/api/supabase');
const { sendEmail } = require('../lib/api/email');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const {
      name,
      phone,
      email,
      city,
      activity,
      score,
      verdict,
      monthlyProfit,
      url,
      source,
      message
    } = body;

    // Validation
    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }

    // Saudi phone validation: starts with 05 (10 digits) or international +
    const phoneStr = String(phone).trim();
    const isValidPhone = /^(05\d{8}|\+\d{7,15})$/.test(phoneStr);
    if (!isValidPhone) {
      return res.status(400).json({ success: false, error: 'Invalid phone number' });
    }

    const payload = {
      name: String(name).slice(0, 200),
      phone: phoneStr.slice(0, 50),
      email: email ? String(email).slice(0, 200) : null,
      city: city ? String(city).slice(0, 100) : null,
      sector: activity ? String(activity).slice(0, 100) : null,
      service: source ? String(source).slice(0, 100) : null,
      message: message ? String(message).slice(0, 5000) : JSON.stringify({
        calculatorScore: score || 0,
        calculatorVerdict: verdict || '',
        monthlyProfit: monthlyProfit || 0,
        pageUrl: url || ''
      }),
      read: false,
      source: source ? String(source).slice(0, 100) : 'website'
    };

    let savedId = null;
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('contact_messages')
        .insert([payload])
        .select()
        .single();

      if (error) {
        console.error('[contact] Supabase error:', error.message);
      } else {
        savedId = data?.id;
      }
    } catch (dbErr) {
      console.error('[contact] DB error:', dbErr.message);
    }

    // Send email notification to admin
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (adminEmails.length > 0) {
      const emailSubject = `طلب دراسة جدوى جديد — ${payload.name}`;
      const emailBody = `
اسم المرسل: ${payload.name}
الجوال: ${payload.phone}
البريد: ${payload.email || 'غير متوفر'}
المدينة: ${payload.city || 'غير محددة'}
النشاط: ${payload.sector || 'غير محدد'}
المصدر: ${payload.source}
مؤشر الاستثمار: ${score || 0}/100 (${verdict || '-'})
الربح الشهري المتوقع: ${monthlyProfit ? Number(monthlyProfit).toLocaleString('ar-SA') + ' ر.س' : '-'}
رابط الحاسبة: ${url || '-'}

${message ? 'الرسالة:\n' + message : ''}

---
تم الاستلام عبر: bonds-global.com
      `.trim();

      const emailHtml = `
<div dir="rtl" style="font-family:Vazirmatn,system-ui,sans-serif;line-height:1.6;color:#1a1a1a;">
  <h2 style="color:#b8954e;">📩 طلب دراسة جدوى جديد</h2>
  <table style="width:100%;border-collapse:collapse;margin:1rem 0;">
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الاسم</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${payload.name}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الجوال</td><td style="padding:0.5rem;border-bottom:1px solid #eee;direction:ltr;text-align:right;">${payload.phone}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">البريد</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${payload.email || '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">المدينة</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${payload.city || '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">النشاط</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${payload.sector || '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">المصدر</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${payload.source}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">مؤشر الاستثمار</td><td style="padding:0.5rem;border-bottom:1px solid #eee;"><strong>${score || 0}/100</strong> — ${verdict || '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الربح الشهري المتوقع</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${monthlyProfit ? Number(monthlyProfit).toLocaleString('ar-SA') + ' ر.س' : '-'}</td></tr>
  </table>
  ${message ? `<div style="background:#f8f9fa;padding:1rem;border-radius:8px;margin-top:1rem;"><p style="margin:0;font-weight:700;">الرسالة:</p><p style="margin:0.5rem 0 0;">${String(message).replace(/\n/g, '<br>')}</p></div>` : ''}
  <p style="margin-top:1.5rem;font-size:0.85rem;color:#555555;">
    <a href="https://bonds-global.com/admin/messages.html" style="color:#b8954e;">فتح لوحة التحكم →</a>
  </p>
</div>
      `;

      for (const adminEmail of adminEmails) {
        await sendEmail({
          to: adminEmail,
          subject: emailSubject,
          text: emailBody,
          html: emailHtml
        });
      }
    }

    res.status(200).json({
      success: true,
      id: savedId,
      demo: !savedId,
      message: 'Lead received successfully'
    });

  } catch (err) {
    console.error('[contact] Error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
