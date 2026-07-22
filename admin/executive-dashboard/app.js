/**
 * Executive Dashboard App
 */
(function (root) {
  'use strict';

  const VIEWS = { OVERVIEW: 'overview', REVENUE: 'revenue', PROJECTS: 'projects' };
  const LS_MARGIN = 'bonds_exec_margin';
  const LS_FIXED = 'bonds_exec_fixed_costs';

  const state = {
    view: VIEWS.OVERVIEW,
    stats: null,
    role: null,
    user: null,
    settings: { margin: 0.65, fixedCosts: 0 },
    charts: {},
    realtime: false,
    refreshTimer: null
  };

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.from(document.querySelectorAll(sel)); }
  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function fmtMoney(n) {
    if (n === undefined || n === null) return '—';
    return Number(n).toLocaleString('ar-SA') + ' ر.س';
  }

  function fmtDate(d) {
    return d ? new Date(d).toLocaleDateString('ar-SA') : '—';
  }

  function fmtDateTime(d) {
    return d ? new Date(d).toLocaleString('ar-SA') : '—';
  }

  function loadSettings() {
    try {
      const m = parseFloat(localStorage.getItem(LS_MARGIN));
      const f = parseFloat(localStorage.getItem(LS_FIXED));
      if (!isNaN(m) && m >= 0 && m <= 1) state.settings.margin = m;
      if (!isNaN(f) && f >= 0) state.settings.fixedCosts = f;
    } catch (e) {}
  }

  function persistSettings() {
    try {
      localStorage.setItem(LS_MARGIN, state.settings.margin);
      localStorage.setItem(LS_FIXED, state.settings.fixedCosts);
    } catch (e) {}
  }

  function calcProfit(revenue) {
    return revenue * state.settings.margin - state.settings.fixedCosts;
  }

  function calcMonthlyProfit(monthRevenue) {
    return monthRevenue * state.settings.margin - (state.settings.fixedCosts / 12);
  }

  function calcCashFlow(monthRevenue) {
    return monthRevenue - (state.settings.fixedCosts / 12);
  }

  function toast(message, type) {
    type = type || 'info';
    const div = el('div', '', message);
    div.style.cssText = 'position:fixed;top:1rem;left:1rem;z-index:9999;padding:0.75rem 1.25rem;border-radius:10px;font-weight:700;box-shadow:0 8px 24px rgba(0,0,0,0.3);';
    const colors = {
      success: 'background:rgba(34,197,94,0.15);color:#22c55e;border:1px solid rgba(34,197,94,0.3);',
      error: 'background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);',
      info: 'background:rgba(59,130,246,0.15);color:#3b82f6;border:1px solid rgba(59,130,246,0.3);'
    };
    div.style.cssText += colors[type];
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 3500);
  }

  async function guard() {
    try {
      const { role, user } = await ExecutiveService.ensureAccess();
      state.role = role;
      state.user = user;
      $('#ex-user').textContent = `${user.email} (${role === 'owner' ? 'مالك' : role === 'admin' ? 'مدير' : 'مشرف'})`;
      return true;
    } catch (err) {
      $('#ex-content').innerHTML = `
        <div class="ecc-empty">
          <div style="font-size:3rem;margin-bottom:1rem;">🚫</div>
          <h2>لا توجد صلاحية وصول</h2>
          <p>${err.message}</p>
          <a href="/calculators/auth/index.html" class="ecc-btn ecc-btn--primary" style="margin-top:1rem;">تسجيل الدخول</a>
        </div>`;
      return false;
    }
  }

  function setActiveNav(view) {
    $$('.ex-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
  }

  async function showView(view) {
    if (!(await guard())) return;
    state.view = view;
    setActiveNav(view);
    $('#ex-content').innerHTML = '<div class="ecc-empty"><div class="loading__spinner"></div><p>جارِ تحميل المؤشرات...</p></div>';
    try {
      if (!state.stats) state.stats = await ExecutiveService.getStats();
      updateLastUpdate();
      switch (view) {
        case VIEWS.OVERVIEW: renderOverview(); break;
        case VIEWS.REVENUE: renderRevenue(); break;
        case VIEWS.PROJECTS: renderProjects(); break;
        default: renderOverview();
      }
    } catch (err) {
      console.error(err);
      $('#ex-content').innerHTML = `<div class="ecc-empty">❌ حدث خطأ: ${err.message}</div>`;
    }
  }

  function updateLastUpdate() {
    $('#ex-last-update').textContent = 'آخر تحديث: ' + fmtDateTime(new Date());
  }

  function renderErrors() {
    if (!state.stats?.errors?.length) return '';
    return `
      <div class="ecc-alert ecc-alert--warning">
        <strong>⚠️ بعض البيانات غير متوفرة:</strong>
        <ul>${state.stats.errors.map(e => `<li><strong>${e.key}:</strong> ${e.message}</li>`).join('')}</ul>
      </div>
    `;
  }

  function kpiCard(icon, label, value, sub) {
    return `
      <div class="ecc-metric">
        <div style="font-size:1.5rem;margin-bottom:0.25rem;">${icon}</div>
        <div class="ecc-metric__value">${value}</div>
        <div class="ecc-metric__label">${label}</div>
        ${sub ? `<div class="ecc-metric__status">${sub}</div>` : ''}
      </div>
    `;
  }

  function destroyCharts() {
    Object.values(state.charts).forEach(c => { try { c.destroy(); } catch (e) {} });
    state.charts = {};
  }

  function chartConfig(type, labels, datasets, options = {}) {
    return {
      type,
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#e8ecf4', font: { family: 'Vazirmatn' } } }
        },
        scales: type !== 'doughnut' ? {
          x: { ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } }, grid: { color: 'rgba(197,160,40,0.05)' } },
          y: { ticks: { color: '#94a3b8', font: { family: 'Vazirmatn' } }, grid: { color: 'rgba(197,160,40,0.05)' } }
        } : {},
        ...options
      }
    };
  }

  function renderOverview() {
    destroyCharts();
    const s = state.stats;
    const totalProfit = calcProfit(s.totalRevenue);
    const netCashFlow = calcCashFlow(s.mrr);

    $('#ex-content').innerHTML = `
      ${renderErrors()}
      <div class="ecc-grid-auto">
        ${kpiCard('💰', 'إجمالي الإيرادات', fmtMoney(s.totalRevenue), 'اشتراكات نشطة')}
        ${kpiCard('📈', 'صافي الربح المقدر', fmtMoney(totalProfit), `هامش ${Math.round(state.settings.margin * 100)}%`)}
        ${kpiCard('💵', 'التدفق النقدي الصافي المقدر', fmtMoney(netCashFlow), 'شهرياً')}
        ${kpiCard('📁', 'المشاريع النشطة', s.activeProjectsCount.toLocaleString('ar-SA'), fmtMoney(s.activeProjectsValue))}
        ${kpiCard('⚠️', 'المشاريع المتعثرة', s.distressedProjectsCount.toLocaleString('ar-SA'), 'معلق / ملغى')}
        ${kpiCard('🎯', 'الفرص الاستثمارية', s.investmentOpportunitiesCount.toLocaleString('ar-SA'), fmtMoney(s.totalOpportunityValue))}
        ${kpiCard('👥', 'العملاء', (s.totalAdvisoryClients + s.totalProfiles).toLocaleString('ar-SA'), `${s.totalProfiles} مستخدم + ${s.totalAdvisoryClients} عميل استشاري`)}
      </div>

      <div class="ecc-grid-2">
        <div class="ecc-card">
          <div class="ecc-card__title">📊 الإيرادات والأرباح (12 شهر)</div>
          <div class="ecc-chart"><canvas id="ex-revenue-chart"></canvas></div>
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title">📈 نمو العملاء (12 شهر)</div>
          <div class="ecc-chart"><canvas id="ex-clients-chart"></canvas></div>
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title">📁 حالات المشاريع الاستشارية</div>
          <div class="ecc-chart ecc-chart--sm"><canvas id="ex-projects-chart"></canvas></div>
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title">💵 التدفق النقدي الصافي المقدر (12 شهر)</div>
          <div class="ecc-chart"><canvas id="ex-cashflow-chart"></canvas></div>
        </div>
      </div>

      <div class="ecc-grid-2">
        <div class="ecc-card">
          <div class="ecc-card__title">🎯 أبرز الفرص الاستثمارية</div>
          ${renderOpportunitiesTable(s.topOpportunities)}
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title">🕘 آخر الاشتراكات</div>
          ${renderSubscriptionsTable(s.recentSubscriptions)}
        </div>
      </div>
    `;

    drawRevenueChart('ex-revenue-chart');
    drawClientsChart('ex-clients-chart');
    drawProjectsChart('ex-projects-chart');
    drawCashFlowChart('ex-cashflow-chart');
  }

  function renderRevenue() {
    destroyCharts();
    const s = state.stats;
    const monthlyProfit = s.revenueByMonth.map(calcMonthlyProfit);
    const totalProfit = calcProfit(s.totalRevenue);
    const annualRevenue = s.revenueByMonth.reduce((a, b) => a + b, 0);
    const annualProfit = monthlyProfit.reduce((a, b) => a + b, 0);

    $('#ex-content').innerHTML = `
      ${renderErrors()}
      <div class="ecc-grid-auto">
        ${kpiCard('💰', 'إجمالي الإيرادات المتكررة (MRR)', fmtMoney(s.mrr), 'شهرياً')}
        ${kpiCard('📅', 'إجمالي الإيرادات السنوية', fmtMoney(annualRevenue), '12 شهر')}
        ${kpiCard('📈', 'صافي الربح السنوي المقدر', fmtMoney(annualProfit), `هامش ${Math.round(state.settings.margin * 100)}%`)}
        ${kpiCard('💵', 'التدفق النقدي الصافي الشهري', fmtMoney(calcCashFlow(s.mrr)), 'بعد التكاليف')}
      </div>
      <div class="ecc-card">
        <div class="ecc-card__title">📊 تفصيل الإيرادات والأرباح شهراً بشهر</div>
        <div class="ecc-chart ecc-chart--tall"><canvas id="ex-revenue-detail-chart"></canvas></div>
      </div>
      <div class="ecc-card">
        <div class="ecc-card__title">🕘 آخر الاشتراكات</div>
        ${renderSubscriptionsTable(s.recentSubscriptions)}
      </div>
    `;

    const ctx = document.getElementById('ex-revenue-detail-chart').getContext('2d');
    state.charts.revenueDetail = new Chart(ctx, chartConfig('bar', s.monthLabels, [
      { label: 'الإيرادات', data: s.revenueByMonth, backgroundColor: 'rgba(212,168,83,0.7)', borderColor: '#d4a853', borderWidth: 1 },
      { label: 'الربح المقدر', data: monthlyProfit, backgroundColor: 'rgba(34,197,94,0.7)', borderColor: '#22c55e', borderWidth: 1 }
    ]));
  }

  function renderProjects() {
    destroyCharts();
    const s = state.stats;
    $('#ex-content').innerHTML = `
      ${renderErrors()}
      <div class="ecc-grid-auto">
        ${kpiCard('📁', 'إجمالي المشاريع', s.projectCounts.total.toLocaleString('ar-SA'), '')}
        ${kpiCard('✅', 'المشاريع النشطة', s.projectCounts.active.toLocaleString('ar-SA'), fmtMoney(s.activeProjectsValue))}
        ${kpiCard('⚠️', 'المشاريع المتعثرة', s.distressedProjectsCount.toLocaleString('ar-SA'), 'معلق / ملغى')}
        ${kpiCard('🎯', 'فرص الإنقاذ المتاحة', s.investmentOpportunitiesCount.toLocaleString('ar-SA'), fmtMoney(s.totalOpportunityValue))}
      </div>
      <div class="ecc-grid-2">
        <div class="ecc-card">
          <div class="ecc-card__title">📁 توزيع حالات المشاريع</div>
          <div class="ecc-chart ecc-chart--sm"><canvas id="ex-projects-detail-chart"></canvas></div>
        </div>
        <div class="ecc-card">
          <div class="ecc-card__title">🎯 توزيع فرص الإنقاذ حسب القيمة</div>
          <div class="ecc-chart ecc-chart--sm"><canvas id="ex-opportunities-chart"></canvas></div>
        </div>
      </div>
      <div class="ecc-card">
        <div class="ecc-card__title">📁 أحدث المشاريع الاستشارية</div>
        ${renderProjectsTable(s.recentProjects)}
      </div>
      <div class="ecc-card">
        <div class="ecc-card__title">🎯 أبرز فرص الإنقاذ</div>
        ${renderOpportunitiesTable(s.topOpportunities)}
      </div>
    `;

    drawProjectsChart('ex-projects-detail-chart');
    drawOpportunitiesChart('ex-opportunities-chart');
  }

  function drawRevenueChart(canvasId) {
    const s = state.stats;
    const profitData = s.revenueByMonth.map(calcMonthlyProfit);
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.revenue = new Chart(ctx, chartConfig('line', s.monthLabels, [
      { label: 'الإيرادات', data: s.revenueByMonth, borderColor: '#d4a853', backgroundColor: 'rgba(212,168,83,0.1)', fill: true, tension: 0.4 },
      { label: 'الربح المقدر', data: profitData, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.05)', fill: true, tension: 0.4 }
    ]));
  }

  function drawClientsChart(canvasId) {
    const s = state.stats;
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.clients = new Chart(ctx, chartConfig('line', s.monthLabels, [
      { label: 'المستخدمون الجدد', data: s.clientsByMonth, borderColor: '#3b82f6', backgroundColor: 'rgba(59,130,246,0.1)', fill: true, tension: 0.4 }
    ]));
  }

  function drawProjectsChart(canvasId) {
    const p = state.stats.projectCounts;
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.projects = new Chart(ctx, chartConfig('doughnut', ['محتمل','نشط','معلق','مكتمل','ملغى'], [
      { data: [p.lead, p.active, p.on_hold, p.completed, p.cancelled], backgroundColor: ['#94a3b8','#22c55e','#f59e0b','#3b82f6','#ef4444'] }
    ], { plugins: { legend: { position: 'right' } } }));
  }

  function drawCashFlowChart(canvasId) {
    const s = state.stats;
    const cashFlowData = s.revenueByMonth.map(calcCashFlow);
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.cashflow = new Chart(ctx, chartConfig('bar', s.monthLabels, [
      { label: 'التدفق الصافي', data: cashFlowData, backgroundColor: cashFlowData.map(v => v >= 0 ? 'rgba(34,197,94,0.7)' : 'rgba(239,68,68,0.7)') }
    ]));
  }

  function drawOpportunitiesChart(canvasId) {
    const s = state.stats;
    const labels = s.topOpportunities.slice(0, 5).map(a => a.name || 'فرصة');
    const data = s.topOpportunities.slice(0, 5).map(a => Number(a.distressed_value) || 0);
    const ctx = document.getElementById(canvasId).getContext('2d');
    state.charts.opportunities = new Chart(ctx, chartConfig('pie', labels, [
      { data, backgroundColor: ['#d4a853','#3b82f6','#22c55e','#f59e0b','#ef4444'] }
    ], { plugins: { legend: { position: 'right' } } }));
  }

  function renderSubscriptionsTable(rows) {
    if (!rows.length) return '<div class="ecc-empty">لا توجد اشتراكات</div>';
    return `
      <div class="ecc-table-wrap">
        <table class="ecc-table">
          <thead><tr><th>الباقة</th><th>الحالة</th><th>القيمة</th><th>التاريخ</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${r.tier === 'enterprise' ? 'Enterprise' : r.tier === 'pro' ? 'Pro' : r.tier || '—'}</td>
                <td><span class="status-badge ${r.status === 'active' ? 'status-badge--healthy' : r.status === 'canceled' ? 'status-badge--at-risk' : 'status-badge--neutral'}">${r.status === 'active' ? 'نشط' : r.status === 'canceled' ? 'ملغى' : r.status}</span></td>
                <td>${fmtMoney(ExecutiveService.TIER_PRICE[r.tier] || 0)}</td>
                <td>${fmtDate(r.created_at)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderProjectsTable(rows) {
    if (!rows.length) return '<div class="ecc-empty">لا توجد مشاريع</div>';
    const statusLabels = { lead: 'محتمل', active: 'نشط', on_hold: 'معلق', completed: 'مكتمل', cancelled: 'ملغى' };
    const statusClasses = { lead: 'status-badge--neutral', active: 'status-badge--healthy', on_hold: 'status-badge--attention', completed: 'status-badge--healthy', cancelled: 'status-badge--at-risk' };
    return `
      <div class="ecc-table-wrap">
        <table class="ecc-table">
          <thead><tr><th>المشروع</th><th>العميل</th><th>الحالة</th><th>الميزانية</th><th>تاريخ البدء</th></tr></thead>
          <tbody>
            ${rows.map(p => `
              <tr>
                <td>${p.name || '—'}</td>
                <td>${p.advisory_clients?.name || '—'}</td>
                <td><span class="status-badge ${statusClasses[p.status] || 'status-badge--neutral'}">${statusLabels[p.status] || p.status}</span></td>
                <td>${fmtMoney(p.budget)}</td>
                <td>${fmtDate(p.start_date)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderOpportunitiesTable(rows) {
    if (!rows.length) return '<div class="ecc-empty">لا توجد فرص</div>';
    const catLabels = { real_estate: 'عقار', equipment: 'معدات', vehicle: 'مركبة', inventory: 'مخزون', receivable: 'ذمم مدينة', investment: 'استثمار', other: 'أخرى' };
    return `
      <div class="ecc-table-wrap">
        <table class="ecc-table">
          <thead><tr><th>الأصل</th><th>الفئة</th><th>القيمة الأصلية</th><th>القيمة المتعثرة</th></tr></thead>
          <tbody>
            ${rows.map(a => `
              <tr>
                <td>${a.name || '—'}</td>
                <td>${catLabels[a.category] || a.category || '—'}</td>
                <td>${fmtMoney(a.original_value)}</td>
                <td>${fmtMoney(a.distressed_value)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  async function refresh() {
    state.stats = null;
    destroyCharts();
    await showView(state.view);
    toast('تم تحديث المؤشرات', 'success');
  }

  function openSettings() {
    closeModal();
    const overlay = el('div', 'ex-modal-overlay');
    overlay.id = 'ex-modal';
    overlay.innerHTML = `
      <div class="ex-modal">
        <div class="ex-modal-header">
          <h2>إعدادات لوحة المؤشرات</h2>
          <button class="ex-close" onclick="ExecutiveApp.closeModal()">&times;</button>
        </div>
        <form id="ex-settings-form" onsubmit="ExecutiveApp.saveSettings(event)">
          <div class="ex-form-group">
            <label>نسبة صافي الربح المقدرة (%)</label>
            <input class="ex-input" type="number" name="margin" min="0" max="100" step="1" value="${Math.round(state.settings.margin * 100)}" required />
            <small>تُستخدم لحساب الأرباح والتدفقات النقدية من الإيرادات.</small>
          </div>
          <div class="ex-form-group">
            <label>التكاليف الثابتة الشهرية (ر.س)</label>
            <input class="ex-input" type="number" name="fixedCosts" min="0" step="1" value="${state.settings.fixedCosts}" required />
            <small>تُخصم من الإيرادات الشهرية لحساب الربح والتدفق النقدي.</small>
          </div>
          <div class="ex-modal-actions">
            <button type="button" class="ecc-btn ecc-btn--ghost" onclick="ExecutiveApp.closeModal()">إلغاء</button>
            <button type="submit" class="ecc-btn ecc-btn--primary">حفظ</button>
          </div>
        </form>
      </div>
    `;
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
    document.body.appendChild(overlay);
  }

  function saveSettings(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    state.settings.margin = Math.max(0, Math.min(100, parseFloat(fd.get('margin')) || 0)) / 100;
    state.settings.fixedCosts = Math.max(0, parseFloat(fd.get('fixedCosts')) || 0);
    persistSettings();
    closeModal();
    refresh();
  }

  function closeModal() {
    const m = $('#ex-modal');
    if (m) m.remove();
  }

  function initRealtime() {
    try {
      const sb = (typeof getSupabase === 'function') ? getSupabase() : window.supabaseClient;
      if (!sb || !sb.channel) return;
      const channel = sb.channel('executive-dashboard')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions' }, () => debouncedRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => debouncedRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'advisory_projects' }, () => debouncedRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'advisory_clients' }, () => debouncedRefresh())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'recovery_assets' }, () => debouncedRefresh())
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            state.realtime = true;
            $('#ex-live').classList.add('active');
          }
        });
    } catch (e) {
      console.warn('[ExecutiveApp] realtime init failed:', e.message);
    }
  }

  let debounceTimer = null;
  function debouncedRefresh() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      state.stats = null;
      showView(state.view);
    }, 800);
  }

  function initPolling() {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    state.refreshTimer = setInterval(() => {
      state.stats = null;
      showView(state.view);
    }, 60000);
  }

  window.addEventListener('beforeunload', () => {
    if (state.refreshTimer) clearInterval(state.refreshTimer);
    if (debounceTimer) clearTimeout(debounceTimer);
  });

  function init() {
    loadSettings();
    const exNav = document.querySelector('.ex-nav');
    if (exNav) {
      exNav.addEventListener('click', e => {
        const a = e.target.closest('.ex-nav a');
        if (!a) return;
        e.preventDefault();
        const view = a.dataset.view;
        if (view) showView(view);
      });
    }
    // Refresh when parent dashboard sends session token.
    window.addEventListener('admin-session-ready', () => {
      state.role = null;
      showView(VIEWS.OVERVIEW);
    });
    // When loaded inside the unified admin iframe, wait for the parent token
    // bridge before hitting Supabase auth (avoids iframe storage issues).
    const inIframe = window.parent !== window;
    const hasBridge = !!window.__ADMIN_TOKEN || !!window.__ADMIN_SESSION;
    if (inIframe && !hasBridge) {
      let started = false;
      const start = () => {
        if (started) return;
        started = true;
        showView(VIEWS.OVERVIEW);
        initRealtime();
        initPolling();
      };
      window.addEventListener('admin-token-ready', start, { once: true });
      window.addEventListener('admin-session-ready', start, { once: true });
      setTimeout(start, 2500);
    } else {
      showView(VIEWS.OVERVIEW);
      initRealtime();
      initPolling();
    }
  }

  root.ExecutiveApp = {
    init, showView, refresh, openSettings, saveSettings, closeModal
  };
})(window);

document.addEventListener('DOMContentLoaded', window.ExecutiveApp.init);
