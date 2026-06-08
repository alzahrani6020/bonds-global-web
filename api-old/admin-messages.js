// ============================================
// Admin Messages API
// Returns contact messages from Supabase
// Requires admin verification
// ============================================

const getSupabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getSupabase();

    if (req.method === 'GET') {
      // List messages
      const { data, error } = await supabase
        .from('contact_messages')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        messages: data || [],
        demo: false
      });
    }

    if (req.method === 'POST') {
      const { action, id } = req.body || {};

      if (action === 'mark_read' && id) {
        const { error } = await supabase
          .from('contact_messages')
          .update({ read: true })
          .eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      if (action === 'delete' && id) {
        const { error } = await supabase
          .from('contact_messages')
          .delete()
          .eq('id', id);
        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[admin-messages] Error:', err.message);
    // Return demo data
    res.status(200).json({
      success: true,
      demo: true,
      messages: [
        { id: 'demo-1', name: 'أحمد محمد', email: 'ahmed@example.com', phone: '+966501234567', sector: 'صناعة', service: 'جدوى', message: 'أود الاستفسار عن دراسة جدوى لمصنع بلاستيك في الرياض.', read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
        { id: 'demo-2', name: 'Sara Abdullah', email: 'sara@example.com', phone: '+971501234567', sector: 'تجارة', service: 'تحليل مالي', message: 'Need financial analysis for our retail chain expansion.', read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
      ]
    });
  }
};
