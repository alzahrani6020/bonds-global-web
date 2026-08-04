/**
 * Update sidebar user info from the current admin session.
 * Finds .sidebar-user inside .sidebar and sets name/avatar from BondsAuth.
 */
(function () {
  'use strict';

  function setText(sel, text) {
    const el = document.querySelector(sel);
    if (el) el.textContent = text;
  }

  async function update() {
    try {
      let user = null;
      if (window.BondsAuth && window.BondsAuth.getUser) {
        user = await window.BondsAuth.getUser();
      } else if (window.BondsAuth && window.BondsAuth.getSession) {
        const session = await window.BondsAuth.getSession();
        user = session?.user || session?.session?.user || null;
      }
      if (!user && window.supabaseClient && window.supabaseClient.auth) {
        const { data } = await window.supabaseClient.auth.getUser();
        user = data?.user;
      }
      if (!user) return;

      const name = user.user_metadata?.full_name || user.email || 'مدير النظام';
      const role = window.__ADMIN_ROLE === 'super_admin' ? 'Super Admin' : 'Admin';
      const avatar = name.charAt(0).toUpperCase();

      const sidebar = document.querySelector('.sidebar');
      if (!sidebar) return;
      const userName = sidebar.querySelector('.user-name');
      const userRole = sidebar.querySelector('.user-role');
      const userAvatar = sidebar.querySelector('.user-avatar');
      if (userName) userName.textContent = name.split('@')[0] || name;
      if (userRole) userRole.textContent = role;
      if (userAvatar) userAvatar.textContent = avatar;
    } catch (e) {
      console.warn('[update-sidebar-user] failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    setTimeout(update, 0);
  }
})();
