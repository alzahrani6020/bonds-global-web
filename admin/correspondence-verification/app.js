// Correspondence verification admin module
/* global CorrespondenceVerificationService */
(function () {
  'use strict';

  // Resolved lazily: app.js is loaded in <head>, before the DOM exists.
  function container() { return document.getElementById('cv-content'); }
  function userEl() { return document.getElementById('cv-user'); }

  const state = { page: 1, limit: 20, issue_number: '', from: '', to: '' };
  let lastEvents = [];
  let totalCount = 0;
  let loading = false;
  let error = null;

  function escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtDateTime(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function resultBadge(result) {
    if (result === 'verified') return '<span class="cv-badge cv-badge--ok">ناجح</span>';
    if (result === 'failed') return '<span class="cv-badge cv-badge--fail">فاشل</span>';
    return `<span class="cv-badge cv-badge--neutral">${escapeHtml(result || '-')}</span>`;
  }

  function verifierCell(event) {
    if (!event.actor_user_id) return '<span class="cv-muted">هوية غير مسجلة</span>';
    const id = escapeHtml(event.actor_user_id);
    const email = event.verifier_email ? escapeHtml(event.verifier_email) : '';
    const phone = event.verifier_phone ? escapeHtml(event.verifier_phone) : '';
    return '<div>' + (email || id) + '</div>'
      + (email ? '<small class="cv-muted">' + id + '</small>' : '')
      + (phone ? '<div class="cv-muted">' + phone + '</div>' : '');
  }

  function openLetterButton(documentId) {
    if (!documentId) return '<span class="cv-muted">—</span>';
    const href = '/letterhead.html?document=' + encodeURIComponent(documentId);
    return `<a class="cv-btn" href="${href}" target="_blank" rel="noopener">فتح الخطاب</a>`;
  }

  // Official issues register derived from the currently loaded verification events,
  // since no standalone issues-list admin action exists yet.
  function deriveVerifiedIssues() {
    const byIssue = new Map();
    for (const ev of lastEvents) {
      if (!ev?.issue_id) continue;
      const existing = byIssue.get(ev.issue_id) || {
        issue_id: ev.issue_id,
        issue_number: ev.issue_number || (ev.issue && ev.issue.issue_number) || ev.issue_id,
        document_id: ev.document_id || null,
        latest: ev.created_at,
        count: 0
      };
      existing.count += 1;
      if (ev.created_at > existing.latest) existing.latest = ev.created_at;
      byIssue.set(ev.issue_id, existing);
    }
    return Array.from(byIssue.values()).sort((a, b) => String(b.latest).localeCompare(String(a.latest)));
  }

  function render() {
    const root = container();
    if (!root) return;
    if (loading) {
      root.innerHTML = '<div class="cv-empty"><div class="cv-spinner"></div><p>جارِ تحميل سجل التحقق...</p></div>';
      return;
    }
    if (error) {
      root.innerHTML = `
        <div class="cv-empty">
          <p class="cv-error">${escapeHtml(error)}</p>
          <button class="cv-btn cv-btn--primary" id="cv-retry">إعادة المحاولة</button>
        </div>`;
      document.getElementById('cv-retry')?.addEventListener('click', load);
      return;
    }

    const totalPages = Math.max(Math.ceil(totalCount / state.limit), 1);
    const issues = deriveVerifiedIssues();

    const rows = lastEvents.map(ev => `
      <tr>
        <td>${escapeHtml(fmtDateTime(ev.created_at))}</td>
        <td>${escapeHtml(ev.issue_number || (ev.issue && ev.issue.issue_number) || '-')}</td>
        <td>${escapeHtml(fmtDateTime(ev.issue?.issued_at || ev.document?.issued_at))}</td>
        <td>${escapeHtml(ev.document?.recipient_name || ev.document?.recipient_organization || '-')}</td>
        <td>${escapeHtml(ev.document?.subject || ev.document?.title || '-')}</td>
        <td>${resultBadge(ev.result)}</td>
        <td>${verifierCell(ev)}</td>
        <td>${openLetterButton(ev.document_id)}</td>
      </tr>`).join('');

    const issueRows = issues.map(issue => `
      <tr>
        <td>${escapeHtml(issue.issue_number)}</td>
        <td>${escapeHtml(fmtDateTime(issue.latest))}</td>
        <td>${escapeHtml(String(issue.count))}</td>
        <td>${openLetterButton(issue.document_id)}</td>
      </tr>`).join('');

    root.innerHTML = `
      <section class="cv-card">
        <div class="cv-card__head">
          <h2>سجل التحقق</h2>
          <span class="cv-muted">${escapeHtml(String(totalCount))} عملية</span>
        </div>
        <form class="cv-filters" id="cv-filters">
          <label>
            رقم الخطاب
            <input type="text" name="issue_number" value="${escapeHtml(state.issue_number)}" placeholder="مثال: OUT-2026-0042" />
          </label>
          <label>
            من تاريخ
            <input type="date" name="from" value="${escapeHtml(state.from)}" />
          </label>
          <label>
            إلى تاريخ
            <input type="date" name="to" value="${escapeHtml(state.to)}" />
          </label>
          <div class="cv-filters__actions">
            <button type="submit" class="cv-btn cv-btn--primary">تطبيق</button>
            <button type="button" class="cv-btn" id="cv-reset">مسح</button>
          </div>
        </form>
        <div class="cv-table-wrap">
          <table class="cv-table">
            <thead>
              <tr>
                <th>الوقت</th>
                <th>رقم الخطاب</th>
                <th>تاريخ الإصدار</th>
                <th>الموجّه إليه</th>
                <th>الموضوع</th>
                <th>النتيجة</th>
                <th>معرّف حساب المتحقق</th>
                <th>الخطاب</th>
              </tr>
            </thead>
            <tbody>
              ${rows || '<tr><td colspan="8" class="cv-muted">لا توجد عمليات تحقق بعد.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="cv-pagination">
          <button class="cv-btn" id="cv-prev" ${state.page <= 1 ? 'disabled' : ''}>السابق</button>
          <span>صفحة ${escapeHtml(String(state.page))} من ${escapeHtml(String(totalPages))}</span>
          <button class="cv-btn" id="cv-next" ${state.page >= totalPages ? 'disabled' : ''}>التالي</button>
        </div>
      </section>
      <section class="cv-card">
        <div class="cv-card__head">
          <h2>الخطابات الرسمية الموثقة</h2>
          <span class="cv-muted">مشتقة من سجل التحقق المعروض</span>
        </div>
        <div class="cv-table-wrap">
          <table class="cv-table">
            <thead>
              <tr>
                <th>رقم الخطاب</th>
                <th>آخر تحقق</th>
                <th>عدد عمليات التحقق</th>
                <th>الخطاب</th>
              </tr>
            </thead>
            <tbody>
              ${issueRows || '<tr><td colspan="4" class="cv-muted">لا توجد خطابات موثقة في السجل المعروض.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>`;

    document.getElementById('cv-filters')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = new FormData(e.target);
      state.issue_number = String(form.get('issue_number') || '').trim();
      state.from = String(form.get('from') || '').trim();
      state.to = String(form.get('to') || '').trim();
      state.page = 1;
      load();
    });
    document.getElementById('cv-reset')?.addEventListener('click', () => {
      state.issue_number = '';
      state.from = '';
      state.to = '';
      state.page = 1;
      load();
    });
    document.getElementById('cv-prev')?.addEventListener('click', () => {
      if (state.page > 1) { state.page -= 1; load(); }
    });
    document.getElementById('cv-next')?.addEventListener('click', () => {
      if (state.page < totalPages) { state.page += 1; load(); }
    });
  }

  async function load() {
    loading = true;
    error = null;
    render();
    try {
      const offset = (state.page - 1) * state.limit;
      const data = await CorrespondenceVerificationService.list({
        issue_number: state.issue_number,
        from: state.from,
        to: state.to,
        limit: state.limit,
        offset
      });
      lastEvents = data.events || [];
      totalCount = data.count || 0;
    } catch (err) {
      lastEvents = [];
      totalCount = 0;
      error = err?.message || 'تعذر تحميل سجل التحقق';
    }
    loading = false;
    render();
  }

  async function init() {
    const user = userEl();
    if (window.BondsAuth && BondsAuth.getSession) {
      try {
        const { data } = await BondsAuth.getSession();
        const email = data?.session?.user?.email || window.__ADMIN_USER_EMAIL || '';
        if (user) user.textContent = email ? 'مسجل الدخول: ' + email : 'جلسة إدارية نشطة';
      } catch (e) {
        if (user) user.textContent = 'جلسة إدارية نشطة';
      }
    } else if (user) {
      user.textContent = 'جلسة إدارية نشطة';
    }
    await load();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
