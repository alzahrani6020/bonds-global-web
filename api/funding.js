// ============================================
// Unified Funding API
// Actions: bank-transfer, sources, funding-readiness, bank-partner-request
// ============================================

const getSupabase = require('../lib/api/supabase');
const { sendEmail } = require('../lib/api/email');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { verifyBearer } = require('../lib/api/auth-helper');
const { setAllowedOrigin } = require('../lib/api/cors');
const { handleFundingExtractionRequest } = require('../lib/api/funding-request-handler');

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || (process.env.ADMIN_EMAILS || '').split(',')[0].trim() || '';

// ── Shared helpers from leads.js ───────────────────────────
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

// ── Bank Transfer ──────────────────────────────────────────
async function sendBankTransferNotification(request) {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;
    const html = `<div style="direction:rtl;font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#b8954e;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#66757F" d="M3 16h30v18H3z"/><path fill="#CCD6DD" d="M2 34h32c1.104 0 2 .896 2 2H0c0-1.104.896-2 2-2z"/><path fill="#292F33" d="M18 23c-1.657 0-3 1.343-3 3v6h6v-6c0-1.657-1.343-3-3-3z"/><path fill="#CCD6DD" d="M3 21h4v11H3zm6 0h4v11H9zm20 0h4v11h-4zm-6 0h4v11h-4z"/><path fill="#AAB8C2" d="M2 32h32v2H2z"/><path fill="#66757F" d="M36 11L18 0 0 11z"/><path fill="#CCD6DD" d="M18 2.4L2 12v4h32v-4z"/><path fill="#8899A6" d="M3 19h4v2H3zm6 0h4v2H9zm14 0h4v2h-4zm6 0h4v2h-4z"/><path fill="#CCD6DD" d="M1 12h34v5H1z"/><path fill="#AAB8C2" d="M36 12c0 .552-.447 1-1 1H1c-.552 0-1-.448-1-1v-1c0-.552.448-1 1-1h34c.553 0 1 .448 1 1v1zm0 6c0 .552-.447 1-1 1H1c-.552 0-1-.448-1-1v-1c0-.552.448-1 1-1h34c.553 0 1 .448 1 1v1z"/><path fill="#E1E8ED" d="M13 32h10v2H13z"/><path fill="#F5F8FA" d="M11 34h14v2H11z"/></svg> طلب تحويل بنكي جديد</h2><table style="width:100%;border-collapse:collapse;margin:20px 0;"><tr><td style="padding:10px;border:1px solid #ddd;font-weight:bold;">الاسم</td><td style="padding:10px;border:1px solid #ddd;">${request.name}</td></tr><tr><td style="padding:10px;border:1px solid #ddd;font-weight:bold;">البريد</td><td style="padding:10px;border:1px solid #ddd;">${request.email}</td></tr><tr><td style="padding:10px;border:1px solid #ddd;font-weight:bold;">الجوال</td><td style="padding:10px;border:1px solid #ddd;">${request.phone || '-'}</td></tr><tr><td style="padding:10px;border:1px solid #ddd;font-weight:bold;">الباقة</td><td style="padding:10px;border:1px solid #ddd;">${request.tier}</td></tr><tr><td style="padding:10px;border:1px solid #ddd;font-weight:bold;">المبلغ</td><td style="padding:10px;border:1px solid #ddd;">${request.amount_sar} ر.س</td></tr></table><a href="https://bonds-global.com/admin/bank-transfers.html" style="display:inline-block;background:#b8954e;color:#1a1a1a;padding:12px 24px;text-decoration:none;border-radius:8px;font-weight:bold;">الذهاب إلى لوحة التحكم</a></div>`;
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Bonds <onboarding@resend.dev>', to: ADMIN_EMAIL, subject: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#66757F" d="M3 16h30v18H3z"/><path fill="#CCD6DD" d="M2 34h32c1.104 0 2 .896 2 2H0c0-1.104.896-2 2-2z"/><path fill="#292F33" d="M18 23c-1.657 0-3 1.343-3 3v6h6v-6c0-1.657-1.343-3-3-3z"/><path fill="#CCD6DD" d="M3 21h4v11H3zm6 0h4v11H9zm20 0h4v11h-4zm-6 0h4v11h-4z"/><path fill="#AAB8C2" d="M2 32h32v2H2z"/><path fill="#66757F" d="M36 11L18 0 0 11z"/><path fill="#CCD6DD" d="M18 2.4L2 12v4h32v-4z"/><path fill="#8899A6" d="M3 19h4v2H3zm6 0h4v2H9zm14 0h4v2h-4zm6 0h4v2h-4z"/><path fill="#CCD6DD" d="M1 12h34v5H1z"/><path fill="#AAB8C2" d="M36 12c0 .552-.447 1-1 1H1c-.552 0-1-.448-1-1v-1c0-.552.448-1 1-1h34c.553 0 1 .448 1 1v1zm0 6c0 .552-.447 1-1 1H1c-.552 0-1-.448-1-1v-1c0-.552.448-1 1-1h34c.553 0 1 .448 1 1v1z"/><path fill="#E1E8ED" d="M13 32h10v2H13z"/><path fill="#F5F8FA" d="M11 34h14v2H11z"/></svg> طلب تحويل بنكي جديد — ${request.name}`, html }),
    });
  } catch (err) { console.error('Notification failed:', err.message); }
}

