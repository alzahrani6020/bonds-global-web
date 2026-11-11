(function () {
  'use strict';

  const isEn = (document.documentElement.lang || '').toLowerCase().startsWith('en');
  const t = {
    save: isEn ? 'Save version' : 'حفظ إصدار',
    submit: isEn ? 'Submit' : 'إرسال للمراجعة',
    review: isEn ? 'Start review' : 'بدء المراجعة',
    approve: isEn ? 'Approve' : 'اعتماد',
    return: isEn ? 'Return' : 'إعادة للتعديل',
    reject: isEn ? 'Reject' : 'رفض',
    sign: isEn ? 'Sign' : 'توقيع',
    issue: isEn ? 'Issue' : 'إصدار',
    stamp: isEn ? 'Stamp' : 'ختم',
    send: isEn ? 'Send' : 'إرسال',
    archive: isEn ? 'Archive' : 'أرشفة',
    status: isEn ? 'Status' : 'الحالة',
    ref: isEn ? 'Reference' : 'رقم الصادر',
    noRef: isEn ? 'Not issued' : 'غير مُصدر',
    saved: isEn ? 'Version saved' : 'تم حفظ الإصدار',
    auth: isEn ? 'Authentication required' : 'يجب تسجيل الدخول',
    loadFail: isEn ? 'Failed to load correspondence' : 'تعذر تحميل المراسلات',
    notAllowed: isEn ? 'This action is not allowed in the current status' : 'هذا الإجراء غير مسموح في الحالة الحالية',
    externalTranslate: isEn ? 'The selected text will be sent to Google Translate. Continue?' : 'سيتم إرسال النص المحدد إلى Google Translate. هل تريد المتابعة؟'
  };

  const ADMIN = new Set(['super_admin', 'admin']);
  const state = {
    document: null,
    latestVersion: null,
    events: [],
    role: 'user',
    list: [],
    lastSavedSnapshot: '',
    history: [],
    future: [],
    lastHistorySnapshot: '',
    loading: false
  };

  const legacy = {
    openSignatureModal: window.openSignatureModal,
    saveSignature: window.saveSignature,
    toggleWrite: window.toggleWrite
  };

  function toast(message) {
    if (typeof window.showToast === 'function') window.showToast(message);
  }

  async function authHeaders() {
    const session = await window.BondsAuth?.getSession?.();
    const token = session?.data?.session?.access_token || '';
    if (!token) throw Object.assign(new Error(t.auth), { status: 401 });
    return { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token };
  }

  async function api(action, options = {}) {
    const method = options.method || 'GET';
    const params = new URLSearchParams({ action });
    if (options.id) params.set('id', options.id);
    if (options.token) params.set('token', options.token);
    if (options.status) params.set('status', options.status);
    if (options.direction) params.set('direction', options.direction);
    const headers = action === 'verify' ? {} : await authHeaders();
    const res = await fetch('/api/correspondence?' + params.toString(), {
      method,
      headers,
      body: method === 'GET' ? undefined : JSON.stringify({ ...(options.body || {}), id: options.id })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || ('HTTP ' + res.status)), { status: res.status, data });
    return data;
  }

  function pagesHtml() {
    return Array.from(document.querySelectorAll('.doc-content')).map(d => d.innerHTML);
  }

  function textContent() {
    return Array.from(document.querySelectorAll('.doc-content')).map(d => d.innerText.trim()).join('\n\n').trim();
  }

  function snapshot() {
    return JSON.stringify(pagesHtml());
  }

  function currentWorkspaceContext() {
    const p = new URLSearchParams(location.search);
    const keys = ['service', 'workspace', 'project_id', 'client_id', 'funding_case_id', 'request_id'];
    const ctx = {};
    keys.forEach(k => { if (p.get(k)) ctx[k] = p.get(k); });
    ctx.source = 'letterhead';
    ctx.path = location.pathname;
    return ctx;
  }

  function subjectFromText(text) {
    const re = isEn ? /Subject\s*:\s*([^\n]+)/i : /الموضوع\s*:\s*([^\n]+)/;
    return (text.match(re)?.[1] || '').trim().slice(0, 500) || null;
  }

  function titleFromText(text) {
    const subject = subjectFromText(text);
    if (subject) return subject.slice(0, 200);
    const words = text.split(/\s+/).filter(Boolean).slice(0, 8).join(' ');
    return words.slice(0, 200) || (isEn ? 'Untitled letter' : 'خطاب بدون عنوان');
  }

  function editable() {
    return !state.document || ['draft', 'returned'].includes(state.document.status);
  }

  function isAdmin() {
    return ADMIN.has(state.role);
  }

  function setEditorEditable(enabled) {
    document.querySelectorAll('.doc-content').forEach(d => {
      if (!enabled) d.contentEditable = 'false';
    });
  }

  function setPages(pages) {
    if (!Array.isArray(pages) || !pages.length) pages = [''];
    const container = document.getElementById('pages-container');
    if (!container) return;
    let sheets = Array.from(container.querySelectorAll('.sheet'));
    if (!sheets.length) return;
    while (sheets.length > pages.length) {
      sheets.pop().remove();
    }
    while (sheets.length < pages.length) {
      const clone = sheets[sheets.length - 1].cloneNode(true);
      container.appendChild(clone);
      sheets.push(clone);
    }
    sheets.forEach((sheet, i) => {
      sheet.dataset.page = String(i + 1);
      const doc = sheet.querySelector('.doc-content');
      if (doc) {
        doc.id = 'doc-' + (i + 1);
        doc.innerHTML = pages[i] || '';
        doc.contentEditable = 'false';
        doc.setAttribute('spellcheck', 'true');
      }
    });
    document.querySelectorAll('.page-number').forEach((el, i) => {
      el.textContent = isEn ? `Page ${i + 1} of ${pages.length}` : `الصفحة ${i + 1} من ${pages.length}`;
    });
    state.lastHistorySnapshot = snapshot();
    state.lastSavedSnapshot = snapshot();
  }

  function currentDocId() {
    return state.document?.id || new URLSearchParams(location.search).get('document') || localStorage.getItem('bonds_letterhead_current_document') || '';
  }

  function syncUrl(id) {
    if (!id) return;
    const url = new URL(location.href);
    url.searchParams.set('document', id);
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    try { localStorage.setItem('bonds_letterhead_current_document', id); } catch (_) {}
  }

  async function ensureDocument() {
    if (state.document) return state.document;
    const existing = currentDocId();
    if (existing) {
      try {
        await loadDocument(existing);
        if (state.document) return state.document;
      } catch (_) {}
    }
    const text = textContent();
    const result = await api('create', {
      method: 'POST',
      body: {
        language: isEn ? 'en' : 'ar',
        direction: 'outgoing',
        document_type: 'letter',
        title: titleFromText(text),
        subject: subjectFromText(text),
        priority: document.getElementById('corr-priority')?.value || 'normal',
        confidentiality: document.getElementById('corr-confidentiality')?.value || 'internal',
        workspace_context: currentWorkspaceContext()
      }
    });
    state.document = result.document;
    state.role = result.role || state.role;
    syncUrl(state.document.id);
    renderGovernance();
    return state.document;
  }

  async function saveVersion(silent) {
    if (state.loading) return;
    const snap = snapshot();
    if (state.document && snap === state.lastSavedSnapshot) {
      if (!silent) toast(isEn ? 'No changes to save' : 'لا توجد تغييرات جديدة');
      return state.document;
    }
    if (!editable()) throw new Error(isEn ? 'Issued documents are locked' : 'المستند المُصدر مقفل ضد التعديل');
    state.loading = true;
    try {
      const doc = await ensureDocument();
      const text = textContent();
      const result = await api('save-version', {
        method: 'POST',
        id: doc.id,
        body: {
          pages_html: pagesHtml(),
          text_content: text,
          title: titleFromText(text),
          subject: subjectFromText(text),
          priority: document.getElementById('corr-priority')?.value || doc.priority || 'normal',
          confidentiality: document.getElementById('corr-confidentiality')?.value || doc.confidentiality || 'internal',
          workspace_context: currentWorkspaceContext()
        }
      });
      state.document = result.document;
      state.lastSavedSnapshot = snap;
      try { localStorage.setItem('bonds_letterhead_offline_backup', snap); } catch (_) {}
      if (!silent) toast('✅ ' + t.saved + ' #' + result.version);
      renderGovernance();
      return state.document;
    } finally {
      state.loading = false;
    }
  }

  async function transition(target, note) {
    const doc = await ensureDocument();
    const result = await api('transition', { method: 'POST', id: doc.id, body: { target, note: note || null } });
    state.document = result.document;
    renderGovernance();
    if (!editable()) setEditorEditable(false);
    toast('✅ ' + t.status + ': ' + state.document.status);
    await refreshInboxDynamic();
    return state.document;
  }

  async function mark(action, body = {}) {
    const doc = await ensureDocument();
    const result = await api(action, { method: 'POST', id: doc.id, body });
    state.document = result.document;
    renderGovernance();
    return state.document;
  }

  async function loadDocument(id) {
    const result = await api('get', { id });
    state.document = result.document;
    state.latestVersion = result.latest_version;
    state.events = result.events || [];
    state.role = result.role || 'user';
    syncUrl(state.document.id);
    if (state.latestVersion?.pages_html) setPages(state.latestVersion.pages_html);
    document.getElementById('corr-priority') && (document.getElementById('corr-priority').value = state.document.priority || 'normal');
    document.getElementById('corr-confidentiality') && (document.getElementById('corr-confidentiality').value = state.document.confidentiality || 'internal');
    setEditorEditable(editable());
    renderGovernance();
    renderGovernanceArtifacts();
    updateVerificationQr();
    return state.document;
  }

  function addButton(parent, id, label, handler) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = id;
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', () => Promise.resolve(handler()).catch(e => toast('⚠️ ' + e.message)));
      parent.appendChild(btn);
    }
    return btn;
  }

  function buildGovernanceBar() {
    if (document.getElementById('correspondence-governance')) return;
    const bar = document.createElement('div');
    bar.id = 'correspondence-governance';
    bar.setAttribute('style', 'position:sticky;top:0;z-index:80;display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:10px 14px;background:#fff;border-bottom:1px solid #dbe3ec;font:13px/1.4 system-ui;color:#0a2342;');
    bar.innerHTML = `
      <strong id="corr-status">${t.status}: draft</strong>
      <span id="corr-reference">${t.ref}: ${t.noRef}</span>
      <label>${isEn ? 'Priority' : 'الأولوية'}
        <select id="corr-priority">
          <option value="low">${isEn ? 'Low' : 'منخفضة'}</option>
          <option value="normal" selected>${isEn ? 'Normal' : 'عادية'}</option>
          <option value="high">${isEn ? 'High' : 'عالية'}</option>
          <option value="urgent">${isEn ? 'Urgent' : 'عاجلة'}</option>
        </select>
      </label>
      <label>${isEn ? 'Confidentiality' : 'السرية'}
        <select id="corr-confidentiality">
          <option value="public">${isEn ? 'Public' : 'عام'}</option>
          <option value="internal" selected>${isEn ? 'Internal' : 'داخلي'}</option>
          <option value="confidential">${isEn ? 'Confidential' : 'سري'}</option>
          <option value="restricted">${isEn ? 'Restricted' : 'مقيد'}</option>
        </select>
      </label>
      <span id="corr-actions" style="display:flex;flex-wrap:wrap;gap:6px"></span>
    `;
    const pages = document.getElementById('pages-container');
    pages?.parentNode?.insertBefore(bar, pages);
    const actions = document.getElementById('corr-actions');
    addButton(actions, 'corr-save', t.save, () => saveVersion(false));
    addButton(actions, 'corr-submit', t.submit, () => transition('submitted'));
    addButton(actions, 'corr-review', t.review, () => transition('under_review'));
    addButton(actions, 'corr-approve', t.approve, () => transition('approved'));
    addButton(actions, 'corr-return', t.return, () => transition('returned'));
    addButton(actions, 'corr-reject', t.reject, () => transition('rejected'));
    addButton(actions, 'corr-sign', t.sign, () => window.openSignatureModal());
    addButton(actions, 'corr-issue', t.issue, () => transition('issued'));
    addButton(actions, 'corr-stamp', t.stamp, () => window.insertStamp());
    addButton(actions, 'corr-send', t.send, () => window.sendToManager());
    addButton(actions, 'corr-archive', t.archive, () => transition('archived'));
  }

  function renderGovernance() {
    buildGovernanceBar();
    const doc = state.document;
    const status = doc?.status || 'draft';
    const statusEl = document.getElementById('corr-status');
    const refEl = document.getElementById('corr-reference');
    if (statusEl) statusEl.textContent = t.status + ': ' + status;
    if (refEl) refEl.textContent = t.ref + ': ' + (doc?.reference_number || t.noRef);
    if (doc) {
      const p = document.getElementById('corr-priority');
      const c = document.getElementById('corr-confidentiality');
      if (p) { p.value = doc.priority || 'normal'; p.disabled = !editable(); }
      if (c) { c.value = doc.confidentiality || 'internal'; c.disabled = !editable(); }
    }

    const show = (id, yes) => {
      const el = document.getElementById(id);
      if (el) el.style.display = yes ? '' : 'none';
    };
    show('corr-save', editable());
    show('corr-submit', ['draft','returned'].includes(status));
    show('corr-review', isAdmin() && status === 'submitted');
    show('corr-approve', isAdmin() && status === 'under_review');
    show('corr-return', isAdmin() && ['submitted','under_review','approved'].includes(status));
    show('corr-reject', isAdmin() && ['submitted','under_review','approved'].includes(status));
    show('corr-sign', isAdmin() && status === 'approved' && !doc?.signed_by);
    show('corr-issue', isAdmin() && status === 'approved' && !!doc?.signed_by);
    show('corr-stamp', isAdmin() && status === 'approved' && !doc?.stamped_by);
    show('corr-send', isAdmin() && status === 'issued');
    show('corr-archive', isAdmin() && ['issued','sent'].includes(status));
    renderGovernanceArtifacts();
    updateVerificationQr();
  }

  function renderGovernanceArtifacts() {
    document.querySelectorAll('[data-governance-artifact]').forEach(el => el.remove());
    const doc = state.document;
    if (!doc) return;
    const target = document.querySelector('.doc-content:last-of-type') || Array.from(document.querySelectorAll('.doc-content')).pop();
    if (!target) return;

    if (doc.signature_image_data) {
      const wrap = document.createElement('div');
      wrap.dataset.governanceArtifact = 'signature';
      wrap.contentEditable = 'false';
      wrap.style.cssText = 'margin-top:24px;display:flex;flex-direction:column;align-items:flex-start;gap:4px;';
      const img = document.createElement('img');
      img.src = doc.signature_image_data;
      img.alt = isEn ? 'Governed signature' : 'توقيع موثق بالسجل';
      img.style.cssText = 'max-width:200px;height:auto;display:block;';
      const meta = document.createElement('small');
      meta.textContent = isEn ? 'Signature recorded in Bonds audit trail' : 'التوقيع مسجل في سجل تدقيق بوندز';
      wrap.append(img, meta);
      target.appendChild(wrap);
    }

    if (doc.stamp_hash) {
      const stamp = document.createElement('div');
      stamp.dataset.governanceArtifact = 'stamp';
      stamp.contentEditable = 'false';
      stamp.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:150px;height:150px;border:3px double #a51d2d;border-radius:50%;color:#a51d2d;text-align:center;font-weight:700;white-space:pre-line;margin:14px 0;';
      stamp.textContent = (isEn ? 'BONDS\nADMINISTRATIVE STAMP\n' : 'بوندز\nختم إداري\n') + (doc.reference_number || (isEn ? 'APPROVED' : 'معتمد'));
      target.appendChild(stamp);
    }
  }

  function updateVerificationQr() {
    const token = state.document?.verification_token;
    if (!token) return;
    const verifyUrl = location.origin + '/verify-document.html?token=' + encodeURIComponent(token) + (isEn ? '&lang=en' : '');
    document.querySelectorAll('.footer-qr-corner img').forEach(img => {
      img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(verifyUrl);
      img.alt = isEn ? 'Verify document' : 'تحقق من المستند';
    });
  }

  async function refreshInboxDynamic() {
    const result = await api('list');
    state.list = result.documents || [];
    state.role = result.role || state.role;
    const draftsList = document.getElementById('drafts-list');
    const sentList = document.getElementById('sent-list');
    if (!draftsList || !sentList) return;

    function renderList(el, items, empty) {
      el.innerHTML = '';
      if (!items.length) {
        const d = document.createElement('div');
        d.className = 'inbox-empty';
        d.textContent = empty;
        el.appendChild(d);
        return;
      }
      items.forEach(doc => {
        const row = document.createElement('div');
        row.className = 'inbox-item';
        row.style.cursor = 'pointer';
        const title = document.createElement('strong');
        title.textContent = doc.reference_number ? doc.reference_number + ' — ' + (doc.subject || doc.title) : (doc.subject || doc.title);
        const meta = document.createElement('div');
        meta.style.cssText = 'color:#64748b;font-size:11px';
        meta.textContent = doc.status + ' · ' + new Date(doc.updated_at).toLocaleString(isEn ? 'en-US' : 'ar-SA');
        row.append(title, document.createElement('br'), meta);
        row.addEventListener('click', () => loadDocument(doc.id).catch(e => toast('⚠️ ' + e.message)));
        el.appendChild(row);
      });
    }
    renderList(draftsList, state.list.filter(d => !['sent','archived'].includes(d.status)), isEn ? 'No active correspondence' : 'لا توجد مراسلات نشطة');
    renderList(sentList, state.list.filter(d => ['sent','archived'].includes(d.status)), isEn ? 'No sent correspondence' : 'لا توجد مراسلات مرسلة');
  }

  async function importLegacyDrafts() {
    const prefix = isEn ? 'bonds_letterhead_en_' : 'bonds_letterhead_';
    const key = prefix + 'drafts';
    const flag = 'bonds_letterhead_legacy_imported_' + (isEn ? 'en' : 'ar');
    if (localStorage.getItem(flag) === '1') return;
    let drafts = [];
    try { drafts = JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) {}
    if (!Array.isArray(drafts) || !drafts.length) return;
    if (!confirm(isEn ? 'Import your legacy local drafts into the governed correspondence system?' : 'استيراد المسودات المحلية القديمة إلى نظام المراسلات الجديد؟')) return;

    let imported = 0;
    for (const legacyDraft of drafts.slice(0, 30)) {
      try {
        const pages = Array.isArray(legacyDraft.html) ? legacyDraft.html : [String(legacyDraft.html || '')];
        const created = await api('create', {
          method: 'POST',
          body: {
            language: isEn ? 'en' : 'ar',
            direction: 'outgoing',
            document_type: 'letter',
            title: String(legacyDraft.name || (isEn ? 'Imported draft' : 'مسودة مستوردة')).slice(0, 200),
            workspace_context: { ...currentWorkspaceContext(), imported_from: 'legacy_localStorage' }
          }
        });
        await api('save-version', {
          method: 'POST',
          id: created.document.id,
          body: {
            pages_html: pages,
            text_content: '',
            title: String(legacyDraft.name || (isEn ? 'Imported draft' : 'مسودة مستوردة')).slice(0, 200),
            workspace_context: { ...currentWorkspaceContext(), imported_from: 'legacy_localStorage' }
          }
        });
        imported++;
      } catch (e) {
        toast('⚠️ ' + (isEn ? 'Legacy import stopped: ' : 'توقف استيراد المسودات: ') + e.message);
        return;
      }
    }
    localStorage.setItem(flag, '1');
    toast('✅ ' + (isEn ? `Imported ${imported} legacy drafts` : `تم استيراد ${imported} مسودة قديمة`));
    await refreshInboxDynamic();
  }

  async function initialize() {
    buildGovernanceBar();
    const id = currentDocId();
    if (id) {
      try { await loadDocument(id); } catch (e) { toast('⚠️ ' + t.loadFail + ': ' + e.message); }
    } else {
      state.lastHistorySnapshot = snapshot();
      state.lastSavedSnapshot = '';
      renderGovernance();
    }

    const prefix = isEn ? 'bonds_letterhead_en_' : 'bonds_letterhead_';
    let legacyDrafts = [];
    try { legacyDrafts = JSON.parse(localStorage.getItem(prefix + 'drafts') || '[]'); } catch (_) {}
    if (Array.isArray(legacyDrafts) && legacyDrafts.length && localStorage.getItem('bonds_letterhead_legacy_imported_' + (isEn ? 'en' : 'ar')) !== '1') {
      const actions = document.getElementById('corr-actions');
      if (actions) addButton(actions, 'corr-import-legacy', isEn ? 'Import legacy drafts' : 'استيراد المسودات القديمة', importLegacyDrafts);
    }

    document.addEventListener('input', e => {
      if (!e.target.closest?.('.doc-content')) return;
      const now = snapshot();
      if (state.lastHistorySnapshot && now !== state.lastHistorySnapshot) {
        state.history.push(state.lastHistorySnapshot);
        if (state.history.length > 50) state.history.shift();
        state.future = [];
      }
      state.lastHistorySnapshot = now;
    }, true);
  }

  // Server-backed save/autosave. localStorage is only an offline safety copy.
  window.saveDoc = function () {
    saveVersion(false).catch(e => toast('⚠️ ' + e.message));
  };
  window.autoSave = function () {
    if (!editable()) return;
    saveVersion(true).catch(() => {
      try { localStorage.setItem('bonds_letterhead_offline_backup', snapshot()); } catch (_) {}
    });
  };
  window.saveDraft = window.saveDoc;
  window.syncDraftsToCloud = window.saveDoc;
  window.loadDraftsFromCloud = function () {
    refreshInboxDynamic().then(() => toast(isEn ? '✅ Correspondence loaded' : '✅ تم تحميل المراسلات')).catch(e => toast('⚠️ ' + e.message));
  };

  window.loadArchive = function () {
    const panel = document.getElementById('inbox-panel');
    if (panel && !panel.classList.contains('open')) panel.classList.add('open');
    refreshInboxDynamic().catch(e => toast('⚠️ ' + e.message));
  };

  window.toggleInbox = function () {
    const panel = document.getElementById('inbox-panel');
    panel?.classList.toggle('open');
    if (panel?.classList.contains('open')) refreshInboxDynamic().catch(e => toast('⚠️ ' + e.message));
  };

  window.generateRef = function () {
    if (!state.document || state.document.status !== 'approved') return toast('⚠️ ' + (isEn ? 'Approve and sign the document before issuance' : 'اعتمد ووقّع المستند قبل إصدار الرقم'));
    transition('issued').catch(e => toast('⚠️ ' + e.message));
  };

  window.toggleWrite = function () {
    if (!editable()) return toast('⚠️ ' + (isEn ? 'Issued documents are locked' : 'المستند المُصدر مقفل'));
    return legacy.toggleWrite?.();
  };

  window.openSignatureModal = function () {
    if (!isAdmin() || !state.document || !['approved','issued'].includes(state.document.status)) {
      return toast('⚠️ ' + (isEn ? 'Signature requires an approved document and admin permission' : 'التوقيع يتطلب مستندًا معتمدًا وصلاحية إدارية'));
    }
    return legacy.openSignatureModal?.();
  };

  window.saveSignature = async function () {
    try {
      const canvas = document.getElementById('sig-canvas');
      if (!canvas) throw new Error(isEn ? 'Signature canvas is unavailable' : 'لوحة التوقيع غير متوفرة');
      const signatureData = canvas.toDataURL('image/png');
      await mark('mark-signature', { signature_data_url: signatureData });
      legacy.closeSignatureModal?.();
      if (typeof window.clearSignature === 'function') window.clearSignature();
      renderGovernanceArtifacts();
      toast('✅ ' + (isEn ? 'Signature persisted and recorded in audit trail' : 'تم حفظ التوقيع وتسجيله في سجل التدقيق'));
    } catch (e) {
      toast('⚠️ ' + e.message);
    }
  };

  window.insertStamp = async function () {
    if (!isAdmin() || !state.document || state.document.status !== 'approved') {
      return toast('⚠️ ' + (isEn ? 'Stamp requires an approved document and admin permission before issuance' : 'الختم يتطلب مستندًا معتمدًا وصلاحية إدارية قبل الإصدار'));
    }
    try {
      await mark('mark-stamp');
      renderGovernanceArtifacts();
      toast('✅ ' + (isEn ? 'Governed stamp recorded' : 'تم تسجيل الختم الإداري في سجل التدقيق'));
    } catch (e) {
      toast('⚠️ ' + e.message);
    }
  };

  window.sendToManager = async function () {
    try {
      if (!state.document || state.document.status !== 'issued') throw new Error(isEn ? 'Only issued documents can be sent' : 'لا يمكن الإرسال إلا بعد إصدار المستند');
      const result = await api('send', { method: 'POST', id: state.document.id, body: {} });
      state.document = result.document;
      renderGovernance();
      await refreshInboxDynamic();
      toast('📨 ' + (isEn ? 'Sent and recorded' : 'تم الإرسال وتسجيل العملية'));
    } catch (e) {
      toast('⚠️ ' + e.message);
    }
  };

  window.shareDoc = function () {
    const token = state.document?.verification_token;
    if (!token) return toast('⚠️ ' + (isEn ? 'Issue the document before sharing' : 'أصدر المستند قبل مشاركته'));
    const url = location.origin + '/verify-document.html?token=' + encodeURIComponent(token) + (isEn ? '&lang=en' : '');
    if (navigator.share) {
      navigator.share({ title: state.document.reference_number || 'Bonds', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => toast('✅ ' + (isEn ? 'Verification link copied' : 'تم نسخ رابط التحقق')));
    }
  };

  window.switchLang = function (lang) {
    const id = state.document?.id || currentDocId();
    const base = lang === 'en' ? '/en/letterhead.html' : '/letterhead.html';
    location.href = id ? base + '?document=' + encodeURIComponent(id) : base;
  };

  window.translateSelection = function () {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) return toast('⚠️ ' + (isEn ? 'Select text first' : 'حدد النص أولاً'));
    if (!confirm(t.externalTranslate)) return;
    window.open('https://translate.google.com/?sl=' + (isEn ? 'en&tl=ar' : 'ar&tl=en') + '&text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  };

  window.deletePage = function () {
    const sheets = Array.from(document.querySelectorAll('.sheet'));
    const active = window.getSelection()?.anchorNode?.parentElement?.closest?.('.sheet') || sheets[sheets.length - 1];
    if (!active) return;
    if (sheets.length === 1) {
      if (confirm(isEn ? 'Clear the only page?' : 'مسح محتوى الصفحة الوحيدة؟')) {
        const doc = active.querySelector('.doc-content');
        if (doc) doc.innerHTML = '';
      }
    } else if (confirm(isEn ? 'Delete the active page?' : 'حذف الصفحة النشطة؟')) {
      active.remove();
      document.querySelectorAll('.page-number').forEach((el, i, arr) => {
        el.textContent = isEn ? `Page ${i + 1} of ${arr.length}` : `الصفحة ${i + 1} من ${arr.length}`;
      });
    }
  };

  window.insertTable = function () {
    const rows = Number(prompt(isEn ? 'Rows (1-50):' : 'عدد الصفوف (1-50):', '3'));
    const cols = Number(prompt(isEn ? 'Columns (1-20):' : 'عدد الأعمدة (1-20):', '3'));
    if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows < 1 || rows > 50 || cols < 1 || cols > 20) {
      return toast('⚠️ ' + (isEn ? 'Invalid table size' : 'حجم الجدول غير مسموح'));
    }
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r++) {
      html += '<tr>';
      for (let c = 0; c < cols; c++) html += '<td>&nbsp;</td>';
      html += '</tr>';
    }
    html += '</tbody></table><div><br></div>';
    document.execCommand('insertHTML', false, html);
  };

  window.handleImageUpload = function (input) {
    const file = input.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|gif)$/i.test(file.type) || file.size > 2 * 1024 * 1024) {
      input.value = '';
      return toast('⚠️ ' + (isEn ? 'Use PNG/JPEG/WebP/GIF under 2 MB' : 'استخدم PNG/JPEG/WebP/GIF بحجم أقل من 2 ميجابايت'));
    }
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        if (img.width > 6000 || img.height > 6000) return toast('⚠️ ' + (isEn ? 'Image dimensions are too large' : 'أبعاد الصورة كبيرة جدًا'));
        const doc = document.querySelector('.doc-content[contenteditable="true"]') || document.querySelector('.doc-content');
        if (!doc) return;
        const el = document.createElement('img');
        el.src = e.target.result;
        el.alt = '';
        el.style.cssText = 'max-width:100%;height:auto;display:block;margin:10px 0;';
        doc.appendChild(el);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
  };

  // Full-document, multi-page undo/redo.
  window.undoDoc = function () {
    if (!state.history.length) return toast('⚠️ ' + (isEn ? 'Nothing to undo' : 'لا يوجد تراجع'));
    state.future.push(snapshot());
    const prev = state.history.pop();
    setPages(JSON.parse(prev));
    state.lastHistorySnapshot = prev;
  };
  window.redoDoc = function () {
    if (!state.future.length) return toast('⚠️ ' + (isEn ? 'Nothing to redo' : 'لا يوجد إعادة'));
    state.history.push(snapshot());
    const next = state.future.pop();
    setPages(JSON.parse(next));
    state.lastHistorySnapshot = next;
  };

  // Deterministic sequential multi-page PDF export.
  window.exportPDF = async function () {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') return toast('⚠️ PDF libraries unavailable');
    const sheets = Array.from(document.querySelectorAll('.sheet'));
    const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
    toast(isEn ? '⏳ Creating PDF...' : '⏳ جاري إنشاء PDF...');
    try {
      for (let i = 0; i < sheets.length; i++) {
        const canvas = await html2canvas(sheets[i], { scale: 2, useCORS: true, allowTaint: false, backgroundColor: '#ffffff' });
        const img = canvas.toDataURL('image/png');
        if (i > 0) pdf.addPage();
        pdf.addImage(img, 'PNG', 0, 0, 210, 297);
      }
      const filename = state.document?.reference_number ? state.document.reference_number + '.pdf' : 'bonds-letterhead.pdf';
      pdf.save(filename);
      toast(isEn ? '✅ PDF downloaded' : '✅ تم تحميل PDF');
    } catch (e) {
      toast('⚠️ ' + (isEn ? 'PDF generation failed: ' : 'فشل إنشاء PDF: ') + e.message);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initialize().catch(e => toast('⚠️ ' + e.message));
  });
})();