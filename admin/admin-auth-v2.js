// ============================================
// Admin Auth Guard — Client-side only (no API call)
// ============================================
(function() {
  const AUTH_CONTAINER_ID = 'admin-auth-guard';
  const ROLE_PERMISSIONS = {
    super_admin: ['users', 'subscriptions', 'messages', 'roles', 'analytics', 'users_write', 'export'],
    admin: ['users', 'subscriptions', 'messages', 'analytics', 'users_write', 'export'],
    support: ['users', 'messages', 'analytics'],
    viewer: ['analytics']
  };

  function createOverlay() {
    if (document.getElementById(AUTH_CONTAINER_ID)) return;
    const div = document.createElement('div');
    div.id = AUTH_CONTAINER_ID;
    div.innerHTML = `
      <div id="admin-auth-overlay" style="position:fixed;inset:0;background:#0a0f1a;z-index:9999;display:flex;align-items:center;justify-content:center;font-family:Vazirmatn,Inter,system-ui,sans-serif;">
        <div style="text-align:center;max-width:400px;padding:2rem;">
          <div style="font-size:3rem;margin-bottom:1rem;">🔒</div>
          <h2 style="color:#e8ecf4;margin-bottom:0.5rem;">التحقق من الصلاحيات...</h2>
          <p id="admin-auth-status" style="color:#94a3b8;">جارِ التحقق من صلاحية الوصول الإداري</p>
          <button id="admin-auth-login" style="display:none;margin-top:1.5rem;padding:0.75rem 2rem;border-radius:10px;border:none;background:linear-gradient(135deg,#d4a853,#f0c96a);color:#0a0f1a;font-weight:800;font-size:0.9rem;cursor:pointer;" onclick="
            const isEn = document.documentElement.lang === 'en';
            const loginPath = isEn ? '../../en/calculators/auth/index.html' : '../calculators/auth/index.html';
            window.location.href = loginPath + '?redirect=' + encodeURIComponent(location.href)
          ">تسجيل الدخول</button>
        </div>
      </div>
    `;
    document.body.appendChild(div);
  }

  function setStatus(text, showLogin) {
    const el = document.getElementById('admin-auth-status');
    if (el) el.textContent = text;
    const btn = document.getElementById('admin-auth-login');
    if (btn) btn.style.display = showLogin ? 'inline-block' : 'none';
  }

  function removeOverlay() {
    const el = document.getElementById(AUTH_CONTAINER_ID);
    if (el) el.remove();
  }

  async function verifyAdmin() {
    createOverlay();

    // Wait for Supabase library
    let attempts = 0;
    while (typeof supabase === 'undefined' && attempts < 50) {
      await new Promise(r => setTimeout(r, 100));
      attempts++;
    }
    if (typeof supabase === 'undefined') {
      setStatus('فشل تحميل مكتبة المصادقة', true);
      return;
    }

    // Wait for window.__ENV
    let envAttempts = 0;
    while ((!window.__ENV?.SUPABASE_URL || !window.__ENV?.SUPABASE_ANON_KEY) && envAttempts < 30) {
      await new Promise(r => setTimeout(r, 100));
      envAttempts++;
    }
    const env = window.__ENV || {};
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      setStatus('لم يتم إعداد البيئة (api/env)', true);
      return;
    }

    // Create client with ANON key (no API call needed)
    const client = supabase.createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

    // Get session
    const { data: { session } } = await client.auth.getSession();
    if (!session) {
      setStatus('يجب تسجيل الدخول للوصول إلى لوحة التحكم', true);
      return;
    }

    setStatus('جارِ التحقق من صلاحية المسؤول...');

    // Direct query to admin_roles (RLS is off by default, token is validated server-side)
    try {
      const { data: roleRow, error: roleError } = await client
        .from('admin_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .single();

      let role;
      if (roleError || !roleRow) {
        // Fallback: owner email gets super_admin if no role record exists
        if (session.user.email === 'iiffund.dev@gmail.com') {
          role = 'super_admin';
        } else {
          setStatus('ليس لديك صلاحية الوصول إلى لوحة التحكم الإدارية', true);
          return;
        }
      } else {
        role = roleRow.role;
      }
      const perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
      window.__ADMIN_ROLE = role;
      window.__ADMIN_PERMS = perms;
      window.__ADMIN_TOKEN = session.access_token || '';
      window.__ADMIN_USER = session.user;
      function hasPerm(p) { return window.__ADMIN_PERMS.includes(p); }

      // Apply sidebar permissions
      document.querySelectorAll('.sidebar-nav .sidebar-link').forEach(link => {
        const href = link.getAttribute('href') || '';
        let required = null;
        if (href.includes('users')) required = 'users';
        if (href.includes('subscriptions')) required = 'subscriptions';
        if (href.includes('messages')) required = 'messages';
        if (href.includes('roles')) required = 'roles';
        if (href.includes('analytics')) required = 'analytics';
        if (required && !hasPerm(required)) link.style.display = 'none';
      });

      if (!hasPerm('users_write')) {
        document.querySelectorAll('.btn-danger, [onclick*="delete"]').forEach(b => b.style.display = 'none');
      }
      if (!hasPerm('export')) {
        document.querySelectorAll('[onclick*="exportCSV"]').forEach(b => b.style.display = 'none');
      }

      removeOverlay();
      window.dispatchEvent(new Event('admin-auth-ready'));

    } catch (e) {
      console.error('[AdminAuth]', e);
      setStatus('خطأ في التحقق من الصلاحيات', true);
    }
  }

  window.retryAdminAuth = verifyAdmin;

  // Safety: always remove overlay after 3s so cached old versions don't block forever
  setTimeout(removeOverlay, 3000);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', verifyAdmin);
  } else {
    verifyAdmin();
  }
})();
