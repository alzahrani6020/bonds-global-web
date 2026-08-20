// ===== Auth Guard + UI State Manager =====
// v6 — waits for BondsAuth, recovers on bfcache/visibility, re-checks on session-recovered
(function() {
  'use strict';

  const AUTH_PAGES = ['/calculators/auth/', '/en/calculators/auth/', '/auth', '/auth-v2'];

  function loadBondsAuthScript() {
    return new Promise(function (resolve) {
      if (document.querySelector('script[src*="bonds-auth-2026.js"]')) {
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = '/bonds-auth-2026.js?v=3.0.8';
      script.async = true;
      script.onload = function () { resolve(); };
      script.onerror = function () { resolve(); };
      document.head.appendChild(script);
    });
  }

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
      // Try to load the unified auth script dynamically if still missing
      if (!window.BondsAuth) {
        await loadBondsAuthScript();
        // Give it another moment to initialize
        await new Promise(resolve => setTimeout(resolve, 300));
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
      const myBondsUrl = isEn ? '/en/my-bonds/' : '/my-bonds/';
      const myBondsLabel = isEn ? 'My Bonds' : 'مساحتي';
      const faUrl = isEn ? '/en/' : '/';
      const faLabel = isEn ? 'Financial Advisory' : 'الاستشارات المالية';

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
            <span style="color:var(--text-secondary);font-size:0.7rem;"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 10l5 5 5-5z"/></svg></span>
          </button>
          <div class="dropdown-menu" style="min-width:180px;">
            <a href="${myBondsUrl}"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#A0041E" d="M9.344 14.702h-2c-.276 0-.5-.224-.5-.5v-7c0-.276.224-.5.5-.5h2c.276 0 .5.224.5.5v7c0 .276-.224.5-.5.5z"/><path fill="#FFE8B6" d="M5 16L18 3l13 13v17H5z"/><path fill="#FFCC4D" d="M18 16h1v16h-1z"/><path fill="#66757F" d="M31 17c-.256 0-.512-.098-.707-.293L18 4.414 5.707 16.707c-.391.391-1.023.391-1.414 0s-.391-1.023 0-1.414l13-13c.391-.391 1.023-.391 1.414 0l13 13c.391.391.391 1.023 0 1.414-.195.195-.451.293-.707.293z"/><path fill="#66757F" d="M18 17c-.256 0-.512-.098-.707-.293-.391-.391-.391-1.023 0-1.414l6.5-6.5c.391-.391 1.023-.391 1.414 0s.391 1.023 0 1.414l-6.5 6.5c-.195.195-.451.293-.707.293z"/><path fill="#C1694F" d="M10 26h4v6h-4z"/><path fill="#55ACEE" d="M10 17h4v4h-4zm12.5 0h4v4h-4zm0 9h4v4h-4z"/><path fill="#5C913B" d="M33.5 33.5c0 .828-.672 1.5-1.5 1.5H4c-.828 0-1.5-.672-1.5-1.5S3.172 32 4 32h28c.828 0 1.5.672 1.5 1.5z"/></svg> ${myBondsLabel}</a>
            <a href="${faUrl}"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#9A4E1C" d="M32 8h-6V4c0-2.209-1.791-4-4-4h-8c-2.209 0-4 1.791-4 4v4H4c-2.209 0-4 1.791-4 4v20c0 2.209 1.791 4 4 4h28c2.209 0 4-1.791 4-4V12c0-2.209-1.791-4-4-4zM12 6c0-1.104.896-2 2-2h8c1.104 0 2 .896 2 2v2H12V6z"/><path fill="#662113" d="M36 20c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-8c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v8z"/><path fill="#9A4E1C" d="M36 18c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4v-6c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v6z"/><path fill="#CCD6DD" d="M22 18c0 1.104-.896 2-2 2h-4c-1.104 0-2-.896-2-2s.896-2 2-2h4c1.104 0 2 .896 2 2"/></svg> ${faLabel}</a>
            <a href="${profileUrl}"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#269" d="M24 26.799v-2.566c2-1.348 4.08-3.779 4.703-6.896.186.103.206.17.413.17.991 0 1.709-1.287 1.709-2.873 0-1.562-.823-2.827-1.794-2.865.187-.674.293-1.577.293-2.735C29.324 5.168 26 .527 18.541.527c-6.629 0-10.777 4.641-10.777 8.507 0 1.123.069 2.043.188 2.755-.911.137-1.629 1.352-1.629 2.845 0 1.587.804 2.873 1.796 2.873.206 0 .025-.067.209-.17C8.952 20.453 11 22.885 13 24.232v2.414c-5 .645-12 3.437-12 6.23v1.061C1 35 2.076 35 3.137 35h29.725C33.924 35 35 35 35 33.938v-1.061c0-2.615-6-5.225-11-6.078z"/></svg> ${isEn ? 'Profile' : 'الملف الشخصي'}</a>
            <a href="${subUrl}"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#BDDDF4" d="M13 3H7l-7 9h10z"/><path fill="#5DADEC" d="M36 12l-7-9h-6l3 9z"/><path fill="#4289C1" d="M26 12h10L18 33z"/><path fill="#8CCAF7" d="M10 12H0l18 21zm3-9l-3 9h16l-3-9z"/><path fill="#5DADEC" d="M18 33l-8-21h16z"/></svg> ${isEn ? 'Subscription' : 'الاشتراك'}</a>
            <div style="border-top:1px solid var(--border);margin:0.4rem 0;"></div>
            <a href="#" onclick="window.BondsAuth.signOut().then(()=>location.reload());return false;" style="color:#ff8a8a;"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#BF6952" d="M29 34c0 1.105-.895 2-2 2H9c-1.105 0-2-.895-2-2V2c0-1.105.895-2 2-2h18c1.105 0 2 .895 2 2v32z"/><circle fill="#FFAC33" cx="11" cy="18" r="1.5"/><path fill="#AC5640" d="M25 3c-.552 0-1 .448-1 1v9H11c-.552 0-1 .448-1 1s.448 1 1 1h14c.552 0 1-.448 1-1V4c0-.552-.448-1-1-1zm0 25c.552 0 1 .448 1 1v3c0 .552-.448 1-1 1H11c-.552 0-1-.448-1-1s.448-1 1-1h13v-2c0-.552.448-1 1-1z"/><path fill="#854836" d="M11 33c-.552 0-1-.448-1-1v-3c0-.552.448-1 1-1h14c.552 0 1 .448 1 1s-.448 1-1 1H12v2c0 .552-.448 1-1 1z"/><path fill="#AC5640" d="M25 21c.552 0 1 .448 1 1v3c0 .552-.448 1-1 1H11c-.552 0-1-.448-1-1s.448-1 1-1h13v-2c0-.552.448-1 1-1z"/><path fill="#854836" d="M11 26c-.552 0-1-.448-1-1v-3c0-.552.448-1 1-1h14c.552 0 1 .448 1 1s-.448 1-1 1H12v2c0 .552-.448 1-1 1zm0-11c-.552 0-1-.448-1-1V4c0-.552.448-1 1-1h14c.552 0 1 .448 1 1s-.448 1-1 1H12v9c0 .552-.448 1-1 1z"/></svg> ${isEn ? 'Sign out' : 'تسجيل الخروج'}</a>
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
        <div style="font-size:3rem;margin-bottom:var(--space-4);"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#AAB8C2" d="M18 3C12.477 3 8 7.477 8 13v10h4V13c0-3.313 2.686-6 6-6s6 2.687 6 6v10h4V13c0-5.523-4.477-10-10-10z"/><path fill="#FFAC33" d="M31 32c0 2.209-1.791 4-4 4H9c-2.209 0-4-1.791-4-4V20c0-2.209 1.791-4 4-4h18c2.209 0 4 1.791 4 4v12z"/></svg></div>
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
