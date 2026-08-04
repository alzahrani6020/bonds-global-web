/**
 * Data Quality Center — App UI
 */
(function (root) {
  'use strict';

  const SERVICE = root.DataQualityService;
  let _currentView = 'dashboard';
  let _filters = { type: '', severity: '', status: 'open' };

  function setContent(html) {
    const el = document.getElementById('dq-content');
    if (el) el.innerHTML = html;
  }

  function formatDate(d) {
    return d ? new Date(d).toLocaleString('ar-SA') : '—';
  }

  function severityClass(s) {
    return s === 'critical' ? 'ai-badge-danger' : s === 'high' ? 'ai-badge-warning' : s === 'medium' ? 'ai-badge-info' : 'ai-badge-success';
  }

  function severityLabel(s) {
    return s === 'critical' ? 'حرج' : s === 'high' ? 'عالي' : s === 'medium' ? 'متوسط' : 'منخفض';
  }

  async function renderDashboard() {
    setContent('<div class="ai-empty"><div class="ai-spinner"></div><p>جارِ تحميل ملخص جودة البيانات...</p></div>');
    try {
      const issues = await SERVICE.getSummary();
      const counts = { total: issues.length, open: 0, resolved: 0, ignored: 0 };
      const byType = {};
      const bySeverity = {};
      issues.forEach(i => {
        counts[i.status] = (counts[i.status] || 0) + 1;
        byType[i.check_type] = (byType[i.check_type] || 0) + 1;
        bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
      });
      const typeLabels = { duplicate: 'مكرر', missing: 'ناقص', broken_relation: 'علاقة مكسورة', orphan_file: 'ملف بدون سجل', incomplete: 'غير مكتمل', invalid: 'غير صالح' };
      setContent(`
        <div class="ai-grid">
          <div class="ai-card"><h3>إجمالي المشاكل</h3><div class="ai-value">${counts.total.toLocaleString('ar-SA')}</div></div>
          <div class="ai-card"><h3>مفتوحة</h3><div class="ai-value ai-negative">${counts.open.toLocaleString('ar-SA')}</div></div>
          <div class="ai-card"><h3>تم حلها</h3><div class="ai-value ai-positive">${counts.resolved.toLocaleString('ar-SA')}</div></div>
          <div class="ai-card"><h3>تم تجاهلها</h3><div class="ai-value">${counts.ignored.toLocaleString('ar-SA')}</div></div>
        </div>
        <div class="ai-row">
          <div class="ai-card"><h3>المشاكل حسب النوع</h3><ul class="ai-insights">${Object.entries(byType).map(([t, c]) => `<li><span class="ai-badge ai-badge-info">${c}</span>${typeLabels[t] || t}</li>`).join('')}</ul></div>
          <div class="ai-card"><h3>المشاكل حسب الخطورة</h3><ul class="ai-insights">${Object.entries(bySeverity).map(([s, c]) => `<li><span class="ai-badge ${severityClass(s)}">${c}</span>${severityLabel(s)}</li>`).join('')}</ul></div>
        </div>
      `);
    } catch (e) {
      setContent("<div class=\"ai-empty\"><p><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل تحميل الملخص: " + BondsAdminCommon.escapeHtml(e.message) + '</p></div>');
    }
  }

  async function renderIssues() {
    setContent('<div class="ai-empty"><div class="ai-spinner"></div><p>جارِ تحميل المشاكل...</p></div>');
    try {
      const issues = await SERVICE.getIssues(_filters.type, _filters.severity, _filters.status);
      const rows = issues.map(i => `
        <tr>
          <td><span class="ai-badge ${severityClass(i.severity)}">${severityLabel(i.severity)}</span></td>
          <td>${BondsAdminCommon.escapeHtml(i.entity_type)}</td>
          <td>${BondsAdminCommon.escapeHtml(i.message)}</td>
          <td>${formatDate(i.created_at)}</td>
          <td>
            ${i.status === 'open' ? `<button class="ai-btn ai-btn-secondary" onclick="DataQualityApp.resolve('${i.id}')">حل</button>` : '<span class="ai-badge ai-badge-success">محلول</span>'}
          </td>
        </tr>
      `).join('');
      setContent(`
        <div class="ai-form-inline">
          <div class="ai-form-group"><label>النوع</label>
            <select id="dq-filter-type" onchange="DataQualityApp.setFilter('type', this.value)">
              <option value="">الكل</option>
              <option value="duplicate" ${_filters.type === 'duplicate' ? 'selected' : ''}>مكرر</option>
              <option value="missing" ${_filters.type === 'missing' ? 'selected' : ''}>ناقص</option>
              <option value="broken_relation" ${_filters.type === 'broken_relation' ? 'selected' : ''}>علاقة مكسورة</option>
              <option value="incomplete" ${_filters.type === 'incomplete' ? 'selected' : ''}>غير مكتمل</option>
            </select>
          </div>
          <div class="ai-form-group"><label>الخطورة</label>
            <select id="dq-filter-severity" onchange="DataQualityApp.setFilter('severity', this.value)">
              <option value="">الكل</option>
              <option value="critical" ${_filters.severity === 'critical' ? 'selected' : ''}>حرج</option>
              <option value="high" ${_filters.severity === 'high' ? 'selected' : ''}>عالي</option>
              <option value="medium" ${_filters.severity === 'medium' ? 'selected' : ''}>متوسط</option>
            </select>
          </div>
          <div class="ai-form-group"><label>الحالة</label>
            <select id="dq-filter-status" onchange="DataQualityApp.setFilter('status', this.value)">
              <option value="" ${_filters.status === '' ? 'selected' : ''}>الكل</option>
              <option value="open" ${_filters.status === 'open' ? 'selected' : ''}>مفتوح</option>
              <option value="resolved" ${_filters.status === 'resolved' ? 'selected' : ''}>محلول</option>
              <option value="ignored" ${_filters.status === 'ignored' ? 'selected' : ''}>متجاهل</option>
            </select>
          </div>
        </div>
        <div class="ai-table-wrap">
          <table class="ai-table">
            <thead><tr><th>الخطورة</th><th>الكيان</th><th>الوصف</th><th>التاريخ</th><th>إجراء</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="5" class="ai-empty">لا توجد مشاكل</td></tr>'}</tbody>
          </table>
        </div>
      `);
    } catch (e) {
      setContent("<div class=\"ai-empty\"><p><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل تحميل المشاكل: " + BondsAdminCommon.escapeHtml(e.message) + '</p></div>');
    }
  }

  function render(view) {
    _currentView = view;
    document.querySelectorAll('#dq-sidebar .ai-nav a').forEach(a => a.classList.toggle('active', a.dataset.view === view));
    if (view === 'dashboard') renderDashboard();
    else renderIssues();
  }

  function renderCheckResult(result) {
    const counts = result && typeof result === 'object' ? result : {};
    const summary = Object.entries(counts).map(([k, v]) => {
      const val = typeof v === 'object' ? JSON.stringify(v) : v;
      return `<li><strong>${BondsAdminCommon.escapeHtml(k)}:</strong> ${BondsAdminCommon.escapeHtml(String(val))}</li>`;
    }).join('');
    return `
      <div class="ai-card" style="margin-bottom:1.5rem;border:1px solid rgba(34,197,94,0.3);background:rgba(34,197,94,0.05);">
        <h3 class="ecc-card__title"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path fill="#77B255" d="M36 32c0 2.209-1.791 4-4 4H4c-2.209 0-4-1.791-4-4V4c0-2.209 1.791-4 4-4h28c2.209 0 4 1.791 4 4v28z"/><path fill="#FFF" d="M29.28 6.362c-1.156-.751-2.704-.422-3.458.736L14.936 23.877l-5.029-4.65c-1.014-.938-2.596-.875-3.533.138-.937 1.014-.875 2.596.139 3.533l7.209 6.666c.48.445 1.09.665 1.696.665.673 0 1.534-.282 2.099-1.139.332-.506 12.5-19.27 12.5-19.27.751-1.159.421-2.707-.737-3.458z"/></svg> اكتمل الفحص</h3>
        <ul class="ai-insights">${summary || '<li>لم يُعاد أي تفصيل</li>'}</ul>
        <button class="ai-btn ai-btn-secondary" onclick="DataQualityApp.render(_currentView)">متابعة</button>
      </div>
    `;
  }

  async function runChecks() {
    setContent('<div class="ai-empty"><div class="ai-spinner"></div><p>جارِ تشغيل فحوصات جودة البيانات...</p></div>');
    try {
      const result = await SERVICE.runChecks();
      setContent(renderCheckResult(result));
    } catch (e) {
      setContent("<div class=\"ai-empty\"><p><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل تشغيل الفحص: " + BondsAdminCommon.escapeHtml(e.message) + '</p></div>');
    }
  }

  async function resolve(id) {
    try {
      await SERVICE.resolveIssue(id);
      renderIssues();
    } catch (e) {
      alert("<svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل تحديث الحالة: " + e.message);
    }
  }

  function setFilter(key, value) {
    _filters[key] = value;
    renderIssues();
  }

  async function refresh() {
    render(_currentView);
  }

  async function init() {
    try {
      const roleInfo = await SERVICE.getUserRole();
      if (!roleInfo || !roleInfo.role) {
        setContent("<div class=\"ai-no-access\"><h2><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#BE1931\" d=\"M36 18c0 9.941-8.059 18-18 18S0 27.941 0 18 8.059 0 18 0s18 8.059 18 18z\"/><path fill=\"#FFF\" d=\"M32 20c0 1.104-.896 2-2 2H6c-1.104 0-2-.896-2-2v-4c0-1.104.896-2 2-2h24c1.104 0 2 .896 2 2v4z\"/></svg> لا توجد صلاحية</h2><p>لا تملك صلاحية الوصول إلى مركز جودة البيانات.</p></div>");
        return;
      }
      const el = document.getElementById('dq-user');
      if (el) el.textContent = roleInfo.user.email;
      render('dashboard');
      document.querySelectorAll('#dq-sidebar .ai-nav a').forEach(a => {
        a.addEventListener('click', e => { e.preventDefault(); render(a.dataset.view); });
      });
    } catch (e) {
      setContent("<div class=\"ai-empty\"><p><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> خطأ أثناء التهيئة: " + BondsAdminCommon.escapeHtml(e.message) + '</p></div>');
    }
  }

  root.DataQualityApp = { init, render, runChecks, resolve, setFilter, refresh };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else setTimeout(init, 0);
})(window);
