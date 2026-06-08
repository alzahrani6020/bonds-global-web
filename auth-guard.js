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

    // Check profile completion once per session
    if (user && profile) {
      checkProfileCompletion(user, profile);
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
  }

  function isProfileComplete(profile) {
    return profile && profile.city && profile.business_type && profile.bio && profile.needs && profile.employee_count;
  }

  async function checkProfileCompletion(user, profile) {
    if (sessionStorage.getItem('bonds_profile_checked')) return;
    sessionStorage.setItem('bonds_profile_checked', '1');
    if (isProfileComplete(profile)) return;

    // Show profile completion modal
    const modal = document.createElement('div');
    modal.id = 'profileCompleteModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(10,15,26,0.92);backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;z-index:99999;padding:1rem;';
    modal.innerHTML = `
      <div style="background:#0d1321;border:1px solid rgba(212,168,83,0.25);border-radius:20px;max-width:480px;width:100%;padding:2rem;box-shadow:0 20px 60px rgba(0,0,0,0.6);position:relative;overflow:hidden;font-family:Vazirmatn,system-ui,sans-serif;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#d4a853,#f0c96a,#d4a853);"></div>
        <div style="font-size:3rem;margin-bottom:0.75rem;text-align:center;">👋</div>
        <h2 style="text-align:center;color:#d4a853;font-size:1.3rem;font-weight:800;margin-bottom:0.5rem;">أكمل معلوماتك</h2>
        <p style="text-align:center;color:#94a3b8;font-size:0.9rem;margin-bottom:1.5rem;line-height:1.7;">ساعدنا في تقديم استشارة أفضل بإكمال بياناتك الأساسية.</p>
        <div style="display:flex;flex-direction:column;gap:1rem;">
          <div>
            <label style="display:block;color:#94a3b8;font-size:0.8rem;font-weight:700;margin-bottom:0.35rem;">المدينة</label>
            <input type="text" id="pcm_city" placeholder="مثال: الرياض" style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1px solid rgba(212,168,83,0.2);background:rgba(255,255,255,0.03);color:#e8ecf4;font-family:inherit;font-size:0.9rem;outline:none;">
          </div>
          <div>
            <label style="display:block;color:#94a3b8;font-size:0.8rem;font-weight:700;margin-bottom:0.35rem;">النشاط التجاري</label>
            <input type="text" id="pcm_business" placeholder="مثال: مطعم، مقهى، مصنع..." style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1px solid rgba(212,168,83,0.2);background:rgba(255,255,255,0.03);color:#e8ecf4;font-family:inherit;font-size:0.9rem;outline:none;">
          </div>
          <div>
            <label style="display:block;color:#94a3b8;font-size:0.8rem;font-weight:700;margin-bottom:0.35rem;">عدد الرواد / الموظفين</label>
            <input type="number" id="pcm_employees" placeholder="0" style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1px solid rgba(212,168,83,0.2);background:rgba(255,255,255,0.03);color:#e8ecf4;font-family:inherit;font-size:0.9rem;outline:none;">
          </div>
          <div>
            <label style="display:block;color:#94a3b8;font-size:0.8rem;font-weight:700;margin-bottom:0.35rem;">نبذة عن عملك</label>
            <textarea id="pcm_bio" placeholder="وصف مختصر للنشاط..." style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1px solid rgba(212,168,83,0.2);background:rgba(255,255,255,0.03);color:#e8ecf4;font-family:inherit;font-size:0.9rem;outline:none;min-height:70px;resize:vertical;"></textarea>
          </div>
          <div>
            <label style="display:block;color:#94a3b8;font-size:0.8rem;font-weight:700;margin-bottom:0.35rem;">احتياجاتك (لتقييم الاستشارة)</label>
            <textarea id="pcm_needs" placeholder="ما تحتاجه من الاستشارة..." style="width:100%;padding:0.75rem 1rem;border-radius:10px;border:1px solid rgba(212,168,83,0.2);background:rgba(255,255,255,0.03);color:#e8ecf4;font-family:inherit;font-size:0.9rem;outline:none;min-height:70px;resize:vertical;"></textarea>
          </div>
        </div>
        <div id="pcm_error" style="color:#ef4444;font-size:0.85rem;margin-top:0.75rem;text-align:center;display:none;"></div>
        <div style="display:flex;gap:0.75rem;justify-content:center;margin-top:1.5rem;">
          <button id="pcm_save" style="flex:1;padding:0.75rem;border-radius:10px;border:none;background:linear-gradient(135deg,#d4a853,#f0c96a);color:#0a0f1a;font-weight:800;font-size:0.95rem;cursor:pointer;transition:all 0.3s;">💾 حفظ المعلومات</button>
          <button id="pcm_skip" style="padding:0.75rem 1.25rem;border-radius:10px;border:1px solid rgba(212,168,83,0.2);background:transparent;color:#94a3b8;font-weight:700;font-size:0.9rem;cursor:pointer;">لاحقاً</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#pcm_skip').addEventListener('click', () => modal.remove());
    modal.querySelector('#pcm_save').addEventListener('click', async () => {
      const city = document.getElementById('pcm_city').value.trim();
      const business_type = document.getElementById('pcm_business').value.trim();
      const employee_count = parseInt(document.getElementById('pcm_employees').value) || 0;
      const bio = document.getElementById('pcm_bio').value.trim();
      const needs = document.getElementById('pcm_needs').value.trim();
      const errEl = document.getElementById('pcm_error');

      if (!city || !business_type || !bio || !needs) {
        errEl.textContent = 'يرجى ملء جميع الحقول المطلوبة';
        errEl.style.display = 'block';
        return;
      }

      const sb = window.BondsAuth.getSupabase();
      if (!sb) { errEl.textContent = 'خطأ في الاتصال'; errEl.style.display = 'block'; return; }

      const { error } = await sb.from('profiles').update({ city, business_type, employee_count, bio, needs, updated_at: new Date().toISOString() }).eq('id', user.id);
      if (error) {
        errEl.textContent = 'خطأ: ' + error.message;
        errEl.style.display = 'block';
        return;
      }
      modal.remove();
    });
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
