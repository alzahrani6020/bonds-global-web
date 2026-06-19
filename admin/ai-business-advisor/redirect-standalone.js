(function () {
  'use strict';
  // Redirect direct access to the unified admin dashboard; keep embed access from dashboard iframe.
  if (!location.search.includes('embed=1')) {
    location.replace('/admin/dashboard.html');
  }
})();
