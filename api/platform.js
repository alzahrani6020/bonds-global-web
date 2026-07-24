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
const { setAllowedOrigin } = require('../lib/api/cors');
const { calculateProject, aiInsight, buildHTMLReport } = require('../pro/pro-engine');

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://bonds-global.com';
const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_KEY || 'bonds-default-secret';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
const crypto = require('crypto');

// In-memory throttle for admin conversion alerts (serverless best-effort)
const alertThrottle = new Map();
function shouldAlert(key, intervalMs = 60 * 60 * 1000) {
  const now = Date.now();
  const last = alertThrottle.get(key);
  if (!last || (now - last) > intervalMs) {
    alertThrottle.set(key, now);
    return true;
  }
  return false;
}

async function notifySlack(message) {
  const slackUrl = process.env.SLACK_WEBHOOK_URL;
  if (!slackUrl) return;
  try {
    await fetch(slackUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: message })
    });
  } catch (e) {}
}

async function notifyAdminsConversionEvent(eventType, details) {
  if (!ADMIN_EMAILS.length) return;
  const throttleKey = eventType + ':' + (details.calculator || 'all');
  if (!shouldAlert(throttleKey)) return;

  const subject = eventType === 'lead'
    ? '✉️ New calculator lead captured'
    : '🚀 New calculator V3 conversion';

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;background:#f8f9fa;border-radius:12px;">
      <h2 style="color:#b8954e;">${subject}</h2>
      <table style="width:100%;border-collapse:collapse;margin:1rem 0;">
        <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">Calculator</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${details.calculator || '-'}</td></tr>
        <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">Country</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${details.country || '-'}</td></tr>
        <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">Language</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${details.lang || '-'}</td></tr>
        ${details.email ? `<tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">Email</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${details.email}</td></tr>` : ''}
        ${details.url ? `<tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">Source URL</td><td style="padding:0.5rem;border-bottom:1px solid #eee;"><a href="${details.url}" style="color:#b8954e;">View</a></td></tr>` : ''}
      </table>
      <p style="margin-top:1.5rem;font-size:0.85rem;color:#555555;">
        <a href="${APP_URL}/admin/conversion-dashboard.html" style="color:#b8954e;">Open Conversion Dashboard →</a>
      </p>
    </div>
  `;

  for (const adminEmail of ADMIN_EMAILS) {
    try { await sendEmail({ to: adminEmail, subject, text: subject, html }); } catch (e) {}
  }

  const slackMsg = eventType === 'lead'
    ? `✉️ New calculator lead: ${details.calculator} (${details.country || 'unknown'}) — ${details.email}`
    : `🚀 New V3 conversion: ${details.calculator} (${details.country || 'unknown'})`;
  notifySlack(slackMsg + (details.url ? ` | ${details.url}` : ''));
}

function getClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || 'unknown';
}

function anonymizeIp(ip) {
  if (!ip || ip === 'unknown') return null;
  return crypto.createHash('sha256').update(ip).digest('hex');
}

function isValidPublicIp(ip) {
  if (!ip || typeof ip !== 'string') return false;
  // IPv4
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  if (ipv4.test(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.some(p => p > 255)) return false;
    const [a, b, c] = parts;
    // loopback, link-local, private, reserved
    if (a === 127 || a === 0 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || a >= 224) return false;
    return true;
  }
  // IPv6: block loopback and unique local
  if (/^::1$/i.test(ip) || /^fc00:/i.test(ip) || /^fe80:/i.test(ip)) return false;
  if (/^[0-9a-fA-F:]+$/.test(ip) && ip.includes(':')) return true;
  return false;
}

async function resolveAuthUser(req, body = {}) {
  const auth = req.headers?.authorization || '';
  let token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token && body?.auth_token) token = String(body.auth_token);
  if (!token) return null;
  const sb = getSupabase();
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

const geoCache = new Map();
async function getGeo(req) {
  const ip = getClientIp(req);

  // Prefer edge-network geo headers when available (Cloudflare / Vercel)
  const cfCountry = req.headers['cf-ipcountry'];
  const vercelCountry = req.headers['x-vercel-ip-country'];
  const countryCode = (vercelCountry || cfCountry || '').toString().toUpperCase();
  if (countryCode && countryCode.length === 2) {
    const rawCity = req.headers['x-vercel-ip-city'] || req.headers['cf-ipcity'] || '';
    const city = rawCity ? decodeURIComponent(rawCity) : null;
    return {
      country: countryCode,
      countryCode,
      city,
      region: req.headers['x-vercel-ip-country-region'] || req.headers['cf-region'] || null
    };
  }

  if (!isValidPublicIp(ip)) return { country: null, countryCode: null, city: null, region: null };
  if (geoCache.has(ip)) return geoCache.get(ip);
  try {
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`);
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
    const user = await resolveAuthUser(req, body);
    body.user_id = user ? user.id : null;
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
    const user = await resolveAuthUser(req, body);
    body.user_id = user ? user.id : null;
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

function setCors(res, req) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ── Advisors ───────────────────────────────────────────────
const ADVISOR_ALLOWED_STATUSES = ['under_review', 'approved', 'returned'];

async function advisorsListAction(req, res) {
  setAllowedOrigin(res, req);
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
  setAllowedOrigin(res, req);
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
  setAllowedOrigin(res, req);
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
      setAllowedOrigin(res, req);
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
  setAllowedOrigin(res, req);
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
    return res.status(403).json({ error: 'Public signup is disabled. Use Supabase client sign-up.' });
  }

  const authClient = getProAuthClient();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.status(200).json({ success: true, token: data.session.access_token, refresh_token: data.session.refresh_token, user: data.user });
}

async function proHandler(req, res) {
  setProCors(res, req);
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
const FORMSPREE_CONTACT_FORM_ID = process.env.FORMSPREE_CONTACT_FORM_ID || 'mykvdana';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase().trim());
}

function isValidPhone(phone) {
  return /^(05\d{8}|\+\d{7,15})$/.test(String(phone).trim());
}

