// ============================================
// Webhook: New User Created
// Called by Supabase database webhook on profiles insert
// Sends email notification to admin
// ============================================

const { sendEmail } = require('./lib/email');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { record } = req.body || {};
    if (!record) {
      return res.status(400).json({ success: false, error: 'No record provided' });
    }

    const { restaurant_name, email, phone, country, tier, created_at } = record;

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (adminEmails.length > 0 && email) {
      const subject = `عميل جديد مسجل: ${restaurant_name || 'مستخدم جديد'}`;
      const text = `
عميل جديد سجّل في المنصة:

الاسم: ${restaurant_name || 'غير متوفر'}
البريد: ${email}
الهاتف: ${phone || 'غير متوفر'}
الدولة: ${country || 'غير محددة'}
الخطة: ${tier || 'free'}
تاريخ التسجيل: ${created_at}

---
فتح لوحة التحكم: https://bonds-global.com/admin/users.html
      `.trim();

      const html = `
<div dir="rtl" style="font-family:Vazirmatn,system-ui,sans-serif;line-height:1.6;color:#0a0f1a;">
  <h2 style="color:#22c55e;">✅ عميل جديد مسجل</h2>
  <table style="width:100%;border-collapse:collapse;margin:1rem 0;">
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الاسم</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${restaurant_name || '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">البريد</td><td style="padding:0.5rem;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الهاتف</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${phone || '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الدولة</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${country || '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الخطة</td><td style="padding:0.5rem;border-bottom:1px solid #eee;"><span style="background:#d4a85320;color:#d4a853;padding:0.2rem 0.6rem;border-radius:50px;font-size:0.8rem;">${tier || 'free'}</span></td></tr>
  </table>
  <p style="margin-top:1.5rem;font-size:0.85rem;color:#94a3b8;">
    <a href="https://bonds-global.com/admin/users.html" style="color:#d4a853;">فتح لوحة المستخدمين →</a>
  </p>
</div>
      `;

      for (const adminEmail of adminEmails) {
        await sendEmail({ to: adminEmail, subject, text, html });
      }
    }

    res.status(200).json({ success: true });

  } catch (err) {
    console.error('[webhook-user-created] Error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
};
