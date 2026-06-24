// ============================================
// Unified Site API
// Actions: contact (default), usage
// ============================================

const getSupabase = require('../lib/api/supabase');
const { sendEmail } = require('../lib/api/email');
const { withRateLimit } = require('../lib/api/rate-limit');

// ── Contact / Lead Form ────────────────────────────────────
async function contactHandler(req, res) {
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

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }

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

    return res.status(200).json({
      success: true,
      id: savedId,
      demo: !savedId,
      message: 'Lead received successfully'
    });

  } catch (err) {
    console.error('[contact] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

// ── Usage / Tracking ───────────────────────────────────────
async function usageHandler(req, res) {
  const sb = getSupabase();
  const action = req.query?.action || req.body?.action;

  try {
    if (req.method === 'GET' && action === 'settings') {
      const { data, error } = await sb.from('site_settings').select('*');
      if (error) throw error;
      const settings = {};
      (data || []).forEach(s => settings[s.key] = s.value);
      return res.status(200).json({
        calc_limit: parseInt(settings.calc_limit || '3', 10),
        feas_limit: parseInt(settings.feas_limit || '1', 10),
        price_pro: parseInt(settings.price_pro_sar || '82', 10),
        price_enterprise: parseInt(settings.price_enterprise_sar || '212', 10),
      });
    }

    if (req.method === 'GET' && action === 'check') {
      const { userId, calculator } = req.query;
      if (!calculator) return res.status(400).json({ error: 'calculator required' });

      const { data: settingsRows } = await sb.from('site_settings').select('*');
      const settings = {};
      (settingsRows || []).forEach(s => settings[s.key] = s.value);
      const calcLimit = parseInt(settings.calc_limit || '3', 10);
      const feasLimit = parseInt(settings.feas_limit || '1', 10);

      let tier = 'free';
      if (userId) {
        const { data: profile } = await sb.from('profiles').select('tier').eq('id', userId).single();
        if (profile?.tier) tier = profile.tier;
        const { data: adminRole } = await sb.from('admin_roles').select('role').eq('user_id', userId).single();
        if (adminRole?.role) {
          return res.status(200).json({ allowed: true, remaining: Infinity, tier, admin: adminRole.role });
        }
      }
      if (tier !== 'free') return res.status(200).json({ allowed: true, remaining: Infinity, tier });

      const isFeas = calculator.includes('feasibility');
      let limit = isFeas ? feasLimit : calcLimit;
      let exception = null;

      if (userId) {
        const { data: exc } = await sb.from('usage_exceptions').select('*').eq('user_id', userId).or('calculator.eq.' + calculator + ',calculator.eq.all').limit(1).single();
        if (exc) { limit = exc.limit_override; exception = exc; }
      }

      let dbCount = 0;
      if (userId) {
        const { data } = await sb.from('usage_logs').select('id').eq('user_id', userId).eq('calculator', calculator)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
        dbCount = data?.length || 0;
      }

      return res.status(200).json({
        allowed: dbCount < limit, used: dbCount, remaining: Math.max(0, limit - dbCount),
        limit, tier, exception: exception ? { reason: exception.reason, limit_override: exception.limit_override } : null,
      });
    }

    if (req.method === 'POST' && action === 'log') {
      const { userId, calculator, country, inputs, results } = req.body || {};
      if (!calculator) return res.status(400).json({ error: 'calculator required' });
      await sb.from('usage_logs').insert([{
        user_id: userId || null, calculator, country: country || null,
        inputs: inputs || null, results: results || null,
      }]);
      return res.status(200).json({ success: true });
    }

    if (req.method === 'POST' && action === 'track') {
      const body = req.body || {};
      const { page, section, url, referrer, lang, screen, duration_seconds, event } = body;

      if (event === 'session_end' && typeof duration_seconds === 'number') {
        const { error } = await sb.from('page_sessions').insert([{
          page: String(page || 'unknown').slice(0, 255),
          section: String(section || page || 'unknown').slice(0, 255),
          duration_seconds: Math.max(0, Math.min(duration_seconds, 86400)),
          started_at: body.started_at || new Date(Date.now() - duration_seconds * 1000).toISOString(),
          url: String(url || '').slice(0, 512),
          referrer: String(referrer || '').slice(0, 512),
          lang: String(lang || '').slice(0, 10),
          screen: String(screen || '').slice(0, 20),
          source: 'web'
        }]);
        if (error) {
          console.error('[track] session insert error:', error.message);
          return res.status(500).json({ error: 'Session insert failed' });
        }
        return res.status(200).json({ success: true, type: 'session' });
      }

      const { error } = await sb.from('page_views').insert([{
        page: String(page || 'unknown').slice(0, 255),
        section: String(section || page || 'unknown').slice(0, 255),
        url: String(url || '').slice(0, 512),
        referrer: String(referrer || '').slice(0, 512),
        lang: String(lang || '').slice(0, 10),
        screen: String(screen || '').slice(0, 20),
        source: 'web'
      }]);

      if (error) {
        console.error('[track] insert error:', error.message);
        return res.status(500).json({ error: 'Insert failed' });
      }
      return res.status(200).json({ success: true, type: 'view' });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Usage API error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Main dispatcher ────────────────────────────────────────
async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || req.body?.action || 'contact';

  if (action === 'contact') return contactHandler(req, res);
  if (action === 'usage') return usageHandler(req, res);

  return res.status(400).json({ error: 'Unknown action' });
}

module.exports = withRateLimit('public', handler);
