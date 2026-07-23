// Bonds Global — Exit-intent prompt for calculators
// Requires: showAuthModal (auth-modal.js) and window._calcCompleted = true after calculation
(function() {
  'use strict';

  var hasTriggered = false;

  function isRTL() {
    var html = document.documentElement;
    return html.getAttribute('dir') === 'rtl' || html.lang === 'ar';
  }

  function triggerSaveAction() {
    if (window.saveFeasibilityProject) return window.saveFeasibilityProject();
    if (window.saveCashFlowProject) return window.saveCashFlowProject();
    if (window.savePricingProject) return window.savePricingProject();
    if (window.saveLoanProject) return window.saveLoanProject();
    if (window.saveROIProject) return window.saveROIProject();
    if (window.saveFactoryCostProject) return window.saveFactoryCostProject();
    if (window.saveBondsProject) return window.saveBondsProject();
  }

  function showExitPrompt() {
    if (hasTriggered) return;
    hasTriggered = true;
    var rtl = isRTL();

    if (typeof showAuthModal === 'function') {
      showAuthModal('save', function() {
        if (window.BondsAuth && window.BondsAuth.getUser) {
          window.BondsAuth.getUser().then(function(userData) {
            if (userData && userData.user) {
              triggerSaveAction();
            } else {
              sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search);
              window.location.href = '/calculators/auth/index.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
            }
          });
        } else {
          sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search);
          window.location.href = '/calculators/auth/index.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
        }
      });
    } else {
      var msg = rtl
        ? 'لديك نتائج لم تحفظها. هل تريد تسجيل الدخول وحفظها؟'
        : 'You have unsaved results. Would you like to sign in and save them?';
      if (confirm(msg)) {
        sessionStorage.setItem('auth_redirect', window.location.pathname + window.location.search);
        window.location.href = '/calculators/auth/index.html?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
      }
    }
  }

  // Desktop: detect mouse leaving viewport toward top
  document.addEventListener('mouseout', function(e) {
    if (e.clientY < 12 && !hasTriggered && window._calcCompleted) {
      showExitPrompt();
    }
  });

  // Mobile / all devices: warn before leaving with unsaved results
  window.addEventListener('beforeunload', function(e) {
    if (window._calcCompleted && !hasTriggered) {
      var rtl = isRTL();
      var msg = rtl
        ? 'لديك نتائج لم تحفظها. هل أنت متأكد من المغادرة؟'
        : 'You have unsaved results. Are you sure you want to leave?';
      e.returnValue = msg;
      return msg;
    }
  });
})();
