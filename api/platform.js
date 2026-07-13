// ============================================
// Platform API router
// Merges: advisors, pro, site, log-usage, nps
// ============================================

const getSupabase = require('../lib/api/supabase');
const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');
const { sendEmail } = require('../lib/api/email');
const { verifyBearer, verifyBearerAndUser } = require('../lib/api/auth-helper');
const { checkRateLimit } = require('../lib/api/rate-limit');
const { calculateProject, aiInsight, buildHTMLReport } = require('../pro/pro-engine');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';
const crypto = require('crypto');

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function anonymizeIp(ip) {
  if (!ip || ip === 'unknown') return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

const geoCache = new Map();
async function getGeo(req) {
  const ip = getClientIp(req);

  // Prefer edge-network geo headers when available (Cloudflare / Vercel)
  const cfCountry = req.headers['cf-ipcountry'];
  const vercelCountry = req.headers['x-vercel-ip-country'];
  const countryCode = (vercelCountry || cfCountry || '').toString().toUpperCase();
  if (countryCode && countryCode.length === 2) {
    return {
      country: countryCode,
      countryCode,
      city: req.headers['x-vercel-ip-city'] || req.headers['cf-ipcity'] || null,
      region: req.headers['x-vercel-ip-country-region'] || req.headers['cf-region'] || null
    };
  }

  if (!ip || ip === 'unknown') return { country: null, countryCode: null, city: null, region: null };
  if (geoCache.has(ip)) return geoCache.get(ip);
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`);
    if (!res.ok) throw new Error(`ipapi ${res.status}`);
    const data = await res.json();
    const result = { country: data.country_name || data.country || null, countryCode: data.country_code || null, city: data.city || null, region: data.region || null };
    geoCache.set(ip, result);
    if (geoCache.size > 5000) geoCache.clear();
    return result;
  } catch (err) {
    console.warn('[heartbeat] geo lookup failed:', err.message);
    return { country: null, countryCode: null, city: null, region: null };
  }
}

async function upsertPresence(sb, body, ip, geo) {
  const now = new Date().toISOString();
  const payload = {
    session_id: String(body.session_id || '').slice(0, 64),
    user_id: body.user_id || null,
    ip_address: anonymizeIp(ip),
    country: geo.country,
    country_code: geo.countryCode,
    city: geo.city,
    region: geo.region,
    page: String(body.page || '').slice(0, 255),
    section: String(body.section || body.page || '').slice(0, 255),
    url: String(body.url || '').slice(0, 512),
    user_agent: String(body.user_agent || '').slice(0, 512),
    screen: String(body.screen || '').slice(0, 20),
    lang: String(body.lang || '').slice(0, 10),
    last_seen_at: now,
    is_online: true
  };
  const { data: existing } = await sb.from('user_presence').select('session_id, started_at').eq('session_id', payload.session_id).single();
  if (existing) {
    const { error } = await sb.from('user_presence').update(payload).eq('session_id', payload.session_id);
    if (error) throw error;
  } else {
    payload.started_at = body.started_at || now;
    const { error } = await sb.from('user_presence').insert([payload]);
    if (error) throw error;
  }
}

async function insertPageView(sb, body, ip, geo, durationSeconds) {
  const payload = {
    session_id: String(body.session_id || '').slice(0, 64),
    user_id: body.user_id || null,
    ip_address: anonymizeIp(ip),
    country: geo.country,
    country_code: geo.countryCode,
    city: geo.city,
    region: geo.region,
    page: String(body.page || '').slice(0, 255),
    section: String(body.section || body.page || '').slice(0, 255),
    url: String(body.url || '').slice(0, 512),
    referrer: String(body.referrer || '').slice(0, 512),
    user_agent: String(body.user_agent || '').slice(0, 512),
    lang: String(body.lang || '').slice(0, 10),
    screen: String(body.screen || '').slice(0, 20),
    source: 'web',
    duration_seconds: typeof durationSeconds === 'number' ? durationSeconds : null
  };
  const { error } = await sb.from('page_views').insert([payload]);
  if (error) throw error;
}

async function heartbeatHandler(req, res) {
  try {
    const body = req.body || {};
    if (!body.session_id) return res.status(400).json({ error: 'session_id required' });
    const sb = getSupabase();
    const geo = await getGeo(req);
    const ip = getClientIp(req);
    await upsertPresence(sb, body, ip, geo);
    if (body.event === 'view') await insertPageView(sb, body, ip, geo);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[heartbeat] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function heartbeatLeaveHandler(req, res) {
  try {
    const body = req.body || {};
    if (!body.session_id) return res.status(400).json({ error: 'session_id required' });
    const sb = getSupabase();
    const geo = await getGeo(req);
    const ip = getClientIp(req);
    const duration = typeof body.duration_seconds === 'number' ? body.duration_seconds : null;
    await upsertPresence(sb, body, ip, geo);
    await insertPageView(sb, body, ip, geo, duration);
    await sb.from('user_presence').update({ is_online: false }).eq('session_id', body.session_id);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[heartbeat leave] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Advisors ───────────────────────────────────────────────
const ADVISOR_ALLOWED_STATUSES = ['under_review', 'approved', 'returned'];

async function advisorsListAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabase();
    const { data: advisors, error } = await supabase.from('advisors')
      .select('id, name, title, bio, avatar_url, specializations, languages, years_experience, certifications, commission_rate, hourly_rate, sort_order')
      .eq('status', 'approved')
      .eq('is_public', true)
      .order('sort_order', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.status(200).json({ success: true, advisors: advisors || [] });
  } catch (err) {
    console.error('[advisors] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to load advisors' });
  }
}

async function advisorsDashboardAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await verifyBearerAndUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const supabase = getSupabase();
    const { data: advisor, error: advisorError } = await supabase
      .from('advisors')
      .select('id, name, title, bio, status, commission_rate, is_public')
      .eq('user_id', user.id)
      .single();

    if (advisorError || !advisor) {
      return res.status(404).json({ error: 'Advisor profile not found' });
    }

    const { data: assignments, error: assignmentsError } = await supabase
      .from('ai_review_requests')
      .select('id, status, note, preferred_by_client, created_at, updated_at, ai_requests!inner(id, type)')
      .eq('advisor_id', advisor.id)
      .order('created_at', { ascending: false });

    if (assignmentsError) throw assignmentsError;

    const { data: earnings, error: earningsError } = await supabase
      .from('advisor_earnings')
      .select('id, description, gross_amount, commission_amount, net_amount, status, paid_at, created_at')
      .eq('advisor_id', advisor.id)
      .order('created_at', { ascending: false });

    if (earningsError) throw earningsError;

    const pending = (assignments || []).filter(a => ['assigned', 'under_review'].includes(a.status)).length;
    const completed = (assignments || []).filter(a => a.status === 'approved').length;
    const totalEarnings = (earnings || []).reduce((sum, e) => sum + (Number(e.net_amount) || 0), 0);
    const paidEarnings = (earnings || []).filter(e => e.status === 'paid').reduce((sum, e) => sum + (Number(e.net_amount) || 0), 0);

    res.status(200).json({
      success: true,
      advisor,
      assignments: assignments || [],
      earnings: earnings || [],
      stats: { pending, completed, totalEarnings, paidEarnings }
    });
  } catch (err) {
    console.error('[advisor-dashboard] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
}

async function advisorsUpdateReviewAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await verifyBearerAndUser(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { reviewRequestId, status, notes } = req.body || {};
    if (!reviewRequestId || !ADVISOR_ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    const supabase = getSupabase();
    const { data: advisor } = await supabase
      .from('advisors')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!advisor) return res.status(404).json({ error: 'Advisor profile not found' });

    const update = {
      status,
      advisor_notes: notes ? String(notes).slice(0, 2000) : null,
      updated_at: new Date().toISOString()
    };
    if (status === 'approved') {
      update.completed_at = new Date().toISOString();
      update.reviewed_by = user.id;
    }

    const { data, error } = await supabase
      .from('ai_review_requests')
      .update(update)
      .eq('id', reviewRequestId)
      .eq('advisor_id', advisor.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Review request not found or not assigned to you' });

    res.status(200).json({ success: true, review: data });
  } catch (err) {
    console.error('[advisor-update-review] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to update review' });
  }
}

async function advisorsHandler(req, res) {
  const action = req.query?.action || req.body?.action;
  switch (action) {
    case 'list': return advisorsListAction(req, res);
    case 'dashboard': return advisorsDashboardAction(req, res);
    case 'update-review': return advisorsUpdateReviewAction(req, res);
    default:
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') return res.status(200).end();
      return res.status(400).json({ error: 'Invalid or missing action' });
  }
}

// ── Pro ────────────────────────────────────────────────────
function getProAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Supabase auth environment variables missing');
  return createClient(url, key);
}

function setProCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getProAction(req) {
  if (req.body && req.body.action) return req.body.action;
  if (req.query && req.query.action) return req.query.action;
  const url = req.url || '';
  const qs = url.split('?')[1] || '';
  const m = qs.match(/(^|&)action=([^&]+)/);
  if (m) return decodeURIComponent(m[2]);
  return url.replace(/^\/api\/pro\.js\/?/, '').replace(/\/$/, '') || null;
}

async function proCalculate(req, res) {
  const body = req.body || {};
  const { sector, activity, capital, revenue } = body;
  if (!sector || !activity || !capital || !revenue) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const result = calculateProject({ sector, activity, capital: parseFloat(capital), revenue: parseFloat(revenue) });
  const ai = aiInsight(result);
  res.status(200).json({ result, ai });
}

async function proReport(req, res) {
  const params = req.method === 'GET' ? (req.query || {}) : (req.body || {});
  const { sector, activity, capital, revenue, format = 'json' } = params;
  if (!sector || !activity || !capital || !revenue) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const result = calculateProject({ sector, activity, capital: parseFloat(capital), revenue: parseFloat(revenue) });
  const insight = aiInsight(result);
  if (format === 'html') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(buildHTMLReport(result, insight));
  }
  res.status(200).json({ result, insight });
}

async function proStripe(req, res) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = req.body || {};
  const { plan = 'single', email } = body;
  const priceId = plan === 'monthly' ? process.env.STRIPE_PRICE_ENTERPRISE : process.env.STRIPE_PRICE_PRO;

  const sessionConfig = {
    payment_method_types: ['card'],
    mode: 'payment',
    success_url: `${APP_URL}/pro/report.html?paid=1`,
    cancel_url: `${APP_URL}/pro/index.html`,
    customer_email: email || undefined
  };

  if (priceId) {
    sessionConfig.line_items = [{ price: priceId, quantity: 1 }];
  } else {
    sessionConfig.line_items = [{
      price_data: {
        currency: 'sar',
        product_data: { name: plan === 'monthly' ? 'Bonds Pro Monthly' : 'Bonds Pro Report' },
        unit_amount: plan === 'monthly' ? 19900 : 4900
      },
      quantity: 1
    }];
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);
  res.status(200).json({ url: session.url });
}

async function proAuth(req, res) {
  const { action, email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  if (action === 'signup') {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    return res.status(200).json({ success: true, user: { id: data.user.id, email: data.user.email } });
  }

  const authClient = getProAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.status(200).json({ success: true, token: data.session.access_token, refresh_token: data.session.refresh_token, user: data.user });
}

async function proHandler(req, res) {
  setProCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  let action = getProAction(req);
  // Normalize legacy pro login actions to the shared auth handler
  if (action === 'signin' || action === 'signup') action = 'auth';

  try {
    switch (action) {
      case 'calculate': return await proCalculate(req, res);
      case 'report': return await proReport(req, res);
      case 'stripe': return await proStripe(req, res);
      case 'auth': return await proAuth(req, res);
      default: return res.status(404).json({ error: 'Unknown pro action', action, url: req.url });
    }
  } catch (err) {
    console.error(`[pro/${action}] Error:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message, action, url: req.url });
    }
  }
}