async function handleBankTransfer(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { name, email, phone, tier } = req.body || {};
  if (!name || !email || !tier) return res.status(400).json({ error: 'Name, email and tier required' });
  if (!['pro', 'enterprise'].includes(tier)) return res.status(400).json({ error: 'Invalid tier' });

  try {
    const sb = getSupabase();
    const amountSar = tier === 'enterprise' ? 212 : 82;
    const { data, error } = await sb.from('bank_transfer_requests').insert([{ name, email, phone, tier, amount_sar: amountSar }]).select().single();
    if (error) throw error;
    sendBankTransferNotification({ name, email, phone, tier, amount_sar: amountSar });
    return res.status(200).json({ success: true, requestId: data.id, message: 'تم استلام طلبك. سنفعل اشتراكك خلال 24 ساعة.' });
  } catch (err) { console.error(err); return res.status(500).json({ error: 'Failed' }); }
}

// ── Funding Sources ────────────────────────────────────────
const VALID_TYPES = ['bank', 'fund', 'investor', 'government_program'];

async function isAdmin(userId) {
  const sb = getSupabase();
  const { data } = await sb.from('admin_roles')
    .select('role')
    .eq('user_id', userId)
    .in('role', ['super_admin', 'admin'])
    .single();
  return !!data;
}

async function listSources(req, res) {
  const sb = getSupabase();
  const {
    country_code,
    type,
    sector,
    search,
    limit = '50',
    offset = '0'
  } = req.query || {};

  let query = sb.from('funding_sources').select('*').eq('is_active', true);

  if (country_code) query = query.eq('country_code', country_code.toUpperCase());
  if (type) query = query.eq('type', type);
  if (sector) query = query.ilike('sector', `%${sector}%`);
  if (search) {
    query = query.or(`name_ar.ilike.%${search}%,name_en.ilike.%${search}%,description.ilike.%${search}%`);
  }

  const maxLimit = Math.min(parseInt(limit, 10) || 50, 100);
  const skip = Math.max(parseInt(offset, 10) || 0, 0);

  query = query.order('is_featured', { ascending: false })
    .order('sort_order', { ascending: true })
    .order('name_ar', { ascending: true })
    .range(skip, skip + maxLimit - 1);

  const { data, error, count } = await query;
  if (error) {
    console.error('[funding-sources] list error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ data: data || [], count });
}

async function createSource(req, res) {
  const body = req.body || {};
  if (!VALID_TYPES.includes(body.type)) {
    return res.status(400).json({ error: 'Invalid or missing type' });
  }
  if (!body.name_ar) {
    return res.status(400).json({ error: 'name_ar is required' });
  }
  const sb = getSupabase();
  const { data, error } = await sb.from('funding_sources').insert([body]).select().single();
  if (error) {
    console.error('[funding-sources] create error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  return res.status(201).json({ data });
}

async function updateSource(req, res) {
  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'id query param required' });
  const body = req.body || {};
  const sb = getSupabase();
  const { data, error } = await sb.from('funding_sources').update(body).eq('id', id).select().single();
  if (error) {
    console.error('[funding-sources] update error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ data });
}

async function deleteSource(req, res) {
  const id = req.query?.id;
  if (!id) return res.status(400).json({ error: 'id query param required' });
  const sb = getSupabase();
  const { error } = await sb.from('funding_sources').delete().eq('id', id);
  if (error) {
    console.error('[funding-sources] delete error:', error.message);
    return res.status(500).json({ error: error.message });
  }
  return res.status(200).json({ success: true });
}

async function handleSources(req, res) {
  if (req.method === 'GET') {
    if (await checkRateLimit('public', req, res)) return;
    return listSources(req, res);
  }

  let user;
  try {
    user = await verifyBearer(req);
  } catch (err) {
    return res.status(err.status || 401).json({ error: err.message });
  }

  const admin = await isAdmin(user.id);
  if (!admin) return res.status(403).json({ error: 'Admin required' });

  if (await checkRateLimit('public', req, res)) return;

  if (req.method === 'POST') return createSource(req, res);
  if (req.method === 'PUT') return updateSource(req, res);
  if (req.method === 'DELETE') return deleteSource(req, res);
  return res.status(405).json({ error: 'Method not allowed' });
}

// ── Funding Readiness ──────────────────────────────────────
async function fundingReadinessAction(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await checkRateLimit('auth', req, res)) return;

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

    return res.status(200).json({ success: true, id: data.id, score: scoreNum });
  } catch (err) {
    console.error('[funding-readiness] Error:', err);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

// ── Bank Partner Request ───────────────────────────────────
async function bankPartnerRequestAction(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (await checkRateLimit('auth', req, res)) return;

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

    return res.status(200).json({ success: true, id: data.id });
  } catch (err) {
    console.error('[bank-partner-request] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit request' });
  }
}

// ── Optional auth for public funding form ──────────────────
async function getUserFromToken(req, sb) {
  const authHeader = req.headers?.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7);
  try {
    const { data, error } = await sb.auth.getUser(token);
    if (error || !data?.user) return null;
    return data.user;
  } catch (e) {
    return null;
  }
}

// ── Main dispatcher ────────────────────────────────────────
async function handler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query?.action || req.body?.action;

  switch (action) {
    case 'bank-transfer':
      if (await checkRateLimit('public', req, res)) return;
      return handleBankTransfer(req, res);
    case 'sources':
      return handleSources(req, res);
    case 'funding-readiness':
      return fundingReadinessAction(req, res);
    case 'bank-partner-request':
      return bankPartnerRequestAction(req, res);
    case 'funding-request': {
      if (await checkRateLimit('public', req, res)) return;
      const sb = getSupabase();
      const user = await getUserFromToken(req, sb);
      return handleFundingExtractionRequest(req, res, user);
    }
    default:
      return res.status(400).json({ error: 'Invalid or missing action' });
  }
}

module.exports = handler;