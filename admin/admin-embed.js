/**
 * Admin Embed Mode — hides module sidebars when loaded inside unified admin iframe.
 * Usage: append ?embed=1 to any admin/module URL.
 */
(function () {
  'use strict';

  const isEmbed = location.search.includes('embed=1');

  function applyEmbedStyles() {
    const style = document.createElement('style');
    style.textContent = `
      html.admin-embed,
      html.admin-embed body {
        overflow: hidden;
      }
      .admin-embed .sidebar,
      .admin-embed #sidebar,
      .admin-embed .admin-sidebar,
      .admin-embed .fa-sidebar,
      .admin-embed .fa-menu-toggle,
      .admin-embed #fa-menu-toggle,
      .admin-embed .fa-sidebar-overlay,
      .admin-embed .mobile-toggle,
      .admin-embed [href*="dashboard.html"] {
        display: none !important;
      }
      .admin-embed .admin-layout,
      .admin-embed .fa-layout {
        display: block !important;
      }
      .admin-embed .main-content,
      .admin-embed .admin-main,
      .admin-embed .fa-main {
        margin-right: 0 !important;
        margin-left: 0 !important;
        width: 100% !important;
        max-width: 100% !important;
        padding: 1rem !important;
      }
    `;
    document.head.appendChild(style);
    document.documentElement.classList.add('admin-embed');
  }

  if (isEmbed) {
    applyEmbedStyles();
  }

  // Token bridge: receive admin token/session from parent unified dashboard
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return;
    if (e.data && e.data.type === 'admin-token') {
      window.__ADMIN_TOKEN = e.data.token || '';
      window.dispatchEvent(new Event('admin-token-ready'));
    }
    if (e.data && e.data.type === 'admin-session') {
      window.__ADMIN_SESSION = e.data.session || null;
      window.dispatchEvent(new Event('admin-session-ready'));
    }
  });

  // Track admin module views so the journey reflects actual admin sections/pages.
  if (!window.__BONDS_TRACKING__) {
    const trackScript = document.createElement('script');
    trackScript.src = '/lib/tracking.js?v=2';
    trackScript.async = true;
    document.head.appendChild(trackScript);
  }
})();