// ── Site (contact + usage) ─────────────────────────────────
async function siteContactHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const {
      name, phone, email, city, activity, score, verdict, monthlyProfit, url, source, message
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
    let saveError = null;
    try {
      const supabase = getSupabase();
      let { data, error } = await supabase
        .from('contact_messages')
        .insert([payload])
        .select()
        .single();

      // Retry without `city` if the column doesn't exist yet in this environment
      if (error && /column.*city|city.*column|schema cache/i.test(error.message || '')) {
        console.error('[contact] city column missing, retrying without it:', error.message);
        const payloadNoCity = { ...payload };
        delete payloadNoCity.city;
        const retry = await supabase
          .from('contact_messages')
          .insert([payloadNoCity])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) {
        saveError = error.message;
        console.error('[contact] Supabase error:', error.message);
      } else {
        savedId = data?.id;
      }
    } catch (dbErr) {
      saveError = dbErr.message;
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
        await sendEmail({ to: adminEmail, subject: emailSubject, text: emailBody, html: emailHtml });
      }
    }

    return res.status(200).json({
      success: true,
      id: savedId,
      saved: !!savedId,
      demo: !savedId,
      saveError: savedId ? undefined : saveError,
      message: savedId
        ? 'Lead received successfully'
        : 'Lead received but NOT saved to database — check server logs'
    });

  } catch (err) {
    console.error('[contact] Error:', err.message);
    return res.status(500).json({ success: false, error: 'Server error' });
  }
}

