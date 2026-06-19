/**
 * AI Business Advisor — App UI
 */
(function (root) {
  'use strict';

  const STORAGE_KEY = 'bonds_ai_advisor_settings';
  const SERVICE = root.AiAdvisorService;
  const ENGINE = root.AiAnalysisEngine;

  let _settings = { margin: 0.65, fixedCosts: 0 };
  let _metrics = null;
  let _analyzed = null;
  let _currentView = 'overview';
  let _charts = {};

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) _settings = { ..._settings, ...JSON.parse(raw) };
    } catch (e) { /* ignore */ }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
  }

  function formatCurrency(n) {
    return Math.round(Number(n) || 0).toLocaleString('ar-SA') + ' ر.س';
  }

  function setContent(html) {
    const el = document.getElementById('ai-content');
    if (!el) return;
    el.innerHTML = html;
  }

  function setLoading(msg) {
    setContent('<div class="ai-empty"><div class="ai-spinner"></div><p>' + (msg || 'جارِ التحميل...') + '</p></div>');
  }

  function setUserText(text) {
    const el = document.getElementById('ai-user');
    if (el) el.textContent = text || '';
  }

  function showNoAccess(msg) {
    setContent('<div class="ai-no-access"><h2>⛔ لا توجد صلاحية</h2><p>' + (msg || 'لا تملك صلاحية الوصول إلى مستشار الأعمال الذكي.') + '</p><a href="/admin/dashboard.html" class="ai-btn ai-btn-primary">العودة إلى لوحة الإدارة</a></div>');
  }

  function destroyChart(key) {
    if (_charts[key]) {
      _charts[key].destroy();
      delete _charts[key];
    }
  }

  function createLineChart(canvasId, labels, datasets) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);
    _charts[canvasId] = new root.Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: '#e8ecf4' } } },
        scales: {
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        }
      }
    });
  }

  function createDoughnutChart(canvasId, labels, data, colors) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);
    _charts[canvasId] = new root.Chart(ctx, {
      type: 'doughnut',
      data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'right', labels: { color: '#e8ecf4' } } }
      }
    });
  }

  function createBarChart(canvasId, labels, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;
    destroyChart(canvasId);
    _charts[canvasId] = new root.Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'القيمة', data, backgroundColor: '#d4a853', borderRadius: 6 }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          x: { ticks: { color: '#94a3b8' }, grid: { display: false } }
        }
      }
    });
  }

  function analyze() {
    if (!_metrics) return null;
    const stats = { ..._metrics.stats, settings: _settings };
    const financial = ENGINE.analyzeFinancials(stats, _settings);
    const opportunities = ENGINE.analyzeOpportunities(_metrics.assets);
    const risks = ENGINE.assessRisks(stats, _metrics.projects, _metrics.assets);
    const financing = ENGINE.suggestFinancing(opportunities, risks, stats);
    const distressed = ENGINE.analyzeDistressed(_metrics.projects, _metrics.assets);
    _analyzed = { stats, financial, opportunities, risks, financing, distressed, raw: _metrics };
    return _analyzed;
  }

  function kpiCards(a) {
    const riskColor = a.risks.riskLevel === 'high' ? 'ai-negative' : a.risks.riskLevel === 'medium' ? 'ai-neutral' : 'ai-positive';
    return `
      <div class="ai-grid">
        <div class="ai-card"><h3>صحة الأعمال</h3><div class="ai-value">${a.financial.healthScore}/100</div><div class="ai-delta ${a.financial.healthScore >= 70 ? 'ai-positive' : a.financial.healthScore >= 45 ? 'ai-neutral' : 'ai-negative'}">${a.financial.healthLabel}</div></div>
        <div class="ai-card"><h3>إجمالي الإيرادات (12 شهر)</h3><div class="ai-value">${formatCurrency(a.stats.totalRevenue)}</div><div class="ai-delta ${a.financial.revenueTrend === 'up' ? 'ai-positive' : a.financial.revenueTrend === 'down' ? 'ai-negative' : 'ai-neutral'}">${a.financial.revenueTrend === 'up' ? '↑ صاعد' : a.financial.revenueTrend === 'down' ? '↓ هابط' : '→ مستقر'}</div></div>
        <div class="ai-card"><h3>صافي الربح المقدر</h3><div class="ai-value">${formatCurrency(a.financial.profitEstimate)}</div><div class="ai-delta">هامش افتراضي ${Math.round((_settings.margin)*100)}%</div></div>
        <div class="ai-card"><h3>قيمة الفرص المتاحة</h3><div class="ai-value">${formatCurrency(a.stats.totalOpportunityValue)}</div><div class="ai-delta">${a.opportunities.length} فرصة</div></div>
        <div class="ai-card"><h3>المشاريع المتعثرة</h3><div class="ai-value">${a.stats.distressedProjectsCount}</div><div class="ai-delta ${a.stats.distressedProjectsCount ? 'ai-negative' : 'ai-positive'}">${a.stats.distressedProjectsCount ? 'يتطلب تدخل' : 'لا يوجد'}</div></div>
        <div class="ai-card"><h3>مستوى المخاطر</h3><div class="ai-value ${riskColor}">${a.risks.riskLevel === 'high' ? 'مرتفع' : a.risks.riskLevel === 'medium' ? 'متوسط' : 'منخفض'}</div><div class="ai-delta">${a.risks.risks.length} مخاطر</div></div>
      </div>
    `;
  }

  function insightList(a) {
    let items = [];
    a.financial.flags.forEach(f => items.push({ type: f.type, text: f.text }));
    a.risks.risks.slice(0, 3).forEach(r => items.push({ type: r.level === 'high' ? 'danger' : 'warning', text: r.text }));
    a.financing.slice(0, 2).forEach(f => items.push({ type: 'info', text: f.title + ': ' + f.desc }));
    if (!items.length) items.push({ type: 'info', text: 'الوضع العام مستقر؛ لا توجد تنبيهات حرجة.' });
    return `
      <div class="ai-card">
        <h3>💡 توصيات سريعة</h3>
        <ul class="ai-insights">
          ${items.map(i => `<li><span class="ai-badge ai-badge-${i.type === 'danger' ? 'danger' : i.type === 'warning' ? 'warning' : i.type === 'info' ? 'info' : 'success'}">${i.type === 'danger' ? 'خطر' : i.type === 'warning' ? 'تنبيه' : i.type === 'info' ? 'فرصة' : 'جيد'}</span>${escapeHtml(i.text)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function renderOverview() {
    const a = analyze();
    if (!a) return setLoading('جارِ التحليل...');
    const scoreDeg = Math.round((a.financial.healthScore / 100) * 360);
    setContent(`
      ${kpiCards(a)}
      <div class="ai-row">
        <div class="ai-chart-card">
          <h4>الإيرادات الشهرية</h4>
          <div style="height:260px"><canvas id="chart-revenue"></canvas></div>
        </div>
        <div class="ai-chart-card">
          <h4>توزيع المشاريع</h4>
          <div style="height:260px"><canvas id="chart-projects"></canvas></div>
        </div>
      </div>
      <div class="ai-row">
        <div class="ai-card ai-health">
          <div class="ai-health-ring" style="--score:${scoreDeg}deg"><span>${a.financial.healthScore}</span></div>
          <div class="ai-health-text">
            <h3>الصحة المالية: ${a.financial.healthLabel}</h3>
            <p>التدفق النقدي الشهري: <strong>${formatCurrency(a.financial.netCashFlow)}</strong><br/>
            مدى السيولة: <strong>${a.financial.runwayMonths === 999 ? 'مريح' : a.financial.runwayMonths + ' شهر'}</strong><br/>
            اتجاه العملاء: <strong>${a.financial.clientTrend === 'up' ? 'نمو' : a.financial.clientTrend === 'down' ? 'تراجع' : 'مستقر'}</strong></p>
          </div>
        </div>
        ${insightList(a)}
      </div>
      <div class="ai-chart-card">
        <h4>الأصول المتعثرة حسب الفئة</h4>
        <div style="height:260px"><canvas id="chart-assets"></canvas></div>
      </div>
    `);

    createLineChart('chart-revenue', a.stats.months.map(m => m.slice(5) + '/' + m.slice(2, 4)), [
      { label: 'الإيرادات', data: a.stats.revenueByMonth, borderColor: '#d4a853', backgroundColor: 'rgba(212,168,83,0.15)', fill: true, tension: 0.3 }
    ]);

    const p = a.stats.projectCounts;
    createDoughnutChart('chart-projects', ['نشط', 'مكتمل', 'معلق', 'ملغى', 'آخر'],
      [p.active, p.completed, p.on_hold, p.cancelled, p.other],
      ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c', '#94a3b8']);

    const cats = {};
    a.raw.assets.forEach(asset => { cats[asset.category || 'أخرى'] = (cats[asset.category || 'أخرى'] || 0) + (Number(asset.original_value) || 0); });
    createBarChart('chart-assets', Object.keys(cats), Object.values(cats));
  }

  function renderFinancial() {
    const a = analyze();
    if (!a) return setLoading('جارِ التحليل...');
    const profitSeries = a.stats.revenueByMonth.map(r => r * _settings.margin - (_settings.fixedCosts / 12));
    const cashSeries = a.stats.revenueByMonth.map(r => r * _settings.margin - (_settings.fixedCosts / 12));
    setContent(`
      <h2 class="ai-section-title">الإعدادات المالية</h2>
      <div class="ai-form-inline">
        <div class="ai-form-group">
          <label for="ai-margin">هامش الربح الإجمالي (%)</label>
          <input type="number" id="ai-margin" step="1" min="0" max="100" value="${Math.round(_settings.margin*100)}" />
        </div>
        <div class="ai-form-group">
          <label for="ai-fixed">التكاليف الثابتة السنوية (ر.س)</label>
          <input type="number" id="ai-fixed" step="1000" min="0" value="${_settings.fixedCosts}" />
        </div>
        <button class="ai-btn ai-btn-primary" onclick="AiAdvisorApp.applySettings()">تطبيق</button>
      </div>
      ${kpiCards(a)}
      <div class="ai-row">
        <div class="ai-chart-card"><h4>الإيرادات مقابل الربح المقدر</h4><div style="height:260px"><canvas id="chart-profit"></canvas></div></div>
        <div class="ai-chart-card"><h4>التدفق النقدي الشهري</h4><div style="height:260px"><canvas id="chart-cash"></canvas></div></div>
      </div>
      ${a.financial.flags.length ? `<div class="ai-card"><h3>⚠️ تنبيهات مالية</h3><ul class="ai-insights">${a.financial.flags.map(f => `<li><span class="ai-badge ai-badge-${f.type === 'danger' ? 'danger' : 'warning'}">${f.type === 'danger' ? 'خطير' : 'تنبيه'}</span>${escapeHtml(f.text)}</li>`).join('')}</ul></div>` : ''}
    `);

    createLineChart('chart-profit', a.stats.months.map(m => m.slice(5) + '/' + m.slice(2, 4)), [
      { label: 'الإيرادات', data: a.stats.revenueByMonth, borderColor: '#d4a853', tension: 0.3 },
      { label: 'الربح المقدر', data: profitSeries, borderColor: '#2ecc71', tension: 0.3 }
    ]);
    createBarChart('chart-cash', a.stats.months.map(m => m.slice(5) + '/' + m.slice(2, 4)), cashSeries);
  }

  function renderOpportunities() {
    const a = analyze();
    if (!a) return setLoading('جارِ التحليل...');
    const rows = a.opportunities.map(o => `
      <tr>
        <td><strong>${escapeHtml(o.name)}</strong></td>
        <td>${escapeHtml(o.category || '—')}</td>
        <td>${formatCurrency(o.original_value)}</td>
        <td>${formatCurrency(o.distressed_value)}</td>
        <td class="ai-positive">${formatCurrency(o.upside)}</td>
        <td><span class="ai-badge ${o.score >= 70 ? 'ai-badge-success' : o.score >= 45 ? 'ai-badge-warning' : 'ai-badge-danger'}">${o.score}/100</span></td>
        <td>${escapeHtml(o.recommendation)}</td>
      </tr>
    `).join('');
    setContent(`
      <h2 class="ai-section-title">الفرص الاستثمارية الموصى بها</h2>
      <div class="ai-table-wrap">
        <table class="ai-table">
          <thead>
            <tr><th>الأصل/الفرصة</th><th>الفئة</th><th>القيمة الأصلية</th><th>القيمة المتعثرة</th><th>هامش الربح</th><th>الدرجة</th><th>التوصية</th></tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `);
  }

  function renderRisks() {
    const a = analyze();
    if (!a) return setLoading('جارِ التحليل...');
    const items = a.risks.risks.map(r => `
      <div class="ai-risk-item ${r.level}">
        <h4>${escapeHtml(r.title)} <span class="ai-badge ai-badge-${r.level === 'high' ? 'danger' : r.level === 'medium' ? 'warning' : 'success'}">${r.level === 'high' ? 'مرتفع' : r.level === 'medium' ? 'متوسط' : 'منخفض'}</span></h4>
        <p>${escapeHtml(r.text)}</p>
      </div>
    `).join('');
    setContent(`
      <h2 class="ai-section-title">تقييم المخاطر</h2>
      <div class="ai-card"><h3>المستوى العام للمخاطر</h3><div class="ai-value ${a.risks.riskLevel === 'high' ? 'ai-negative' : a.risks.riskLevel === 'medium' ? 'ai-neutral' : 'ai-positive'}">${a.risks.riskLevel === 'high' ? 'مرتفع' : a.risks.riskLevel === 'medium' ? 'متوسط' : 'منخفض'}</div></div>
      <div class="ai-risk-list">${items || '<p class="ai-empty">لا توجد مخاطر مسجلة حالياً.</p>'}</div>
    `);
  }

  function renderFinancing() {
    const a = analyze();
    if (!a) return setLoading('جارِ التحليل...');
    const items = a.financing.map(f => `
      <div class="ai-financing-item">
        <h4>${escapeHtml(f.title)} <span class="ai-tag">أولوية ${f.urgency}</span></h4>
        <small>${escapeHtml(f.type)}</small>
        <p>${escapeHtml(f.desc)}</p>
        <em>التأثير: ${escapeHtml(f.impact)}</em>
      </div>
    `).join('');
    setContent(`
      <h2 class="ai-section-title">الحلول التمويلية المقترحة</h2>
      <div class="ai-financing-list">${items || '<p class="ai-empty">لا توجد حلول تمويلية مقترحة حالياً.</p>'}</div>
    `);
  }

  function renderDistressed() {
    const a = analyze();
    if (!a) return setLoading('جارِ التحليل...');
    const assetRows = a.distressed.assets.map(x => `
      <tr>
        <td>${escapeHtml(x.name)}</td>
        <td>${escapeHtml(x.category || '—')}</td>
        <td>${escapeHtml(x.status)}</td>
        <td>${escapeHtml(x.priority || '—')}</td>
        <td><span class="ai-badge ${x.distressScore >= 70 ? 'ai-badge-danger' : x.distressScore >= 40 ? 'ai-badge-warning' : 'ai-badge-success'}">${x.distressScore}/100</span></td>
        <td>${formatCurrency(x.value)}</td>
        <td>${escapeHtml(x.action)}</td>
      </tr>
    `).join('');
    const projectRows = a.distressed.projects.map(p => `
      <tr>
        <td>${escapeHtml(p.name)}</td>
        <td>${p.status === 'cancelled' ? 'ملغى' : 'معلق'}</td>
        <td>${escapeHtml(p.client)}</td>
        <td>${formatCurrency(p.value)}</td>
        <td>${escapeHtml(p.action)}</td>
      </tr>
    `).join('');
    setContent(`
      <h2 class="ai-section-title">المشاريع والأصول المتعثرة</h2>
      <h3 class="ai-section-title">🏭 الأصول المتعثرة (${a.distressed.assets.length})</h3>
      <div class="ai-table-wrap">
        <table class="ai-table">
          <thead><tr><th>الأصل</th><th>الفئة</th><th>الحالة</th><th>الأولوية</th><th>درجة التعثر</th><th>القيمة</th><th>الإجراء المقترح</th></tr></thead>
          <tbody>${assetRows || '<tr><td colspan="7" class="ai-empty">لا توجد أصول متعثرة</td></tr>'}</tbody>
        </table>
      </div>
      <h3 class="ai-section-title">📁 المشاريع المتعثرة (${a.distressed.projects.length})</h3>
      <div class="ai-table-wrap">
        <table class="ai-table">
          <thead><tr><th>المشروع</th><th>الحالة</th><th>العميل</th><th>الميزانية</th><th>الإجراء المقترح</th></tr></thead>
          <tbody>${projectRows || '<tr><td colspan="5" class="ai-empty">لا توجد مشاريع متعثرة</td></tr>'}</tbody>
        </table>
      </div>
    `);
  }

  function reportSummary(a) {
    return {
      generated_at: new Date().toISOString(),
      health_score: a.financial.healthScore,
      health_label: a.financial.healthLabel,
      total_revenue: a.stats.totalRevenue,
      profit_estimate: a.financial.profitEstimate,
      net_cash_flow: a.financial.netCashFlow,
      risk_level: a.risks.riskLevel,
      opportunities_count: a.opportunities.length,
      total_opportunity_value: a.stats.totalOpportunityValue,
      distressed_projects_count: a.stats.distressedProjectsCount,
      distressed_assets_count: a.stats.distressedAssetsCount,
      settings: _settings
    };
  }

  async function saveCurrentReport() {
    const a = analyze();
    if (!a) return alert('لا يوجد تقرير لحفظه.');
    const title = prompt('أدخل عنوان التقرير:', 'تقرير الإدارة العليا — ' + new Date().toLocaleDateString('ar-SA'));
    if (!title) return;
    try {
      const html = ENGINE.generateManagementReport(a);
      await SERVICE.saveReport(title, html, reportSummary(a));
      alert('✅ تم حفظ التقرير بنجاح.');
      renderReports();
    } catch (e) {
      alert('❌ فشل الحفظ: ' + e.message);
    }
  }

  async function loadSavedReport(id) {
    try {
      const report = await SERVICE.getReport(id);
      setContent(`
        <div class="ai-topbar-actions" style="margin-bottom:1rem">
          <button class="ai-btn ai-btn-secondary" onclick="AiAdvisorApp.generateFullReport()">⬅️ تقرير جديد</button>
          <button class="ai-btn ai-btn-primary" onclick="window.print()">🖨️ طباعة / PDF</button>
        </div>
        <div id="ai-report-container">${report.content_html}</div>
      `);
    } catch (e) {
      alert('❌ فشل تحميل التقرير: ' + e.message);
    }
  }

  async function deleteSavedReport(id) {
    if (!confirm('هل أنت متأكد من حذف التقرير؟')) return;
    try {
      await SERVICE.deleteReport(id);
      renderReports();
    } catch (e) {
      alert('❌ فشل الحذف: ' + e.message);
    }
  }

  async function renderReports() {
    const a = analyze();
    if (!a) return setLoading('جارِ التحليل...');
    const html = ENGINE.generateManagementReport(a);
    let savedRows = '';
    try {
      const reports = await SERVICE.getReports();
      savedRows = reports.map(r => `
        <tr>
          <td><strong>${escapeHtml(r.title)}</strong></td>
          <td>${new Date(r.created_at).toLocaleString('ar-SA')}</td>
          <td>
            <button class="ai-btn ai-btn-secondary" onclick="AiAdvisorApp.loadSavedReport('${r.id}')">عرض</button>
            <button class="ai-btn" style="color:var(--ai-danger)" onclick="AiAdvisorApp.deleteSavedReport('${r.id}')">حذف</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      savedRows = `<tr><td colspan="3" class="ai-empty">تعذر تحميل التقارير المحفوظة: ${escapeHtml(e.message)}</td></tr>`;
    }
    setContent(`
      <div class="ai-topbar-actions" style="margin-bottom:1rem">
        <button class="ai-btn ai-btn-primary" onclick="AiAdvisorApp.saveCurrentReport()">💾 حفظ التقرير</button>
        <button class="ai-btn ai-btn-primary" onclick="window.print()">🖨️ طباعة / PDF</button>
      </div>
      <div id="ai-report-container">${html}</div>
      <h2 class="ai-section-title">التقارير المحفوظة</h2>
      <div class="ai-table-wrap">
        <table class="ai-table">
          <thead><tr><th>العنوان</th><th>تاريخ الإنشاء</th><th>إجراءات</th></tr></thead>
          <tbody>${savedRows || '<tr><td colspan="3" class="ai-empty">لا توجد تقارير محفوظة</td></tr>'}</tbody>
        </table>
      </div>
    `);
  }

  function render(view) {
    _currentView = view;
    document.querySelectorAll('.ai-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    switch (view) {
      case 'overview': renderOverview(); break;
      case 'financial': renderFinancial(); break;
      case 'opportunities': renderOpportunities(); break;
      case 'risks': renderRisks(); break;
      case 'financing': renderFinancing(); break;
      case 'distressed': renderDistressed(); break;
      case 'reports': renderReports(); break;
      default: renderOverview();
    }
  }

  async function refresh() {
    setLoading('جارِ تحديث البيانات والتحليل...');
    try {
      _metrics = await SERVICE.getMetrics();
      analyze();
      render(_currentView);
    } catch (e) {
      setContent('<div class="ai-empty"><p>❌ فشل تحميل البيانات: ' + escapeHtml(e.message) + '</p></div>');
    }
  }

  function applySettings() {
    const marginEl = document.getElementById('ai-margin');
    const fixedEl = document.getElementById('ai-fixed');
    if (marginEl) _settings.margin = Math.max(0, Math.min(1, Number(marginEl.value) / 100));
    if (fixedEl) _settings.fixedCosts = Math.max(0, Number(fixedEl.value) || 0);
    saveSettings();
    analyze();
    renderFinancial();
  }

  function generateFullReport() {
    render('reports');
    // Update nav active state
    document.querySelectorAll('.ai-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === 'reports'));
  }

  async function init() {
    loadSettings();
    try {
      const roleInfo = await SERVICE.getUserRole();
      if (!roleInfo || !roleInfo.role) {
        showNoAccess();
        return;
      }
      setUserText(roleInfo.user.email);
      setLoading('جارِ تحليل بيانات الأعمال...');
      _metrics = await SERVICE.getMetrics();
      analyze();
      render('overview');

      // Nav
      document.querySelectorAll('.ai-nav a').forEach(a => {
        a.addEventListener('click', e => {
          e.preventDefault();
          render(a.dataset.view);
        });
      });
    } catch (e) {
      setContent('<div class="ai-empty"><p>❌ خطأ أثناء التهيئة: ' + escapeHtml(e.message) + '</p></div>');
    }
  }

  root.AiAdvisorApp = {
    init,
    refresh,
    applySettings,
    generateFullReport,
    render,
    saveCurrentReport,
    loadSavedReport,
    deleteSavedReport
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }
})(window);
