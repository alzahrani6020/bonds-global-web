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
        overflow: auto;
        height: auto;
        min-height: 100%;
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

  let lastReportedHeight = 0;
  let heightTimeout = null;
  function reportHeight() {
    if (heightTimeout) return;
    heightTimeout = setTimeout(() => {
      heightTimeout = null;
      const height = Math.max(
        document.body?.scrollHeight || 0,
        document.documentElement?.scrollHeight || 0,
        document.body?.offsetHeight || 0,
        document.documentElement?.offsetHeight || 0
      );
      // Only send when height changes meaningfully to avoid loops
      if (height > 0 && Math.abs(height - lastReportedHeight) > 5) {
        lastReportedHeight = height;
        window.parent.postMessage({ type: 'iframe-height', height }, location.origin);
      }
    }, 100);
  }

  if (isEmbed) {
    applyEmbedStyles();
    // Report content height so the parent dashboard can resize the iframe
    // and provide a unified scrollbar instead of an inner iframe scrollbar.
    window.addEventListener('load', reportHeight);
    window.addEventListener('resize', reportHeight);
    // Observe DOM changes that may affect height (e.g. messages loaded)
    if (typeof MutationObserver !== 'undefined' && document.body) {
      const observer = new MutationObserver(() => {
        window.requestAnimationFrame(reportHeight);
      });
      observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    }
    // Fallback periodic reports in case dynamic content loads slowly
    setInterval(reportHeight, 2000);
  }

  // Token bridge: only trust the same-origin parent dashboard in embed mode.
  window.addEventListener('message', function (e) {
    if (!isEmbed) return;
    if (e.origin !== location.origin) return;
    if (e.source !== window.parent) return;
    if (!e.data || e.data.type !== 'admin-token') return;

    const token = typeof e.data.token === 'string'
      ? e.data.token.trim()
      : '';

    if (!token || token.length > 8192) return;

    window.__ADMIN_TOKEN = token;
    window.dispatchEvent(new Event('admin-token-ready'));
  });

  // Track admin module views so the journey reflects actual admin sections/pages.
  if (!window.__BONDS_TRACKING__) {
    const trackScript = document.createElement('script');
    trackScript.src = '/lib/tracking.js?v=2';
    trackScript.async = true;
    document.head.appendChild(trackScript);
  }
})();
