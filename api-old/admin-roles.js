// ============================================
// Admin Roles API
// CRUD for admin role assignments
// Requires super_admin for writes
// ============================================

const getSupabase = require('./lib/supabase');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getSupabase();

    // Verify caller is admin
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();
    let callerId = null;

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) callerId = user.id;
    }

    // For GET, allow any admin (checked by frontend auth guard)
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('admin_roles')
        .select('id, user_id, role, created_at, profiles:profiles!inner(restaurant_name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return res.status(200).json({ success: true, roles: data || [] });
    }

    if (req.method === 'POST') {
      const { action } = req.body || {};

      // Verify caller is super_admin for writes
      if (action === 'add' || action === 'remove') {
        if (!callerId) {
          return res.status(401).json({ success: false, error: 'Authentication required' });
        }
        const { data: callerRole } = await supabase
          .from('admin_roles')
          .select('role')
          .eq('user_id', callerId)
          .single();

        if (callerRole?.role !== 'super_admin') {
          return res.status(403).json({ success: false, error: 'Super Admin required' });
        }
      }

      if (action === 'add') {
        const { email, role } = req.body;
        if (!email || !role) {
          return res.status(400).json({ success: false, error: 'Email and role required' });
        }

        // Find user by email
        const { data: users, error: userErr } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', email)
          .limit(1);

        if (userErr || !users || users.length === 0) {
          return res.status(404).json({ success: false, error: 'User not found' });
        }

        const userId = users[0].id;

        const { error } = await supabase
          .from('admin_roles')
          .insert([{ user_id: userId, role, granted_by: callerId }]);

        if (error) {
          if (error.message.includes('duplicate')) {
            return res.status(409).json({ success: false, error: 'User already has a role' });
          }
          throw error;
        }

        return res.status(200).json({ success: true });
      }

      if (action === 'remove') {
        const { id } = req.body;
        if (!id) return res.status(400).json({ success: false, error: 'ID required' });

        const { error } = await supabase
          .from('admin_roles')
          .delete()
          .eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ success: false, error: 'Invalid action' });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[admin-roles] Error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
