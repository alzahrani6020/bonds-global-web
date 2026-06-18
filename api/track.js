const { createClient } = require('@supabase/supabase-js');
const { withRateLimit } = require('../lib/api/rate-limit');
const URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!URL || !KEY) return res.status(500).json({ error: 'Missing Supabase config' });

  let body = {};
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const sb = createClient(URL, KEY);
  const { page, section, url, referrer, lang, screen, duration_seconds, event } = body;

  // If session_end event with duration, store in page_sessions
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

  // Otherwise store as page view
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

module.exports = withRateLimit('public', handler);
