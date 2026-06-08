// ============================================
// Contact Form API
// Stores contact submissions in Supabase
// Sends email notification to admin
// ============================================

const getSupabase = require('./lib/supabase');
const { sendEmail } = require('./lib/email');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { name, email, phone, sector, service, message } = req.body || {};

    // Validation
    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, email and message are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }

    const supabase = getSupabase();

    // Store in Supabase (table: contact_messages)
    const { data, error } = await supabase
      .from('contact_messages')
      .insert([{
        name: String(name).slice(0, 200),
        email: String(email).slice(0, 200),
        phone: phone ? String(phone).slice(0, 50) : null,
        sector: sector ? String(sector).slice(0, 100) : null,
        service: service ? String(service).slice(0, 100) : null,
        message: String(message).slice(0, 5000),
        read: false,
        source: 'website'
      }])
      .select()
      .single();

    if (error) {
      console.error('[contact] Supabase error:', error.message);
      // Fallback: still return success to user even if DB fails
      return res.status(200).json({
        success: true,
        warning: 'Message received but storage delayed',
        demo: true
      });
    }

    // Send email notification to admin
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (adminEmails.length > 0) {
      const emailSubject = `رسالة تواصل جديدة من ${name}`;
      const emailBody = `
اسم المرسل: ${name}
البريد: ${email}
الهاتف: ${phone || 'غير متوفر'}
القطاع: ${sector || 'غير محدد'}
الخدمة: ${service || 'غير محددة'}

الرسالة:
${message}

---
تم الاستلام عبر: bonds-global.com
      `.trim();

      const emailHtml = `
<div dir="rtl" style="font-family:Vazirmatn,system-ui,sans-serif;line-height:1.6;color:#0a0f1a;">
  <h2 style="color:#d4a853;">📩 رسالة تواصل جديدة</h2>
  <table style="width:100%;border-collapse:collapse;margin:1rem 0;">
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الاسم</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${name}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">البريد</td><td style="padding:0.5rem;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الهاتف</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${phone || '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">القطاع</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${sector || '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الخدمة</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${service || '-'}</td></tr>
  </table>
  <div style="background:#f8f9fa;padding:1rem;border-radius:8px;margin-top:1rem;">
    <p style="margin:0;font-weight:700;">الرسالة:</p>
    <p style="margin:0.5rem 0 0;">${message.replace(/\n/g, '<br>')}</p>
  </div>
  <p style="margin-top:1.5rem;font-size:0.85rem;color:#94a3b8;">
    <a href="https://bonds-global.com/admin/messages.html" style="color:#d4a853;">فتح لوحة التحكم →</a>
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
      id: data?.id,
      message: 'Message sent successfully'
    });

  } catch (err) {
    console.error('[contact] Error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
