/**
 * Unified Usage API
 * GET  /api/usage?action=check|settings
 * POST /api/usage?action=log
 */

const getSupabase = require('../lib/api/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSupabase();
  const action = req.query?.action || req.body?.action;

  try {
    // ── GET /api/usage?action=settings ────────────────────────
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

    // ── GET /api/usage?action=check ───────────────────────────
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
        // Admins bypass limits
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

    // ── POST /api/usage?action=log ────────────────────────────
    if (req.method === 'POST' && action === 'log') {
      const { userId, calculator, country, inputs, results } = req.body || {};
      if (!calculator) return res.status(400).json({ error: 'calculator required' });
      await sb.from('usage_logs').insert([{
        user_id: userId || null, calculator, country: country || null,
        inputs: inputs || null, results: results || null,
      }]);
      return res.status(200).json({ success: true });
    }

    res.status(400).json({ error: 'Unknown action' });
  } catch (err) {
    console.error('Usage API error:', err);
    res.status(500).json({ error: err.message });
  }
};