async function siteContactHandler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const {
      name, phone, email, city, activity, sector, service, score, verdict, monthlyProfit, url, source, message, website
    } = body;

    // Honeypot
    if (website) {
      return res.status(200).json({ success: true });
    }

    if (!name || !phone) {
      return res.status(400).json({ success: false, error: 'Name and phone are required' });
    }

    const phoneStr = String(phone).trim();
    if (!isValidPhone(phoneStr)) {
      return res.status(400).json({ success: false, error: 'Invalid phone number' });
    }

    const emailStr = email ? String(email).toLowerCase().trim() : '';
    if (emailStr && !isValidEmail(emailStr)) {
      return res.status(400).json({ success: false, error: 'Invalid email address' });
    }

    const sectorVal = sector || activity || '';
    const serviceVal = service || source || '';
    const isContactPage = !!(message && (sectorVal || serviceVal));

    const payload = {
      name: String(name).slice(0, 200),
      phone: phoneStr.slice(0, 50),
      email: emailStr ? emailStr.slice(0, 200) : null,
      city: city ? String(city).slice(0, 100) : null,
      sector: sectorVal ? String(sectorVal).slice(0, 100) : null,
      service: serviceVal ? String(serviceVal).slice(0, 100) : null,
      message: message ? String(message).slice(0, 5000) : JSON.stringify({
        calculatorScore: score || 0,
        calculatorVerdict: verdict || '',
        monthlyProfit: monthlyProfit || 0,
        pageUrl: url || ''
      }),
      read: false,
      source: source ? String(source).slice(0, 100) : (isContactPage ? 'contact-page' : 'website')
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

    // Forward to Formspree for email delivery
    let formspreeOk = false;
    try {
      const formspreeRes = await fetch(`https://formspree.io/f/${FORMSPREE_CONTACT_FORM_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: payload.name,
          phone: payload.phone,
          email: payload.email,
          city: payload.city,
          sector: payload.sector,
          service: payload.service,
          message: payload.message,
          _subject: isContactPage
            ? `طلب تواصل جديد من ${payload.name} — بوندز`
            : `طلب دراسة جدوى جديد — ${payload.name}`,
          _replyto: payload.email || undefined
        })
      });
      formspreeOk = formspreeRes.ok;
      if (!formspreeOk) {
        const text = await formspreeRes.text().catch(() => '');
        console.error('[contact] Formspree failed:', formspreeRes.status, text.slice(0, 200));
      }
    } catch (fsErr) {
      console.error('[contact] Formspree error:', fsErr.message);
    }

    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map(s => s.trim()).filter(Boolean);
    if (adminEmails.length > 0) {
      const emailSubject = isContactPage
        ? `طلب تواصل جديد من ${payload.name} — بوندز`
        : `طلب دراسة جدوى جديد — ${payload.name}`;

      const emailBody = isContactPage
        ? `
اسم المرسل: ${payload.name}
الجوال: ${payload.phone}
البريد: ${payload.email || 'غير متوفر'}
المدينة: ${payload.city || 'غير محددة'}
القطاع: ${payload.sector || 'غير محدد'}
الخدمة: ${payload.service || 'غير محددة'}

الرسالة:
${message || '—'}

---
تم الاستلام عبر: bonds-global.com/contact
        `.trim()
        : `
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

      const emailHtml = isContactPage
        ? `
<div dir="rtl" style="font-family:Vazirmatn,system-ui,sans-serif;line-height:1.6;color:#1a1a1a;">
  <h2 style="color:#b8954e;">طلب تواصل جديد — بوندز</h2>
  <table style="width:100%;border-collapse:collapse;margin:1rem 0;">
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الاسم</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${escapeHtml(payload.name)}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الجوال</td><td style="padding:0.5rem;border-bottom:1px solid #eee;direction:ltr;text-align:right;">${escapeHtml(payload.phone)}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">البريد</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${payload.email ? escapeHtml(payload.email) : '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">المدينة</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${payload.city ? escapeHtml(payload.city) : '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">القطاع</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${payload.sector ? escapeHtml(payload.sector) : '-'}</td></tr>
    <tr><td style="padding:0.5rem;border-bottom:1px solid #eee;font-weight:700;">الخدمة</td><td style="padding:0.5rem;border-bottom:1px solid #eee;">${payload.service ? escapeHtml(payload.service) : '-'}</td></tr>
  </table>
  <div style="background:#f8f9fa;padding:1rem;border-radius:8px;margin-top:1rem;">
    <p style="margin:0;font-weight:700;">الرسالة:</p>
    <p style="margin:0.5rem 0 0;">${message ? escapeHtml(String(message)).replace(/\n/g, '<br>') : '—'}</p>
  </div>
  <p style="margin-top:1.5rem;font-size:0.85rem;color:#555555;">
    <a href="https://bonds-global.com/admin/messages.html" style="color:#b8954e;">فتح لوحة التحكم →</a>
  </p>
</div>
        `
        : `
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

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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
      const { calculator } = req.query;
      if (!calculator) return res.status(400).json({ error: 'calculator required' });

      const user = await resolveAuthUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      const userId = user.id;

      const { data: settingsRows } = await sb.from('site_settings').select('*');
      const settings = {};
      (settingsRows || []).forEach(s => settings[s.key] = s.value);
      const calcLimit = parseInt(settings.calc_limit || '3', 10);
      const feasLimit = parseInt(settings.feas_limit || '1', 10);

      let tier = 'free';
      let tierExpiresAt = null;
      const { data: profile } = await sb.from('profiles').select('tier, tier_expires_at').eq('id', userId).single();
      if (profile?.tier) {
        tier = profile.tier;
        tierExpiresAt = profile.tier_expires_at;
      }
      const { data: adminRole } = await sb.from('admin_roles').select('role').eq('user_id', userId).single();
      if (adminRole?.role) {
        return res.status(200).json({ allowed: true, remaining: Infinity, tier, admin: adminRole.role });
      }

      if (tierExpiresAt && new Date(tierExpiresAt) < new Date()) {
        tier = 'free';
      }
      if (tier !== 'free') return res.status(200).json({ allowed: true, remaining: Infinity, tier, tier_expires_at: tierExpiresAt });

      const isFeas = calculator.includes('feasibility');
      let limit = isFeas ? feasLimit : calcLimit;
      let exception = null;

      const nowIso = new Date().toISOString();
      const { data: exc } = await sb.from('usage_exceptions')
        .select('*')
        .eq('user_id', userId)
        .or('calculator.eq.' + calculator + ',calculator.eq.all')
        .or('expires_at.gt.' + nowIso + ',expires_at.is.null')
        .limit(1)
        .single();
      if (exc) { limit = exc.limit_override; exception = exc; }

      const { data } = await sb.from('usage_logs').select('id').eq('user_id', userId).eq('calculator', calculator)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      const dbCount = data?.length || 0;

      return res.status(200).json({
        allowed: dbCount < limit, used: dbCount, remaining: Math.max(0, limit - dbCount),
        limit, tier, exception: exception ? { reason: exception.reason, limit_override: exception.limit_override } : null,
      });
    }

    if (req.method === 'POST' && action === 'log') {
      const { calculator, country, inputs, results } = req.body || {};
      if (!calculator) return res.status(400).json({ error: 'calculator required' });

      const user = await resolveAuthUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required' });

      await sb.from('usage_logs').insert([{
        user_id: user.id, calculator, country: country || null,
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
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      const user = await resolveAuthUser(req);
      if (!user) return res.status(401).json({ error: 'Authentication required' });
      const { data: adminRole } = await supabase.from('admin_roles').select('role').eq('user_id', user.id).single();
      if (!adminRole?.role) return res.status(403).json({ error: 'Admin access required' });

      const days = Math.min(parseInt(req.query?.days || '30', 10), 90);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from('calculator_events')
        .select('event, calculator, country, lang, action, duration_seconds, properties, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(10000);

      if (error) throw error;

      // Aggregate metrics
      const metrics = {
        started: 0, completed: 0, saved: 0, exported: 0, v3: 0,
        signup_prompts: 0, signups_confirmed: 0, guests_continued: 0,
        email_captured: 0, totalDuration: 0, durationCount: 0
      };
      const byCalculator = {};
      (data || []).forEach(row => {
        const e = row.event;
        const c = row.calculator || 'unknown';
        if (!byCalculator[c]) byCalculator[c] = { started: 0, completed: 0, saved: 0, exported: 0, v3: 0 };
        if (e === 'calc_started') { metrics.started++; byCalculator[c].started++; }
        if (e === 'calc_completed') { metrics.completed++; byCalculator[c].completed++; }
        if (e === 'calc_save_clicked' || e === 'calc_project_saved') { metrics.saved++; byCalculator[c].saved++; }
        if (e === 'calc_export_clicked') { metrics.exported++; byCalculator[c].exported++; }
        if (e === 'calc_v3_clicked') { metrics.v3++; byCalculator[c].v3++; }
        if (e === 'calc_signup_prompt_confirmed') { metrics.signups_confirmed++; }
        if (e === 'calc_guest_continued') { metrics.guests_continued++; }
        if (e === 'calc_signup_from_action') { metrics.signup_prompts++; }
        if (e === 'email_captured') { metrics.email_captured++; }
        if (typeof row.duration_seconds === 'number' && row.duration_seconds > 0) {
          metrics.totalDuration += row.duration_seconds;
          metrics.durationCount++;
        }
      });

      return res.status(200).json({
        success: true,
        days,
        metrics: {
          started: metrics.started,
          completed: metrics.completed,
          saved: metrics.saved,
          exported: metrics.exported,
          v3: metrics.v3,
          signupPrompts: metrics.signup_prompts,
          signupsConfirmed: metrics.signups_confirmed,
          guestsContinued: metrics.guests_continued,
          emailCaptured: metrics.email_captured,
          avgTimeToResult: metrics.durationCount ? Math.round(metrics.totalDuration / metrics.durationCount) : null
        },
        byCalculator,
        events: data
      });
    } catch (err) {
      console.error('[log-usage GET] Error:', err);
      return res.status(500).json({ success: false, error: 'Failed to fetch metrics' });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const event = body.event || body.calculator || '';
    const calculator = body.calculator || event;
    if (!calculator) return res.status(400).json({ error: 'calculator required' });

    const user = await resolveAuthUser(req);
    const ip = getClientIp(req);

    const { error } = await supabase.from('calculator_events').insert([{
      event: event,
      calculator: calculator,
      country: (body.country || '').toString().slice(0, 8) || null,
      lang: (body.lang || '').toString().slice(0, 8) || null,
      session_id: (body.session_id || '').toString().slice(0, 64) || null,
      user_id: user ? user.id : null,
      action: (body.action || '').toString().slice(0, 32) || null,
      duration_seconds: typeof body.duration_seconds === 'number' ? Math.max(0, Math.min(body.duration_seconds, 86400)) : null,
      properties: body.properties || body.inputs || {},
      url: (body.url || '').toString().slice(0, 512) || null,
      ip_hash: anonymizeIp(ip)
    }]);

    if (error) throw error;

    // Notify admins on V3 conversion (throttled)
    if (event === 'calc_v3_clicked') {
      notifyAdminsConversionEvent('v3', {
        calculator: calculator,
        country: (body.country || '').toString().slice(0, 8) || null,
        lang: (body.lang || '').toString().slice(0, 8) || null,
        url: (body.url || '').toString().slice(0, 512) || null
      }).catch(() => {});
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[log-usage] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to log usage' });
  }
}

function buildTrackClickUrl(targetUrl, email, step) {
  const payload = JSON.stringify({ u: targetUrl, e: email, s: step, t: Date.now() });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const token = crypto.createHash('sha256').update(payloadB64 + UNSUBSCRIBE_SECRET).digest('base64url');
  return `${APP_URL}/api/track-click?d=${encodeURIComponent(payloadB64)}&sig=${encodeURIComponent(token)}`;
}

function buildTrackOpenUrl(email, step) {
  const payload = JSON.stringify({ e: email, s: step, t: Date.now() });
  const payloadB64 = Buffer.from(payload).toString('base64url');
  const token = crypto.createHash('sha256').update(payloadB64 + UNSUBSCRIBE_SECRET).digest('base64url');
  return `${APP_URL}/api/track-open?d=${encodeURIComponent(payloadB64)}&sig=${encodeURIComponent(token)}`;
}

// ── Calculator Lead Email Journey ──────────────────────────
function calculatorEmailTemplates(step, data) {
  const rtl = data.lang === 'ar';
  const calcName = data.calculator;
  const returnUrl = data.url || APP_URL;
  const token = data.unsubscribeToken || data.unsubscribe_token || '';
  const email = data.email || '';
  const variant = data.variant === 'B' ? 'B' : 'A';
  const unsubscribeUrl = `${APP_URL}/api/unsubscribe-lead?token=${encodeURIComponent(token)}`;
  const trackedReturnUrl = buildTrackClickUrl(returnUrl, email, step);
  const trackedUnsubscribeUrl = buildTrackClickUrl(unsubscribeUrl, email, step);
  const trackedHomeUrl = buildTrackClickUrl(APP_URL, email, step);
  const trackedOpenUrl = buildTrackOpenUrl(email, step);
  const advisorUrl = buildTrackClickUrl(`${APP_URL}/advisor`, email, step);

  const footerHtml = rtl
    ? `<hr style="border:0;border-top:1px solid #eee;margin:1.5rem 0;">
       <p style="font-size:0.8rem;color:#888;">أنت تتلقى هذا البريد لأنك استخدمت أداة حاسبة في بوندز.</p>
       <p style="font-size:0.8rem;"><a href="${trackedUnsubscribeUrl}" style="color:#b8954e;">إلغاء الاشتراك</a> | <a href="${trackedHomeUrl}" style="color:#b8954e;">بوندز</a></p>`
    : `<hr style="border:0;border-top:1px solid #eee;margin:1.5rem 0;">
       <p style="font-size:0.8rem;color:#888;">You received this because you used a Bonds calculator.</p>
       <p style="font-size:0.8rem;"><a href="${trackedUnsubscribeUrl}" style="color:#b8954e;">Unsubscribe</a> | <a href="${trackedHomeUrl}" style="color:#b8954e;">Bonds</a></p>`;

  const footerText = rtl
    ? `---\nأنت تتلقى هذا البريد لأنك استخدمت أداة حاسبة في بوندز.\nإلغاء الاشتراك: ${trackedUnsubscribeUrl}\nبوندز: ${trackedHomeUrl}`
    : `---\nYou received this because you used a Bonds calculator.\nUnsubscribe: ${trackedUnsubscribeUrl}\nBonds: ${trackedHomeUrl}`;

  const preheader = (text) => `
    <div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${escapeHtml(text)}</div>
    <img src="${trackedOpenUrl}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />
  `;

  const subjects = {
    0: {
      A: rtl ? `✅ نتائجك جاهزة من حاسبة ${calcName}` : `✅ Your ${calcName} calculator results are ready`,
      B: rtl ? `🎯 ${calcName} — راجع نتائجك الآن` : `🎯 ${calcName} — review your results now`
    },
    1: {
      A: rtl ? `⏰ احفظ نتائج حاسبة ${calcName}` : `⏰ Save your ${calcName} results before they're gone`,
      B: rtl ? `⚠️ نتائج ${calcName} ستُفقد قريبًا` : `⚠️ Your ${calcName} results will be lost soon`
    },
    2: {
      A: rtl ? `🚀 حوّل نتائج ${calcName} إلى خطة استثمارية` : `🚀 Turn your ${calcName} results into an investment plan`,
      B: rtl ? `📈 هل تريد الربح من فكرة ${calcName}؟` : `📈 Want to profit from your ${calcName} idea?`
    },
    3: {
      A: rtl ? `🤝 هل تحتاج مساعدة في مشروع ${calcName}؟` : `🤝 Need help with your ${calcName} project?`,
      B: rtl ? `💼 مستشار بوندز جاهز لمساعدتك في ${calcName}` : `💼 A Bonds advisor is ready to help with ${calcName}`
    }
  };

  const previews = {
    0: rtl ? 'شكراً لاستخدامك الحاسبة. اضغط لمراجعتها وحفظها.' : 'Thanks for using the calculator. Click to review and save.',
    1: rtl ? 'نتائجك لا تزال متاحة لكنها لن تُحفظ إلا بتسجيل الدخول.' : 'Your results are still available but only saved if you sign in.',
    2: rtl ? 'حوّلها إلى خطة استثمارية متكاملة مع Bonds V3.' : 'Convert it into a complete investment plan with Bonds V3.',
    3: rtl ? 'احصل على مراجعة احترافية لمشروعك من مستشار متخصص.' : 'Get a professional review of your project from a specialist advisor.'
  };

  if (step === 0) {
    const html = `
      ${preheader(previews[0])}
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;background:#f8f9fa;border-radius:12px;direction:${rtl?'rtl':'ltr'};text-align:${rtl?'right':'left'};">
        <h2 style="color:#b8954e;">${rtl ? 'نتائجك جاهزة!' : 'Your results are ready!'}</h2>
        <p>${rtl ? 'شكراً لاستخدامك حاسبة' : 'Thanks for using the'} <strong>${calcName}</strong> ${rtl ? 'في بوندز.' : 'calculator on Bonds.'}</p>
        <p>${rtl ? 'يمكنك العودة لنتائجك ومتابعة العمل من خلال الرابط أدناه:' : 'You can return to your results and continue working using the link below:'}</p>
        <a href="${trackedReturnUrl}" style="display:inline-block;margin:1rem 0;padding:0.75rem 1.5rem;background:linear-gradient(135deg,#d4a853,#f0c96a);color:#0c0c1c;text-decoration:none;border-radius:8px;font-weight:700;">${rtl ? 'العودة لنتائجي →' : 'Back to my results →'}</a>
        <p style="margin-top:1rem;">${rtl ? 'أو سجّل دخولك لحفظ المشروع كاملًا والاستمرار في V3.' : 'Or sign in to save the full project and continue with V3.'}</p>
        ${footerHtml}
      </div>
    `;
    const text = rtl
      ? `نتائجك جاهزة!\n\nشكراً لاستخدامك حاسبة ${calcName} في بوندز.\n\nالعودة لنتائجك: ${trackedReturnUrl}\n\nأو سجّل دخولك لحفظ المشروع والاستمرار في V3.\n\n${footerText}`
      : `Your results are ready!\n\nThanks for using the ${calcName} calculator on Bonds.\n\nBack to your results: ${trackedReturnUrl}\n\nOr sign in to save the full project and continue with V3.\n\n${footerText}`;
    return { subject: subjects[0][variant], html, text, preview: previews[0] };
  }

  if (step === 1) {
    const html = `
      ${preheader(previews[1])}
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;background:#f8f9fa;border-radius:12px;direction:${rtl?'rtl':'ltr'};text-align:${rtl?'right':'left'};">
        <h2 style="color:#b8954e;">${rtl ? 'لا تفقد عملك' : 'Don\'t lose your work'}</h2>
        <p>${rtl ? 'أمس استخدمت حاسبة' : 'Yesterday you used the'} <strong>${calcName}</strong> ${rtl ? 'في بوندز.' : 'calculator on Bonds.'}</p>
        <p>${rtl ? 'نتائجك لا تزال متاحة، لكنها لن تُحفظ إلا إذا سجّلت دخولك.' : 'Your results are still available, but they will only be saved if you sign in.'}</p>
        <a href="${trackedReturnUrl}" style="display:inline-block;margin:1rem 0;padding:0.75rem 1.5rem;background:linear-gradient(135deg,#d4a853,#f0c96a);color:#0c0c1c;text-decoration:none;border-radius:8px;font-weight:700;">${rtl ? 'حفظ مشروعي الآن →' : 'Save my project now →'}</a>
        ${footerHtml}
      </div>
    `;
    const text = rtl
      ? `لا تفقد عملك\n\nأمس استخدمت حاسبة ${calcName} في بوندز.\n\nنتائجك لا تزال متاحة، لكنها لن تُحفظ إلا إذا سجّلت دخولك.\n\nحفظ مشروعي الآن: ${trackedReturnUrl}\n\n${footerText}`
      : `Don\'t lose your work\n\nYesterday you used the ${calcName} calculator on Bonds.\n\nYour results are still available, but they will only be saved if you sign in.\n\nSave my project now: ${trackedReturnUrl}\n\n${footerText}`;
    return { subject: subjects[1][variant], html, text, preview: previews[1] };
  }

  if (step === 2) {
    const html = `
      ${preheader(previews[2])}
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;background:#f8f9fa;border-radius:12px;direction:${rtl?'rtl':'ltr'};text-align:${rtl?'right':'left'};">
        <h2 style="color:#b8954e;">${rtl ? 'هل تريد الذهاب أبعد؟' : 'Ready to go further?'}</h2>
        <p>${rtl ? 'قبل أسبوع استخدمت حاسبة' : 'A week ago you used the'} <strong>${calcName}</strong> ${rtl ? 'في بوندز.' : 'calculator on Bonds.'}</p>
        <p>${rtl ? 'بonds V3 يحوّل نتائجك إلى خطة استثمارية متكاملة: تحليل مالي، تقييم مخاطر، دراسة سوق، وتقرير احترافي.' : 'Bonds V3 turns your results into a complete investment plan: financial analysis, risk assessment, market study, and a professional report.'}</p>
        <a href="${trackedReturnUrl}" style="display:inline-block;margin:1rem 0;padding:0.75rem 1.5rem;background:linear-gradient(135deg,#d4a853,#f0c96a);color:#0c0c1c;text-decoration:none;border-radius:8px;font-weight:700;">${rtl ? 'ابدأ خطتي الاستثمارية →' : 'Start my investment plan →'}</a>
        ${footerHtml}
      </div>
    `;
    const text = rtl
      ? `هل تريد الذهاب أبعد؟\n\nقبل أسبوع استخدمت حاسبة ${calcName} في بوندز.\n\nبonds V3 يحوّل نتائجك إلى خطة استثمارية متكاملة.\n\nابدأ خطتي الاستثمارية: ${trackedReturnUrl}\n\n${footerText}`
      : `Ready to go further?\n\nA week ago you used the ${calcName} calculator on Bonds.\n\nBonds V3 turns your results into a complete investment plan.\n\nStart my investment plan: ${trackedReturnUrl}\n\n${footerText}`;
    return { subject: subjects[2][variant], html, text, preview: previews[2] };
  }

  // Step 3: advisor offer (~14 days)
  const html = `
    ${preheader(previews[3])}
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:1.5rem;background:#f8f9fa;border-radius:12px;direction:${rtl?'rtl':'ltr'};text-align:${rtl?'right':'left'};">
      <h2 style="color:#b8954e;">${rtl ? 'هل تحتاج مساعدة متخصصة؟' : 'Need specialist help?'}</h2>
      <p>${rtl ? 'قبل أسبوعين استخدمت حاسبة' : 'Two weeks ago you used the'} <strong>${calcName}</strong> ${rtl ? 'في بوندز.' : 'calculator on Bonds.'}</p>
      <p>${rtl ? 'مستشارو بوندز يمكنهم مراجعة مشروعك وتقديم توصيات عملية للخطوات التالية.' : 'Bonds advisors can review your project and provide practical recommendations for next steps.'}</p>
      <a href="${advisorUrl}" style="display:inline-block;margin:1rem 0;padding:0.75rem 1.5rem;background:linear-gradient(135deg,#d4a853,#f0c96a);color:#0c0c1c;text-decoration:none;border-radius:8px;font-weight:700;">${rtl ? 'طلب مراجعة مجانية →' : 'Request a free review →'}</a>
      <p style="margin-top:1rem;font-size:0.9rem;color:var(--text-secondary);">${rtl ? 'أو عد إلى نتائجك:' : 'Or return to your results:'} <a href="${trackedReturnUrl}" style="color:#b8954e;">${rtl ? 'النتائج' : 'Results'}</a></p>
      ${footerHtml}
    </div>
  `;
  const text = rtl
    ? `هل تحتاج مساعدة متخصصة؟\n\nقبل أسبوعين استخدمت حاسبة ${calcName} في بوندز.\n\nمستشارو بوندز يمكنهم مراجعة مشروعك وتقديم توصيات عملية.\n\nطلب مراجعة مجانية: ${advisorUrl}\n\nأو عد إلى النتائج: ${trackedReturnUrl}\n\n${footerText}`
    : `Need specialist help?\n\nTwo weeks ago you used the ${calcName} calculator on Bonds.\n\nBonds advisors can review your project and provide practical recommendations.\n\nRequest a free review: ${advisorUrl}\n\nOr return to results: ${trackedReturnUrl}\n\n${footerText}`;
  return { subject: subjects[3][variant], html, text, preview: previews[3] };
}

