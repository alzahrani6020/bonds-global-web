// Funding Cases admin module
/* global FundingCasesService, DOMPurify */
(function () {
  'use strict';

  const container = document.getElementById('fc-content');
  const userEl = document.getElementById('fc-user');

  const STATUSES = [
    'new', 'initial_review', 'documents_required', 'under_assessment',
    'funding_options', 'submitted_to_provider', 'provider_review',
    'approved', 'declined', 'on_hold', 'closed'
  ];

  const STATUS_COLORS = {
    new: 'neutral',
    initial_review: 'attention',
    documents_required: 'attention',
    under_assessment: 'attention',
    funding_options: 'healthy',
    submitted_to_provider: 'healthy',
    provider_review: 'attention',
    approved: 'healthy',
    declined: 'at-risk',
    on_hold: 'attention',
    closed: 'neutral'
  };

  const DOCUMENT_TYPES = {
    commercial_register: 'السجل التجاري',
    financial_statements: 'القوائم المالية',
    bank_statement: 'كشف الحساب البنكي',
    id_copy: 'صورة الهوية',
    project_plan: 'خطة المشروع',
    other: 'مستند آخر'
  };

  let currentFilters = { page: 1, limit: 20 };
  let statusLabels = {};
  let sourceOptions = [];
  let financingTypeOptions = [];
  let assignees = [];
  let kpis = null;

  function escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtMoney(amount, currency) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return '-';
    return n.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' ' + (currency || 'SAR');
  }

  function fmtDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function fmtDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function toDateTimeLocal(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 16);
  }

  function statusBadge(status) {
    const label = statusLabels.ar?.[status] || status;
    const type = STATUS_COLORS[status] || 'neutral';
    return `<span class="status-badge status-badge--${type}">${escapeHtml(label)}</span>`;
  }

  function sourceLabel(source) {
    const map = {
      'funding-hub': 'Funding Hub',
      readiness: 'اختبار الجاهزية',
      calculator: 'حاسبة',
      'funding-sources': 'مصادر التمويل',
      'financial-advisory': 'استشاري مالي',
      'economic-intelligence': 'ذكاء اقتصادي',
      'sector-real-estate': 'قطاع عقاري',
      'sector-industrial': 'قطاع صناعي',
      'sector-hospitality': 'قطاع ضيافة',
      'sector-healthcare': 'قطاع صحي',
      direct: 'مباشر'
    };
    return map[source] || source;
  }

  function setContent(html) {
    if (!container) return;
    container.innerHTML = html;
  }

  function showLoading(message) {
    setContent('<div class="fc-empty"><div class="fc-spinner"></div><p>' + escapeHtml(message || 'جارِ التحميل...') + '</p></div>');
  }

  function showError(message) {
    setContent('<div class="fc-empty"><p class="fc-error-text">' + escapeHtml(message) + '</p><button class="ecc-btn ecc-btn--primary" onclick="window.FundingCasesApp.loadList()">إعادة المحاولة</button></div>');
  }

  function buildKpiCards() {
    if (!kpis) return '';
    return `
      <div class="fc-kpis">
        <div class="fc-kpi"><div class="fc-kpi__num">${(kpis.total || 0).toLocaleString('ar-SA')}</div><div class="fc-kpi__label">إجمالي الطلبات</div></div>
        <div class="fc-kpi"><div class="fc-kpi__num">${(kpis.newThisWeek || 0).toLocaleString('ar-SA')}</div><div class="fc-kpi__label">جديد هذا الأسبوع</div></div>
        <div class="fc-kpi fc-kpi--danger"><div class="fc-kpi__num">${(kpis.overdue || 0).toLocaleString('ar-SA')}</div><div class="fc-kpi__label">متأخر عن المتابعة</div></div>
        <div class="fc-kpi"><div class="fc-kpi__num">${fmtMoney(kpis.avgAmount)}</div><div class="fc-kpi__label">متوسط المبلغ</div></div>
        <div class="fc-kpi"><div class="fc-kpi__num">${kpis.conversionRate || 0}%</div><div class="fc-kpi__label">معدل الموافقة</div></div>
      </div>
    `;
  }

  function buildFilters() {
    const statusOptions = STATUSES.map(s => `<option value="${s}">${escapeHtml(statusLabels.ar?.[s] || s)}</option>`).join('');
    const sourceOpts = sourceOptions.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(sourceLabel(s))}</option>`).join('');
    const typeOpts = financingTypeOptions.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');

    return `
      <div class="fc-toolbar">
        <div class="fc-search">
          <input type="text" id="fc-search" class="ecc-input" placeholder="البحث برقم الطلب، الشركة، البريد أو الجوال" value="${escapeHtml(currentFilters.search || '')}">
          <button class="ecc-btn ecc-btn--primary" id="fc-search-btn">بحث</button>
        </div>
        <div class="fc-filters">
          <select id="fc-filter-status" class="ecc-select"><option value="">كل الحالات</option>${statusOptions}</select>
          <select id="fc-filter-source" class="ecc-select"><option value="">كل المصادر</option>${sourceOpts}</select>
          <select id="fc-filter-type" class="ecc-select"><option value="">كل أنواع التمويل</option>${typeOpts}</select>
          <button class="ecc-btn ecc-btn--ghost" id="fc-reset-filters">مسح</button>
        </div>
      </div>
    `;
  }

  function buildPagination(pagination) {
    if (pagination.pages <= 1) return '';
    let pages = '';
    for (let i = 1; i <= pagination.pages; i++) {
      pages += `<button class="fc-page ${i === pagination.page ? 'is-active' : ''}" data-page="${i}">${i}</button>`;
    }
    return `<div class="fc-pagination">${pages}</div>`;
  }

  function buildListTable(cases) {
    const rows = cases.map(c => `
      <tr data-id="${c.id}">
        <td><code dir="ltr">${escapeHtml(c.case_reference)}</code></td>
        <td>${escapeHtml(c.company)}</td>
        <td>${fmtMoney(c.amount)}</td>
        <td>${escapeHtml(c.financing_type || '-')}</td>
        <td>${escapeHtml(sourceLabel(c.source))}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${fmtDate(c.next_action_at || c.created_at)}</td>
        <td><button class="ecc-btn ecc-btn--sm fc-open-case" data-id="${c.id}">فتح</button></td>
      </tr>
    `).join('');

    return `
      <div class="fc-table-wrap">
        <table class="ecc-table fc-table">
          <thead>
            <tr>
              <th>الرقم</th>
              <th>الشركة</th>
              <th>المبلغ</th>
              <th>نوع التمويل</th>
              <th>المصدر</th>
              <th>الحالة</th>
              <th>الموعد</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8" class="fc-empty-cell">لا توجد طلبات تمويل</td></tr>'}</tbody>
        </table>
      </div>
    `;
  }

  function buildListCards(cases) {
    if (!cases.length) return '<div class="fc-empty">لا توجد طلبات تمويل</div>';
    return cases.map(c => `
      <div class="fc-card" data-id="${c.id}">
        <div class="fc-card-header">
          <code dir="ltr">${escapeHtml(c.case_reference)}</code>
          ${statusBadge(c.status)}
        </div>
        <div class="fc-card-body">
          <div class="fc-card-row"><span>الشركة</span><span>${escapeHtml(c.company)}</span></div>
          <div class="fc-card-row"><span>المبلغ</span><span>${fmtMoney(c.amount)}</span></div>
          <div class="fc-card-row"><span>نوع التمويل</span><span>${escapeHtml(c.financing_type || '-')}</span></div>
          <div class="fc-card-row"><span>المصدر</span><span>${escapeHtml(sourceLabel(c.source))}</span></div>
          <div class="fc-card-row"><span>التاريخ</span><span>${fmtDate(c.created_at)}</span></div>
        </div>
        <div class="fc-card-actions">
          <button class="ecc-btn ecc-btn--primary fc-open-case" data-id="${c.id}">فتح</button>
        </div>
      </div>
    `).join('');
  }

  function renderList(data) {
    const { cases, pagination } = data;
    statusLabels = data.statusLabels || statusLabels;

    const html = `
      <div class="fc-header">
        <h1>طلبات التمويل</h1>
        <p>إدارة ومتابعة طلبات التمويل القادمة من الأدوات المختلفة.</p>
      </div>
      ${buildKpiCards()}
      ${buildFilters()}
      <div class="fc-desktop">${buildListTable(cases)}</div>
      <div class="fc-mobile">${buildListCards(cases)}</div>
      ${buildPagination(pagination)}
    `;
    setContent(html);
    bindListEvents();
    applyFilterValues();
  }

  function applyFilterValues() {
    const statusEl = document.getElementById('fc-filter-status');
    const sourceEl = document.getElementById('fc-filter-source');
    const typeEl = document.getElementById('fc-filter-type');
    const searchEl = document.getElementById('fc-search');
    if (statusEl) statusEl.value = currentFilters.status || '';
    if (sourceEl) sourceEl.value = currentFilters.source || '';
    if (typeEl) typeEl.value = currentFilters.financingType || '';
    if (searchEl) searchEl.value = currentFilters.search || '';
  }

  function bindListEvents() {
    document.querySelectorAll('.fc-open-case').forEach(btn => {
      btn.addEventListener('click', () => loadDetail(btn.dataset.id));
    });
    document.querySelectorAll('.fc-page').forEach(btn => {
      btn.addEventListener('click', () => {
        currentFilters.page = parseInt(btn.dataset.page, 10);
        loadList();
      });
    });
    const searchBtn = document.getElementById('fc-search-btn');
    const searchInput = document.getElementById('fc-search');
    if (searchBtn) searchBtn.addEventListener('click', () => applySearch());
    if (searchInput) searchInput.addEventListener('keypress', e => { if (e.key === 'Enter') applySearch(); });

    ['fc-filter-status', 'fc-filter-source', 'fc-filter-type'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('change', applyFilters);
    });

    const resetBtn = document.getElementById('fc-reset-filters');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      currentFilters = { page: 1, limit: 20 };
      loadList();
    });
  }

  function applySearch() {
    const val = document.getElementById('fc-search')?.value || '';
    currentFilters.search = val.trim();
    currentFilters.page = 1;
    loadList();
  }

  function applyFilters() {
    currentFilters.status = document.getElementById('fc-filter-status')?.value || '';
    currentFilters.source = document.getElementById('fc-filter-source')?.value || '';
    currentFilters.financingType = document.getElementById('fc-filter-type')?.value || '';
    currentFilters.page = 1;
    loadList();
  }

  function buildTimeline(events) {
    if (!events.length) return '<p class="fc-muted">لا توجد أحداث مسجلة.</p>';
    return events.map(e => `
      <div class="fc-timeline-item">
        <div class="fc-timeline-meta">${fmtDateTime(e.created_at)} · ${escapeHtml(e.actor_email || 'النظام')}</div>
        <div class="fc-timeline-title">${escapeHtml(eventTypeLabel(e.event_type))}</div>
        ${e.from_status && e.to_status ? `<div class="fc-timeline-change">${statusBadge(e.from_status)} → ${statusBadge(e.to_status)}</div>` : ''}
        ${e.note ? `<div class="fc-timeline-note">${escapeHtml(e.note)}</div>` : ''}
        ${e.notification_sent ? `<div class="fc-timeline-note fc-timeline-note--success">✓ تم إرسال إشعار للعميل</div>` : ''}
      </div>
    `).join('');
  }

  function eventTypeLabel(type) {
    const map = {
      case_created: 'إنشاء الطلب',
      status_changed: 'تغيير الحالة',
      assigned: 'تعيين مستشار',
      note_added: 'ملاحظة',
      contact: 'تواصل / ربط',
      document_requested: 'طلب مستند',
      document_received: 'استلام مستند',
      submitted_to_provider: 'تقديم للجهة',
      case_closed: 'إغلاق الطلب'
    };
    return map[type] || type;
  }

  function buildDocuments(documents) {
    if (!documents.length) return '<p class="fc-muted">لا توجد مستندات.</p>';
    return documents.map(d => `
      <div class="fc-doc">
        <div>
          <div>${escapeHtml(d.file_name)}</div>
          <div class="fc-muted">${(Number(d.file_size) / 1024).toFixed(1)} KB · ${documentTypeLabel(d.document_type)}</div>
        </div>
        ${d.signedUrl ? `<a class="ecc-btn ecc-btn--sm" href="${escapeHtml(d.signedUrl)}" target="_blank" rel="noopener" download>تحميل</a>` : ''}
      </div>
    `).join('');
  }

  function documentTypeLabel(type) {
    const map = { uploaded: 'مرفق من العميل', required: 'مطلوب', received: 'مستلم من الإدارة' };
    return map[type] || type;
  }

  function buildAssigneeOptions(selectedId) {
    if (!assignees.length) return `<option value="">لا يوجد مسؤولون</option>`;
    const opts = assignees.map(a => `<option value="${escapeHtml(a.id)}" ${a.id === selectedId ? 'selected' : ''}>${escapeHtml(a.label)}</option>`).join('');
    return `<option value="">غير معيّن</option>${opts}`;
  }

  function buildStatusOptions(currentStatus, allowedTransitions) {
    const allowed = new Set(allowedTransitions || []);
    return STATUSES.map(s => {
      const disabled = s !== currentStatus && !allowed.has(s) ? 'disabled' : '';
      return `<option value="${s}" ${currentStatus === s ? 'selected' : ''} ${disabled}>${escapeHtml(statusLabels.ar?.[s] || s)}</option>`;
    }).join('');
  }

  function buildAdvisorySection(c) {
    if (c.client_id || c.project_id) {
      return `
        <div class="fc-advisory-link">
          <p class="fc-muted">تم الربط بالاستشارات المالية.</p>
          ${c.client_id ? `<div>عميل: <code dir="ltr">${escapeHtml(c.client_id)}</code></div>` : ''}
          ${c.project_id ? `<div>مشروع: <code dir="ltr">${escapeHtml(c.project_id)}</code></div>` : ''}
        </div>
      `;
    }
    return `<button class="ecc-btn ecc-btn--ghost fc-create-advisory" data-id="${c.id}">إنشاء عميل/مشروع استشاري</button>`;
  }

  function renderDetail(data) {
    const c = data.case;
    statusLabels = data.statusLabels || statusLabels;
    const allowedTransitions = data.allowedTransitions || [];

    const statusOptions = buildStatusOptions(c.status, allowedTransitions);
    const assigneeOptions = buildAssigneeOptions(c.assigned_to);
    const isOverdue = c.next_action_at && new Date(c.next_action_at) < new Date();
    const deadlineClass = isOverdue ? 'fc-deadline--overdue' : '';

    const html = `
      <div class="fc-detail-header">
        <button class="ecc-btn ecc-btn--ghost fc-back">← العودة للقائمة</button>
        <h1 dir="ltr">${escapeHtml(c.case_reference)}</h1>
        ${statusBadge(c.status)}
      </div>

      <div class="fc-detail-grid">
        <div class="fc-detail-main">
          <section class="fc-section">
            <h2>بيانات العميل</h2>
            <div class="fc-grid-2">
              <div class="fc-field"><label>الاسم</label><div>${escapeHtml(c.name)}</div></div>
              <div class="fc-field"><label>الشركة</label><div>${escapeHtml(c.company)}</div></div>
              <div class="fc-field"><label>البريد</label><div dir="ltr">${escapeHtml(c.email)}</div></div>
              <div class="fc-field"><label>الجوال</label><div dir="ltr">${escapeHtml(c.phone || '-')}</div></div>
              <div class="fc-field"><label>الدولة</label><div>${escapeHtml(c.country || '-')}</div></div>
              <div class="fc-field"><label>المصدر</label><div>${escapeHtml(sourceLabel(c.source))}</div></div>
            </div>
          </section>

          <section class="fc-section">
            <h2>تفاصيل التمويل</h2>
            <div class="fc-grid-2">
              <div class="fc-field"><label>نوع التمويل</label><div>${escapeHtml(c.financing_type || '-')}</div></div>
              <div class="fc-field"><label>المبلغ</label><div>${fmtMoney(c.amount)}</div></div>
              <div class="fc-field"><label>الغرض</label><div>${escapeHtml(c.purpose_category || '-')}</div></div>
              <div class="fc-field"><label>القطاع</label><div>${escapeHtml(c.sector || '-')}</div></div>
              <div class="fc-field"><label>درجة الجاهزية</label><div>${c.readiness_score ?? '-'}</div></div>
            </div>
            <div class="fc-field"><label>الخطاب الموجه</label><div class="fc-box">${escapeHtml(c.letter || '-')}</div></div>
            <div class="fc-field"><label>تفاصيل إضافية</label><div class="fc-box">${escapeHtml(c.purpose || '-')}</div></div>
          </section>

          <section class="fc-section">
            <h2>الخط الزمني</h2>
            <div class="fc-timeline">${buildTimeline(data.events)}</div>
          </section>
        </div>

        <div class="fc-detail-side">
          <section class="fc-section fc-sticky">
            <h2>إدارة الحالة</h2>
            <div class="fc-field">
              <label for="fc-detail-status">الحالة</label>
              <select id="fc-detail-status" class="ecc-select">${statusOptions}</select>
            </div>
            <div class="fc-field">
              <label for="fc-detail-assigned">تعيين إلى</label>
              <select id="fc-detail-assigned" class="ecc-select">${assigneeOptions}</select>
            </div>
            <div class="fc-field">
              <label for="fc-detail-next">الإجراء التالي</label>
              <input type="datetime-local" id="fc-detail-next" class="ecc-input ${deadlineClass}" value="${toDateTimeLocal(c.next_action_at)}">
            </div>
            <div class="fc-field">
              <label for="fc-detail-sla">موعد SLA</label>
              <input type="datetime-local" id="fc-detail-sla" class="ecc-input" value="${toDateTimeLocal(c.sla_deadline_at)}">
            </div>
            <div class="fc-field">
              <label for="fc-detail-provider">اسم الجهة التمويلية</label>
              <input type="text" id="fc-detail-provider" class="ecc-input" value="${escapeHtml(c.provider_name || '')}">
            </div>
            <div class="fc-field">
              <label for="fc-detail-internal">ملاحظات داخلية</label>
              <textarea id="fc-detail-internal" class="ecc-textarea" rows="3">${escapeHtml(c.internal_notes || '')}</textarea>
            </div>
            <button class="ecc-btn ecc-btn--primary fc-update" data-id="${c.id}">حفظ التغييرات</button>

            <hr class="fc-divider">

            <div class="fc-field">
              <label for="fc-detail-note">إضافة ملاحظة للعميل/الخط الزمني</label>
              <textarea id="fc-detail-note" class="ecc-textarea" rows="3"></textarea>
            </div>
            <button class="ecc-btn ecc-btn--ghost fc-add-note" data-id="${c.id}">إضافة ملاحظة</button>

            <hr class="fc-divider">

            <h3>المستندات</h3>
            <div class="fc-field">
              <label>طلب مستند من العميل</label>
              <select id="fc-doc-request-type" class="ecc-select">
                ${Object.entries(DOCUMENT_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
              </select>
              <textarea id="fc-doc-request-note" class="ecc-textarea" rows="2" placeholder="ملاحظة اختيارية..."></textarea>
              <button class="ecc-btn ecc-btn--ghost fc-request-doc" data-id="${c.id}">طلب المستند</button>
            </div>
            <div class="fc-field">
              <label>رفع مستند من الإدارة</label>
              <input type="file" id="fc-doc-upload" class="ecc-input" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg">
              <button class="ecc-btn ecc-btn--ghost fc-upload-doc" data-id="${c.id}">رفع المستند</button>
            </div>

            <hr class="fc-divider">

            ${buildAdvisorySection(c)}

            <hr class="fc-divider">

            <div class="fc-actions">
              <a class="ecc-btn ecc-btn--sm" href="mailto:${escapeHtml(c.email)}">إرسال بريد</a>
              <a class="ecc-btn ecc-btn--sm" href="https://wa.me/${String(c.phone || '').replace(/\D/g, '')}" target="_blank" rel="noopener">واتساب</a>
            </div>
          </section>

          <section class="fc-section">
            <h2>المستندات المرفقة</h2>
            ${buildDocuments(data.documents)}
          </section>
        </div>
      </div>
    `;
    setContent(html);
    bindDetailEvents(c.id);
  }

  async function readFileAsBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result !== 'string') return reject(new Error('Failed to read file'));
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  function bindDetailEvents(caseId) {
    document.querySelector('.fc-back')?.addEventListener('click', loadList);

    document.querySelector('.fc-update')?.addEventListener('click', async () => {
      const status = document.getElementById('fc-detail-status')?.value;
      const assigned = document.getElementById('fc-detail-assigned')?.value || null;
      const next = document.getElementById('fc-detail-next')?.value || null;
      const sla = document.getElementById('fc-detail-sla')?.value || null;
      const provider = document.getElementById('fc-detail-provider')?.value.trim() || null;
      const internal = document.getElementById('fc-detail-internal')?.value.trim() || null;

      const updates = { status };
      updates.assigned_to = assigned;
      updates.next_action_at = next ? new Date(next).toISOString() : null;
      updates.sla_deadline_at = sla ? new Date(sla).toISOString() : null;
      updates.provider_name = provider;
      updates.internal_notes = internal;

      try {
        await FundingCasesService.update(caseId, updates);
        showToast('تم حفظ التغييرات');
        loadDetail(caseId);
      } catch (err) {
        showToast(err.message || 'فشل الحفظ', 'error');
      }
    });

    document.querySelector('.fc-add-note')?.addEventListener('click', async () => {
      const note = document.getElementById('fc-detail-note')?.value.trim();
      if (!note) return;
      try {
        await FundingCasesService.addNote(caseId, note);
        showToast('تمت إضافة الملاحظة');
        loadDetail(caseId);
      } catch (err) {
        showToast(err.message || 'فشل إضافة الملاحظة', 'error');
      }
    });

    document.querySelector('.fc-request-doc')?.addEventListener('click', async () => {
      const type = document.getElementById('fc-doc-request-type')?.value;
      const note = document.getElementById('fc-doc-request-note')?.value.trim();
      try {
        await FundingCasesService.requestDocument(caseId, type, note);
        showToast('تم طلب المستند');
        loadDetail(caseId);
      } catch (err) {
        showToast(err.message || 'فشل طلب المستند', 'error');
      }
    });

    document.querySelector('.fc-upload-doc')?.addEventListener('click', async () => {
      const input = document.getElementById('fc-doc-upload');
      const file = input?.files?.[0];
      if (!file) return showToast('اختر ملفاً أولاً', 'error');
      try {
        const data = await readFileAsBase64(file);
        await FundingCasesService.uploadDocument(caseId, { name: file.name, type: file.type, data });
        showToast('تم رفع المستند');
        input.value = '';
        loadDetail(caseId);
      } catch (err) {
        showToast(err.message || 'فشل رفع المستند', 'error');
      }
    });

    document.querySelector('.fc-create-advisory')?.addEventListener('click', async () => {
      try {
        await FundingCasesService.linkAdvisory(caseId, { createNew: true });
        showToast('تم الربط بالاستشارات المالية');
        loadDetail(caseId);
      } catch (err) {
        showToast(err.message || 'فشل الربط', 'error');
      }
    });
  }

  function showToast(message, type = 'success') {
    const existing = document.querySelector('.fc-toast');
    if (existing) existing.remove();
    const el = document.createElement('div');
    el.className = 'fc-toast fc-toast--' + type;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.classList.add('is-visible'), 10);
    setTimeout(() => { el.classList.remove('is-visible'); setTimeout(() => el.remove(), 300); }, 2500);
  }

  async function loadList() {
    showLoading('جارِ تحميل طلبات التمويل...');
    try {
      const [data, kpiData] = await Promise.all([
        FundingCasesService.list(currentFilters),
        FundingCasesService.getKpis().catch(() => null)
      ]);
      kpis = kpiData?.kpis || null;
      sourceOptions = [...new Set((data.cases || []).map(c => c.source).filter(Boolean))];
      financingTypeOptions = [...new Set((data.cases || []).map(c => c.financing_type).filter(Boolean))];
      renderList(data);
    } catch (err) {
      showError(err.message || 'تعذر تحميل الطلبات');
    }
  }

  async function loadDetail(id) {
    showLoading('جارِ تحميل تفاصيل الطلب...');
    try {
      if (!assignees.length) {
        const assigneeData = await FundingCasesService.listAssignees().catch(() => ({ assignees: [] }));
        assignees = assigneeData.assignees || [];
      }
      const data = await FundingCasesService.detail(id);
      renderDetail(data);
    } catch (err) {
      showError(err.message || 'تعذر تحميل التفاصيل');
    }
  }

  async function init() {
    try {
      const assigneeData = await FundingCasesService.listAssignees().catch(() => ({ assignees: [] }));
      assignees = assigneeData.assignees || [];
    } catch (e) {
      assignees = [];
    }
    loadList();
    if (window.BondsAuth && BondsAuth.getUser) {
      BondsAuth.getUser().then(user => {
        if (userEl) userEl.textContent = user?.email || 'غير معروف';
      });
    }
  }

  window.FundingCasesApp = { loadList, loadDetail, init };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
