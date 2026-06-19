/**
 * Global Search — App UI
 */
(function (root) {
  'use strict';

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  async function search() {
    const queryEl = document.getElementById('gs-query');
    const typeEl = document.getElementById('gs-type');
    const resultsEl = document.getElementById('gs-results');
    const query = queryEl ? queryEl.value.trim() : '';
    if (!query) {
      if (resultsEl) resultsEl.innerHTML = '<p class="ai-empty">أدخل كلمة بحث.</p>';
      return;
    }
    if (resultsEl) resultsEl.innerHTML = '<div class="ai-empty"><div class="ai-spinner"></div><p>جارِ البحث...</p></div>';
    try {
      const entityType = typeEl ? typeEl.value : '';
      const results = await root.BondsSearch.search(query, {
        limit: 50,
        entityTypes: entityType ? [entityType] : null
      });
      if (!results.length) {
        if (resultsEl) resultsEl.innerHTML = '<p class="ai-empty">لا توجد نتائج.</p>';
        return;
      }
      const typeLabels = {
        advisory_client: 'عميل',
        advisory_project: 'مشروع',
        recovery_asset: 'أصل متعثر',
        advisory_feasibility_study: 'دراسة جدوى',
        ai_advisor_report: 'تقرير'
      };
      const rows = results.map(r => `
        <tr>
          <td><span class="ai-badge ai-badge-info">${typeLabels[r.entity_type] || r.entity_type}</span></td>
          <td><strong>${escapeHtml(r.title)}</strong></td>
          <td>${escapeHtml(r.content)}</td>
          <td>${Math.round((r.rank || 0) * 100)}%</td>
        </tr>
      `).join('');
      if (resultsEl) {
        resultsEl.innerHTML = `
          <div class="ai-table-wrap">
            <table class="ai-table">
              <thead><tr><th>النوع</th><th>العنوان</th><th>التفاصيل</th><th>التوافق</th></tr></thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        `;
      }
    } catch (e) {
      if (resultsEl) resultsEl.innerHTML = '<p class="ai-empty">❌ فشل البحث: ' + escapeHtml(e.message) + '</p>';
    }
  }

  root.GlobalSearchApp = { search };
})(window);