async function sendCalculatorEmail(supabase, lead, step) {
  // We need a lead id to track unsubscribes and duplicates
  let leadId = lead.id;
  if (!leadId && lead.email) {
    const { data: matched } = await supabase.from('calculator_leads')
      .select('id, unsubscribed_at, converted_at, bounced_at, complained_at')
      .eq('email', lead.email)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (matched) {
      leadId = matched.id;
      if (matched.unsubscribed_at) return { skipped: true, reason: 'unsubscribed' };
      if (matched.converted_at) return { skipped: true, reason: 'converted' };
      if (matched.bounced_at) return { skipped: true, reason: 'bounced' };
      if (matched.complained_at) return { skipped: true, reason: 'complained' };
    }
  }

  if (leadId) {
    // Check status flags
    const { data: status } = await supabase.from('calculator_leads')
      .select('unsubscribed_at, converted_at, bounced_at, complained_at')
      .eq('id', leadId)
      .single();
    if (status?.unsubscribed_at) return { skipped: true, reason: 'unsubscribed' };
    if (status?.converted_at) return { skipped: true, reason: 'converted' };
    if (status?.bounced_at) return { skipped: true, reason: 'bounced' };
    if (status?.complained_at) return { skipped: true, reason: 'complained' };

    // Check already sent
    const { data: existing } = await supabase.from('calculator_email_sequences')
      .select('id')
      .eq('lead_id', leadId)
      .eq('step', step)
      .single();
    if (existing) return { skipped: true, reason: 'already_sent' };

    // Check retry limit for previous failures (max 3 attempts, at least 1h apart)
    const { data: failedLog } = await supabase.from('calculator_email_send_logs')
      .select('attempts, failed_at')
      .eq('lead_id', leadId)
      .eq('step', step)
      .single();
    if (failedLog) {
      if (failedLog.attempts >= 3) return { skipped: true, reason: 'max_retries_exceeded' };
      const hoursSinceFailure = (Date.now() - new Date(failedLog.failed_at).getTime()) / (60 * 60 * 1000);
      if (hoursSinceFailure < 1) return { skipped: true, reason: 'retry_cooldown' };
    }
  }

  const variant = Math.random() < 0.5 ? 'A' : 'B';
  const tpl = calculatorEmailTemplates(step, { ...lead, variant });
  const result = await sendEmail({
    to: lead.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text
  });

  // Retry logic: only mark as sent on real success. Demo mode (missing config) is treated
  // as a soft skip so the admin sees the issue; transient failures are retried by the cron.
  if (result.success && !result.demo) {
    await supabase.from('calculator_email_sequences').insert([{
      lead_id: leadId || lead.id || null,
      email: lead.email,
      calculator: lead.calculator,
      step,
      variant
    }]);
    // Clear any previous failure log on successful retry
    if (leadId || lead.id) {
      await supabase.from('calculator_email_send_logs')
        .delete()
        .eq('lead_id', leadId || lead.id)
        .eq('step', step);
    }
    return result;
  }

  if (result.demo) {
    // Configuration missing — log once as a demo send so we don't spam retries.
    await supabase.from('calculator_email_sequences').insert([{
      lead_id: leadId || lead.id || null,
      email: lead.email,
      calculator: lead.calculator,
      step,
      variant
    }]);
    return { ...result, demo: true };
  }

  // Transient failure — log for retry (up to 3 attempts, at least 1h apart)
  const { data: existingLog } = await supabase.from('calculator_email_send_logs')
    .select('id, attempts')
    .eq('lead_id', leadId || lead.id || 0)
    .eq('step', step)
    .single();

  const attempts = (existingLog?.attempts || 0) + 1;
  const logRow = {
    lead_id: leadId || lead.id || null,
    email: lead.email,
    step,
    attempts,
    last_error: String(result.error || result.reason || 'unknown').slice(0, 500),
    failed_at: new Date().toISOString()
  };

  if (existingLog) {
    await supabase.from('calculator_email_send_logs')
      .update(logRow)
      .eq('id', existingLog.id);
  } else {
    await supabase.from('calculator_email_send_logs').insert([logRow]);
  }

  return { success: false, error: result.error || result.reason || 'send_failed', attempts };
}