async function sendLetterAction(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const { to, subject, body, html, text } = req.body || {};
  const recipient = to && String(to).trim() ? String(to).trim() : process.env.MANAGER_EMAIL;
  if (!recipient || !recipient.includes('@')) {
    return res.status(400).json({ ok: false, error: 'A valid recipient email is required.' });
  }

  const result = await sendEmail({
    to: recipient,
    subject: subject || 'New letterhead submission',
    text: text || body || '',
    html: Array.isArray(html) ? html.join('<hr>') : (html || '')
  });

  if (result.success) return res.status(200).json({ ok: true });
  return res.status(500).json({ ok: false, error: 'Failed to send email.' });
}

async function siteUsageHandler(req, res) {
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
      let tierExpiresAt = null;
      if (userId) {
        const { data: profile } = await sb.from('profiles').select('tier, tier_expires_at').eq('id', userId).single();
        if (profile?.tier) {
          tier = profile.tier;
          tierExpiresAt = profile.tier_expires_at;
        }
        const { data: adminRole } = await sb.from('admin_roles').select('role').eq('user_id', userId).single();
        if (adminRole?.role) {
          return res.status(200).json({ allowed: true, remaining: Infinity, tier, admin: adminRole.role });
        }
      }
      if (tierExpiresAt && new Date(tierExpiresAt) < new Date()) {
        tier = 'free';
      }
      if (tier !== 'free') return res.status(200).json({ allowed: true, remaining: Infinity, tier, tier_expires_at: tierExpiresAt });

      const isFeas = calculator.includes('feasibility');
      let limit = isFeas ? feasLimit : calcLimit;
      let exception = null;

      if (userId) {
        const nowIso = new Date().toISOString();
        const { data: exc } = await sb.from('usage_exceptions')
          .select('*')
          .eq('user_id', userId)
          .or('calculator.eq.' + calculator + ',calculator.eq.all')
          .or('expires_at.gt.' + nowIso + ',expires_at.is.null')
          .limit(1)
          .single();
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

async function siteHandler(req, res) {
  const action = req.query?.action || req.body?.action || 'contact';
  if (action === 'contact') return siteContactHandler(req, res);
  if (action === 'usage') return siteUsageHandler(req, res);
  if (action === 'heartbeat') return heartbeatHandler(req, res);
  if (action === 'heartbeat-leave') return heartbeatLeaveHandler(req, res);
  if (action === 'send-letter') return sendLetterAction(req, res);
  return res.status(400).json({ error: 'Unknown action' });
}

// ── Log Usage ──────────────────────────────────────────────
async function logUsageHandler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { user_id, calculator, country, inputs, results } = req.body || {};
    if (!calculator) return res.status(400).json({ error: 'calculator required' });

    const supabase = getSupabase();
    const { error } = await supabase.from('usage_logs').insert([{
      user_id: user_id || null,
      calculator,
      country: country || null,
      inputs: inputs || null,
      results: results || null,
    }]);

    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[log-usage] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to log usage' });
  }
}

