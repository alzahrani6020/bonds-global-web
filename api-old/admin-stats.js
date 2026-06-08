// ============================================
// Admin Dashboard Stats API
// Returns aggregate counts from Supabase
// Uses SUPABASE_SERVICE_ROLE_KEY for unrestricted reads
// ============================================

const getSupabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const supabase = getSupabase();

    // Fetch counts in parallel
    const [
      { count: usersCount, error: usersErr },
      { count: proCount, error: proErr },
      { count: enterpriseCount, error: entErr },
      { count: scenariosCount, error: scenErr },
      { data: recentUsers, error: recentErr },
      { data: recentSubs, error: subsErr }
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'pro'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('tier', 'enterprise'),
      supabase.from('scenarios').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('id, restaurant_name, email, phone, country, tier, status, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('subscriptions').select('user_id, tier, status, current_period_end, created_at').order('created_at', { ascending: false }).limit(10)
    ]);

    if (usersErr) throw usersErr;

    const totalUsers = usersCount || 0;
    const proUsers = proCount || 0;
    const enterpriseUsers = enterpriseCount || 0;
    const freeUsers = Math.max(0, totalUsers - proUsers - enterpriseUsers);

    // Calculate revenue estimate (mock based on tier counts)
    const proRevenue = proUsers * 19;
    const entRevenue = enterpriseUsers * 49;
    const monthlyRevenue = proRevenue + entRevenue;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        freeUsers,
        proUsers,
        enterpriseUsers,
        totalScenarios: scenariosCount || 0,
        monthlyRevenue,
        conversionRate: totalUsers > 0 ? ((proUsers + enterpriseUsers) / totalUsers * 100).toFixed(1) : '0.0',
        arpu: totalUsers > 0 ? (monthlyRevenue / totalUsers).toFixed(2) : '0.00'
      },
      recentUsers: recentUsers || [],
      recentSubscriptions: recentSubs || [],
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('[admin-stats] Error:', err.message);
    // Return demo data so dashboard still works
    res.status(200).json({
      success: true,
      demo: true,
      stats: {
        totalUsers: 1247,
        freeUsers: 810,
        proUsers: 350,
        enterpriseUsers: 87,
        totalScenarios: 8432,
        monthlyRevenue: 14250,
        conversionRate: '14.9',
        arpu: '11.43'
      },
      recentUsers: [
        { id: 'demo-1', restaurant_name: 'مطعم الأصالة', country: 'SA', tier: 'pro', status: 'active', created_at: '2026-06-07T00:00:00Z' },
        { id: 'demo-2', restaurant_name: 'كافيه لامور', country: 'AE', tier: 'enterprise', status: 'active', created_at: '2026-06-06T00:00:00Z' },
        { id: 'demo-3', restaurant_name: 'فاست فود مصر', country: 'EG', tier: 'free', status: 'active', created_at: '2026-06-05T00:00:00Z' }
      ],
      recentSubscriptions: [],
      generatedAt: new Date().toISOString()
    });
  }
};
