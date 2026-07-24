// ===== Auth Guard + UI State Manager =====
// v6 — waits for BondsAuth, recovers on bfcache/visibility, re-checks on session-recovered
(function() {
  'use strict';

  const AUTH_PAGES = ['/calculators/auth/', '/en/calculators/auth/', '/auth', '/auth-v2'];

  async function initAuth() {
    // Wait for the unified auth system (it may load after this script)
    if (!window.BondsAuth) {
      if (typeof window !== 'undefined') {
        let attempts = 0;
        const maxAttempts = 30;
        await new Promise(resolve => {
          const interval = setInterval(() => {
            attempts++;
            if (window.BondsAuth || attempts >= maxAttempts) {
              clearInterval(interval);
              resolve();
            }
          }, 100);
        });
      }
      if (!window.BondsAuth) {
        console.warn('[AuthGuard] BondsAuth not loaded after wait');
        return;
      }
    }
    // Validate session with SERVER (not just localStorage)
    const { data: userData, error: userError } = await window.BondsAuth.getUser();
    const user = userData?.user;

    if (userError) {
      console.warn('[AuthGuard] Session invalid:', userError.message);
    }

    // Fetch profile for avatar + name
    let profile = null;
    if (user) {
      try {
        const { data: p } = await window.BondsAuth.getProfile(user.id);
        profile = p;
      } catch (e) { /* ignore */ }
    }

    updateUI(user, profile);

    // Check profile completion once per session
    if (user) {
      const pr = profile || {};
      checkProfileCompletion(user, pr);
    }

    // Listen for auth state changes
    const sb = window.BondsAuth.getSupabase();
    if (sb) {
      sb.auth.onAuthStateChange(async (event, session) => {
        const u = session?.user || null;
        let pr = null;
        if (u) {
          try {
            const { data: p } = await window.BondsAuth.getProfile(u.id);
            pr = p;
          } catch (e) { /* ignore */ }
        }
        updateUI(u, pr);
      });
    }

    // Re-check when BondsAuth recovers a session after bfcache/visibility/focus
    window.addEventListener('bonds:session-recovered', async (e) => {
      const u = e.detail?.session?.user || null;
      let pr = null;
      if (u) {
        try {
          const { data: p } = await window.BondsAuth.getProfile(u.id);
          pr = p;
        } catch (err) { /* ignore */ }
      }
      updateUI(u, pr);
    });
  }

  function isProfileComplete(profile) {
    return profile && profile.city && profile.business_type && profile.bio && profile.needs && profile.employee_count !== null && profile.employee_count !== undefined && profile.branch_count !== null && profile.branch_count !== undefined;
  }

  async function checkProfileCompletion(user, profile) {
    if (isProfileComplete(profile)) return;

    // Allow the user to skip onboarding for 24 hours
    const skipped = sessionStorage.getItem('bonds_onboarding_skipped');
    if (skipped && (Date.now() - parseInt(skipped, 10)) < 24 * 60 * 60 * 1000) return;

    // Redirect to onboarding page to force profile completion
    const current = window.location.pathname;
    if (current.includes('/calculators/auth/')) return; // Don't redirect on auth pages
    sessionStorage.setItem('auth_redirect', window.location.href);
    window.location.href = '/calculators/auth/onboarding.html';
  }

  function updateUI(user, profile) {
    const authContainer = document.getElementById('authContainer');
    if (!authContainer) return;

    if (user) {
      const name = profile?.restaurant_name || user.user_metadata?.restaurant_name || localStorage.getItem('bonds_restaurant_name') || user.email?.split('@')[0] || 'مستخدم';
      const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url || user.user_metadata?.picture || localStorage.getItem('bonds_avatar_url');
      const initial = name.charAt(0).toUpperCase();
      const isEn = window.location.pathname.startsWith('/en/');
      const profileUrl = isEn ? '/en/calculators/auth/profile.html' : '/calculators/auth/profile.html';
      const subUrl = isEn ? '/en/calculators/auth/subscription.html' : '/calculators/auth/subscription.html';
      const myBondsUrl = isEn ? '/en/fixed-income-intelligence' : '/fixed-income-intelligence';
      const myBondsLabel = isEn ? 'Financial Advisory' : 'الاستشارات المالية';

      // Build avatar with unique IDs
      const avatarId = 'ha_' + Math.random().toString(36).slice(2, 8);
      const avatarHtml = avatarUrl
        ? `<span id="${avatarId}_wrap" style="position:relative;width:32px;height:32px;display:inline-block;"><img id="${avatarId}_img" src="" alt="${name}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);display:none;"><span id="${avatarId}_fb" style="position:absolute;top:0;left:0;width:32px;height:32px;border-radius:50%;background:var(--gold);color:#0c0c0c;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;border:2px solid var(--gold);">${initial}</span></span>`
        : `<div style="width:32px;height:32px;border-radius:50%;background:var(--gold);color:#0c0c0c;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;border:2px solid var(--gold);">${initial}</div>`;

      authContainer.innerHTML = `
        <div class="dropdown bonds-user-dropdown" style="position:relative;display:flex;align-items:center;gap:var(--space-3);">
          <button type="button" class="dropdown-toggle" style="display:flex;align-items:center;gap:var(--space-3);cursor:pointer;background:transparent;border:none;padding:0;margin:0;font:inherit;color:inherit;" aria-expanded="false" aria-haspopup="true">
            ${avatarHtml}
            <span style="color:var(--gold);font-weight:700;font-size:0.9rem;white-space:nowrap;">${name}</span>
            <span style="color:var(--text-secondary);font-size:0.7rem;">▼</span>
          </button>
          <div class="dropdown-menu" style="min-width:180px;">
            <a href="${myBondsUrl}">🏠 ${myBondsLabel}</a>
            <a href="${profileUrl}">👤 ${isEn ? 'Profile' : 'الملف الشخصي'}</a>
            <a href="${subUrl}">💎 ${isEn ? 'Subscription' : 'الاشتراك'}</a>
            <div style="border-top:1px solid var(--border);margin:0.4rem 0;"></div>
            <a href="#" onclick="window.BondsAuth.signOut().then(()=>location.reload());return false;" style="color:#ff8a8a;">🚪 ${isEn ? 'Sign out' : 'تسجيل الخروج'}</a>
          </div>
        </div>
      `;

      // Load avatar image
      if (avatarUrl) {
        const isSupabase = avatarUrl.includes('supabase.co/storage');
        setTimeout(() => {
          const img = document.getElementById(avatarId + '_img');
          const fb = document.getElementById(avatarId + '_fb');
          if (!img || !fb) return;

          if (isSupabase) {
            const pathMatch = avatarUrl.match(/\/avatars\/(.+)$/);
            if (pathMatch && window.BondsAuth) {
              window.BondsAuth.getSupabase().storage.from('avatars').download(pathMatch[1]).then(({ data, error }) => {
                if (!error && data && document.getElementById(avatarId + '_img')) {
                  const blobUrl = URL.createObjectURL(data);
                  img.src = blobUrl;
                  img.style.display = 'inline';
                  fb.style.display = 'none';
                }
              }).catch(() => {});
            }
          } else {
            img.src = avatarUrl;
            img.onload = () => { img.style.display = 'inline'; fb.style.display = 'none'; };
            img.onerror = () => { img.style.display = 'none'; fb.style.display = 'flex'; };
          }
        }, 0);
      }

      // Wire up user dropdown toggle (shared CSS handles hover on desktop)
      const userDropdown = authContainer.querySelector('.bonds-user-dropdown');
      const userToggle = authContainer.querySelector('.bonds-user-dropdown .dropdown-toggle');
      if (userDropdown && userToggle) {
        userToggle.addEventListener('click', function (e) {
          e.stopPropagation();
          if (window.innerWidth > 900 && !window.matchMedia('(pointer: coarse)').matches) return;
          const wasOpen = userDropdown.classList.contains('is-open');
          document.querySelectorAll('.dropdown.is-open').forEach(d => {
            d.classList.remove('is-open');
            const t = d.querySelector('.dropdown-toggle');
            if (t) t.setAttribute('aria-expanded', 'false');
          });
          userDropdown.classList.toggle('is-open', !wasOpen);
          userToggle.setAttribute('aria-expanded', String(!wasOpen));
        });
      }
    } else {
      const currentPath = window.location.pathname;
      const isEn = currentPath.startsWith('/en/');
      const authUrl = isEn ? '/en/calculators/auth/' : '/calculators/auth/';
      const accountLabel = isEn ? 'Sign in' : 'تسجيل الدخول';
      authContainer.innerHTML = `
        <a href="${authUrl}" class="header-account" aria-label="${accountLabel}"
           onclick="sessionStorage.setItem('auth_redirect', '${encodeURIComponent(currentPath)}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>
        </a>
      `;
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

  // Gate check for features — uses getUser() for real validation
  window.requireAuth = async function(redirectUrl) {
    const { data: userData } = await window.BondsAuth.getUser();
    if (!userData?.user) {
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
