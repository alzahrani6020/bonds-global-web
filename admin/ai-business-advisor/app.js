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

  async function loadServerSettings() {
    try {
      const token = await BondsAdminCommon.getAdminToken();
      if (!token) return;
      const res = await fetch('/api/admin?action=settings', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      if (!res.ok) return;
      const data = await res.json();
      const serverMargin = parseFloat(data.ai_advisor_margin);
      const serverFixed = parseFloat(data.ai_advisor_fixed_costs);
      if (!isNaN(serverMargin) && serverMargin >= 0 && serverMargin <= 1) {
        _settings.margin = serverMargin;
      }
      if (!isNaN(serverFixed) && serverFixed >= 0) {
        _settings.fixedCosts = serverFixed;
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
    } catch (e) {
      console.warn('[AiAdvisorApp] failed to load server settings:', e);
    }
  }

  function saveSettings() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_settings));
  }

  async function saveServerSettings() {
    saveSettings();
    try {
      const token = await BondsAdminCommon.getAdminToken();
      if (!token) return;
      await fetch('/api/admin?action=settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          ai_advisor_margin: _settings.margin,
          ai_advisor_fixed_costs: _settings.fixedCosts
        })
      });
    } catch (e) {
      console.warn('[AiAdvisorApp] failed to save server settings:', e);
    }
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
    setContent("<div class=\"ai-no-access\"><h2><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#BE1931\" d=\"M36 18c0 9.941-8.059 18-18 18S0 27.941 0 18 8.059 0 18 0s18 8.059 18 18z\"/><path fill=\"#FFF\" d=\"M32 20c0 1.104-.896 2-2 2H6c-1.104 0-2-.896-2-2v-4c0-1.104.896-2 2-2h24c1.104 0 2 .896 2 2v4z\"/></svg> لا توجد صلاحية</h2><p>" + (msg || 'لا تملك صلاحية الوصول إلى مستشار الأعمال الذكي.') + '</p><a href="/admin/dashboard.html" class="ecc-btn ecc-btn--primary">العودة إلى لوحة الإدارة</a></div>');
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
        <div class="ecc-card"><h3 class="ecc-card__title">صحة الأعمال</h3><div class="ecc-metric__value">${a.financial.healthScore}/100</div><div class="ecc-metric__status ${a.financial.healthScore >= 70 ? 'ai-positive' : a.financial.healthScore >= 45 ? 'ai-neutral' : 'ai-negative'}">${a.financial.healthLabel}</div></div>
        <div class="ecc-card"><h3 class="ecc-card__title">إجمالي الإيرادات (12 شهر)</h3><div class="ecc-metric__value">${formatCurrency(a.stats.totalRevenue)}</div><div class="ecc-metric__status ${a.financial.revenueTrend === 'up' ? 'ai-positive' : a.financial.revenueTrend === 'down' ? 'ai-negative' : 'ai-neutral'}">${a.financial.revenueTrend === 'up' ? '↑ صاعد' : a.financial.revenueTrend === 'down' ? '↓ هابط' : '→ مستقر'}</div></div>
        <div class="ecc-card"><h3 class="ecc-card__title">صافي الربح المقدر</h3><div class="ecc-metric__value">${formatCurrency(a.financial.profitEstimate)}</div><div class="ecc-metric__status">هامش افتراضي ${Math.round((_settings.margin)*100)}%</div></div>
        <div class="ecc-card"><h3 class="ecc-card__title">قيمة الفرص المتاحة</h3><div class="ecc-metric__value">${formatCurrency(a.stats.totalOpportunityValue)}</div><div class="ecc-metric__status">${a.opportunities.length} فرصة</div></div>
        <div class="ecc-card"><h3 class="ecc-card__title">المشاريع المتعثرة</h3><div class="ecc-metric__value">${a.stats.distressedProjectsCount}</div><div class="ecc-metric__status ${a.stats.distressedProjectsCount ? 'ai-negative' : 'ai-positive'}">${a.stats.distressedProjectsCount ? 'يتطلب تدخل' : 'لا يوجد'}</div></div>
        <div class="ecc-card"><h3 class="ecc-card__title">مستوى المخاطر</h3><div class="ecc-metric__value ${riskColor}">${a.risks.riskLevel === 'high' ? 'مرتفع' : a.risks.riskLevel === 'medium' ? 'متوسط' : 'منخفض'}</div><div class="ecc-metric__status">${a.risks.risks.length} مخاطر</div></div>
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
      <div class="ecc-card">
        <h3 class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#FFD983" d="M29 11.06c0 6.439-5 7.439-5 13.44 0 3.098-3.123 3.359-5.5 3.359-2.053 0-6.586-.779-6.586-3.361C11.914 18.5 7 17.5 7 11.06 7 5.029 12.285.14 18.083.14 23.883.14 29 5.029 29 11.06z"/><path fill="#CCD6DD" d="M22.167 32.5c0 .828-2.234 2.5-4.167 2.5-1.933 0-4.167-1.672-4.167-2.5 0-.828 2.233-.5 4.167-.5 1.933 0 4.167-.328 4.167.5z"/><path fill="#FFCC4D" d="M22.707 10.293c-.391-.391-1.023-.391-1.414 0L18 13.586l-3.293-3.293c-.391-.391-1.023-.391-1.414 0s-.391 1.023 0 1.414L17 15.414V26c0 .553.448 1 1 1s1-.447 1-1V15.414l3.707-3.707c.391-.391.391-1.023 0-1.414z"/><path fill="#99AAB5" d="M24 31c0 1.104-.896 2-2 2h-8c-1.104 0-2-.896-2-2v-6h12v6z"/><path fill="#CCD6DD" d="M11.999 32c-.48 0-.904-.347-.985-.836-.091-.544.277-1.06.822-1.15l12-2c.544-.098 1.06.277 1.15.822.091.544-.277 1.06-.822 1.15l-12 2c-.055.01-.111.014-.165.014zm0-4c-.48 0-.904-.347-.985-.836-.091-.544.277-1.06.822-1.15l12-2c.544-.097 1.06.277 1.15.822.091.544-.277 1.06-.822 1.15l-12 2c-.055.01-.111.014-.165.014z"/></svg> توصيات سريعة</h3>
        <ul class="ai-insights">
          ${items.map(i => `<li><span class="status-badge status-badge--${i.type === 'danger' ? 'at-risk' : i.type === 'warning' ? 'attention' : i.type === 'info' ? 'neutral' : 'healthy'}">${i.type === 'danger' ? 'خطر' : i.type === 'warning' ? 'تنبيه' : i.type === 'info' ? 'فرصة' : 'جيد'}</span>${BondsAdminCommon.escapeHtml(i.text)}</li>`).join('')}
        </ul>
      </div>
    `;
  }

  function renderOverview() {
    const a = analyze();
    if (!a) return setLoading('جارِ التحليل...');
    const scoreDeg = Math.round((a.financial.healthScore / 100) * 360);
    setContent(`
      ${kpiCards(a)}
      <div class="ai-row">
        <div class="ecc-card">
          <h4 class="ecc-card__title">الإيرادات الشهرية</h4>
          <div class="ecc-chart"><canvas id="chart-revenue"></canvas></div>
        </div>
        <div class="ecc-card">
          <h4 class="ecc-card__title">توزيع المشاريع</h4>
          <div class="ecc-chart"><canvas id="chart-projects"></canvas></div>
        </div>
      </div>
      <div class="ai-row">
        <div class="ecc-card ai-health">
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
      <div class="ecc-card">
        <h4 class="ecc-card__title">الأصول المتعثرة حسب الفئة</h4>
        <div class="ecc-chart"><canvas id="chart-assets"></canvas></div>
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
      <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:1rem;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#3B88C3" d="M0 4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4z"/><path fill="#FFF" d="M20.512 8.071c0 1.395-1.115 2.573-2.511 2.573-1.333 0-2.511-1.209-2.511-2.573 0-1.271 1.178-2.45 2.511-2.45 1.333.001 2.511 1.148 2.511 2.45zm-4.744 6.728c0-1.488.931-2.481 2.232-2.481 1.302 0 2.232.992 2.232 2.481v11.906c0 1.488-.93 2.48-2.232 2.48s-2.232-.992-2.232-2.48V14.799z"/></svg> تُحفظ هذه الإعدادات في السيرفر وتُشارك بين المشرفين.</p>
      <div class="ai-form-inline">
        <div class="ai-form-group">
          <label for="ai-margin">هامش الربح الإجمالي (%)</label>
          <input type="number" id="ai-margin" step="1" min="0" max="100" value="${Math.round(_settings.margin*100)}" />
        </div>
        <div class="ai-form-group">
          <label for="ai-fixed">التكاليف الثابتة السنوية (ر.س)</label>
          <input type="number" id="ai-fixed" step="1000" min="0" value="${_settings.fixedCosts}" />
        </div>
        <button class="ecc-btn ecc-btn--primary" onclick="AiAdvisorApp.applySettings()">تطبيق</button>
      </div>
      ${kpiCards(a)}
      <div class="ai-row">
        <div class="ecc-card"><h4 class="ecc-card__title">الإيرادات مقابل الربح المقدر</h4><div class="ecc-chart"><canvas id="chart-profit"></canvas></div></div>
        <div class="ecc-card"><h4 class="ecc-card__title">التدفق النقدي الشهري</h4><div class="ecc-chart"><canvas id="chart-cash"></canvas></div></div>
      </div>
      ${a.financial.flags.length ? `<div class="ecc-card"><h3 class="ecc-card__title"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> تنبيهات مالية</h3><ul class="ai-insights">${a.financial.flags.map(f => `<li><span class="status-badge status-badge--${f.type === 'danger' ? 'at-risk' : 'attention'}">${f.type === 'danger' ? 'خطير' : 'تنبيه'}</span>${BondsAdminCommon.escapeHtml(f.text)}</li>`).join('')}</ul></div>` : ''}
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
        <td><strong>${BondsAdminCommon.escapeHtml(o.name)}</strong></td>
        <td>${BondsAdminCommon.escapeHtml(o.category || '—')}</td>
        <td>${formatCurrency(o.original_value)}</td>
        <td>${formatCurrency(o.distressed_value)}</td>
        <td class="ai-positive">${formatCurrency(o.upside)}</td>
        <td><span class="status-badge ${o.score >= 70 ? 'status-badge--healthy' : o.score >= 45 ? 'status-badge--attention' : 'status-badge--at-risk'}">${o.score}/100</span></td>
        <td>${BondsAdminCommon.escapeHtml(o.recommendation)}</td>
      </tr>
    `).join('');
    setContent(`
      <h2 class="ai-section-title">الفرص الاستثمارية الموصى بها</h2>
      <div class="ecc-table-wrap">
        <table class="ecc-table">
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
        <h4>${BondsAdminCommon.escapeHtml(r.title)} <span class="status-badge status-badge--${r.level === 'high' ? 'at-risk' : r.level === 'medium' ? 'attention' : 'healthy'}">${r.level === 'high' ? 'مرتفع' : r.level === 'medium' ? 'متوسط' : 'منخفض'}</span></h4>
        <p>${BondsAdminCommon.escapeHtml(r.text)}</p>
      </div>
    `).join('');
    setContent(`
      <h2 class="ai-section-title">تقييم المخاطر</h2>
      <div class="ecc-card"><h3 class="ecc-card__title">المستوى العام للمخاطر</h3><div class="ecc-metric__value ${a.risks.riskLevel === 'high' ? 'ai-negative' : a.risks.riskLevel === 'medium' ? 'ai-neutral' : 'ai-positive'}">${a.risks.riskLevel === 'high' ? 'مرتفع' : a.risks.riskLevel === 'medium' ? 'متوسط' : 'منخفض'}</div></div>
      <div class="ai-risk-list">${items || '<p class="ai-empty">لا توجد مخاطر مسجلة حالياً.</p>'}</div>
    `);
  }

  function renderFinancing() {
    const a = analyze();
    if (!a) return setLoading('جارِ التحليل...');
    const items = a.financing.map(f => `
      <div class="ai-financing-item">
        <h4>${BondsAdminCommon.escapeHtml(f.title)} <span class="ai-tag">أولوية ${f.urgency}</span></h4>
        <small>${BondsAdminCommon.escapeHtml(f.type)}</small>
        <p>${BondsAdminCommon.escapeHtml(f.desc)}</p>
        <em>التأثير: ${BondsAdminCommon.escapeHtml(f.impact)}</em>
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
        <td>${BondsAdminCommon.escapeHtml(x.name)}</td>
        <td>${BondsAdminCommon.escapeHtml(x.category || '—')}</td>
        <td>${BondsAdminCommon.escapeHtml(x.status)}</td>
        <td>${BondsAdminCommon.escapeHtml(x.priority || '—')}</td>
        <td><span class="status-badge ${x.distressScore >= 70 ? 'status-badge--at-risk' : x.distressScore >= 40 ? 'status-badge--attention' : 'status-badge--healthy'}">${x.distressScore}/100</span></td>
        <td>${formatCurrency(x.value)}</td>
        <td>${BondsAdminCommon.escapeHtml(x.action)}</td>
      </tr>
    `).join('');
    const projectRows = a.distressed.projects.map(p => `
      <tr>
        <td>${BondsAdminCommon.escapeHtml(p.name)}</td>
        <td>${p.status === 'cancelled' ? 'ملغى' : 'معلق'}</td>
        <td>${BondsAdminCommon.escapeHtml(p.client)}</td>
        <td>${formatCurrency(p.value)}</td>
        <td>${BondsAdminCommon.escapeHtml(p.action)}</td>
      </tr>
    `).join('');
    setContent(`
      <h2 class="ai-section-title">المشاريع والأصول المتعثرة</h2>
      <h3 class="ai-section-title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#BE1931" d="M10.308 9H5.692l-.154 2h4.924zM10 5H6l-.154 2h4.308zm.615 8h-5.23l-.154 2h5.538zM5 18h6l-.077-1H5.077zm15.615-5h-5.23l-.154 2h5.538zM15 18h6l-.077-1h-5.846zm5.308-9h-4.616l-.154 2h4.924zM20 5h-4l-.154 2h4.308zm10.308 4h-4.616l-.154 2h4.924zm-5.231 8L25 18h6l-.077-1zm5.538-4h-5.23l-.154 2h5.538zM30 5h-4l-.154 2h4.308z"/><path fill="#E6E7E8" d="M10.462 11H5.538l-.153 2h5.23zm-.308-4H5.846l-.154 2h4.616zm-4.923 8l-.154 2h5.846l-.154-2zm15.231-4h-4.924l-.153 2h5.23zm-.308-4h-4.308l-.154 2h4.616zm-4.923 8l-.154 2h5.846l-.154-2zm15.231-4h-4.924l-.153 2h5.23zm.307 4h-5.538l-.154 2h5.846zm-.615-8h-4.308l-.154 2h4.616z"/><path fill="#A0041E" d="M35 34c0 1.104-.896 2-2 2H3c-1.104 0-2-.896-2-2V20c0-1.104.896-2 2-2h30c1.104 0 2 .896 2 2v14z"/><path fill="#C1694F" d="M1 20h34v2H1z"/><path fill="#AAB8C2" d="M6 24h4v4H6zm10 0h4v4h-4zm10 0h4v4h-4zM6 30h4v4H6zm10 0h4v4h-4zm10 0h4v4h-4z"/><path fill="#D1D3D4" d="M9 0C7.896 0 7 .896 7 2c0 .457.159.873.417 1.209C7.17 3.392 7 3.67 7 4c0 .552.448 1 1 1s1-.448 1-1c1.104 0 2-.896 2-2s-.896-2-2-2zm10 0c-1.104 0-2 .896-2 2 0 .457.159.873.417 1.209C17.17 3.392 17 3.67 17 4c0 .552.448 1 1 1s1-.448 1-1c1.104 0 2-.896 2-2s-.896-2-2-2zm10 0c-1.104 0-2 .896-2 2 0 .457.159.873.417 1.209C27.17 3.392 27 3.67 27 4c0 .552.447 1 1 1s1-.448 1-1c1.104 0 2-.896 2-2s-.896-2-2-2z"/></svg> الأصول المتعثرة (${a.distressed.assets.length})</h3>
      <div class="ecc-table-wrap">
        <table class="ecc-table">
          <thead><tr><th>الأصل</th><th>الفئة</th><th>الحالة</th><th>الأولوية</th><th>درجة التعثر</th><th>القيمة</th><th>الإجراء المقترح</th></tr></thead>
          <tbody>${assetRows || '<tr><td colspan="7" class="ai-empty">لا توجد أصول متعثرة</td></tr>'}</tbody>
        </table>
      </div>
      <h3 class="ai-section-title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#269" d="M0 29c0 2.209 1.791 4 4 4h24c2.209 0 4-1.791 4-4V12c0-2.209-1.791-4-4-4h-9c-3.562 0-3-5-8.438-5H4C1.791 3 0 4.791 0 7v22z"/><path fill="#55ACEE" d="M30 10h-6.562C18 10 18.562 15 15 15H6c-2.209 0-4 1.791-4 4v10c0 .553-.448 1-1 1s-1-.447-1-1c0 2.209 1.791 4 4 4h26c2.209 0 4-1.791 4-4V14c0-2.209-1.791-4-4-4z"/></svg> المشاريع المتعثرة (${a.distressed.projects.length})</h3>
      <div class="ecc-table-wrap">
        <table class="ecc-table">
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
      alert("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#77B255\" d=\"M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z\"/><path fill=\"#FFF\" d=\"M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z\"/></svg> تم حفظ التقرير بنجاح.");
      renderReports();
    } catch (e) {
      alert("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل الحفظ: " + e.message);
    }
  }

  async function loadSavedReport(id) {
    try {
      const report = await SERVICE.getReport(id);
      setContent(`
        <div class="ai-topbar-actions">
          <button class="ecc-btn ecc-btn--ghost" onclick="AiAdvisorApp.generateFullReport()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#3B88C3" d="M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z"/><path fill="#FFF" d="M29 14h-9V7L7 18l13 11v-7h9z"/></svg> تقرير جديد</button>
          <button class="ecc-btn ecc-btn--primary" onclick="window.print()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#67757F" d="M30 12H6V5c0-1.105.826-2 1.846-2h20.309C29.173 3 30 3.895 30 5v7zm0 19c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2v-3h24v3z"/><path fill="#E1E8ED" d="M27 12H9V2c0-1.105.896-2 2-2h14c1.104 0 2 .896 2 2v10z"/><path fill="#5DADEC" d="M34 25c0 1-1 3-3 3H5c-2 0-3-2-3-3v-9c0-2.209 1.791-4 4-4h24c2.209 0 4 1.791 4 4v9z"/><path fill="#292F33" d="M30 25c0-1.104-.978-2-2.182-2H8.182C6.977 23 6 23.896 6 25v4h24v-4z"/><path fill="#4289C1" d="M30 15c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2v-4h24v4z"/><path fill="#E1E8ED" d="M27 34c0 1.104-.896 2-2 2H11c-1.104 0-2-.896-2-2v-8h18v8z"/><path fill="#9AAAB4" d="M25 29c0 .553-.447 1-1 1H12c-.552 0-1-.447-1-1 0-.553.448-1 1-1h12c.553 0 1 .447 1 1z"/><circle fill="#F5F8FA" cx="30.5" cy="19.5" r="1.5"/><path fill="#9AAAB4" d="M25 32c0 .553-.447 1-1 1H12c-.552 0-1-.447-1-1 0-.553.448-1 1-1h12c.553 0 1 .447 1 1zM9 25h18v2H9z"/></svg> طباعة / PDF</button>
        </div>
        <div id="ai-report-container">${report.content_html}</div>
      `);
    } catch (e) {
      alert("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل تحميل التقرير: " + e.message);
    }
  }

  async function deleteSavedReport(id) {
    if (!confirm('هل أنت متأكد من حذف التقرير؟')) return;
    try {
      await SERVICE.deleteReport(id);
      renderReports();
    } catch (e) {
      alert("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل الحذف: " + e.message);
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
          <td><strong>${BondsAdminCommon.escapeHtml(r.title)}</strong></td>
          <td>${new Date(r.created_at).toLocaleString('ar-SA')}</td>
          <td>
            <button class="ecc-btn ecc-btn--ghost ecc-btn--sm" onclick="AiAdvisorApp.loadSavedReport('${r.id}')">عرض</button>
            <button class="ecc-btn ecc-btn--ghost ecc-btn--sm" style="color:var(--danger)" onclick="AiAdvisorApp.deleteSavedReport('${r.id}')">حذف</button>
          </td>
        </tr>
      `).join('');
    } catch (e) {
      savedRows = `<tr><td colspan="3" class="ai-empty">تعذر تحميل التقارير المحفوظة: ${BondsAdminCommon.escapeHtml(e.message)}</td></tr>`;
    }
    setContent(`
      <div class="ai-topbar-actions">
        <button class="ecc-btn ecc-btn--primary" onclick="AiAdvisorApp.saveCurrentReport()"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#31373D" d="M4 36s-4 0-4-4V4s0-4 4-4h26c1 0 2 1 2 1l3 3s1 1 1 2v26s0 4-4 4H4z"/><path fill="#55ACEE" d="M5 19v-1s0-2 2-2h21c2 0 2 2 2 2v1H5z"/><path fill="#E1E8ED" d="M5 32.021V19h25v13s0 2-2 2H7c-2 0-2-1.979-2-1.979zM10 3s0-1 1-1h18c1.048 0 1 1 1 1v10s0 1-1 1H11s-1 0-1-1V3zm12 10h5V3h-5v10z"/></svg> حفظ التقرير</button>
        <button class="ecc-btn ecc-btn--primary" onclick="window.print()"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#67757F" d="M30 12H6V5c0-1.105.826-2 1.846-2h20.309C29.173 3 30 3.895 30 5v7zm0 19c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2v-3h24v3z"/><path fill="#E1E8ED" d="M27 12H9V2c0-1.105.896-2 2-2h14c1.104 0 2 .896 2 2v10z"/><path fill="#5DADEC" d="M34 25c0 1-1 3-3 3H5c-2 0-3-2-3-3v-9c0-2.209 1.791-4 4-4h24c2.209 0 4 1.791 4 4v9z"/><path fill="#292F33" d="M30 25c0-1.104-.978-2-2.182-2H8.182C6.977 23 6 23.896 6 25v4h24v-4z"/><path fill="#4289C1" d="M30 15c0 1.104-.896 2-2 2H8c-1.104 0-2-.896-2-2v-4h24v4z"/><path fill="#E1E8ED" d="M27 34c0 1.104-.896 2-2 2H11c-1.104 0-2-.896-2-2v-8h18v8z"/><path fill="#9AAAB4" d="M25 29c0 .553-.447 1-1 1H12c-.552 0-1-.447-1-1 0-.553.448-1 1-1h12c.553 0 1 .447 1 1z"/><circle fill="#F5F8FA" cx="30.5" cy="19.5" r="1.5"/><path fill="#9AAAB4" d="M25 32c0 .553-.447 1-1 1H12c-.552 0-1-.447-1-1 0-.553.448-1 1-1h12c.553 0 1 .447 1 1zM9 25h18v2H9z"/></svg> طباعة / PDF</button>
      </div>
      <div id="ai-report-container">${html}</div>
      <h2 class="ai-section-title">التقارير المحفوظة</h2>
      <div class="ecc-table-wrap">
        <table class="ecc-table">
          <thead><tr><th>العنوان</th><th>تاريخ الإنشاء</th><th>إجراءات</th></tr></thead>
          <tbody>${savedRows || '<tr><td colspan="3" class="ai-empty">لا توجد تقارير محفوظة</td></tr>'}</tbody>
        </table>
      </div>
    `);
  }

  async function renderAi() {
    const defaults = {
      sector: 'التجارة',
      city: 'الرياض',
      investment: 2000000,
      monthly_revenue: 300000,
      monthly_costs: 220000,
      annual_revenue: _metrics ? Math.round(_metrics.stats.totalRevenue) : 5000000,
      existing_debt: 0,
      net_profit: _metrics ? Math.round(_metrics.stats.totalRevenue * 0.15) : 750000,
      total_assets: _metrics ? Math.round(_metrics.stats.totalAssetsValue) : 0,
      dscr: 1.5,
      entity_name: 'منشأة بوندز',
    };
    setContent(`
      <h2 class="ai-section-title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><ellipse fill="#F4900C" cx="33.5" cy="14.5" rx="2.5" ry="3.5"/><ellipse fill="#F4900C" cx="2.5" cy="14.5" rx="2.5" ry="3.5"/><path fill="#FFAC33" d="M34 19c0 .553-.447 1-1 1h-3c-.553 0-1-.447-1-1v-9c0-.552.447-1 1-1h3c.553 0 1 .448 1 1v9zM7 19c0 .553-.448 1-1 1H3c-.552 0-1-.447-1-1v-9c0-.552.448-1 1-1h3c.552 0 1 .448 1 1v9z"/><path fill="#FFCC4D" d="M28 5c0 2.761-4.478 4-10 4C12.477 9 8 7.761 8 5s4.477-5 10-5c5.522 0 10 2.239 10 5z"/><path fill="#F4900C" d="M25 4.083C25 5.694 21.865 7 18 7c-3.866 0-7-1.306-7-2.917 0-1.611 3.134-2.917 7-2.917 3.865 0 7 1.306 7 2.917z"/><path fill="#269" d="M30 5.5C30 6.881 28.881 7 27.5 7h-19C7.119 7 6 6.881 6 5.5S7.119 3 8.5 3h19C28.881 3 30 4.119 30 5.5z"/><path fill="#55ACEE" d="M30 6H6c-1.104 0-2 .896-2 2v26h28V8c0-1.104-.896-2-2-2z"/><path fill="#3B88C3" d="M35 33v-1c0-1.104-.896-2-2-2H22.071l-3.364 3.364c-.391.391-1.023.391-1.414 0L13.929 30H3c-1.104 0-2 .896-2 2v1c0 1.104-.104 2 1 2h32c1.104 0 1-.896 1-2z"/><circle fill="#FFF" cx="24.5" cy="14.5" r="4.5"/><circle fill="#DD2E44" cx="24.5" cy="14.5" r="2.721"/><circle fill="#FFF" cx="11.5" cy="14.5" r="4.5"/><path fill="#F5F8FA" d="M29 25.5c0 1.381-1.119 2.5-2.5 2.5h-17C8.119 28 7 26.881 7 25.5S8.119 23 9.5 23h17c1.381 0 2.5 1.119 2.5 2.5z"/><path fill="#CCD6DD" d="M17 23h2v5h-2zm-5 0h2v5h-2zm10 0h2v5h-2zM7 25.5c0 1.21.859 2.218 2 2.45v-4.9c-1.141.232-2 1.24-2 2.45zm20-2.45v4.899c1.141-.232 2-1.24 2-2.45s-.859-2.217-2-2.449z"/><circle fill="#DD2E44" cx="11.5" cy="14.5" r="2.721"/></svg> تحليل AI</h2>
      <div class="ecc-card">
        <div class="ai-form-inline" style="flex-wrap:wrap;">
          <div class="ai-form-group">
            <label>نوع التحليل</label>
            <select id="ai-type">
              <option value="feasibility_study">دراسة جدوى</option>
              <option value="credit_assessment">تقييم الجدارة الائتمانية</option>
            </select>
          </div>
        </div>
        <div id="ai-inputs-feasibility" class="ai-form-grid">
          <div class="ai-form-group"><label>القطاع</label><input type="text" id="ai-sector" value="${BondsAdminCommon.escapeHtml(defaults.sector)}" /></div>
          <div class="ai-form-group"><label>المدينة</label><input type="text" id="ai-city" value="${BondsAdminCommon.escapeHtml(defaults.city)}" /></div>
          <div class="ai-form-group"><label>الاستثمار (ر.س)</label><input type="number" id="ai-investment" value="${defaults.investment}" /></div>
          <div class="ai-form-group"><label>الإيرادات الشهرية</label><input type="number" id="ai-monthly-revenue" value="${defaults.monthly_revenue}" /></div>
          <div class="ai-form-group"><label>التكاليف الشهرية</label><input type="number" id="ai-monthly-costs" value="${defaults.monthly_costs}" /></div>
          <div class="ai-form-group"><label>NPV</label><input type="number" id="ai-npv" value="" placeholder="اختياري" /></div>
          <div class="ai-form-group"><label>IRR %</label><input type="number" id="ai-irr" value="" placeholder="اختياري" step="0.1" /></div>
          <div class="ai-form-group"><label>DSCR</label><input type="number" id="ai-dscr" value="${defaults.dscr}" step="0.01" /></div>
        </div>
        <div id="ai-inputs-credit" class="ai-form-grid" style="display:none;">
          <div class="ai-form-group"><label>اسم المنشأة</label><input type="text" id="ai-entity" value="${BondsAdminCommon.escapeHtml(defaults.entity_name)}" /></div>
          <div class="ai-form-group"><label>الإيرادات السنوية</label><input type="number" id="ai-annual-revenue" value="${defaults.annual_revenue}" /></div>
          <div class="ai-form-group"><label>الدين القائم</label><input type="number" id="ai-existing-debt" value="${defaults.existing_debt}" /></div>
          <div class="ai-form-group"><label>صافي الربح</label><input type="number" id="ai-net-profit" value="${defaults.net_profit}" /></div>
          <div class="ai-form-group"><label>إجمالي الأصول</label><input type="number" id="ai-total-assets" value="${defaults.total_assets}" /></div>
          <div class="ai-form-group"><label>DSCR</label><input type="number" id="ai-dscr-credit" value="${defaults.dscr}" step="0.01" /></div>
        </div>
        <div style="margin-top:1rem;">
          <button class="ecc-btn ecc-btn--primary" id="ai-run-btn" onclick="AiAdvisorApp.runAiAnalysis()"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg> تشغيل التحليل</button>
          <span id="ai-cost" style="color:var(--text-secondary);font-size:0.85rem;margin-right:1rem;"></span>
        </div>
      </div>
      <div id="ai-result" class="ecc-card" style="display:none;"></div>
    `);

    document.getElementById('ai-type').addEventListener('change', (e) => {
      document.getElementById('ai-inputs-feasibility').style.display = e.target.value === 'feasibility_study' ? 'grid' : 'none';
      document.getElementById('ai-inputs-credit').style.display = e.target.value === 'credit_assessment' ? 'grid' : 'none';
    });
  }

  async function runAiAnalysis() {
    const type = document.getElementById('ai-type').value;
    const btn = document.getElementById('ai-run-btn');
    const resultEl = document.getElementById('ai-result');
    const costEl = document.getElementById('ai-cost');
    btn.disabled = true;
    costEl.textContent = 'جارِ التحليل...';
    resultEl.style.display = 'none';
    try {
      let payload;
      if (type === 'feasibility_study') {
        payload = {
          sector: document.getElementById('ai-sector').value,
          city: document.getElementById('ai-city').value,
          investment: Number(document.getElementById('ai-investment').value) || 0,
          monthly_revenue: Number(document.getElementById('ai-monthly-revenue').value) || 0,
          monthly_costs: Number(document.getElementById('ai-monthly-costs').value) || 0,
          dscr: Number(document.getElementById('ai-dscr').value) || null,
        };
        const npv = document.getElementById('ai-npv').value;
        const irr = document.getElementById('ai-irr').value;
        if (npv) payload.npv = Number(npv);
        if (irr) payload.irr = Number(irr);
      } else {
        payload = {
          entity_name: document.getElementById('ai-entity').value,
          annual_revenue: Number(document.getElementById('ai-annual-revenue').value) || 0,
          existing_debt: Number(document.getElementById('ai-existing-debt').value) || 0,
          net_profit: Number(document.getElementById('ai-net-profit').value) || null,
          total_assets: Number(document.getElementById('ai-total-assets').value) || null,
          dscr: Number(document.getElementById('ai-dscr-credit').value) || null,
        };
      }
      const res = await root.AiAnalyzeService.analyze({ type, payload });
      resultEl.innerHTML = '<h3>نتيجة التحليل</h3>' + root.AiAnalyzeService.renderResult(res.result);
      resultEl.style.display = 'block';
      if (res.usage) {
        costEl.textContent = `التكلفة: $${res.usage.cost_usd || 0} · النموذج: ${res.result?.guardrails ? 'GPT' : 'n/a'}`;
      } else {
        costEl.textContent = '';
      }
    } catch (err) {
      resultEl.innerHTML = `<div class="ai-no-access"><p><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#DD2E44" d="M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z"/></svg> ${BondsAdminCommon.escapeHtml(err.message)}</p></div>`;
      resultEl.style.display = 'block';
      costEl.textContent = '';
    } finally {
      btn.disabled = false;
    }
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
      case 'ai': renderAi(); break;
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
      setContent("<div class=\"ai-empty\"><p><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل تحميل البيانات: " + BondsAdminCommon.escapeHtml(e.message) + '</p></div>');
    }
  }

  async function applySettings() {
    const marginEl = document.getElementById('ai-margin');
    const fixedEl = document.getElementById('ai-fixed');
    if (marginEl) _settings.margin = Math.max(0, Math.min(1, Number(marginEl.value) / 100));
    if (fixedEl) _settings.fixedCosts = Math.max(0, Number(fixedEl.value) || 0);
    await saveServerSettings();
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
    await loadServerSettings();
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
      setContent("<div class=\"ai-empty\"><p><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> خطأ أثناء التهيئة: " + BondsAdminCommon.escapeHtml(e.message) + '</p></div>');
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
    deleteSavedReport,
    runAiAnalysis
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 0);
  }
})(window);
