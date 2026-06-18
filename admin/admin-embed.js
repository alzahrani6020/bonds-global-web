/**
 * Admin Embed Mode — hides module sidebars when loaded inside unified admin iframe.
 * Usage: append ?embed=1 to any admin/module URL.
 */
(function () {
  'use strict';

  if (!location.search.includes('embed=1')) return;

  function apply() {
    const style = document.createElement('style');
    style.textContent = `
      html.admin-embed,
      html.admin-embed body {
        overflow: hidden;
      }
      .admin-embed .sidebar,
      .admin-embed #sidebar,
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
