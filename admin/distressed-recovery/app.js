(function () {
  'use strict';

  let currentView = 'dashboard';
  let currentAssetId = null;
  let currentAsset = null;
  let currentPlans = [];
  let currentInvestors = [];

  let content = null;
  let navLinks = [];

  const currency = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 });

  function formatMoney(n) {
    if (n === undefined || n === null) return '—';
    return currency.format(Number(n)) + ' ر.س';
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('ar-SA');
  }

  function statusBadge(status) {
    const map = {
      identified: 'fa-badge-gray',
      valuation: 'fa-badge-blue',
      planning: 'fa-badge-orange',
      active_rescue: 'fa-badge-gold',
      restructuring: 'fa-badge-gold',
      recovered: 'fa-badge-green',
      liquidated: 'fa-badge-red',
      write_off: 'fa-badge-red'
    };
    return `<span class="fa-badge ${map[status] || 'fa-badge-gray'}">${RecoveryService.ASSET_STATUSES[status] || status}</span>`;
  }

  function priorityBadge(p) {
    const map = { low: 'fa-badge-green', medium: 'fa-badge-blue', high: 'fa-badge-orange', critical: 'fa-badge-red' };
    return `<span class="fa-badge ${map[p] || 'fa-badge-gray'}">${RecoveryService.PRIORITIES[p] || p}</span>`;
  }

  function toast(msg, type = 'info') {
    const el = document.createElement('div');
    el.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); z-index:300; padding:0.8rem 1.5rem; border-radius:12px; font-weight:700; background:${type === 'error' ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.9)'}; color:#fff;`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function navTo(view, params = {}) {
    currentView = view;
    currentAssetId = params.assetId || null;
    navLinks.forEach(a => a.classList.toggle('active', a.dataset.view === view));
    render();
  }

  function closeMobileMenu() {
    document.getElementById('fa-sidebar')?.classList.remove('fa-sidebar--open');
    document.getElementById('fa-sidebar-overlay')?.classList.remove('fa-sidebar-overlay--open');
  }

  function openMobileMenu() {
    document.getElementById('fa-sidebar')?.classList.add('fa-sidebar--open');
    document.getElementById('fa-sidebar-overlay')?.classList.add('fa-sidebar-overlay--open');
  }

  function bindNav() {
    navLinks.forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      navTo(a.dataset.view);
      closeMobileMenu();
    }));
  }

  async function init() {
    content = document.getElementById('fa-content');
    navLinks = document.querySelectorAll('.fa-nav a[data-view]');
    bindNav();
    document.getElementById('fa-menu-toggle')?.addEventListener('click', openMobileMenu);
    document.getElementById('fa-sidebar-overlay')?.addEventListener('click', closeMobileMenu);
    try {
      await RecoveryService.init();
      const user = await RecoveryService.getCurrentUser();
      document.getElementById('fa-user').textContent = user?.email || 'مستخدم';
      render();
    } catch (err) {
      content.innerHTML = `<div class="fa-empty" style="flex-direction:column;gap:1rem;"><p><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> ${err.message}</p><a href="/calculators/auth/login.html" class="fa-btn fa-btn-primary">تسجيل الدخول</a></div>`;
    }
  }

  async function render() {
    content.innerHTML = '<div class="fa-empty"><div class="fa-spinner"></div><p class="fa-loading-text">جارٍ التحميل...</p></div>';
    try {
      if (currentView === 'dashboard') await renderDashboard();
      else if (currentView === 'assets') await renderAssets();
      else if (currentView === 'asset-detail') await renderAssetDetail();
      else if (currentView === 'reports') await renderReports();
      else if (currentView === 'activity') await renderActivity();
      else renderDashboard();
    } catch (err) {
      content.innerHTML = `<div class="fa-empty"><p><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> ${err.message}</p></div>`;
    }
  }

  // Dashboard
  async function renderDashboard() {
    const stats = await RecoveryService.getDashboardStats();
    const report = await RecoveryService.getStatusReport();
    const statusRows = Object.entries(report.byStatus || [])
      .sort((a, b) => b[1] - a[1])
      .map(([s, c]) => `<tr><td>${statusBadge(s)}</td><td style="text-align:left;font-weight:800;">${c}</td></tr>`).join('');
    content.innerHTML = `
      <h1 class="fa-page-title">لوحة إنقاذ الأصول المتعثرة</h1>
      <div class="fa-stats">
        <div class="fa-stat"><div class="fa-stat-value">${stats.counts.assets.toLocaleString('ar-SA')}</div><div class="fa-stat-label">الأصول المسجلة</div></div>
        <div class="fa-stat"><div class="fa-stat-value">${stats.counts.plans.toLocaleString('ar-SA')}</div><div class="fa-stat-label">خطط الإنقاذ</div></div>
        <div class="fa-stat"><div class="fa-stat-value">${stats.counts.investors.toLocaleString('ar-SA')}</div><div class="fa-stat-label">المستثمرون</div></div>
        <div class="fa-stat"><div class="fa-stat-value">${formatMoney(stats.counts.totalCosts)}</div><div class="fa-stat-label">إجمالي التكاليف</div></div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem;">
        <div class="fa-card">
          <div class="fa-card-header"><h3 class="fa-card-title">توزيع الحالة</h3></div>
          <div class="fa-table-wrap"><table class="fa-table"><tbody>${statusRows || '<tr><td>لا توجد بيانات</td></tr>'}</tbody></table></div>
        </div>
        <div class="fa-card">
          <div class="fa-card-header"><h3 class="fa-card-title">ملخص القيمة</h3></div>
          <div style="display:flex;flex-direction:column;gap:1rem;">
            <div><div style="color:var(--fa-muted);font-size:0.85rem;">القيمة الأصلية</div><div style="font-size:1.4rem;font-weight:800;color:var(--fa-gold-bright);">${formatMoney(report.totalOriginal)}</div></div>
            <div><div style="color:var(--fa-muted);font-size:0.85rem;">القيمة عند التعثر</div><div style="font-size:1.4rem;font-weight:800;color:var(--fa-danger);">${formatMoney(report.totalDistressed)}</div></div>
            <div><div style="color:var(--fa-muted);font-size:0.85rem;">نسبة الفقد المتوقع</div><div style="font-size:1.4rem;font-weight:800;">${report.totalOriginal ? Math.round((1 - report.totalDistressed / report.totalOriginal) * 100) : 0}%</div></div>
          </div>
        </div>
      </div>
      <div class="fa-card">
        <div class="fa-card-header"><h3 class="fa-card-title">آخر الأصول المحدثة</h3><button class="fa-btn fa-btn-primary fa-btn-sm" data-action="new-asset">+ أصل جديد</button></div>
        ${stats.recentAssets.length === 0 ? `
          <div class="fa-empty-state">
            <svg class="fa-empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/></svg>
            <h4 class="fa-empty-state-title">لا توجد أصول مسجلة</h4>
            <p class="fa-empty-state-desc">ابدأ بإضافة أول أصل متعثر لتظهر هنا.</p>
            <button class="fa-btn fa-btn-primary" data-action="new-asset">+ إضافة أول أصل</button>
          </div>
        ` : `
          <div class="fa-table-wrap">
            <table class="fa-table">
              <thead><tr><th>الكود</th><th>الاسم</th><th>الحالة</th><th>الأولوية</th><th>القيمة المتعثرة</th></tr></thead>
              <tbody>
                ${stats.recentAssets.map(a => `
                  <tr>
                    <td><a href="#" data-asset="${a.id}">${BondsAdminCommon.escapeHtml(a.asset_code) || a.id.slice(0, 8)}</a></td>
                    <td><a href="#" data-asset="${a.id}">${BondsAdminCommon.escapeHtml(a.name)}</a></td>
                    <td>${statusBadge(a.status)}</td>
                    <td>${priorityBadge(a.priority)}</td>
                    <td>${formatMoney(a.distressed_value)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
    bindCommon(content);
  }

  // Assets list
  async function renderAssets() {
    const filters = currentAssetsFilters || {};
    const { data } = await RecoveryService.getAssets({ ...filters, limit: 200 });
    content.innerHTML = `
      <h1 class="fa-page-title">الأصول المتعثرة</h1>
      <div class="fa-toolbar">
        <input type="search" class="fa-search" id="asset-search" placeholder="ابحث بالاسم، الكود، أو المالك..." value="${BondsAdminCommon.escapeHtml(filters.search || '')}" />
        <select class="fa-search" id="asset-status" style="max-width:160px;">
          <option value="">كل الحالات</option>
          ${Object.entries(RecoveryService.ASSET_STATUSES).map(([k, v]) => `<option value="${k}" ${filters.status === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <select class="fa-search" id="asset-priority" style="max-width:160px;">
          <option value="">كل الأولويات</option>
          ${Object.entries(RecoveryService.PRIORITIES).map(([k, v]) => `<option value="${k}" ${filters.priority === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        <button class="fa-btn fa-btn-primary" data-action="new-asset">+ أصل جديد</button>
      </div>
      <div class="fa-table-wrap">
        <table class="fa-table">
          <thead>
            <tr><th>الكود</th><th>الاسم</th><th>الفئة</th><th>الحالة</th><th>الأولوية</th><th>القيمة الأصلية</th><th>القيمة المتعثرة</th><th>تاريخ التعثر</th><th></th></tr>
          </thead>
          <tbody>
            ${data.map(a => `
              <tr>
                <td><a href="#" data-asset="${a.id}">${BondsAdminCommon.escapeHtml(a.asset_code) || a.id.slice(0, 8)}</a></td>
                <td><a href="#" data-asset="${a.id}">${BondsAdminCommon.escapeHtml(a.name)}</a></td>
                <td>${RecoveryService.ASSET_CATEGORIES[a.category] || a.category}</td>
                <td>${statusBadge(a.status)}</td>
                <td>${priorityBadge(a.priority)}</td>
                <td>${formatMoney(a.original_value)}</td>
                <td>${formatMoney(a.distressed_value)}</td>
                <td>${formatDate(a.distress_date)}</td>
                <td><button class="fa-btn fa-btn-danger fa-btn-sm" data-delete-asset="${a.id}">حذف</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      ${data.length === 0 ? `
        <div class="fa-empty-state">
          <svg class="fa-empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/></svg>
          <h4 class="fa-empty-state-title">لا توجد أصول مسجلة</h4>
          <p class="fa-empty-state-desc">لم يتم العثور على أصول مطابقة للبحث أو الفلاتر.</p>
          <button class="fa-btn fa-btn-primary" data-action="new-asset">+ إضافة أصل جديد</button>
        </div>
      ` : ''}
    `;
    bindCommon(content);
    document.getElementById('asset-search')?.addEventListener('input', BondsAdminCommon.debounce(e => setAssetFilter('search', e.target.value), 400));
    document.getElementById('asset-status')?.addEventListener('change', e => setAssetFilter('status', e.target.value));
    document.getElementById('asset-priority')?.addEventListener('change', e => setAssetFilter('priority', e.target.value));
    content.querySelectorAll('[data-delete-asset]').forEach(b => b.addEventListener('click', async e => {
      if (!confirm('هل أنت متأكد من الحذف؟')) return;
      await RecoveryService.deleteAsset(b.dataset.deleteAsset);
      invalidateAssetDetailCache(b.dataset.deleteAsset);
      invalidateAssetsListCache();
      toast('تم الحذف');
      renderAssets();
    }));
  }

  let currentAssetsFilters = {};
  function setAssetFilter(key, value) {
    currentAssetsFilters[key] = value;
    renderAssets();
  }

  // Asset detail
  async function renderAssetDetail() {
    if (!currentAssetId) { navTo('assets'); return; }
    currentAsset = await RecoveryService.getAsset(currentAssetId);
    currentPlans = await RecoveryService.getPlans(currentAssetId);
    const [valuations, reasons, costs, offers, docs, notes] = await Promise.all([
      RecoveryService.getValuations(currentAssetId),
      RecoveryService.getReasons(currentAssetId),
      RecoveryService.getCosts(currentAssetId),
      RecoveryService.getOffers(currentAssetId),
      RecoveryService.getDocuments(currentAssetId),
      RecoveryService.getNotes(currentAssetId)
    ]);

    const activeTab = currentAssetTab || 'overview';

    content.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem;">
        <div>
          <div style="color:var(--fa-muted);font-size:0.85rem;">${currentAsset.asset_code || currentAsset.id.slice(0, 8)}</div>
          <h1 class="fa-page-title" style="margin:0;">${BondsAdminCommon.escapeHtml(currentAsset.name)}</h1>
          <div style="margin-top:0.5rem;">${statusBadge(currentAsset.status)} ${priorityBadge(currentAsset.priority)}</div>
        </div>
        <div class="fa-toolbar" style="margin:0;">
          <button class="fa-btn fa-btn-secondary fa-btn-sm" data-action="edit-asset"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#D99E82" d="M35.222 33.598c-.647-2.101-1.705-6.059-2.325-7.566-.501-1.216-.969-2.438-1.544-3.014-.575-.575-1.553-.53-2.143.058 0 0-2.469 1.675-3.354 2.783-1.108.882-2.785 3.357-2.785 3.357-.59.59-.635 1.567-.06 2.143.576.575 1.798 1.043 3.015 1.544 1.506.62 5.465 1.676 7.566 2.325.359.11 1.74-1.271 1.63-1.63z"/><path fill="#EA596E" d="M13.643 5.308c1.151 1.151 1.151 3.016 0 4.167l-4.167 4.168c-1.151 1.15-3.018 1.15-4.167 0L1.141 9.475c-1.15-1.151-1.15-3.016 0-4.167l4.167-4.167c1.15-1.151 3.016-1.151 4.167 0l4.168 4.167z"/><path fill="#FFCC4D" d="M31.353 23.018l-4.17 4.17-4.163 4.165L7.392 15.726l8.335-8.334 15.626 15.626z"/><path fill="#292F33" d="M32.078 34.763s2.709 1.489 3.441.757c.732-.732-.765-3.435-.765-3.435s-2.566.048-2.676 2.678z"/><path fill="#CCD6DD" d="M2.183 10.517l8.335-8.335 5.208 5.209-8.334 8.335z"/><path fill="#99AAB5" d="M3.225 11.558l8.334-8.334 1.042 1.042L4.267 12.6zm2.083 2.086l8.335-8.335 1.042 1.042-8.335 8.334z"/></svg> تعديل</button>
          <button class="fa-btn fa-btn-primary fa-btn-sm" data-action="new-plan" data-asset="${currentAssetId}">+ خطة إنقاذ</button>
        </div>
      </div>
      <div class="fa-tabs">
        ${['overview','plans','costs','offers','documents','notes','ai'].map(t =>
          `<button class="fa-tab ${activeTab === t ? 'active' : ''}" data-tab="${t}">${tabName(t)}</button>`
        ).join('')}
      </div>
      <div id="asset-tab-content"></div>
    `;

    const tabContent = document.getElementById('asset-tab-content');
    if (activeTab === 'overview') renderOverviewTab(tabContent, { valuations, reasons });
    else if (activeTab === 'plans') renderPlansTab(tabContent, currentPlans);
    else if (activeTab === 'costs') renderCostsTab(tabContent, costs);
    else if (activeTab === 'offers') renderOffersTab(tabContent, offers);
    else if (activeTab === 'documents') renderDocumentsTab(tabContent, docs);
    else if (activeTab === 'notes') renderNotesTab(tabContent, notes);
    else if (activeTab === 'ai') renderAiTab(tabContent, { reasons, plans: currentPlans });

    bindCommon(content);
    content.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => { currentAssetTab = b.dataset.tab; renderAssetDetail(); }));
  }

  let currentAssetTab = 'overview';
  function tabName(t) {
    return { overview: 'نظرة عامة', plans: 'خطط الإنقاذ', costs: 'التكاليف', offers: 'العروض', documents: 'المستندات', notes: 'الملاحظات', ai: "<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><ellipse fill=\"#F4900C\" cx=\"33.5\" cy=\"14.5\" rx=\"2.5\" ry=\"3.5\"/><ellipse fill=\"#F4900C\" cx=\"2.5\" cy=\"14.5\" rx=\"2.5\" ry=\"3.5\"/><path fill=\"#FFAC33\" d=\"M34 19c0 .553-.447 1-1 1h-3c-.553 0-1-.447-1-1v-9c0-.552.447-1 1-1h3c.553 0 1 .448 1 1v9zM7 19c0 .553-.448 1-1 1H3c-.552 0-1-.447-1-1v-9c0-.552.448-1 1-1h3c.552 0 1 .448 1 1v9z\"/><path fill=\"#FFCC4D\" d=\"M28 5c0 2.761-4.478 4-10 4C12.477 9 8 7.761 8 5s4.477-5 10-5c5.522 0 10 2.239 10 5z\"/><path fill=\"#F4900C\" d=\"M25 4.083C25 5.694 21.865 7 18 7c-3.866 0-7-1.306-7-2.917 0-1.611 3.134-2.917 7-2.917 3.865 0 7 1.306 7 2.917z\"/><path fill=\"#269\" d=\"M30 5.5C30 6.881 28.881 7 27.5 7h-19C7.119 7 6 6.881 6 5.5S7.119 3 8.5 3h19C28.881 3 30 4.119 30 5.5z\"/><path fill=\"#55ACEE\" d=\"M30 6H6c-1.104 0-2 .896-2 2v26h28V8c0-1.104-.896-2-2-2z\"/><path fill=\"#3B88C3\" d=\"M35 33v-1c0-1.104-.896-2-2-2H22.071l-3.364 3.364c-.391.391-1.023.391-1.414 0L13.929 30H3c-1.104 0-2 .896-2 2v1c0 1.104-.104 2 1 2h32c1.104 0 1-.896 1-2z\"/><circle fill=\"#FFF\" cx=\"24.5\" cy=\"14.5\" r=\"4.5\"/><circle fill=\"#DD2E44\" cx=\"24.5\" cy=\"14.5\" r=\"2.721\"/><circle fill=\"#FFF\" cx=\"11.5\" cy=\"14.5\" r=\"4.5\"/><path fill=\"#F5F8FA\" d=\"M29 25.5c0 1.381-1.119 2.5-2.5 2.5h-17C8.119 28 7 26.881 7 25.5S8.119 23 9.5 23h17c1.381 0 2.5 1.119 2.5 2.5z\"/><path fill=\"#CCD6DD\" d=\"M17 23h2v5h-2zm-5 0h2v5h-2zm10 0h2v5h-2zM7 25.5c0 1.21.859 2.218 2 2.45v-4.9c-1.141.232-2 1.24-2 2.45zm20-2.45v4.899c1.141-.232 2-1.24 2-2.45s-.859-2.217-2-2.449z\"/><circle fill=\"#DD2E44\" cx=\"11.5\" cy=\"14.5\" r=\"2.721\"/></svg> AI" }[t];
  }

  // Module cache helpers
  const MODULE_CACHE_KEY = 'distressed-recovery';
  const MODULE_CACHE_TTL = 120000;

  function invalidateAssetDetailCache(assetId) {
    if (!window.BondsAdminModuleCache || !assetId) return;
    window.BondsAdminModuleCache.invalidate(MODULE_CACHE_KEY, `asset:${assetId}:detail`);
    window.BondsAdminModuleCache.invalidate(MODULE_CACHE_KEY, `asset:${assetId}:plans`);
    window.BondsAdminModuleCache.invalidate(MODULE_CACHE_KEY, `asset:${assetId}:valuations`);
    window.BondsAdminModuleCache.invalidate(MODULE_CACHE_KEY, `asset:${assetId}:reasons`);
    window.BondsAdminModuleCache.invalidate(MODULE_CACHE_KEY, `asset:${assetId}:costs`);
    window.BondsAdminModuleCache.invalidate(MODULE_CACHE_KEY, `asset:${assetId}:offers`);
    window.BondsAdminModuleCache.invalidate(MODULE_CACHE_KEY, `asset:${assetId}:documents`);
    window.BondsAdminModuleCache.invalidate(MODULE_CACHE_KEY, `asset:${assetId}:notes`);
  }

  function invalidateAssetsListCache() {
    if (!window.BondsAdminModuleCache) return;
    // Module cache doesn't expose prefix deletion by scope; clear the whole module
    // to invalidate all assets:* scopes plus dependent reports.
    window.BondsAdminModuleCache.invalidate(MODULE_CACHE_KEY);
  }

  function patchRecoveryServiceCache() {
    if (!window.BondsAdminModuleCache) return;

    const originalGetAssets = RecoveryService.getAssets;
    RecoveryService.getAssets = async function (opts) {
      const filters = { ...(opts || {}) };
      delete filters.limit;
      const scope = Object.keys(filters).length === 0
        ? 'assets:all'
        : `assets:${JSON.stringify(filters)}`;
      const cached = window.BondsAdminModuleCache.get(MODULE_CACHE_KEY, scope, MODULE_CACHE_TTL);
      if (cached !== null) return cached;
      const result = await originalGetAssets.call(this, opts);
      window.BondsAdminModuleCache.set(MODULE_CACHE_KEY, scope, result);
      return result;
    };

    const wrapNoArgs = (method, scope) => {
      const original = RecoveryService[method];
      RecoveryService[method] = async function (...args) {
        const cached = window.BondsAdminModuleCache.get(MODULE_CACHE_KEY, scope, MODULE_CACHE_TTL);
        if (cached !== null) return cached;
        const result = await original.apply(this, args);
        window.BondsAdminModuleCache.set(MODULE_CACHE_KEY, scope, result);
        return result;
      };
    };

    wrapNoArgs('getDashboardStats', 'dashboardStats');
    wrapNoArgs('getStatusReport', 'statusReport');
    wrapNoArgs('getFinancialReport', 'financialReport');

    const originalGetActivity = RecoveryService.getActivity;
    RecoveryService.getActivity = async function (limit) {
      const cached = window.BondsAdminModuleCache.get(MODULE_CACHE_KEY, 'activity', MODULE_CACHE_TTL);
      if (cached !== null) return cached;
      const result = await originalGetActivity.call(this, limit);
      window.BondsAdminModuleCache.set(MODULE_CACHE_KEY, 'activity', result);
      return result;
    };

    const perAssetScopes = {
      getAsset: 'detail',
      getPlans: 'plans',
      getValuations: 'valuations',
      getReasons: 'reasons',
      getCosts: 'costs',
      getOffers: 'offers',
      getDocuments: 'documents',
      getNotes: 'notes'
    };
    for (const [method, suffix] of Object.entries(perAssetScopes)) {
      const original = RecoveryService[method];
      RecoveryService[method] = async function (assetId, ...rest) {
        const scope = `asset:${assetId}:${suffix}`;
        const cached = window.BondsAdminModuleCache.get(MODULE_CACHE_KEY, scope, MODULE_CACHE_TTL);
        if (cached !== null) return cached;
        const result = await original.call(this, assetId, ...rest);
        window.BondsAdminModuleCache.set(MODULE_CACHE_KEY, scope, result);
        return result;
      };
    }
  }

  patchRecoveryServiceCache();

  function renderOverviewTab(el, { valuations, reasons }) {
    const latestVal = valuations[0];
    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1.5rem;">
        <div class="fa-card">
          <div class="fa-card-header"><h3 class="fa-card-title">معلومات الأصل</h3></div>
          <div class="fa-form-grid" style="gap:0.75rem 1.25rem;">
            <div><div style="color:var(--fa-muted);font-size:0.8rem;">الفئة</div><div style="font-weight:700;">${RecoveryService.ASSET_CATEGORIES[currentAsset.category] || currentAsset.category}</div></div>
            <div><div style="color:var(--fa-muted);font-size:0.8rem;">المالك</div><div style="font-weight:700;">${BondsAdminCommon.escapeHtml(currentAsset.owner_name) || '—'}</div></div>
            <div><div style="color:var(--fa-muted);font-size:0.8rem;">الموقع</div><div style="font-weight:700;">${[BondsAdminCommon.escapeHtml(currentAsset.city), BondsAdminCommon.escapeHtml(currentAsset.country_code)].filter(Boolean).join('، ') || '—'}</div></div>
            <div><div style="color:var(--fa-muted);font-size:0.8rem;">تاريخ التعثر</div><div style="font-weight:700;">${formatDate(currentAsset.distress_date)}</div></div>
          </div>
          ${currentAsset.description ? `<div style="margin-top:1rem;color:var(--fa-muted);">${BondsAdminCommon.escapeHtml(currentAsset.description)}</div>` : ''}
        </div>
        <div class="fa-card">
          <div class="fa-card-header"><h3 class="fa-card-title">القيم</h3></div>
          <div style="display:flex;flex-direction:column;gap:1rem;">
            <div><div style="color:var(--fa-muted);font-size:0.85rem;">القيمة الأصلية</div><div style="font-size:1.4rem;font-weight:800;color:var(--fa-gold-bright);">${formatMoney(currentAsset.original_value)}</div></div>
            <div><div style="color:var(--fa-muted);font-size:0.85rem;">القيمة المتعثرة</div><div style="font-size:1.4rem;font-weight:800;color:var(--fa-danger);">${formatMoney(currentAsset.distressed_value)}</div></div>
            <div><div style="color:var(--fa-muted);font-size:0.85rem;">آخر تقييم</div><div style="font-size:1.2rem;font-weight:800;">${latestVal ? formatMoney(latestVal.market_value) : '—'}</div></div>
          </div>
        </div>
      </div>
      <div class="fa-card">
        <div class="fa-card-header"><h3 class="fa-card-title">أسباب التعثر</h3><button class="fa-btn fa-btn-secondary fa-btn-sm" data-action="new-reason" data-asset="${currentAssetId}">+ سبب</button></div>
        ${reasons.length === 0 ? '<div style="color:var(--fa-muted);">لا توجد أسباب مسجلة</div>' :
          reasons.map(r => `
            <div class="fa-list-item">
              <div>
                <div style="font-weight:700;">${RecoveryService.REASON_CATEGORIES[r.reason_category] || r.reason_category}</div>
                <div style="color:var(--fa-muted);font-size:0.85rem;">${BondsAdminCommon.escapeHtml(r.description)}</div>
              </div>
              <div>${priorityBadge(r.severity)}</div>
            </div>
          `).join('')}
      </div>
      <div class="fa-card">
        <div class="fa-card-header"><h3 class="fa-card-title">التقييمات</h3><button class="fa-btn fa-btn-secondary fa-btn-sm" data-action="new-valuation" data-asset="${currentAssetId}">+ تقييم</button></div>
        <div class="fa-table-wrap">
          <table class="fa-table">
            <thead><tr><th>التاريخ</th><th>القيمة السوقية</th><th>قيمة البيع الإجباري</th><th>قيمة الإنقاذ المتوقعة</th><th>الطريقة</th><th>المقيّم</th></tr></thead>
            <tbody>
              ${valuations.map(v => `
                <tr>
                  <td>${formatDate(v.valuation_date)}</td>
                  <td>${formatMoney(v.market_value)}</td>
                  <td>${formatMoney(v.forced_sale_value)}</td>
                  <td>${formatMoney(v.recovery_value)}</td>
                  <td>${BondsAdminCommon.escapeHtml(v.method) || '—'}</td>
                  <td>${BondsAdminCommon.escapeHtml(v.appraiser) || '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    bindCommon(el);
  }

  function renderPlansTab(el, plans) {
    el.innerHTML = `
      <div class="fa-card">
        <div class="fa-card-header"><h3 class="fa-card-title">خطط الإنقاذ</h3><button class="fa-btn fa-btn-primary fa-btn-sm" data-action="new-plan" data-asset="${currentAssetId}">+ خطة جديدة</button></div>
        ${plans.length === 0 ? '<div style="color:var(--fa-muted);">لا توجد خطط</div>' :
          plans.map(p => `
            <div class="fa-card" style="background:rgba(255,255,255,0.02);">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem;">
                <div>
                  <div style="font-weight:800;font-size:1.1rem;color:var(--fa-gold-bright);">${BondsAdminCommon.escapeHtml(p.plan_name)}</div>
                  <div style="color:var(--fa-muted);font-size:0.85rem;">${RecoveryService.STRATEGIES[p.strategy] || p.strategy} • ${statusBadge(p.status)}</div>
                </div>
                <div class="fa-toolbar" style="margin:0;">
                  <button class="fa-btn fa-btn-secondary fa-btn-sm" data-action="edit-plan" data-plan="${p.id}">تعديل</button>
                  <button class="fa-btn fa-btn-danger fa-btn-sm" data-delete-plan="${p.id}">حذف</button>
                </div>
              </div>
              <div style="margin-top:1rem;display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:1rem;">
                <div><div style="color:var(--fa-muted);font-size:0.8rem;">القيمة المتوقعة</div><div style="font-weight:800;">${formatMoney(p.expected_recovery_value)}</div></div>
                <div><div style="color:var(--fa-muted);font-size:0.8rem;">تاريخ الإنقاذ المتوقع</div><div style="font-weight:800;">${formatDate(p.expected_recovery_date)}</div></div>
                <div><div style="color:var(--fa-muted);font-size:0.8rem;">الاحتمالية</div><div style="font-weight:800;">${p.probability || '—'}%</div></div>
              </div>
              ${p.summary ? `<div style="margin-top:0.75rem;color:var(--fa-muted);">${BondsAdminCommon.escapeHtml(p.summary)}</div>` : ''}
              <div style="margin-top:1rem;">
                <div style="font-weight:700;margin-bottom:0.5rem;">المراحل</div>
                ${(p.recovery_plan_stages || []).sort((a, b) => a.stage_order - b.stage_order).map(s => `
                  <div class="fa-stage">
                    <div class="fa-stage-order">${s.stage_order + 1}</div>
                    <div style="flex:1;">
                      <div style="font-weight:700;">${BondsAdminCommon.escapeHtml(s.title)}</div>
                      <div style="color:var(--fa-muted);font-size:0.8rem;">${BondsAdminCommon.escapeHtml(s.description || '')} ${s.due_date ? '• تاريخ الاستحقاق: ' + formatDate(s.due_date) : ''}</div>
                    </div>
                    <select data-stage-status="${s.id}" style="background:rgba(255,255,255,0.05);border:1px solid var(--fa-border);color:var(--fa-text);border-radius:8px;padding:0.3rem;">
                      ${['pending','in_progress','completed','blocked','skipped'].map(st => `<option value="${st}" ${s.status === st ? 'selected' : ''}>${stageStatusName(st)}</option>`).join('')}
                    </select>
                  </div>
                `).join('') || '<div style="color:var(--fa-muted);">لا توجد مراحل</div>'}
              </div>
            </div>
          `).join('')}
      </div>
    `;
    bindCommon(el);
    el.querySelectorAll('[data-delete-plan]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('حذف الخطة؟')) return;
      await RecoveryService.deletePlan(b.dataset.deletePlan);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحذف');
      renderAssetDetail();
    }));
    el.querySelectorAll('[data-stage-status]').forEach(s => s.addEventListener('change', async () => {
      await RecoveryService.updateStageStatus(s.dataset.stageStatus, s.value);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم تحديث الحالة');
      renderAssetDetail();
    }));
  }

  function stageStatusName(s) {
    return { pending: 'معلّق', in_progress: 'قيد التنفيذ', completed: 'مكتمل', blocked: 'متوقف', skipped: 'تم تخطيه' }[s] || s;
  }

  function renderCostsTab(el, costs) {
    el.innerHTML = `
      <div class="fa-card">
        <div class="fa-card-header"><h3 class="fa-card-title">تكاليف الإنقاذ</h3><button class="fa-btn fa-btn-primary fa-btn-sm" data-action="new-cost" data-asset="${currentAssetId}">+ تكلفة</button></div>
        <div class="fa-table-wrap">
          <table class="fa-table">
            <thead><tr><th>النوع</th><th>المبلغ</th><th>التاريخ</th><th>الوصف</th><th></th></tr></thead>
            <tbody>
              ${costs.map(c => `
                <tr>
                  <td>${costTypeName(c.cost_type)}</td>
                  <td>${formatMoney(c.amount)}</td>
                  <td>${formatDate(c.incurred_date)}</td>
                  <td>${BondsAdminCommon.escapeHtml(c.description) || '—'}</td>
                  <td><button class="fa-btn fa-btn-danger fa-btn-sm" data-delete-cost="${c.id}">حذف</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${costs.length === 0 ? '<div style="color:var(--fa-muted);margin-top:1rem;">لا توجد تكاليف</div>' : ''}
      </div>
    `;
    bindCommon(el);
    el.querySelectorAll('[data-delete-cost]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('حذف التكلفة؟')) return;
      await RecoveryService.deleteCost(b.dataset.deleteCost);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحذف');
      renderAssetDetail();
    }));
  }

  function costTypeName(t) {
    return { legal: 'قانونية', admin: 'إدارية', marketing: 'تسويق', repair: 'إصلاح', appraisal: 'تقييم', consulting: 'استشارية', holding: 'احتفاظ', other: 'أخرى' }[t] || t;
  }

  async function renderOffersTab(el, offers) {
    currentInvestors = await RecoveryService.getInvestors();
    el.innerHTML = `
      <div class="fa-card">
        <div class="fa-card-header"><h3 class="fa-card-title">عروض المستثمرين</h3><button class="fa-btn fa-btn-primary fa-btn-sm" data-action="new-offer" data-asset="${currentAssetId}">+ عرض</button></div>
        <div class="fa-table-wrap">
          <table class="fa-table">
            <thead><tr><th>المستثمر</th><th>نوع العرض</th><th>القيمة</th><th>الحالة</th><th>تاريخ التقديم</th><th></th></tr></thead>
            <tbody>
              ${offers.map(o => `
                <tr>
                  <td>${BondsAdminCommon.escapeHtml(o.recovery_investors?.name) || '—'}</td>
                  <td>${offerTypeName(o.offer_type)}</td>
                  <td>${formatMoney(o.offer_value)}</td>
                  <td>${offerStatusBadge(o.status)}</td>
                  <td>${formatDate(o.submitted_at)}</td>
                  <td><button class="fa-btn fa-btn-danger fa-btn-sm" data-delete-offer="${o.id}">حذف</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${offers.length === 0 ? '<div style="color:var(--fa-muted);margin-top:1rem;">لا توجد عروض</div>' : ''}
      </div>
    `;
    bindCommon(el);
    el.querySelectorAll('[data-delete-offer]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('حذف العرض؟')) return;
      await RecoveryService.deleteOffer(b.dataset.deleteOffer);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحذف');
      renderAssetDetail();
    }));
  }

  function offerTypeName(t) {
    return { purchase: 'شراء', partnership: 'شراكة', refinance: 'إعادة تمويل', lease: 'إيجار' }[t] || t;
  }
  function offerStatusBadge(s) {
    const map = { received: 'fa-badge-gray', under_review: 'fa-badge-blue', accepted: 'fa-badge-green', rejected: 'fa-badge-red', negotiating: 'fa-badge-orange' };
    const names = { received: 'مستلم', under_review: 'قيد المراجعة', accepted: 'مقبول', rejected: 'مرفوض', negotiating: 'تفاوض' };
    return `<span class="fa-badge ${map[s] || 'fa-badge-gray'}">${names[s] || s}</span>`;
  }

  function renderDocumentsTab(el, docs) {
    el.innerHTML = `
      <div class="fa-card">
        <div class="fa-card-header"><h3 class="fa-card-title">المستندات</h3></div>
        <div style="margin-bottom:1rem;">
          <input type="file" id="recovery-doc-input" style="display:none;" />
          <button class="fa-btn fa-btn-primary fa-btn-sm" onclick="document.getElementById('recovery-doc-input').click()"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#99AAB5" d="M35.354 25.254c.217-2.391-.513-4.558-2.057-6.102L17.033 2.89c-.391-.391-1.024-.391-1.414 0-.391.391-.391 1.024 0 1.414l16.264 16.263c1.116 1.117 1.642 2.717 1.479 4.506-.159 1.748-.957 3.456-2.188 4.686-1.23 1.23-2.938 2.027-4.685 2.187-1.781.161-3.39-.362-4.506-1.479L3.598 12.082c-.98-.98-1.059-2.204-.953-3.058.15-1.196.755-2.401 1.66-3.307 1.7-1.7 4.616-2.453 6.364-.707l14.85 14.849c1.119 1.12.026 2.803-.708 3.536-.733.735-2.417 1.826-3.535.707L9.962 12.789c-.391-.391-1.024-.39-1.414 0-.391.391-.391 1.023 0 1.414l11.313 11.314c1.859 1.858 4.608 1.05 6.363-.707 1.758-1.757 2.565-4.507.708-6.364L12.083 3.597c-2.62-2.62-6.812-1.673-9.192.706C1.677 5.517.864 7.147.661 8.775c-.229 1.833.312 3.509 1.523 4.721l18.384 18.385c1.365 1.365 3.218 2.094 5.281 2.094.27 0 .544-.013.82-.037 2.206-.201 4.362-1.209 5.918-2.765 1.558-1.556 2.565-3.713 2.767-5.919z"/></svg> رفع مستند</button>
        </div>
        <div class="fa-table-wrap">
          <table class="fa-table">
            <thead><tr><th>الملف</th><th>الحجم</th><th>التاريخ</th><th></th></tr></thead>
            <tbody>
              ${docs.map(d => `
                <tr>
                  <td><a href="${BondsAdminCommon.escapeHtml(d.public_url || '#')}" target="_blank" rel="noopener">${BondsAdminCommon.escapeHtml(d.file_name)}</a></td>
                  <td>${d.file_size ? Math.round(d.file_size / 1024) + ' KB' : '—'}</td>
                  <td>${formatDate(d.created_at)}</td>
                  <td><button class="fa-btn fa-btn-danger fa-btn-sm" data-delete-doc="${d.id}">حذف</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    const input = document.getElementById('recovery-doc-input');
    input?.addEventListener('change', async () => {
      const file = input.files[0];
      if (!file) return;
      try {
        await RecoveryService.uploadDocument(file, { asset_id: currentAssetId });
        invalidateAssetDetailCache(currentAssetId);
        toast('تم الرفع');
        renderAssetDetail();
      } catch (e) {
        toast(e.message, 'error');
      }
    });
    el.querySelectorAll('[data-delete-doc]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('حذف المستند؟')) return;
      await RecoveryService.deleteDocument(b.dataset.deleteDoc);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحذف');
      renderAssetDetail();
    }));
  }

  function renderNotesTab(el, notes) {
    el.innerHTML = `
      <div class="fa-card">
        <div class="fa-card-header"><h3 class="fa-card-title">الملاحظات</h3></div>
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">
          <input type="text" id="recovery-note-input" class="fa-search" placeholder="أضف ملاحظة..." />
          <button class="fa-btn fa-btn-primary" id="recovery-note-add">إضافة</button>
        </div>
        ${notes.map(n => `
          <div class="fa-list-item">
            <div>${BondsAdminCommon.escapeHtml(n.note)}</div>
            <div style="display:flex;align-items:center;gap:0.5rem;">
              <span style="color:var(--fa-muted);font-size:0.8rem;">${formatDate(n.created_at)}</span>
              <button class="fa-btn fa-btn-danger fa-btn-sm" data-delete-note="${n.id}">حذف</button>
            </div>
          </div>
        `).join('')}
        ${notes.length === 0 ? '<div style="color:var(--fa-muted);">لا توجد ملاحظات</div>' : ''}
      </div>
    `;
    document.getElementById('recovery-note-add')?.addEventListener('click', async () => {
      const input = document.getElementById('recovery-note-input');
      if (!input.value.trim()) return;
      await RecoveryService.saveNote({ asset_id: currentAssetId, note: input.value.trim() });
      invalidateAssetDetailCache(currentAssetId);
      toast('تمت الإضافة');
      renderAssetDetail();
    });
    el.querySelectorAll('[data-delete-note]').forEach(b => b.addEventListener('click', async () => {
      if (!confirm('حذف الملاحظة؟')) return;
      await RecoveryService.deleteNote(b.dataset.deleteNote);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحذف');
      renderAssetDetail();
    }));
  }

  function renderAiTab(el, { reasons, plans }) {
    const reasonSummary = reasons.map(r => RecoveryService.REASON_CATEGORIES[r.reason_category] || r.reason_category).map(escapeHtml).join('، ');
    el.innerHTML = `
      <div class="fa-card">
        <div class="fa-card-header"><h3 class="fa-card-title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><ellipse fill="#F4900C" cx="33.5" cy="14.5" rx="2.5" ry="3.5"/><ellipse fill="#F4900C" cx="2.5" cy="14.5" rx="2.5" ry="3.5"/><path fill="#FFAC33" d="M34 19c0 .553-.447 1-1 1h-3c-.553 0-1-.447-1-1v-9c0-.552.447-1 1-1h3c.553 0 1 .448 1 1v9zM7 19c0 .553-.448 1-1 1H3c-.552 0-1-.447-1-1v-9c0-.552.448-1 1-1h3c.552 0 1 .448 1 1v9z"/><path fill="#FFCC4D" d="M28 5c0 2.761-4.478 4-10 4C12.477 9 8 7.761 8 5s4.477-5 10-5c5.522 0 10 2.239 10 5z"/><path fill="#F4900C" d="M25 4.083C25 5.694 21.865 7 18 7c-3.866 0-7-1.306-7-2.917 0-1.611 3.134-2.917 7-2.917 3.865 0 7 1.306 7 2.917z"/><path fill="#269" d="M30 5.5C30 6.881 28.881 7 27.5 7h-19C7.119 7 6 6.881 6 5.5S7.119 3 8.5 3h19C28.881 3 30 4.119 30 5.5z"/><path fill="#55ACEE" d="M30 6H6c-1.104 0-2 .896-2 2v26h28V8c0-1.104-.896-2-2-2z"/><path fill="#3B88C3" d="M35 33v-1c0-1.104-.896-2-2-2H22.071l-3.364 3.364c-.391.391-1.023.391-1.414 0L13.929 30H3c-1.104 0-2 .896-2 2v1c0 1.104-.104 2 1 2h32c1.104 0 1-.896 1-2z"/><circle fill="#FFF" cx="24.5" cy="14.5" r="4.5"/><circle fill="#DD2E44" cx="24.5" cy="14.5" r="2.721"/><circle fill="#FFF" cx="11.5" cy="14.5" r="4.5"/><path fill="#F5F8FA" d="M29 25.5c0 1.381-1.119 2.5-2.5 2.5h-17C8.119 28 7 26.881 7 25.5S8.119 23 9.5 23h17c1.381 0 2.5 1.119 2.5 2.5z"/><path fill="#CCD6DD" d="M17 23h2v5h-2zm-5 0h2v5h-2zm10 0h2v5h-2zM7 25.5c0 1.21.859 2.218 2 2.45v-4.9c-1.141.232-2 1.24-2 2.45zm20-2.45v4.899c1.141-.232 2-1.24 2-2.45s-.859-2.217-2-2.449z"/><circle fill="#DD2E44" cx="11.5" cy="14.5" r="2.721"/></svg> تحليل AI لخطة الإنقاذ</h3></div>
        <p style="font-size:0.8rem;color:var(--fa-muted);margin:0 1rem 1rem;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#3B88C3" d="M0 4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4z"/><path fill="#FFF" d="M20.512 8.071c0 1.395-1.115 2.573-2.511 2.573-1.333 0-2.511-1.209-2.511-2.573 0-1.271 1.178-2.45 2.511-2.45 1.333.001 2.511 1.148 2.511 2.45zm-4.744 6.728c0-1.488.931-2.481 2.232-2.481 1.302 0 2.232.992 2.232 2.481v11.906c0 1.488-.93 2.48-2.232 2.48s-2.232-.992-2.232-2.48V14.799z"/></svg> هذا التحليل يستخدم محركاً قاعدياً (Rule-Based) يعتمد على بيانات الأصل والخطة.</p>
        <div class="fa-form-grid">
          <div class="fa-form-group"><label>إجمالي الدين/التكلفة المتعثرة</label><input type="number" id="ai-distress-debt" value="${currentAsset.distressed_value || currentAsset.original_value || ''}" /></div>
          <div class="fa-form-group"><label>الاستنزاف الشهري</label><input type="number" id="ai-distress-burn" value="" placeholder="اختياري" /></div>
          <div class="fa-form-group"><label>النقد المتبقي</label><input type="number" id="ai-distress-cash" value="" placeholder="اختياري" /></div>
          <div class="fa-form-group"><label>عدد الموظفين</label><input type="number" id="ai-distress-employees" value="" placeholder="اختياري" /></div>
        </div>
        <div style="margin-top:1rem;">
          <button class="fa-btn fa-btn-primary" id="ai-distress-run" onclick="RecoveryApp.runDistressedAi()">تشغيل التحليل</button>
          <span id="ai-distress-cost" style="color:var(--fa-muted);font-size:0.85rem;margin-right:1rem;"></span>
        </div>
      </div>
      <div id="ai-distress-result" class="fa-card" style="display:none;margin-top:1.5rem;"></div>
    `;
  }

  async function runDistressedAi() {
    const btn = document.getElementById('ai-distress-run');
    const costEl = document.getElementById('ai-distress-cost');
    const resultEl = document.getElementById('ai-distress-result');
    btn.disabled = true;
    costEl.textContent = 'جارِ التحليل...';
    resultEl.style.display = 'none';
    try {
      const reasons = (await RecoveryService.getReasons(currentAssetId)).map(r => RecoveryService.REASON_CATEGORIES[r.reason_category] || r.reason_category);
      const payload = {
        project_name: currentAsset.name,
        current_status: RecoveryService.ASSET_STATUSES[currentAsset.status] || currentAsset.status,
        distress_reasons: reasons.length ? reasons : ['غير محدد'],
        total_debt: Number(document.getElementById('ai-distress-debt').value) || (currentAsset.distressed_value || 0),
        monthly_burn: Number(document.getElementById('ai-distress-burn').value) || null,
        remaining_cash: Number(document.getElementById('ai-distress-cash').value) || null,
        employees_count: Number(document.getElementById('ai-distress-employees').value) || null,
      };
      const res = await AiAnalyzeService.analyze({ type: 'distressed_project', payload });
      resultEl.innerHTML = '<h3>نتيجة تحليل الإنقاذ</h3>' + AiAnalyzeService.renderResult(res.result);
      resultEl.style.display = 'block';
      costEl.textContent = res.usage ? `التكلفة: $${res.usage.cost_usd || 0}` : '';
    } catch (err) {
      resultEl.innerHTML = `<p style="color:var(--fa-danger)"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#DD2E44" d="M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z"/></svg> ${BondsAdminCommon.escapeHtml(err.message)}</p>`;
      resultEl.style.display = 'block';
      costEl.textContent = '';
    } finally {
      btn.disabled = false;
    }
  }

  // Reports
  async function renderReports() {
    const [statusReport, finReport] = await Promise.all([
      RecoveryService.getStatusReport(),
      RecoveryService.getFinancialReport()
    ]);
    content.innerHTML = `
      <h1 class="fa-page-title">التقارير</h1>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:1.5rem;">
        <div class="fa-card">
          <div class="fa-card-header"><h3 class="fa-card-title">الأصول حسب الحالة</h3></div>
          <div class="fa-table-wrap"><table class="fa-table"><tbody>
            ${Object.entries(statusReport.byStatus).map(([s, c]) => `<tr><td>${statusBadge(s)}</td><td style="text-align:left;font-weight:800;">${c}</td></tr>`).join('')}
          </tbody></table></div>
        </div>
        <div class="fa-card">
          <div class="fa-card-header"><h3 class="fa-card-title">الأصول حسب الفئة</h3></div>
          <div class="fa-table-wrap"><table class="fa-table"><tbody>
            ${Object.entries(statusReport.byCategory).map(([c, n]) => `<tr><td>${RecoveryService.ASSET_CATEGORIES[c] || c}</td><td style="text-align:left;font-weight:800;">${n}</td></tr>`).join('')}
          </tbody></table></div>
        </div>
        <div class="fa-card">
          <div class="fa-card-header"><h3 class="fa-card-title">المالية</h3></div>
          <div style="display:flex;flex-direction:column;gap:1rem;">
            <div><div style="color:var(--fa-muted);font-size:0.85rem;">إجمالي التكاليف</div><div style="font-size:1.3rem;font-weight:800;color:var(--fa-danger);">${formatMoney(finReport.totalCosts)}</div></div>
            <div><div style="color:var(--fa-muted);font-size:0.85rem;">إجمالي العروض</div><div style="font-size:1.3rem;font-weight:800;color:var(--fa-info);">${formatMoney(finReport.totalOffers)}</div></div>
            <div><div style="color:var(--fa-muted);font-size:0.85rem;">العروض المقبولة</div><div style="font-size:1.3rem;font-weight:800;color:var(--fa-success);">${formatMoney(finReport.acceptedOffers)}</div></div>
          </div>
        </div>
        <div class="fa-card">
          <div class="fa-card-header"><h3 class="fa-card-title">التكاليف حسب النوع</h3></div>
          <div class="fa-table-wrap"><table class="fa-table"><tbody>
            ${Object.entries(finReport.byType).map(([t, a]) => `<tr><td>${costTypeName(t)}</td><td style="text-align:left;font-weight:800;">${formatMoney(a)}</td></tr>`).join('')}
          </tbody></table></div>
        </div>
      </div>
    `;
  }

  // Activity
  async function renderActivity() {
    const logs = await RecoveryService.getActivity(100);
    content.innerHTML = `
      <h1 class="fa-page-title">السجل الزمني</h1>
      <div class="fa-card">
        <div class="fa-table-wrap">
          <table class="fa-table">
            <thead><tr><th>الوقت</th><th>الإجراء</th><th>الأصل</th><th>التفاصيل</th></tr></thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td style="white-space:nowrap;">${formatDate(l.created_at)} ${new Date(l.created_at).toLocaleTimeString('ar-SA')}</td>
                  <td>${BondsAdminCommon.escapeHtml(l.action)}</td>
                  <td>${BondsAdminCommon.escapeHtml(l.recovery_assets?.name) || '—'}</td>
                  <td style="color:var(--fa-muted);">${l.details ? JSON.stringify(l.details) : '—'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // Modals
  function openModal(title, bodyHtml, onSubmit) {
    const overlay = document.createElement('div');
    overlay.className = 'fa-modal-overlay';
    overlay.innerHTML = `
      <div class="fa-modal">
        <div class="fa-modal-header"><h2 class="fa-modal-title">${title}</h2><button class="fa-modal-close">&times;</button></div>
        <form id="fa-modal-form">${bodyHtml}</form>
        <div style="display:flex;justify-content:flex-end;gap:0.75rem;margin-top:1.5rem;">
          <button type="button" class="fa-btn fa-btn-secondary" data-close>إلغاء</button>
          <button type="submit" class="fa-btn fa-btn-primary" form="fa-modal-form">حفظ</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close], .fa-modal-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#fa-modal-form').addEventListener('submit', async e => {
      e.preventDefault();
      try {
        await onSubmit(new FormData(e.target));
        overlay.remove();
      } catch (err) {
        toast(err.message, 'error');
      }
    });
  }

  function bindCommon(root) {
    root.querySelectorAll('[data-action="new-asset"]').forEach(b => b.addEventListener('click', () => showAssetModal()));
    root.querySelectorAll('[data-action="edit-asset"]').forEach(b => b.addEventListener('click', () => showAssetModal(currentAsset)));
    root.querySelectorAll('[data-action="new-plan"]').forEach(b => b.addEventListener('click', () => showPlanModal(b.dataset.asset)));
    root.querySelectorAll('[data-action="edit-plan"]').forEach(b => b.addEventListener('click', async () => {
      const plan = await RecoveryService.getPlan(b.dataset.plan);
      showPlanModal(currentAssetId, plan);
    }));
    root.querySelectorAll('[data-action="new-reason"]').forEach(b => b.addEventListener('click', () => showReasonModal(b.dataset.asset)));
    root.querySelectorAll('[data-action="new-valuation"]').forEach(b => b.addEventListener('click', () => showValuationModal(b.dataset.asset)));
    root.querySelectorAll('[data-action="new-cost"]').forEach(b => b.addEventListener('click', () => showCostModal(b.dataset.asset)));
    root.querySelectorAll('[data-action="new-offer"]').forEach(b => b.addEventListener('click', () => showOfferModal(b.dataset.asset)));
    root.querySelectorAll('[data-asset]').forEach(a => a.addEventListener('click', e => {
      e.preventDefault();
      navTo('asset-detail', { assetId: a.dataset.asset });
    }));
  }

  function selectOptions(obj, selected) {
    return Object.entries(obj).map(([k, v]) => `<option value="${k}" ${selected === k ? 'selected' : ''}>${v}</option>`).join('');
  }

  function showAssetModal(asset = null) {
    openModal(asset ? 'تعديل أصل' : 'أصل جديد', `
      <input type="hidden" name="id" value="${asset?.id || ''}" />
      <div class="fa-form-grid">
        <div class="fa-form-group"><label>الاسم *</label><input name="name" required value="${BondsAdminCommon.escapeHtml(asset?.name || '')}" /></div>
        <div class="fa-form-group"><label>الكود</label><input name="asset_code" value="${BondsAdminCommon.escapeHtml(asset?.asset_code || '')}" /></div>
        <div class="fa-form-group"><label>الفئة *</label><select name="category" required>${selectOptions(RecoveryService.ASSET_CATEGORIES, asset?.category || 'real_estate')}</select></div>
        <div class="fa-form-group"><label>الحالة</label><select name="status">${selectOptions(RecoveryService.ASSET_STATUSES, asset?.status || 'identified')}</select></div>
        <div class="fa-form-group"><label>الأولوية</label><select name="priority">${selectOptions(RecoveryService.PRIORITIES, asset?.priority || 'medium')}</select></div>
        <div class="fa-form-group"><label>المالك</label><input name="owner_name" value="${BondsAdminCommon.escapeHtml(asset?.owner_name || '')}" /></div>
        <div class="fa-form-group"><label>المدينة</label><input name="city" value="${BondsAdminCommon.escapeHtml(asset?.city || '')}" /></div>
        <div class="fa-form-group"><label>رمز الدولة</label><input name="country_code" value="${BondsAdminCommon.escapeHtml(asset?.country_code || '')}" placeholder="SA" /></div>
        <div class="fa-form-group"><label>القيمة الأصلية</label><input type="number" name="original_value" value="${asset?.original_value || ''}" /></div>
        <div class="fa-form-group"><label>القيمة المتعثرة</label><input type="number" name="distressed_value" value="${asset?.distressed_value || ''}" /></div>
        <div class="fa-form-group"><label>تاريخ التعثر</label><input type="date" name="distress_date" value="${asset?.distress_date || ''}" /></div>
      </div>
      <div class="fa-form-group" style="margin-top:1rem;"><label>الوصف</label><textarea name="description">${BondsAdminCommon.escapeHtml(asset?.description || '')}</textarea></div>
    `, async fd => {
      const payload = Object.fromEntries(fd.entries());
      payload.original_value = Number(payload.original_value) || 0;
      payload.distressed_value = Number(payload.distressed_value) || 0;
      const saved = await RecoveryService.saveAsset(payload);
      invalidateAssetDetailCache(saved.id);
      invalidateAssetsListCache();
      toast('تم الحفظ');
      if (asset) { currentAsset = saved; renderAssetDetail(); }
      else { navTo('asset-detail', { assetId: saved.id }); }
    });
  }

  function showPlanModal(assetId, plan = null) {
    const stages = plan?.recovery_plan_stages || [];
    openModal(plan ? 'تعديل خطة' : 'خطة إنقاذ جديدة', `
      <input type="hidden" name="id" value="${plan?.id || ''}" />
      <input type="hidden" name="asset_id" value="${assetId}" />
      <div class="fa-form-grid">
        <div class="fa-form-group"><label>اسم الخطة *</label><input name="plan_name" required value="${BondsAdminCommon.escapeHtml(plan?.plan_name || '')}" /></div>
        <div class="fa-form-group"><label>الاستراتيجية *</label><select name="strategy" required>${selectOptions(RecoveryService.STRATEGIES, plan?.strategy || 'restructure')}</select></div>
        <div class="fa-form-group"><label>الحالة</label><select name="status">${['draft','approved','active','completed','cancelled'].map(s => `<option value="${s}" ${plan?.status === s ? 'selected' : ''}>${planStatusName(s)}</option>`).join('')}</select></div>
        <div class="fa-form-group"><label>القيمة المتوقعة للإنقاذ</label><input type="number" name="expected_recovery_value" value="${plan?.expected_recovery_value || ''}" /></div>
        <div class="fa-form-group"><label>تاريخ الإنقاذ المتوقع</label><input type="date" name="expected_recovery_date" value="${plan?.expected_recovery_date || ''}" /></div>
        <div class="fa-form-group"><label>الاحتمالية %</label><input type="number" min="0" max="100" name="probability" value="${plan?.probability || ''}" /></div>
      </div>
      <div class="fa-form-group" style="margin-top:1rem;"><label>ملخص</label><textarea name="summary">${BondsAdminCommon.escapeHtml(plan?.summary || '')}</textarea></div>
      <div style="margin-top:1rem;">
        <div style="font-weight:700;margin-bottom:0.5rem;">المراحل</div>
        <div id="plan-stages-list">
          ${stages.map((s, i) => stageRow(s, i)).join('')}
        </div>
        <button type="button" class="fa-btn fa-btn-secondary fa-btn-sm" id="add-stage" style="margin-top:0.5rem;">+ مرحلة</button>
      </div>
    `, async fd => {
      const payload = Object.fromEntries(fd.entries());
      payload.expected_recovery_value = Number(payload.expected_recovery_value) || 0;
      payload.probability = payload.probability ? Number(payload.probability) : null;
      const stageEls = document.querySelectorAll('#plan-stages-list .stage-row');
      const stagesArr = [];
      stageEls.forEach((el, i) => {
        stagesArr.push({
          id: el.querySelector('[name="stage_id"]').value || undefined,
          title: el.querySelector('[name="stage_title"]').value,
          description: el.querySelector('[name="stage_description"]').value,
          due_date: el.querySelector('[name="stage_due"]').value || null,
          status: el.querySelector('[name="stage_status"]').value,
          stage_order: i
        });
      });
      await RecoveryService.savePlan(payload, stagesArr);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحفظ');
      renderAssetDetail();
    });

    setTimeout(() => {
      const list = document.getElementById('plan-stages-list');
      document.getElementById('add-stage')?.addEventListener('click', () => {
        const idx = list.children.length;
        const div = document.createElement('div');
        div.innerHTML = stageRow({}, idx);
        list.appendChild(div.firstElementChild);
      });
      list?.addEventListener('click', e => {
        if (e.target.dataset.removeStage) e.target.closest('.stage-row').remove();
      });
    }, 0);
  }

  function stageRow(s, i) {
    return `
      <div class="stage-row fa-form-grid" style="align-items:end;margin-bottom:0.75rem;">
        <input type="hidden" name="stage_id" value="${s.id || ''}" />
        <div class="fa-form-group"><label>العنوان</label><input name="stage_title" required value="${BondsAdminCommon.escapeHtml(s.title || '')}" /></div>
        <div class="fa-form-group"><label>الوصف</label><input name="stage_description" value="${BondsAdminCommon.escapeHtml(s.description || '')}" /></div>
        <div class="fa-form-group"><label>تاريخ الاستحقاق</label><input type="date" name="stage_due" value="${s.due_date || ''}" /></div>
        <div class="fa-form-group"><label>الحالة</label><select name="stage_status">${['pending','in_progress','completed','blocked','skipped'].map(st => `<option value="${st}" ${s.status === st ? 'selected' : ''}>${stageStatusName(st)}</option>`).join('')}</select></div>
        <button type="button" class="fa-btn fa-btn-danger fa-btn-sm" data-remove-stage>حذف</button>
      </div>
    `;
  }

  function planStatusName(s) {
    return { draft: 'مسودة', approved: 'معتمدة', active: 'نشطة', completed: 'مكتملة', cancelled: 'ملغاة' }[s] || s;
  }

  function showReasonModal(assetId, reason = null) {
    openModal(reason ? 'تعديل سبب' : 'سبب تعثر جديد', `
      <input type="hidden" name="id" value="${reason?.id || ''}" />
      <input type="hidden" name="asset_id" value="${assetId}" />
      <div class="fa-form-grid">
        <div class="fa-form-group"><label>التصنيف *</label><select name="reason_category" required>${selectOptions(RecoveryService.REASON_CATEGORIES, reason?.reason_category || 'market_decline')}</select></div>
        <div class="fa-form-group"><label>الخطورة</label><select name="severity">${selectOptions(RecoveryService.PRIORITIES, reason?.severity || 'medium')}</select></div>
        <div class="fa-form-group"><label>تاريخ الاكتشاف</label><input type="date" name="discovered_at" value="${reason?.discovered_at || ''}" /></div>
      </div>
      <div class="fa-form-group" style="margin-top:1rem;"><label>الوصف *</label><textarea name="description" required>${BondsAdminCommon.escapeHtml(reason?.description || '')}</textarea></div>
    `, async fd => {
      const payload = Object.fromEntries(fd.entries());
      await RecoveryService.saveReason(payload);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحفظ');
      renderAssetDetail();
    });
  }

  function showValuationModal(assetId, val = null) {
    openModal(val ? 'تعديل تقييم' : 'تقييم جديد', `
      <input type="hidden" name="id" value="${val?.id || ''}" />
      <input type="hidden" name="asset_id" value="${assetId}" />
      <div class="fa-form-grid">
        <div class="fa-form-group"><label>تاريخ التقييم *</label><input type="date" name="valuation_date" required value="${val?.valuation_date || new Date().toISOString().slice(0, 10)}" /></div>
        <div class="fa-form-group"><label>القيمة السوقية *</label><input type="number" name="market_value" required value="${val?.market_value || ''}" /></div>
        <div class="fa-form-group"><label>قيمة البيع الإجباري</label><input type="number" name="forced_sale_value" value="${val?.forced_sale_value || ''}" /></div>
        <div class="fa-form-group"><label>قيمة الإنقاذ المتوقعة</label><input type="number" name="recovery_value" value="${val?.recovery_value || ''}" /></div>
        <div class="fa-form-group"><label>الطريقة</label><input name="method" value="${BondsAdminCommon.escapeHtml(val?.method || '')}" /></div>
        <div class="fa-form-group"><label>المقيّم</label><input name="appraiser" value="${BondsAdminCommon.escapeHtml(val?.appraiser || '')}" /></div>
      </div>
      <div class="fa-form-group" style="margin-top:1rem;"><label>ملاحظات</label><textarea name="notes">${BondsAdminCommon.escapeHtml(val?.notes || '')}</textarea></div>
    `, async fd => {
      const payload = Object.fromEntries(fd.entries());
      payload.market_value = Number(payload.market_value) || 0;
      payload.forced_sale_value = Number(payload.forced_sale_value) || null;
      payload.recovery_value = Number(payload.recovery_value) || null;
      await RecoveryService.saveValuation(payload);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحفظ');
      renderAssetDetail();
    });
  }

  function showCostModal(assetId, cost = null) {
    openModal(cost ? 'تعديل تكلفة' : 'تكلفة جديدة', `
      <input type="hidden" name="id" value="${cost?.id || ''}" />
      <input type="hidden" name="asset_id" value="${assetId}" />
      <div class="fa-form-grid">
        <div class="fa-form-group"><label>النوع *</label><select name="cost_type" required>${['legal','admin','marketing','repair','appraisal','consulting','holding','other'].map(t => `<option value="${t}" ${cost?.cost_type === t ? 'selected' : ''}>${costTypeName(t)}</option>`).join('')}</select></div>
        <div class="fa-form-group"><label>المبلغ *</label><input type="number" name="amount" required value="${cost?.amount || ''}" /></div>
        <div class="fa-form-group"><label>التاريخ *</label><input type="date" name="incurred_date" required value="${cost?.incurred_date || new Date().toISOString().slice(0, 10)}" /></div>
        <div class="fa-form-group"><label>رابط الإيصال</label><input name="receipt_url" value="${BondsAdminCommon.escapeHtml(cost?.receipt_url || '')}" /></div>
      </div>
      <div class="fa-form-group" style="margin-top:1rem;"><label>الوصف</label><textarea name="description">${BondsAdminCommon.escapeHtml(cost?.description || '')}</textarea></div>
    `, async fd => {
      const payload = Object.fromEntries(fd.entries());
      payload.amount = Number(payload.amount) || 0;
      await RecoveryService.saveCost(payload);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحفظ');
      renderAssetDetail();
    });
  }

  async function showOfferModal(assetId, offer = null) {
    currentInvestors = await RecoveryService.getInvestors();
    openModal(offer ? 'تعديل عرض' : 'عرض مستثمر جديد', `
      <input type="hidden" name="id" value="${offer?.id || ''}" />
      <input type="hidden" name="asset_id" value="${assetId}" />
      <div class="fa-form-grid">
        <div class="fa-form-group"><label>المستثمر *</label><select name="investor_id" required>
          <option value="">اختر مستثمراً</option>
          ${currentInvestors.map(i => `<option value="${i.id}" ${offer?.investor_id === i.id ? 'selected' : ''}>${i.name}</option>`).join('')}
        </select></div>
        <div class="fa-form-group"><label>نوع العرض</label><select name="offer_type">${['purchase','partnership','refinance','lease'].map(t => `<option value="${t}" ${offer?.offer_type === t ? 'selected' : ''}>${offerTypeName(t)}</option>`).join('')}</select></div>
        <div class="fa-form-group"><label>القيمة *</label><input type="number" name="offer_value" required value="${offer?.offer_value || ''}" /></div>
        <div class="fa-form-group"><label>الحالة</label><select name="status">${['received','under_review','accepted','rejected','negotiating'].map(s => `<option value="${s}" ${offer?.status === s ? 'selected' : ''}>${{received:'مستلم',under_review:'قيد المراجعة',accepted:'مقبول',rejected:'مرفوض',negotiating:'تفاوض'}[s]}</option>`).join('')}</select></div>
        <div class="fa-form-group"><label>تاريخ التقديم</label><input type="date" name="submitted_at" value="${offer?.submitted_at || new Date().toISOString().slice(0, 10)}" /></div>
      </div>
      <div class="fa-form-group" style="margin-top:1rem;"><label>ملاحظات</label><textarea name="notes">${BondsAdminCommon.escapeHtml(offer?.notes || '')}</textarea></div>
      <div style="margin-top:0.75rem;"><a href="#" id="new-investor-link" style="color:var(--fa-gold);font-size:0.9rem;">+ مستثمر جديد</a></div>
    `, async fd => {
      const payload = Object.fromEntries(fd.entries());
      payload.offer_value = Number(payload.offer_value) || 0;
      await RecoveryService.saveOffer(payload);
      invalidateAssetDetailCache(currentAssetId);
      toast('تم الحفظ');
      renderAssetDetail();
    });
    setTimeout(() => {
      document.getElementById('new-investor-link')?.addEventListener('click', e => {
        e.preventDefault();
        showInvestorModal();
      });
    }, 0);
  }

  function showInvestorModal(inv = null) {
    openModal(inv ? 'تعديل مستثمر' : 'مستثمر جديد', `
      <input type="hidden" name="id" value="${inv?.id || ''}" />
      <div class="fa-form-grid">
        <div class="fa-form-group"><label>الاسم *</label><input name="name" required value="${BondsAdminCommon.escapeHtml(inv?.name || '')}" /></div>
        <div class="fa-form-group"><label>النوع *</label><select name="type" required>${['individual','company','fund','bank','government','other'].map(t => `<option value="${t}" ${inv?.type === t ? 'selected' : ''}>${{individual:'فرد',company:'شركة',fund:'صندوق',bank:'بنك',government:'حكومة',other:'أخرى'}[t]}</option>`).join('')}</select></div>
        <div class="fa-form-group"><label>اسم جهة الاتصال</label><input name="contact_name" value="${BondsAdminCommon.escapeHtml(inv?.contact_name || '')}" /></div>
        <div class="fa-form-group"><label>البريد</label><input type="email" name="email" value="${BondsAdminCommon.escapeHtml(inv?.email || '')}" /></div>
        <div class="fa-form-group"><label>الهاتف</label><input name="phone" value="${BondsAdminCommon.escapeHtml(inv?.phone || '')}" /></div>
        <div class="fa-form-group"><label>رمز الدولة</label><input name="country_code" value="${BondsAdminCommon.escapeHtml(inv?.country_code || '')}" placeholder="SA" /></div>
      </div>
      <div class="fa-form-group" style="margin-top:1rem;"><label>ملاحظات</label><textarea name="notes">${BondsAdminCommon.escapeHtml(inv?.notes || '')}</textarea></div>
    `, async fd => {
      const payload = Object.fromEntries(fd.entries());
      await RecoveryService.saveInvestor(payload);
      toast('تم الحفظ');
    });
  }



  window.RecoveryApp = { runDistressedAi };

  window.addEventListener('DOMContentLoaded', init);
})();
