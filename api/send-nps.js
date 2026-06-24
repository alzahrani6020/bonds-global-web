// ============================================
// Send NPS Surveys
// POST /api/send-nps
// Authorization: Bearer <admin-jwt> OR internal cron
// Finds reports approved in last 24h without survey, sends email
// ============================================

const getSupabase = require('../lib/api/supabase');
const { sendEmail } = require('../lib/api/email');
const { verifyBearer } = require('../lib/api/auth-helper');
const { withRateLimit } = require('../lib/api/rate-limit');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Optional admin auth; if missing, still allow internal cron via secret
  const cronSecret = req.headers['x-cron-secret'];
  const expectedCronSecret = process.env.CRON_SECRET;
  let isAdmin = false;

  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    isAdmin = true;
  } else {
    try {
      const user = await verifyBearer(req);
      const { data: role } = await getSupabase().from('admin_roles').select('role').eq('user_id', user.id).single();
      if (['super_admin','admin','support'].includes(role?.role)) isAdmin = true;
    } catch { /* not admin */ }
  }

  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = getSupabase();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Find approved reports in last 24h without a survey
    const { data: reports, error } = await supabase.from('ai_advisor_reports')
      .select('id, title, approved_at, advisor_name, client_id, advisory_clients!inner(id, auth_user_id, name, email)')
      .gte('approved_at', since)
      .not('client_id', 'is', null);

    if (error) throw error;

    let sent = 0;
    for (const report of reports || []) {
      const client = report.advisory_clients;
      if (!client?.auth_user_id || !client?.email) continue;

      // Skip if survey already exists
      const { count } = await supabase.from('nps_surveys')
        .select('*', { count: 'exact', head: true })
        .eq('report_id', report.id)
        .eq('user_id', client.auth_user_id);
      if (count > 0) continue;

      const { data: survey } = await supabase.from('nps_surveys').insert({
        user_id: client.auth_user_id,
        report_id: report.id,
        status: 'sent',
        sent_at: new Date().toISOString()
      }).select().single();

      const surveyUrl = `${APP_URL}/nps.html?id=${survey.id}`;
      const subject = `ما رأيك في تقرير بوندز الأخير؟`;
      const html = `
        <div dir="rtl" style="font-family:Vazirmatn,system-ui,sans-serif;line-height:1.6;color:#1a1a1a;max-width:600px;margin:0 auto;">
          <div style="background:#0a0f1a;color:#d4a853;padding:1.5rem;text-align:center;">
            <h2 style="margin:0;">بوندز</h2>
          </div>
          <div style="padding:1.5rem;border:1px solid #e5e5e5;">
            <p>مرحباً ${escapeHtml(client.name)}،</p>
            <p>تم اعتماد تقريرك <strong>${escapeHtml(report.title)}</strong>. نود معرفة رأيك بسؤال واحد:</p>
            <div style="text-align:center;margin:2rem 0;">
              <a href="${escapeHtml(surveyUrl)}&score=10" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#22c55e;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">10</a>
              <a href="${escapeHtml(surveyUrl)}&score=9" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#86efac;color:#166534;border-radius:8px;text-decoration:none;font-weight:700;">9</a>
              <a href="${escapeHtml(surveyUrl)}&score=8" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#d9f99d;color:#3f6212;border-radius:8px;text-decoration:none;font-weight:700;">8</a>
              <a href="${escapeHtml(surveyUrl)}&score=7" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#fef08a;color:#854d0e;border-radius:8px;text-decoration:none;font-weight:700;">7</a>
              <a href="${escapeHtml(surveyUrl)}&score=6" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#fed7aa;color:#9a3412;border-radius:8px;text-decoration:none;font-weight:700;">6</a>
              <a href="${escapeHtml(surveyUrl)}&score=5" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#fdba74;color:#9a3412;border-radius:8px;text-decoration:none;font-weight:700;">5</a>
              <a href="${escapeHtml(surveyUrl)}&score=4" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#fb923c;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">4</a>
              <a href="${escapeHtml(surveyUrl)}&score=3" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#f87171;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">3</a>
              <a href="${escapeHtml(surveyUrl)}&score=2" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">2</a>
              <a href="${escapeHtml(surveyUrl)}&score=1" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">1</a>
              <a href="${escapeHtml(surveyUrl)}&score=0" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#991b1b;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">0</a>
            </div>
            <p style="font-size:0.85rem;color:#666;">0 = غير مرجح على الإطلاق، 10 = مرجح جداً</p>
            <p style="margin-top:1.5rem;"><a href="${escapeHtml(surveyUrl)}" style="color:#d4a853;">أو اضغط هنا لإضافة تعليق</a></p>
          </div>
        </div>
      `;

      await sendEmail({ to: client.email, subject, html });
      sent++;
    }

    res.status(200).json({ success: true, sent, checked: reports?.length || 0 });
  } catch (err) {
    console.error('[send-nps] Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}

module.exports = withRateLimit('auth', handler);