async function runCalculatorEmailJourney() {
  const supabase = getSupabase();
  const now = new Date();

  // Step 0: immediate (sent inline on capture, but also catch any missed)
  const { data: leads0 } = await supabase.from('calculator_leads')
    .select('id, email, calculator, country, lang, url, unsubscribe_token, created_at')
    .is('unsubscribed_at', null)
    .is('converted_at', null)
    .is('bounced_at', null)
    .is('complained_at', null)
    .order('created_at', { ascending: false })
    .limit(100);

  for (const lead of (leads0 || [])) {
    const ageMs = now - new Date(lead.created_at);
    if (ageMs < 5 * 60 * 1000) { // within 5 minutes
      const { data: sent } = await supabase.from('calculator_email_sequences')
        .select('id').eq('lead_id', lead.id).eq('step', 0).single();
      if (!sent) await sendCalculatorEmail(supabase, lead, 0);
    }
  }

  // Step 1: ~24 hours
  const { data: leads1 } = await supabase.from('calculator_leads')
    .select('id, email, calculator, country, lang, url, unsubscribe_token, created_at')
    .is('unsubscribed_at', null)
    .is('converted_at', null)
    .is('bounced_at', null)
    .is('complained_at', null)
    .lte('created_at', new Date(now - 22 * 60 * 60 * 1000).toISOString())
    .gte('created_at', new Date(now - 48 * 60 * 60 * 1000).toISOString())
    .limit(200);

  for (const lead of (leads1 || [])) {
    await sendCalculatorEmail(supabase, lead, 1);
  }

  // Step 2: ~7 days
  const { data: leads2 } = await supabase.from('calculator_leads')
    .select('id, email, calculator, country, lang, url, unsubscribe_token, created_at')
    .is('unsubscribed_at', null)
    .is('converted_at', null)
    .is('bounced_at', null)
    .is('complained_at', null)
    .lte('created_at', new Date(now - 6 * 24 * 60 * 60 * 1000).toISOString())
    .gte('created_at', new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString())
    .limit(200);

  for (const lead of (leads2 || [])) {
    await sendCalculatorEmail(supabase, lead, 2);
  }

  // Step 3: ~14 days — advisor offer
  const { data: leads3 } = await supabase.from('calculator_leads')
    .select('id, email, calculator, country, lang, url, unsubscribe_token, created_at')
    .is('unsubscribed_at', null)
    .is('converted_at', null)
    .is('bounced_at', null)
    .is('complained_at', null)
    .lte('created_at', new Date(now - 13 * 24 * 60 * 60 * 1000).toISOString())
    .gte('created_at', new Date(now - 18 * 24 * 60 * 60 * 1000).toISOString())
    .limit(200);

  for (const lead of (leads3 || [])) {
    await sendCalculatorEmail(supabase, lead, 3);
  }
}

