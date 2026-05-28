// ===== Auth Guard + UI State Manager =====
(function() {
  'use strict';

  const AUTH_PAGES = ['/calculators/auth/', '/en/calculators/auth/', '/auth.html'];
  const PUBLIC_PAGES = ['/', '/index.html', '/about.html', '/faq.html', '/contact.html', '/pricing.html'];

  async function initAuth() {
    const { data: sessionData } = await window.BondsAuth.getSession();
    const session = sessionData?.session;
    const user = session?.user;

    updateUI(user);

    // Listen for auth state changes
    const sb = window.BondsAuth.getSupabase();
    if (sb) {
      sb.auth.onAuthStateChange((event, session) => {
        updateUI(session?.user || null);
      });
    }
  }

  function updateUI(user) {
    // Update header auth buttons
    const authContainer = document.getElementById('authContainer');
    if (authContainer) {
      if (user) {
        const name = user.user_metadata?.restaurant_name || user.email?.split('@')[0] || 'مستخدم';
        authContainer.innerHTML = `
          <div style="display:flex;align-items:center;gap:var(--space-3);">
            <a href="/calculators/auth/account.html" style="color:var(--gold);font-weight:700;text-decoration:none;font-size:0.9rem;"
              👤 ${name}
            </a>
            <button onclick="window.BondsAuth.signOut().then(()=>location.reload())" 
              style="background:transparent;border:1px solid var(--border);color:var(--text);padding:0.4rem 0.8rem;border-radius:6px;cursor:pointer;font-size:0.8rem;">
              خروج
            </button>
          </div>
        `;
      } else {
        authContainer.innerHTML = `
          <a href="/calculators/auth/" class="btn btn-secondary" style="font-size:0.85rem;padding:0.5rem 1rem;">
            تسجيل الدخول
          </a>
        `;
      }
    }

    // Show/hide premium badges
    const premiumBadges = document.querySelectorAll('[data-premium]');
    premiumBadges.forEach(el => {
      if (!user) {
        el.style.opacity = '0.5';
        el.style.pointerEvents = 'none';
      }
    });
  }

  // Gate check for features
  window.requireAuth = async function(redirectUrl) {
    const { data: sessionData } = await window.BondsAuth.getSession();
    if (!sessionData?.session) {
      window.location.href = '/calculators/auth/?redirect=' + encodeURIComponent(redirectUrl || window.location.pathname);
      return false;
    }
    return true;
  };

  window.requireTier = async function(feature, fallback) {
    const result = await window.BondsAuth.checkFeatureAccess(feature);
    if (!result.allowed) {
      if (fallback) fallback(result);
      else showUpgradeModal(result);
      return false;
    }
    return true;
  };

  function showUpgradeModal(result) {
    const modal = document.createElement('div');
    modal.id = 'upgradeModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);display:flex;align-items:center;justify-content:center;z-index:9999;';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-lg);padding:var(--space-8);max-width:420px;width:90%;text-align:center;">
        <div style="font-size:3rem;margin-bottom:var(--space-4);">🔒</div>
        <h3 style="margin-bottom:var(--space-3);">الميزة متوفرة في الباقة المدفوعة</h3>
        <p style="color:var(--text-secondary);margin-bottom:var(--space-6);">
          باقتك الحالية: <strong>${result.tier === 'none' ? 'زائر' : result.tier}</strong><br/>
          ${result.reason === 'not_logged_in' ? 'سجّل دخولك أولاً للوصول للمزيد.' : 'رقيّ باقتك لفتح هذه الميزة.'}
        </p>
        <div style="display:flex;gap:var(--space-3);justify-content:center;">
          <a href="/pricing.html" class="btn btn-primary">عرض الباقات</a>
          <button onclick="document.getElementById('upgradeModal').remove()" class="btn btn-secondary">لاحقاً</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }
})();
