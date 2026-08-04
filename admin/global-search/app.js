/**
 * Global Search — App UI
 */
(function (root) {
  'use strict';

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
          <td><strong>${BondsAdminCommon.escapeHtml(r.title)}</strong></td>
          <td>${BondsAdminCommon.escapeHtml(r.content)}</td>
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
      if (resultsEl) resultsEl.innerHTML = "<p class=\"ai-empty\"><svg aria-hidden=\"true\" xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 36 36\"><path fill=\"#DD2E44\" d=\"M21.533 18.002L33.768 5.768c.976-.976.976-2.559 0-3.535-.977-.977-2.559-.977-3.535 0L17.998 14.467 5.764 2.233c-.976-.977-2.56-.977-3.535 0-.977.976-.977 2.559 0 3.535l12.234 12.234L2.201 30.265c-.977.977-.977 2.559 0 3.535.488.488 1.128.732 1.768.732s1.28-.244 1.768-.732l12.262-12.263 12.234 12.234c.488.488 1.128.732 1.768.732.64 0 1.279-.244 1.768-.732.976-.977.976-2.559 0-3.535L21.533 18.002z\"/></svg> فشل البحث: " + BondsAdminCommon.escapeHtml(e.message) + '</p>';
    }
  }

  root.GlobalSearchApp = { search };
})(window);