async function calculatorEmailJourneyHandler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Require a secret token, cron secret, or admin auth
  let isAuthorized = false;
  const cronSecret = req.headers?.['x-cron-secret'];
  const expectedCronSecret = process.env.CRON_SECRET;
  if (cronSecret && expectedCronSecret && cronSecret === expectedCronSecret) {
    isAuthorized = true;
  } else {
    const secret = req.query?.secret || req.body?.secret || '';
    const adminSecret = process.env.CALCULATOR_JOURNEY_SECRET || process.env.ADMIN_API_SECRET || UNSUBSCRIBE_SECRET;
    if (secret === adminSecret) {
      isAuthorized = true;
    } else {
      const user = await resolveAuthUser(req);
      if (user) {
        const supabase = getSupabase();
        const { data: adminRole } = await supabase.from('admin_roles').select('role').eq('user_id', user.id).single();
        if (adminRole?.role) isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    await runCalculatorEmailJourney();
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[calculator-email-journey] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function unsubscribeLeadHandler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const token = (req.query?.token || '').toString();
  if (!token) return res.status(400).json({ error: 'Token required' });

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('calculator_leads')
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq('unsubscribe_token', token);
    if (error) throw error;

    const rtl = req.headers['accept-language']?.startsWith('ar');
    const message = rtl
      ? '✅ تم إلغاء اشتراكك بنجاح. لن تتلقى المزيد من رسائل الحاسبات.'
      : '✅ You have been unsubscribed successfully. You will no longer receive calculator emails.';
    return res.status(200).send(`<html lang="${rtl?'ar':'en'}" dir="${rtl?'rtl':'ltr'}"><body style="font-family:Arial;padding:2rem;text-align:center;"><h2>${message}</h2></body></html>`);
  } catch (err) {
    console.error('[unsubscribe-lead] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// ── Email Click Tracking ───────────────────────────────────
async function trackClickHandler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { d, sig } = req.query || {};
  if (!d) return res.status(400).json({ error: 'Missing data' });

  let payload;
  let payloadStr;
  try {
    payloadStr = Buffer.from(d, 'base64url').toString('utf8');
    payload = JSON.parse(payloadStr);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid data' });
  }

  const expectedSig = crypto.createHash('sha256').update(payloadStr + UNSUBSCRIBE_SECRET).digest('base64url');
  if (!sig || sig !== expectedSig) {
    return res.status(403).json({ error: 'Invalid signature' });
  }

  const targetUrl = payload.u || APP_URL;
  const email = payload.e;
  const step = typeof payload.s === 'number' ? payload.s : null;

  try {
    const supabase = getSupabase();
    if (email && step !== null) {
      await supabase.from('calculator_email_sequences')
        .update({ clicked_at: new Date().toISOString() })
        .eq('email', email)
        .eq('step', step)
        .is('clicked_at', null);
    }
  } catch (err) {
    console.error('[track-click] Error:', err);
  }

  return res.status(302).setHeader('Location', targetUrl).end();
}

// ── Email Open Tracking ────────────────────────────────────
const TRANSPARENT_GIF = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');

async function trackOpenHandler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { d, sig } = req.query || {};
  if (!d) {
    res.setHeader('Content-Type', 'image/gif');
    return res.status(200).send(TRANSPARENT_GIF);
  }

  let payload;
  let payloadStr;
  try {
    payloadStr = Buffer.from(d, 'base64url').toString('utf8');
    payload = JSON.parse(payloadStr);
  } catch (err) {
    res.setHeader('Content-Type', 'image/gif');
    return res.status(200).send(TRANSPARENT_GIF);
  }

  const expectedSig = crypto.createHash('sha256').update(payloadStr + UNSUBSCRIBE_SECRET).digest('base64url');
  if (!sig || sig !== expectedSig) {
    res.setHeader('Content-Type', 'image/gif');
    return res.status(200).send(TRANSPARENT_GIF);
  }

  const email = payload.e;
  const step = typeof payload.s === 'number' ? payload.s : null;

  try {
    const supabase = getSupabase();
    if (email && step !== null) {
      await supabase.from('calculator_email_sequences')
        .update({ opened_at: new Date().toISOString() })
        .eq('email', email)
        .eq('step', step)
        .is('opened_at', null);
    }
  } catch (err) {
    console.error('[track-open] Error:', err);
  }

  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  return res.status(200).send(TRANSPARENT_GIF);
}

// ── Resend Email Webhook (bounce / complaint) ──────────────
async function emailWebhookHandler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const type = body.type || '';
    const email = body.data?.to || body.data?.email || body.email;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(200).json({ success: true, ignored: true });
    }

    const supabase = getSupabase();
    const now = new Date().toISOString();
    const emailLower = String(email).toLowerCase().trim();

    if (type === 'email.bounced' || type === 'email.delivery_failed' || type === 'bounced') {
      await supabase.from('calculator_leads')
        .update({ bounced_at: now })
        .eq('email', emailLower);
      console.log('[email-webhook] Bounce recorded for:', emailLower);
    } else if (type === 'email.complained' || type === 'complained' || type === 'spam') {
      await supabase.from('calculator_leads')
        .update({ complained_at: now })
        .eq('email', emailLower);
      console.log('[email-webhook] Complaint recorded for:', emailLower);
    } else {
      return res.status(200).json({ success: true, ignored: true, type });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[email-webhook] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function requireAdminAuth(req, res) {
  const user = await resolveAuthUser(req);
  if (!user) return { error: res.status(401).json({ error: 'Authentication required' }) };
  const supabase = getSupabase();
  const { data: adminRole } = await supabase.from('admin_roles').select('role').eq('user_id', user.id).single();
  if (!adminRole?.role) return { error: res.status(403).json({ error: 'Admin required' }) };
  return { supabase, user };
}

// ── Calculator Leads Admin Stats ───────────────────────────
async function calculatorLeadsStatsHandler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdminAuth(req, res);
  if (auth.error) return auth.error;
  const { supabase } = auth;

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { count: totalLeads } = await supabase.from('calculator_leads').select('*', { count: 'exact', head: true });
    const { count: leads24h } = await supabase.from('calculator_leads').select('*', { count: 'exact', head: true }).gte('created_at', since24h);
    const { count: leads7d } = await supabase.from('calculator_leads').select('*', { count: 'exact', head: true }).gte('created_at', since7d);
    const { count: unsubscribed } = await supabase.from('calculator_leads').select('*', { count: 'exact', head: true }).not('unsubscribed_at', 'is', null);
    const { count: converted } = await supabase.from('calculator_leads').select('*', { count: 'exact', head: true }).not('converted_at', 'is', null);
    const { count: bounced } = await supabase.from('calculator_leads').select('*', { count: 'exact', head: true }).not('bounced_at', 'is', null);
    const { count: complained } = await supabase.from('calculator_leads').select('*', { count: 'exact', head: true }).not('complained_at', 'is', null);

    const { data: sequences } = await supabase.from('calculator_email_sequences').select('step, variant, opened_at, clicked_at').gte('created_at', since30d);
    const seqStats = { 0: 0, 1: 0, 2: 0, 3: 0, opens: 0, clicks: 0 };
    const variants = { A: { sent: 0, clicks: 0 }, B: { sent: 0, clicks: 0 } };
    const variantByStep = {};
    (sequences || []).forEach(s => {
      if (typeof s.step === 'number') seqStats[s.step] = (seqStats[s.step] || 0) + 1;
      if (s.opened_at) seqStats.opens++;
      if (s.clicked_at) seqStats.clicks++;
      const v = s.variant === 'B' ? 'B' : 'A';
      variants[v].sent++;
      if (s.clicked_at) variants[v].clicks++;
      const key = s.step + ':' + v;
      if (!variantByStep[key]) variantByStep[key] = { step: s.step, variant: v, sent: 0, clicks: 0 };
      variantByStep[key].sent++;
      if (s.clicked_at) variantByStep[key].clicks++;
    });

    const { data: recentLeads } = await supabase.from('calculator_leads')
      .select('id, email, calculator, country, lang, source, url, created_at, unsubscribed_at, converted_at, bounced_at, complained_at')
      .order('created_at', { ascending: false })
      .limit(50);

    const { data: allLeads } = await supabase.from('calculator_leads')
      .select('calculator')
      .gte('created_at', since30d);
    const calcCounts = {};
    (allLeads || []).forEach(l => { calcCounts[l.calculator] = (calcCounts[l.calculator] || 0) + 1; });
    const byCalculator = Object.entries(calcCounts)
      .map(([calculator, count]) => ({ calculator, count }))
      .sort((a, b) => b.count - a.count);

    return res.status(200).json({
      success: true,
      totals: {
        total: totalLeads || 0,
        last24h: leads24h || 0,
        last7d: leads7d || 0,
        unsubscribed: unsubscribed || 0,
        converted: converted || 0,
        bounced: bounced || 0,
        complained: complained || 0
      },
      sequences: seqStats,
      variants,
      variantByStep: Object.values(variantByStep),
      recentLeads: recentLeads || [],
      byCalculator
    });
  } catch (err) {
    console.error('[calculator-leads-stats] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function markLeadConvertedHandler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
    return res.status(400).json({ success: false, error: 'Valid email required' });
  }
  const normalizedEmail = String(email).toLowerCase().trim();

  // Allow admins to mark any lead converted, or authenticated users to mark their own email
  const user = await resolveAuthUser(req);
  let supabase = getSupabase();
  let isAdmin = false;
  if (user) {
    const { data: adminRole } = await supabase.from('admin_roles').select('role').eq('user_id', user.id).single();
    isAdmin = !!adminRole?.role;
  }
  if (!isAdmin) {
    if (!user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    if (user.email !== normalizedEmail) {
      return res.status(403).json({ success: false, error: 'Can only mark your own email as converted' });
    }
    if (await checkRateLimit('auth', req, res)) return;
  }

  try {
    const { error } = await supabase.from('calculator_leads')
      .update({ converted_at: new Date().toISOString() })
      .eq('email', normalizedEmail);

    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[mark-lead-converted] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── Calculator Leads Retention ─────────────────────────────
async function calculatorLeadsRetentionHandler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await requireAdminAuth(req, res);
  if (auth.error) return auth.error;
  const { supabase } = auth;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();
    const oneYearAgo = new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Hard-delete leads that opted out or were undeliverable more than 30 days ago
    const { error: deleteError, count: deleted } = await supabase.from('calculator_leads')
      .delete()
      .or(`unsubscribed_at.lt.${thirtyDaysAgo},bounced_at.lt.${thirtyDaysAgo},complained_at.lt.${thirtyDaysAgo}`)
      .select('id');
    if (deleteError) throw deleteError;

    // 2. Anonymize active leads older than 1 year (GDPR data minimization)
    const { error: anonError } = await supabase.from('calculator_leads')
      .update({
        email: 'anonymized@deleted.local',
        metadata: {},
        url: null,
        session_id: null,
        anonymized_at: now.toISOString()
      })
      .is('anonymized_at', null)
      .lt('created_at', oneYearAgo);
    if (anonError) throw anonError;

    // 3. Count remaining leads for reporting
    const { count: remaining } = await supabase.from('calculator_leads')
      .select('*', { count: 'exact', head: true });
    const { count: anonymized } = await supabase.from('calculator_leads')
      .select('*', { count: 'exact', head: true }).not('anonymized_at', 'is', null);

    return res.status(200).json({
      success: true,
      deleted: deleted || 0,
      anonymized: anonymized || 0,
      remaining: remaining || 0
    });
  } catch (err) {
    console.error('[calculator-leads-retention] Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}

// ── Lead Capture ───────────────────────────────────────────
async function leadCaptureHandler(req, res) {
  setAllowedOrigin(res, req);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const email = String(body.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    const supabase = getSupabase();
    const ip = getClientIp(req);
    const unsubscribeToken = crypto.randomBytes(32).toString('hex');
    const emailHash = crypto.createHash('sha256').update(email).digest('hex');
    const { data: insertedLead, error } = await supabase.from('calculator_leads').insert([{
      email,
      email_hash: emailHash,
      calculator: String(body.calculator || '').slice(0, 64) || 'unknown',
      country: String(body.country || '').slice(0, 8) || null,
      lang: String(body.lang || '').slice(0, 8) || null,
      session_id: String(body.session_id || '').slice(0, 64) || null,
      source: String(body.source || 'exit_intent').slice(0, 32),
      url: String(body.url || '').slice(0, 512) || null,
      metadata: body.metadata || {},
      unsubscribe_token: unsubscribeToken
    }]).select('id, email, email_hash, calculator, country, lang, url, unsubscribe_token').single();

    if (error) throw error;

    // Send immediate welcome email
    sendCalculatorEmail(supabase, insertedLead || {
      email,
      calculator: String(body.calculator || '').slice(0, 64) || 'unknown',
      country: String(body.country || '').slice(0, 8) || null,
      lang: String(body.lang || '').slice(0, 8) || null,
      url: String(body.url || '').slice(0, 512) || null,
      unsubscribe_token: unsubscribeToken
    }, 0).catch(() => {});

    // Notify admins (throttled)
    notifyAdminsConversionEvent('lead', {
      calculator: String(body.calculator || '').slice(0, 64) || 'unknown',
      country: String(body.country || '').slice(0, 8) || null,
      lang: String(body.lang || '').slice(0, 8) || null,
      email: email,
      url: String(body.url || '').slice(0, 512) || null
    }).catch(() => {});

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('[lead-capture] Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to capture lead' });
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
  setAllowedOrigin(res, req);
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
  setAllowedOrigin(res, req);
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
  setAllowedOrigin(res, req);
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
      setAllowedOrigin(res, req);
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      if (req.method === 'OPTIONS') return res.status(200).end();
      return res.status(400).json({ error: 'Invalid or missing action' });
  }
}

// ── Main Router ────────────────────────────────────────────
module.exports = async function handler(req, res) {
  setCors(res, req);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    // Advisors
    if (pathname === '/api/advisors' || pathname === '/api/advisors/') {
      req.query = req.query || {}; req.query.action = req.query.action || 'list';
      if (await checkRateLimit('public', req, res)) return;
      return advisorsHandler(req, res);
    }
    if (pathname === '/api/advisor-dashboard' || pathname === '/api/advisor-dashboard/') {
      req.query = req.query || {}; req.query.action = 'dashboard';
      if (await checkRateLimit('auth', req, res)) return;
      return advisorsHandler(req, res);
    }
    if (pathname === '/api/advisor-update-review' || pathname === '/api/advisor-update-review/') {
      req.query = req.query || {}; req.query.action = 'update-review';
      if (await checkRateLimit('auth', req, res)) return;
      return advisorsHandler(req, res);
    }

    // Pro
    if (pathname === '/api/pro' || pathname === '/api/pro/') {
      if (await checkRateLimit('compute', req, res)) return;
      return proHandler(req, res);
    }

    // Letterhead email
    if (pathname === '/api/send-letter' || pathname === '/api/send-letter/') {
      req.query = req.query || {}; req.query.action = 'send-letter';
      if (await checkRateLimit('public', req, res)) return;
      return siteHandler(req, res);
    }

    // Site
    if (pathname === '/api/contact' || pathname === '/api/contact/') {
      req.query = req.query || {}; req.query.action = 'contact';
      if (await checkRateLimit('public', req, res)) return;
      return siteHandler(req, res);
    }
    if (pathname === '/api/usage' || pathname === '/api/usage/' || pathname === '/api/track' || pathname === '/api/track/') {
      req.query = req.query || {}; req.query.action = 'usage';
      if (await checkRateLimit('public', req, res)) return;
      return siteHandler(req, res);
    }
    if (pathname === '/api/site' || pathname === '/api/site/') {
      if (await checkRateLimit('public', req, res)) return;
      return siteHandler(req, res);
    }

    // Log usage
    if (pathname === '/api/log-usage' || pathname === '/api/log-usage/') {
      if (await checkRateLimit('public', req, res)) return;
      return logUsageHandler(req, res);
    }

    // Lead capture
    if (pathname === '/api/capture-lead' || pathname === '/api/capture-lead/') {
      if (await checkRateLimit('public', req, res)) return;
      return leadCaptureHandler(req, res);
    }

    // Calculator lead retargeting email journey (cron + admin trigger)
    if (pathname === '/api/calculator-email-journey' || pathname === '/api/calculator-email-journey/') {
      return calculatorEmailJourneyHandler(req, res);
    }

    // Calculator leads admin stats
    if (pathname === '/api/calculator-leads' || pathname === '/api/calculator-leads/') {
      return calculatorLeadsStatsHandler(req, res);
    }

    // Mark calculator lead as converted (called after signup/purchase)
    if (pathname === '/api/mark-lead-converted' || pathname === '/api/mark-lead-converted/' ||
        pathname === '/api/calculator-leads/convert' || pathname === '/api/calculator-leads/convert/') {
      return markLeadConvertedHandler(req, res);
    }

    // Calculator leads data retention (GDPR cleanup)
    if (pathname === '/api/calculator-leads/retention' || pathname === '/api/calculator-leads/retention/') {
      return calculatorLeadsRetentionHandler(req, res);
    }

    // One-click unsubscribe for calculator lead emails
    if (pathname === '/api/unsubscribe-lead' || pathname === '/api/unsubscribe-lead/') {
      if (await checkRateLimit('public', req, res)) return;
      return unsubscribeLeadHandler(req, res);
    }

    // Email click tracking for calculator lead sequences
    if (pathname === '/api/track-click' || pathname === '/api/track-click/') {
      return trackClickHandler(req, res);
    }

    // Email open tracking pixel for calculator lead sequences
    if (pathname === '/api/track-open' || pathname === '/api/track-open/') {
      return trackOpenHandler(req, res);
    }

    // Resend email webhook (bounce / complaint)
    if (pathname === '/api/email-webhook' || pathname === '/api/email-webhook/') {
      return emailWebhookHandler(req, res);
    }

    // NPS
    if (pathname === '/api/nps-check' || pathname === '/api/nps-check/') {
      req.query = req.query || {}; req.query.action = 'check';
      if (await checkRateLimit('public', req, res)) return;
      return npsHandler(req, res);
    }
    if (pathname === '/api/nps-submit' || pathname === '/api/nps-submit/') {
      req.query = req.query || {}; req.query.action = 'submit';
      if (await checkRateLimit('public', req, res)) return;
      return npsHandler(req, res);
    }
    if (pathname === '/api/send-nps' || pathname === '/api/send-nps/') {
      req.query = req.query || {}; req.query.action = 'send';
      if (await checkRateLimit('auth', req, res)) return;
      return npsHandler(req, res);
    }
    if (pathname === '/api/nps' || pathname === '/api/nps/') {
      const action = req.query?.action || req.body?.action;
      const category = action === 'send' ? 'auth' : 'public';
      if (await checkRateLimit(category, req, res)) return;
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
