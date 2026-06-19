/**
 * Data Quality Center — Service
 */
(function (root) {
  'use strict';

  let _sb = null;
  const ADMIN_EMAIL = (root.__ENV && root.__ENV.ADMIN_EMAIL) ? root.__ENV.ADMIN_EMAIL : '';

  function getSb() {
    if (_sb) return _sb;
    const url = (root.__ENV && root.__ENV.SUPABASE_URL) || '';
    const key = (root.__ENV && root.__ENV.SUPABASE_ANON_KEY) || '';
    _sb = root.supabase.createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
    return _sb;
  }

  function withTimeout(promise, ms, label) {
    return Promise.race([promise, new Promise((_, reject) => setTimeout(() => reject(new Error(label + ' timeout')), ms))]);
  }

  async function getUserRole() {
    const sb = getSb();
    const { data: { user } } = await withTimeout(sb.auth.getUser(), 10000, 'getUser');
    if (!user) return null;
    if (ADMIN_EMAIL && user.email === ADMIN_EMAIL) return { role: 'manager', user };
    const { data: adminRole } = await withTimeout(sb.from('admin_roles').select('role').eq('user_id', user.id).maybeSingle(), 10000, 'admin_roles');
    if (['super_admin','admin'].includes(adminRole?.role)) return { role: 'manager', user };
    const { data: advRole } = await withTimeout(sb.from('advisory_roles').select('role').eq('user_id', user.id).maybeSingle(), 10000, 'advisory_roles');
    if (advRole?.role) return { role: advRole.role, user };
    return { role: null, user };
  }

  async function runChecks() {
    const sb = getSb();
    const { data, error } = await withTimeout(sb.rpc('dq_run_all_checks'), 30000, 'dq_run_all_checks');
    if (error) throw error;
    return data;
  }

  async function getSummary() {
    const sb = getSb();
    const { data, error } = await withTimeout(
      sb.from('data_quality_issues')
        .select('check_type, severity, status')
        .order('created_at', { ascending: false }),
      15000, 'getSummary'
    );
    if (error) throw error;
    return data || [];
  }

  async function getIssues(type, severity, status, page = 0, pageSize = 50) {
    const sb = getSb();
    let q = sb.from('data_quality_issues').select('*').order('created_at', { ascending: false });
    if (type) q = q.eq('check_type', type);
    if (severity) q = q.eq('severity', severity);
    if (status) q = q.eq('status', status);
    q = q.range(page * pageSize, (page + 1) * pageSize - 1);
    const { data, error } = await withTimeout(q, 15000, 'getIssues');
    if (error) throw error;
    return data || [];
  }

  async function resolveIssue(id) {
    const sb = getSb();
    const { data: { user } } = await sb.auth.getUser();
    const { error } = await withTimeout(
      sb.from('data_quality_issues').update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user.id }).eq('id', id),
      15000, 'resolveIssue'
    );
    if (error) throw error;
  }

  root.DataQualityService = { getSb, getUserRole, runChecks, getSummary, getIssues, resolveIssue };
})(window);
