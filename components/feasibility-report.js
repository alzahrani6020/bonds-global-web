'use strict';

// Read-only browser report. It never saves, re-computes, or authorizes an artifact.
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BondsFeasibilityReport = api;
})(typeof window !== 'undefined' ? window : null, function() {
  function escape(value) {
    return String(value === undefined || value === null ? '' : value).replace(/[&<>"']/g, function(char) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char];
    });
  }
  function number(value) {
    return typeof value === 'number' && Number.isFinite(value)
      ? value.toLocaleString('en-US', {maximumFractionDigits: 4}) : '—';
  }
  function finite(value) { return typeof value === 'number' && Number.isFinite(value); }
  function row(key, value) { return '<tr><th scope="row">' + escape(key) + '</th><td>' + escape(value) + '</td></tr>'; }
  function section(title, content) { return '<section><h2>' + escape(title) + '</h2>' + content + '</section>'; }
  function render(input) {
    const payload = input && input.payload || {};
    const result = payload.result || {};
    const study = result.engineResults && result.engineResults.feasibility;
    const m = study && study.metrics;
    if (!study || study.executed !== true || !study.ok || !m || !finite(m.npv) || !finite(m.irr_pct)) {
      throw new Error('FEASIBILITY_REPORT_REQUIRES_CALCULATED_METRICS');
    }
    const values = input.inputs || {};
    // This is a view of the executed response; a printable report is not proof of bank approval.
    const ar = input.lang !== 'en';
    const t = (a, en) => ar ? a : en;
    const currency = typeof values.currency === 'string' && /^[A-Z]{3}$/.test(values.currency) ? values.currency : '—';
    const archive = payload.artifact_persistence || {};
    const archived = archive.status === 'saved' && !!archive.artifact_id && !!input.projectId;
    const status = archived ? t('محفوظ ومؤكد بالاسترجاع','Saved and read back') :
      t('غير مؤكد الحفظ — نسخة للمراجعة','Persistence unverified — review copy');
    const project = values.project_name || t('غير محدد','Not provided');
    const assumptionRows = [
      row(t('المشروع','Project'), project),
      row(t('معرّف المشروع','Project ID'), input.projectId || '—'),
      row(t('معرّف المخرج','Artifact ID'), archived ? archive.artifact_id : '—'),
      row(t('العملة','Currency'), currency),
      row(t('الاستثمار الأولي','Initial investment'), number(m.initial_investment)),
      row(t('معدل الخصم','Discount rate'), finite(m.discount_rate) ? number(m.discount_rate * 100) + '%' : '—'),
      row(t('الأفق الزمني (سنوات)','Years'), Array.isArray(m.cash_flows) ? m.cash_flows.length : '—')
    ].join('');
    const metrics = [
      row('NPV', number(m.npv) + ' ' + currency),
      row('IRR', number(m.irr_pct) + '%'),
      row(t('فترة الاسترداد (سنوات)','Payback (years)'), number(m.payback_periods)),
      row(t('مؤشر الربحية','Profitability index'), number(m.profitability_index)),
      row(t('صافي التدفقات','Net cash flows'), number(m.net_cash_flows) + ' ' + currency)
    ].join('');
    let cumul = -m.initial_investment;
    const flows = (Array.isArray(m.cash_flows) ? m.cash_flows : []).map(function(v, i) {
      cumul += v;
      return '<tr><td>' + (i + 1) + '</td><td>' + number(v) + '</td><td>' +
        number(v / Math.pow(1 + m.discount_rate, i + 1)) + '</td><td>' + number(cumul) + '</td></tr>';
    }).join('');
    const flowsTable = '<table><thead><tr><th>' + t('السنة','Year') + '</th><th>' +
      t('التدفق الصافي','Net cash flow') + '</th><th>' + t('القيمة الحالية','Present value') +
      '</th><th>' + t('التراكم بعد الاستثمار','Cumulative after investment') +
      '</th></tr></thead><tbody>' + flows + '</tbody></table>';
    const provenance = '<p class="caution">' +
      t('المؤشرات محسوبة من المدخلات المسجلة عند التنفيذ. لم تُتحقق المصادر التجارية أو التوقعات السوقية بصورة مستقلة، ولا يمثل التقرير اعتمادًا مصرفيًا أو استثماريًا.',
        'Metrics are calculated from execution inputs. Business sources and market forecasts have not been independently verified. This is not bank or investment approval.') +
      '</p>';
    const missing = t('غير متوفر ضمن مخرجات الدراسة الحالية؛ لا تُنشأ أرقام أو قوائم مالية افتراضية.',
      'Not supplied in this execution; no invented financial statement or scenario figures.');
    const optional = [];
    if (result.financial_statements && typeof result.financial_statements === 'object') {
      optional.push(section(t('القوائم المالية المتاحة','Available financial statements'),
        '<pre>' + escape(JSON.stringify(result.financial_statements, null, 2)) + '</pre>'));
    } else optional.push(section(t('القوائم المالية','Financial statements'), '<p>' + missing + '</p>'));
    if (result.scenarios && typeof result.scenarios === 'object') {
      optional.push(section(t('السيناريوهات الموجودة في نتيجة المحرك','Engine-returned scenarios'),
        '<pre>' + escape(JSON.stringify(result.scenarios, null, 2)) + '</pre>'));
    } else optional.push(section(t('الحساسية والسيناريوهات','Sensitivity and scenarios'), '<p>' + missing + '</p>'));
    const heading = t('BONDS Global — تقرير التحليل المالي','BONDS Global — Financial analysis report');
    return '<!doctype html><html lang="' + (ar?'ar':'en') + '" dir="' + (ar?'rtl':'ltr') +
      '"><head><meta charset="utf-8"><title>' + escape(heading) +
      '</title><style>@page{size:A4;margin:16mm}body{font:14px/1.65 Arial,sans-serif;color:#142234;max-width:930px;margin:30px auto;padding:12px}h1{font-size:25px;border-bottom:3px solid #b58b41;padding-bottom:12px}h2{font-size:18px;margin-top:24px}section{break-inside:avoid}table{border-collapse:collapse;width:100%;margin:10px 0;table-layout:fixed}th,td{border:1px solid #b9c2cc;padding:7px;text-align:start;overflow-wrap:anywhere}th{background:#edf0f4}small,.muted{color:#536477}.caution{padding:12px;border:1px solid #a7a7a7;background:#fafafa}pre{white-space:pre-wrap;overflow-wrap:anywhere}footer{margin-top:30px;border-top:1px solid #ccc;padding-top:10px}@media print{body{margin:0;padding:0}section{break-inside:auto}tr{break-inside:avoid}}</style></head><body><h1>' +
      escape(heading) + '</h1><p><strong>' + escape(status) + '</strong></p>' +
      section(t('هوية الدراسة والافتراضات','Study identity and assumptions'), '<table>' + assumptionRows + '</table>') +
      section(t('المؤشرات المالية المحسوبة','Calculated financial indicators'), '<table>' + metrics + '</table>') +
      section(t('التدفقات النقدية السنوية','Annual cash flow schedule'), flowsTable) +
      optional.join('') + section(t('حالة الأدلة','Evidence status'), provenance) +
      '<footer>' + escape(t('نسخة مطبوعة للمراجعة — لا تعدّل السجل المحفوظ','Printable review copy — does not alter the saved record')) +
      '</footer></body></html>';
  }
  function printReport(input) {
    const html = render(input);
    const view = window.open('', '_blank');
    if (!view) throw new Error('REPORT_PRINT_WINDOW_BLOCKED');
    view.document.open();
    view.document.write(html);
    view.document.close();
    view.focus();
    view.print();
  }
  return { render, printReport };
});