// ── NPS ────────────────────────────────────────────────────
function npsEscapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function npsCheckAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query || {};
  if (!id) return res.status(400).json({ valid: false, error: 'Missing id' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.from('nps_surveys')
      .select('id, status')
      .eq('id', id)
      .in('status', ['sent', 'pending'])
      .single();

    if (error || !data) {
      return res.status(200).json({ valid: false });
    }

    res.status(200).json({ valid: true });
  } catch (err) {
    console.error('[nps-check] Error:', err);
    res.status(500).json({ valid: false, error: 'Server error' });
  }
}

async function npsSubmitAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { surveyId, score, feedback } = req.body || {};
    if (!surveyId || score === undefined || score < 0 || score > 10) {
      return res.status(400).json({ success: false, error: 'Invalid survey or score' });
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.from('nps_surveys').update({
      score: Number(score),
      feedback: feedback ? String(feedback).slice(0, 2000) : null,
      status: 'responded',
      responded_at: new Date().toISOString()
    }).eq('id', surveyId).eq('status', 'sent').select().single();

    if (error) throw error;
    if (!data) return res.status(404).json({ success: false, error: 'Survey not found or already responded' });

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('[nps-submit] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to submit' });
  }
}

async function npsSendAction(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cronSecret = req.headers['x-cron-secret'];
  const expectedCronSecret = process.env.CRON_SECRET;
  let isAdmin = false;

  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    isAdmin = true;
  } else {
    try {
      const user = await verifyBearer(req);
      const { data: role } = await getSupabase().from('admin_roles').select('role').eq('user_id', user.id).single();
      if (['super_admin', 'admin', 'support'].includes(role?.role)) isAdmin = true;
    } catch { /* not admin */ }
  }

  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = getSupabase();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: reports, error } = await supabase.from('ai_advisor_reports')
      .select('id, title, approved_at, advisor_name, client_id, advisory_clients!inner(id, auth_user_id, name, email)')
      .gte('approved_at', since)
      .not('client_id', 'is', null);

    if (error) throw error;

    let sent = 0;
    for (const report of reports || []) {
      const client = report.advisory_clients;
      if (!client?.auth_user_id || !client?.email) continue;

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
            <p>مرحباً ${npsEscapeHtml(client.name)}،</p>
            <p>تم اعتماد تقريرك <strong>${npsEscapeHtml(report.title)}</strong>. نود معرفة رأيك بسؤال واحد:</p>
            <div style="text-align:center;margin:2rem 0;">
              <a href="${npsEscapeHtml(surveyUrl)}&score=10" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#22c55e;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">10</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=9" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#86efac;color:#166534;border-radius:8px;text-decoration:none;font-weight:700;">9</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=8" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#d9f99d;color:#3f6212;border-radius:8px;text-decoration:none;font-weight:700;">8</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=7" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#fef08a;color:#854d0e;border-radius:8px;text-decoration:none;font-weight:700;">7</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=6" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#fed7aa;color:#9a3412;border-radius:8px;text-decoration:none;font-weight:700;">6</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=5" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#fdba74;color:#9a3412;border-radius:8px;text-decoration:none;font-weight:700;">5</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=4" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#fb923c;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">4</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=3" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#f87171;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">3</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=2" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">2</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=1" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#dc2626;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">1</a>
              <a href="${npsEscapeHtml(surveyUrl)}&score=0" style="display:inline-block;margin:0.25rem;padding:0.75rem 1rem;background:#991b1b;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;">0</a>
            </div>
            <p style="font-size:0.85rem;color:#666;">0 = غير مرجح على الإطلاق، 10 = مرجح جداً</p>
            <p style="margin-top:1.5rem;"><a href="${npsEscapeHtml(surveyUrl)}" style="color:#d4a853;">أو اضغط هنا لإضافة تعليق</a></p>
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

async function npsHandler(req, res) {
  const action = req.query?.action || req.body?.action;
  switch (action) {
    case 'check': return npsCheckAction(req, res);
    case 'submit': return npsSubmitAction(req, res);
    case 'send': return npsSendAction(req, res);
    default:
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') return res.status(200).end();
      return res.status(400).json({ error: 'Invalid or missing action' });
  }
}

// ── Main Router ────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // Advisors
    if (pathname === '/api/advisors' || pathname === '/api/advisors/') {
      req.query = req.query || {}; req.query.action = req.query.action || 'list';
      if (checkRateLimit('public', req, res)) return;
      return advisorsHandler(req, res);
    }
    if (pathname === '/api/advisor-dashboard' || pathname === '/api/advisor-dashboard/') {
      req.query = req.query || {}; req.query.action = 'dashboard';
      if (checkRateLimit('auth', req, res)) return;
      return advisorsHandler(req, res);
    }
    if (pathname === '/api/advisor-update-review' || pathname === '/api/advisor-update-review/') {
      req.query = req.query || {}; req.query.action = 'update-review';
      if (checkRateLimit('auth', req, res)) return;
      return advisorsHandler(req, res);
    }

    // Pro
    if (pathname === '/api/pro' || pathname === '/api/pro/') {
      if (checkRateLimit('compute', req, res)) return;
      return proHandler(req, res);
    }

    // Letterhead email
    if (pathname === '/api/send-letter' || pathname === '/api/send-letter/') {
      req.query = req.query || {}; req.query.action = 'send-letter';
      if (checkRateLimit('public', req, res)) return;
      return siteHandler(req, res);
    }

    // Site
    if (pathname === '/api/contact' || pathname === '/api/contact/') {
      req.query = req.query || {}; req.query.action = 'contact';
      if (checkRateLimit('public', req, res)) return;
      return siteHandler(req, res);
    }
    if (pathname === '/api/usage' || pathname === '/api/usage/' || pathname === '/api/track' || pathname === '/api/track/') {
      req.query = req.query || {}; req.query.action = 'usage';
      if (checkRateLimit('public', req, res)) return;
      return siteHandler(req, res);
    }
    if (pathname === '/api/site' || pathname === '/api/site/') {
      if (checkRateLimit('public', req, res)) return;
      return siteHandler(req, res);
    }

    // Log usage
    if (pathname === '/api/log-usage' || pathname === '/api/log-usage/') {
      if (checkRateLimit('public', req, res)) return;
      return logUsageHandler(req, res);
    }

    // NPS
    if (pathname === '/api/nps-check' || pathname === '/api/nps-check/') {
      req.query = req.query || {}; req.query.action = 'check';
      if (checkRateLimit('public', req, res)) return;
      return npsHandler(req, res);
    }
    if (pathname === '/api/nps-submit' || pathname === '/api/nps-submit/') {
      req.query = req.query || {}; req.query.action = 'submit';
      if (checkRateLimit('public', req, res)) return;
      return npsHandler(req, res);
    }
    if (pathname === '/api/send-nps' || pathname === '/api/send-nps/') {
      req.query = req.query || {}; req.query.action = 'send';
      if (checkRateLimit('auth', req, res)) return;
      return npsHandler(req, res);
    }
    if (pathname === '/api/nps' || pathname === '/api/nps/') {
      const action = req.query?.action || req.body?.action;
      const category = action === 'send' ? 'auth' : 'public';
      if (checkRateLimit(category, req, res)) return;
      return npsHandler(req, res);
    }

    return res.status(404).json({ error: 'Not found' });
  } catch (err) {
    console.error('[platform] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: err.message || 'Internal error' });
    }
  }
};
