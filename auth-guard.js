// ===== Auth Guard + UI State Manager =====
// v5 — Fixed: uses getUser() for real server validation, removed buggy temporary session logic
(function() {
  'use strict';

  const AUTH_PAGES = ['/calculators/auth/', '/en/calculators/auth/', '/auth.html'];

  async function initAuth() {
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

      // Build avatar with unique IDs
      const avatarId = 'ha_' + Math.random().toString(36).slice(2, 8);
      const avatarHtml = avatarUrl
        ? `<span id="${avatarId}_wrap" style="position:relative;width:32px;height:32px;display:inline-block;"><img id="${avatarId}_img" src="" alt="${name}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid var(--gold);display:none;"><span id="${avatarId}_fb" style="position:absolute;top:0;left:0;width:32px;height:32px;border-radius:50%;background:var(--gold);color:#0c0c0c;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;border:2px solid var(--gold);">${initial}</span></span>`
        : `<div style="width:32px;height:32px;border-radius:50%;background:var(--gold);color:#0c0c0c;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.9rem;border:2px solid var(--gold);">${initial}</div>`;

      authContainer.innerHTML = `
        <div class="bonds-user-menu" style="position:relative;display:flex;align-items:center;gap:var(--space-3);cursor:pointer;" onclick="this.classList.toggle('open');event.stopPropagation();">
          ${avatarHtml}
          <span style="color:var(--gold);font-weight:700;font-size:0.9rem;white-space:nowrap;">${name}</span>
          <span style="color:var(--text-secondary);font-size:0.7rem;">▼</span>
          <div class="bonds-dropdown" style="position:absolute;top:calc(100% + 8px);left:0;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:8px 0;min-width:180px;display:none;box-shadow:0 8px 24px rgba(0,0,0,0.4);z-index:9999;">
            <a href="${profileUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;transition:background 0.2s;" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background='transparent'">👤 الملف الشخصي</a>
            <a href="${subUrl}" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:var(--text);text-decoration:none;font-size:0.85rem;transition:background 0.2s;" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background='transparent'">💎 الاشتراك</a>
            <div style="height:1px;background:var(--border);margin:6px 0;"></div>
            <a href="#" onclick="window.BondsAuth.signOut().then(()=>location.reload());return false;" style="display:flex;align-items:center;gap:10px;padding:10px 16px;color:#ff8a8a;text-decoration:none;font-size:0.85rem;transition:background 0.2s;" onmouseover="this.style.background='var(--bg-elevated)'" onmouseout="this.style.background='transparent'">🚪 تسجيل الخروج</a>
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

      // Click outside to close dropdown
      document.addEventListener('click', () => {
        const menu = authContainer.querySelector('.bonds-user-menu');
        if (menu) menu.classList.remove('open');
      });
      // Toggle dropdown display
      const menu = authContainer.querySelector('.bonds-user-menu');
      const dropdown = authContainer.querySelector('.bonds-dropdown');
      if (menu && dropdown) {
        menu.addEventListener('click', () => {
          const isOpen = menu.classList.contains('open');
          dropdown.style.display = isOpen ? 'block' : 'none';
        });
      }
    } else {
      const currentPath = window.location.pathname;
      const isEn = currentPath.startsWith('/en/');
      const authUrl = isEn ? '/en/calculators/auth/' : '/calculators/auth/';
      authContainer.innerHTML = `
        <a href="${authUrl}" class="btn btn-secondary" style="font-size:0.85rem;padding:0.5rem 1rem;"
           onclick="sessionStorage.setItem('auth_redirect', '${encodeURIComponent(currentPath)}')">
          تسجيل الدخول
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
