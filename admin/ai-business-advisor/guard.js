(function () {
  'use strict';

  function init() {
    if (typeof BondsAuth !== 'undefined' && BondsAuth.initAdminGuard) {
      BondsAuth.initAdminGuard();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
