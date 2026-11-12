(function () {
  'use strict';
  window.BONDS_GOVERNED_CORRESPONDENCE = true;

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
    permissions: [],
    userId: null,
    serverIsOwner: null,
    workspaceContext: null,
    relatedDocumentId: null,
    list: [],
    lastSavedSnapshot: '',
    history: [],
    future: [],
    lastHistorySnapshot: '',
    loading: false,
    summary: null,
    tasks: [],
    inboxPage: 1,
    inboxPageSize: 25,
    inboxTotal: 0,
    workPage: 1,
    workPageSize: 25,
    workTotal: 0
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
    state.userId = session?.data?.session?.user?.id || state.userId || null;
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
    if (options.query && typeof options.query === 'object') {
      Object.entries(options.query).forEach(([key, value]) => {
        if (value !== undefined && value !== null && String(value) !== '') params.set(key, String(value));
      });
    }
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

  function persistedSnapshot() {
    return JSON.stringify({
      pages_html: pagesHtml(),
      direction: document.getElementById('corr-direction')?.value || 'outgoing',
      priority: document.getElementById('corr-priority')?.value || 'normal',
      confidentiality: document.getElementById('corr-confidentiality')?.value || 'internal',
      recipient_organization: document.getElementById('corr-recipient-org')?.value || '',
      recipient_name: document.getElementById('corr-recipient-name')?.value || '',
      recipient_title: document.getElementById('corr-recipient-title')?.value || '',
      recipient_email: document.getElementById('corr-recipient-email')?.value || '',
      sender_department: document.getElementById('corr-sender-dept')?.value || '',
      workspace_context: currentWorkspaceContext()
    });
  }

  function currentWorkspaceContext() {
    const p = new URLSearchParams(location.search);
    const inherited = state.document?.workspace_context && typeof state.document.workspace_context === 'object'
      ? state.document.workspace_context
      : (state.workspaceContext && typeof state.workspaceContext === 'object' ? state.workspaceContext : {});
    const keys = ['service', 'workspace', 'company_id', 'project_id', 'client_id', 'funding_case_id', 'request_id', 'return_to'];
    const ctx = {};
    keys.forEach(k => {
      const value = p.get(k) || inherited[k] || '';
      if (value) ctx[k] = value;
    });
    if (!ctx.workspace && !ctx.service && !ctx.company_id && !ctx.project_id && !ctx.client_id && !ctx.funding_case_id && !ctx.request_id) {
      ctx.workspace = 'correspondence';
    }
    if (!ctx.return_to && ctx.workspace === 'correspondence') {
      ctx.return_to = isEn ? '/en/my-bonds/' : '/my-bonds/';
    }
    ctx.source = 'letterhead';
    ctx.path = location.pathname;
    return ctx;
  }

  function hasWorkspaceContext() {
    const ctx = currentWorkspaceContext();
    return ['service','workspace','company_id','project_id','client_id','funding_case_id','request_id'].some(key => !!ctx[key]);
  }

  function workspaceQuery() {
    const ctx = currentWorkspaceContext();
    const query = {};
    ['service','workspace','company_id','project_id','client_id','funding_case_id','request_id'].forEach(key => {
      if (ctx[key]) query[key] = ctx[key];
    });
    return query;
  }

  function workspaceReturnUrl() {
    const current = new URL(location.href);
    const explicit = current.searchParams.get('return_to');
    if (explicit && explicit.startsWith('/') && !explicit.startsWith('//')) return explicit;
    if (!hasWorkspaceContext()) return isEn ? '/en/my-bonds/' : '/my-bonds/';
    const target = new URL(isEn ? '/en/my-bonds/workspace/' : '/my-bonds/workspace/', location.origin);
    const ctx = workspaceQuery();
    Object.entries(ctx).forEach(([key, value]) => target.searchParams.set(key, value));
    return target.pathname + target.search;
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

  function can(permission) {
    return isAdmin() || state.permissions.includes(permission);
  }

  function isOwner() {
    if (!state.document) return false;
    if (typeof state.serverIsOwner === 'boolean') return state.serverIsOwner;
    return !!state.userId && state.document.owner_user_id === state.userId;
  }

  function canEditCurrent() {
    return editable() && (!state.document || isOwner());
  }

  function canStartRejectedRevision() {
    return !!state.document && state.document.status === 'rejected' && (isOwner() || isAdmin());
  }

  function prepareEditableAction() {
    if (canEditCurrent()) return true;
    if (canStartRejectedRevision()) {
      startRejectedRevision();
      return canEditCurrent();
    }
    return false;
  }

  function setEditorEditable(enabled) {
    const isEditable = !!enabled;
    document.querySelectorAll('.doc-content').forEach(d => {
      d.contentEditable = isEditable ? 'true' : 'false';
      d.setAttribute('aria-readonly', isEditable ? 'false' : 'true');
    });
  }

  function setLegacyEditorControlsDisabled(disabled) {
    const mutatingCalls = [
      'toggleWrite','undoDoc','redoDoc','insertDateTime','insertSubject','applyTemplate','insertTable','insertRuler',
      'addNewPage','deletePage','clearAll','alignText','toggleList','indentText','outdentText','toggleBold',
      'toggleItalic','toggleUnderline','setColor','findReplaceText','handleImageUpload','changeFont'
    ];
    document.querySelectorAll('button[onclick], select[onchange]').forEach(control => {
      const code = control.getAttribute('onclick') || control.getAttribute('onchange') || '';
      if (!mutatingCalls.some(name => code.includes(name + '('))) return;
      control.disabled = !!disabled;
      control.setAttribute('aria-disabled', disabled ? 'true' : 'false');
      if (disabled) control.title = isEn ? 'Locked by correspondence workflow' : 'مقفل حسب حالة سير المراسلات';
    });
    const imageInput = document.getElementById('image-upload');
    const importInput = document.getElementById('document-import');
    if (imageInput) imageInput.disabled = !!disabled;
    if (importInput) importInput.disabled = !!disabled;
  }

  function setPages(pages, options = {}) {
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
        doc.contentEditable = canEditCurrent() ? 'true' : 'false';
        doc.setAttribute('aria-readonly', canEditCurrent() ? 'false' : 'true');
        doc.setAttribute('spellcheck', 'true');
      }
    });
    document.querySelectorAll('.page-number').forEach((el, i) => {
      el.textContent = isEn ? `Page ${i + 1} of ${pages.length}` : `الصفحة ${i + 1} من ${pages.length}`;
    });
    const snap = snapshot();
    state.lastHistorySnapshot = snap;
    if (options.markSaved) state.lastSavedSnapshot = persistedSnapshot();
  }

  function hasMeaningfulDraft() {
    if (textContent()) return true;
    return Array.from(document.querySelectorAll('.doc-content')).some(doc =>
      !!doc.querySelector('img,table,hr,ul,ol') || doc.innerHTML.replace(/<br\s*\/?>(\s*)/gi, '').replace(/&nbsp;/gi, '').trim().length > 0
    );
  }

  function recordMutation(before) {
    const after = snapshot();
    if (before && before !== after) {
      if (state.lastHistorySnapshot !== before) state.lastHistorySnapshot = before;
      state.history.push(before);
      if (state.history.length > 50) state.history.shift();
      state.future = [];
      state.lastHistorySnapshot = after;
    }
    return after;
  }

  function currentDocId() {
    if (state.document?.id) return state.document.id;
    const explicit = new URLSearchParams(location.search).get('document');
    if (explicit) return explicit;
    if (hasWorkspaceContext()) return '';
    return localStorage.getItem('bonds_letterhead_current_document') || '';
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
        direction: document.getElementById('corr-direction')?.value || 'outgoing',
        document_type: 'letter',
        title: titleFromText(text),
        subject: subjectFromText(text),
        priority: document.getElementById('corr-priority')?.value || 'normal',
        confidentiality: document.getElementById('corr-confidentiality')?.value || 'internal',
        recipient_organization: document.getElementById('corr-recipient-org')?.value || null,
        recipient_name: document.getElementById('corr-recipient-name')?.value || null,
        recipient_title: document.getElementById('corr-recipient-title')?.value || null,
        recipient_email: document.getElementById('corr-recipient-email')?.value || null,
        sender_department: document.getElementById('corr-sender-dept')?.value || null,
        workspace_context: currentWorkspaceContext(),
        related_document_id: state.relatedDocumentId || null
      }
    });
    state.document = result.document;
    state.role = result.role || state.role;
    state.permissions = Array.isArray(result.permissions) ? result.permissions : state.permissions;
    state.serverIsOwner = typeof result.is_owner === 'boolean' ? result.is_owner : true;
    state.relatedDocumentId = state.document?.related_document_id || null;
    state.workspaceContext = state.document?.workspace_context && typeof state.document.workspace_context === 'object'
      ? { ...state.document.workspace_context }
      : currentWorkspaceContext();
    syncUrl(state.document.id);
    renderGovernance();
    return state.document;
  }

  async function saveVersion(silent, options = {}) {
    if (state.loading) return;
    const snap = persistedSnapshot();
    if (state.document && snap === state.lastSavedSnapshot && !options.titleOverride) {
      if (!silent) toast(isEn ? 'No changes to save' : 'لا توجد تغييرات جديدة');
      return state.document;
    }
    if (!canEditCurrent()) throw new Error(isEn ? 'This document is locked or not owned by the current user' : 'هذا المستند مقفل أو غير مملوك للمستخدم الحالي');
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
          title: options.titleOverride || titleFromText(text),
          subject: subjectFromText(text),
          direction: document.getElementById('corr-direction')?.value || doc.direction || 'outgoing',
          priority: document.getElementById('corr-priority')?.value || doc.priority || 'normal',
          confidentiality: document.getElementById('corr-confidentiality')?.value || doc.confidentiality || 'internal',
          recipient_organization: document.getElementById('corr-recipient-org')?.value || null,
          recipient_name: document.getElementById('corr-recipient-name')?.value || null,
          recipient_title: document.getElementById('corr-recipient-title')?.value || null,
          recipient_email: document.getElementById('corr-recipient-email')?.value || null,
          sender_department: document.getElementById('corr-sender-dept')?.value || null,
          workspace_context: currentWorkspaceContext()
        }
      });
      state.document = result.document;
      state.workspaceContext = state.document?.workspace_context && typeof state.document.workspace_context === 'object'
        ? { ...state.document.workspace_context }
        : state.workspaceContext;
      state.latestVersion = {
        version: result.version,
        pages_html: pagesHtml(),
        text_content: text,
        checksum_sha256: result.checksum_sha256
      };
      state.lastSavedSnapshot = persistedSnapshot();
      try { localStorage.setItem('bonds_letterhead_offline_backup', snap); } catch (_) {}
      if (!silent) toast('✅ ' + t.saved + ' #' + result.version);
      renderGovernance();
      refreshCommandCenter().catch(() => {});
      return state.document;
    } finally {
      state.loading = false;
    }
  }

  async function transition(target, note) {
    const doc = await ensureDocument();
    if (['returned', 'rejected', 'cancelled'].includes(target) && !String(note || '').trim()) {
      const reason = window.prompt(isEn ? 'Reason is required for this action:' : 'سبب الإجراء إلزامي:');
      if (!String(reason || '').trim()) throw new Error(isEn ? 'A reason is required' : 'يجب إدخال السبب');
      note = reason.trim();
    }
    const result = await api('transition', { method: 'POST', id: doc.id, body: { target, note: note || null } });
    state.document = result.document;
    renderGovernance();
    setEditorEditable(canEditCurrent());
    if (target === 'issued') {
      renderGovernanceArtifacts();
      updateVerificationQr();
      toast('✅ ' + (isEn ? 'Document issued. Secure the final PDF as the next governed step.' : 'تم إصدار المستند. ثبّت PDF النهائي كخطوة حوكمة مستقلة.'));
    }
    toast('✅ ' + t.status + ': ' + state.document.status);
    await Promise.all([refreshInboxDynamic(), refreshCommandCenter()]);
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
    state.permissions = Array.isArray(result.permissions) ? result.permissions : [];
    state.serverIsOwner = typeof result.is_owner === 'boolean' ? result.is_owner : null;
    state.relatedDocumentId = state.document?.related_document_id || null;
    state.workspaceContext = state.document?.workspace_context && typeof state.document.workspace_context === 'object'
      ? { ...state.document.workspace_context }
      : null;
    syncUrl(state.document.id);
    if (state.latestVersion?.pages_html) setPages(state.latestVersion.pages_html, { markSaved: true });
    document.getElementById('corr-priority') && (document.getElementById('corr-priority').value = state.document.priority || 'normal');
    document.getElementById('corr-confidentiality') && (document.getElementById('corr-confidentiality').value = state.document.confidentiality || 'internal');
    document.getElementById('corr-direction') && (document.getElementById('corr-direction').value = state.document.direction || 'outgoing');
    const metadataMap = {
      'corr-recipient-org': 'recipient_organization',
      'corr-recipient-name': 'recipient_name',
      'corr-recipient-title': 'recipient_title',
      'corr-recipient-email': 'recipient_email',
      'corr-sender-dept': 'sender_department'
    };
    Object.entries(metadataMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.value = state.document[key] || '';
    });
    const draftName = document.getElementById('draft-name');
    if (draftName) draftName.value = state.document.title || '';
    state.lastSavedSnapshot = persistedSnapshot();
    setEditorEditable(canEditCurrent());
    renderGovernance();
    renderGovernanceArtifacts();
    updateVerificationQr();
    refreshCommandCenter().catch(() => {});
    return state.document;
  }

  function addButton(parent, id, label, handler, options = {}) {
    let btn = document.getElementById(id);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = id;
      btn.type = 'button';
      btn.textContent = label;
      btn.className = ['corr-btn', options.primary ? 'corr-btn-primary' : '', options.danger ? 'corr-btn-danger' : ''].filter(Boolean).join(' ');
      btn.addEventListener('click', () => Promise.resolve(handler()).catch(e => toast('⚠️ ' + e.message)));
      parent.appendChild(btn);
    } else {
      btn.textContent = label;
      btn.className = ['corr-btn', options.primary ? 'corr-btn-primary' : '', options.danger ? 'corr-btn-danger' : ''].filter(Boolean).join(' ');
    }
    return btn;
  }

  function hideLegacyGovernanceTriggers() {
    [
      'button[onclick="generateRef()"]',
      'button[onclick="openSignatureModal()"]',
      'button[onclick="insertStamp()"]',
      'button[onclick="sendToManager()"]'
    ].forEach(selector => {
      document.querySelectorAll(selector).forEach(button => {
        button.hidden = true;
        button.setAttribute('aria-hidden', 'true');
        button.tabIndex = -1;
      });
    });
  }

  function buildGovernanceBar() {
    if (document.getElementById('correspondence-governance')) return;

    const shell = document.createElement('section');
    shell.id = 'correspondence-governance';
    shell.className = 'corr-governance-shell';

    const strip = document.createElement('div');
    strip.className = 'corr-workflow-strip';
    strip.innerHTML = `
      <div class="corr-identity">
        <span id="corr-status" class="corr-status-badge">${isEn ? 'Draft' : 'مسودة'}</span>
        <span id="corr-reference" class="corr-ref">${isEn ? 'No register number yet' : 'لا يوجد رقم قيد بعد'}</span>
        <span id="corr-outgoing-number" class="corr-ref" hidden></span>
        <span id="corr-incoming-number" class="corr-ref" hidden></span>
        <span id="corr-archive-number" class="corr-ref" hidden></span>
      </div>
      <div class="corr-meta" id="corr-meta">
        <span class="corr-meta-badge" id="corr-direction-badge"></span>
        <span class="corr-meta-badge" id="corr-priority-badge"></span>
        <span class="corr-meta-badge" id="corr-confidentiality-badge"></span>
      </div>
      <div class="corr-actions" id="corr-actions"></div>
      <div class="corr-workflow" id="corr-workflow"></div>
    `;

    const details = document.createElement('div');
    details.id = 'corr-details-panel';
    details.className = 'corr-details-panel';
    details.hidden = true;
    details.innerHTML = `
      <label>${isEn ? 'Direction' : 'الاتجاه'}
        <select id="corr-direction">
          <option value="outgoing">${isEn ? 'Outgoing' : 'صادر'}</option>
          <option value="incoming">${isEn ? 'Incoming' : 'وارد'}</option>
          <option value="internal">${isEn ? 'Internal' : 'داخلي'}</option>
        </select>
      </label>
      <label>${isEn ? 'Priority' : 'الأولوية'}
        <select id="corr-priority">
          <option value="low">${isEn ? 'Low' : 'منخفضة'}</option>
          <option value="normal">${isEn ? 'Normal' : 'عادية'}</option>
          <option value="high">${isEn ? 'High' : 'عالية'}</option>
          <option value="urgent">${isEn ? 'Urgent' : 'عاجلة'}</option>
        </select>
      </label>
      <label>${isEn ? 'Confidentiality' : 'السرية'}
        <select id="corr-confidentiality">
          <option value="public">${isEn ? 'Public' : 'عام'}</option>
          <option value="internal">${isEn ? 'Internal' : 'داخلي'}</option>
          <option value="confidential">${isEn ? 'Confidential' : 'سري'}</option>
          <option value="restricted">${isEn ? 'Restricted' : 'مقيد'}</option>
        </select>
      </label>
      <label>${isEn ? 'Recipient organization' : 'الجهة المستلمة'}<input id="corr-recipient-org" type="text" maxlength="250"></label>
      <label>${isEn ? 'Recipient name' : 'اسم المستلم'}<input id="corr-recipient-name" type="text" maxlength="250"></label>
      <label>${isEn ? 'Recipient title' : 'منصب المستلم'}<input id="corr-recipient-title" type="text" maxlength="250"></label>
      <label>${isEn ? 'Recipient email' : 'بريد المستلم'}<input id="corr-recipient-email" type="email" maxlength="320" dir="ltr"></label>
      <label>${isEn ? 'Sender department' : 'إدارة المرسل'}<input id="corr-sender-dept" type="text" maxlength="250"></label>
    `;

    shell.append(strip, details);

    const drawerBackdrop = document.createElement('div');
    drawerBackdrop.id = 'corr-drawer-backdrop';
    drawerBackdrop.className = 'corr-drawer-backdrop';
    drawerBackdrop.setAttribute('aria-hidden', 'true');

    const drawer = document.createElement('aside');
    drawer.id = 'corr-command-drawer';
    drawer.className = 'corr-command-drawer';
    drawer.setAttribute('aria-hidden', 'true');
    drawer.innerHTML = `
      <div class="corr-drawer-header">
        <strong>${isEn ? 'Correspondence center' : 'مركز المراسلات'}</strong>
        <button type="button" id="corr-drawer-close" aria-label="${isEn ? 'Close command center' : 'إغلاق مركز المراسلات'}">✕</button>
      </div>
      <div class="corr-drawer-body">
        <section class="corr-card">
          <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <strong>${isEn ? 'Command center' : 'مركز الأوامر'}</strong>
            <button type="button" class="corr-btn" id="corr-command-refresh">${isEn ? 'Refresh' : 'تحديث'}</button>
          </div>
          <div class="corr-search-row">
            <input id="corr-command-search" type="search" maxlength="200" placeholder="${isEn ? 'Search reference, recipient, subject…' : 'ابحث بالرقم أو المستلم أو الموضوع…'}">
            <button type="button" class="corr-btn" id="corr-command-search-btn">${isEn ? 'Search' : 'بحث'}</button>
          </div>
          <div id="corr-command-results" style="display:grid;gap:5px;margin-top:8px"></div>
          <div id="corr-summary" class="corr-summary-grid"></div>
        </section>
        <section class="corr-card">
          <strong>${isEn ? 'My work / exceptions' : 'مهامي والاستثناءات'}</strong>
          <div id="corr-my-work" style="display:grid;gap:6px;margin-top:8px"></div>
        </section>
        <section class="corr-card">
          <strong>${isEn ? 'Document activity' : 'سجل نشاط المستند'}</strong>
          <div id="corr-timeline" class="corr-timeline"></div>
        </section>
      </div>
    `;

    const pages = document.getElementById('pages-container');
    pages?.parentNode?.insertBefore(shell, pages);
    document.body.append(drawerBackdrop, drawer);

    hideLegacyGovernanceTriggers();

    const closeDrawer = () => setCommandDrawer(false);
    drawerBackdrop.addEventListener('click', closeDrawer);
    document.getElementById('corr-drawer-close')?.addEventListener('click', closeDrawer);

    document.getElementById('corr-command-refresh')?.addEventListener('click', () => {
      refreshCommandCenter().catch(e => toast('⚠️ ' + e.message));
    });
    const searchInput = document.getElementById('corr-command-search');
    const runSearch = () => searchCommandCenter(searchInput?.value || '').catch(e => toast('⚠️ ' + e.message));
    document.getElementById('corr-command-search-btn')?.addEventListener('click', runSearch);
    searchInput?.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); runSearch(); }
    });

    const actions = document.getElementById('corr-actions');
    addButton(actions, 'corr-new', isEn ? 'New correspondence' : 'مراسلة جديدة', () => startNewCorrespondence());
    addButton(actions, 'corr-revise-copy', isEn ? 'Revise as new draft' : 'إنشاء نسخة للتعديل', () => startRejectedRevision(), { primary: true });
    addButton(actions, 'corr-details-toggle', isEn ? 'Details' : 'بيانات الخطاب', () => {
      const panel = document.getElementById('corr-details-panel');
      if (panel) panel.hidden = !panel.hidden;
    });
    addButton(actions, 'corr-command-open', isEn ? 'Command center' : 'مركز المراسلات', () => setCommandDrawer(true));
    addButton(actions, 'corr-workspace-return', isEn ? 'Back to workspace' : 'العودة لمساحة العمل', () => { location.href = workspaceReturnUrl(); });
    addButton(actions, 'corr-save', t.save, () => saveVersion(false));
    addButton(actions, 'corr-submit', t.submit, () => transition('submitted'), { primary: true });
    addButton(actions, 'corr-review', t.review, () => transition('under_review'), { primary: true });
    addButton(actions, 'corr-approve', t.approve, () => transition('approved'), { primary: true });
    addButton(actions, 'corr-return', t.return, () => transition('returned'));
    addButton(actions, 'corr-reject', t.reject, () => transition('rejected'), { danger: true });
    addButton(actions, 'corr-cancel', isEn ? 'Cancel' : 'إلغاء', () => transition('cancelled'), { danger: true });
    addButton(actions, 'corr-sign', t.sign, () => window.openSignatureModal(), { primary: true });
    addButton(actions, 'corr-issue', t.issue, () => transition('issued'), { primary: true });
    addButton(actions, 'corr-stamp', t.stamp, () => window.insertStamp(), { primary: true });
    addButton(actions, 'corr-finalize-pdf', isEn ? 'Secure final PDF' : 'تثبيت النسخة النهائية', () => persistIssuedPdfArtifact(), { primary: true });
    addButton(actions, 'corr-send', isEn ? 'Send to recipient' : 'إرسال للمستلم', () => window.sendToManager(), { primary: true });
    addButton(actions, 'corr-archive', t.archive, () => transition('archived'), { primary: true });
  }

  function startNewCorrespondence() {
    if (state.document && canEditCurrent() && snapshot() !== state.lastSavedSnapshot && hasMeaningfulDraft()) {
      const ok = confirm(isEn ? 'Discard unsaved changes and start a new correspondence?' : 'تجاهل التغييرات غير المحفوظة وبدء مراسلة جديدة؟');
      if (!ok) return;
    }
    state.document = null;
    state.latestVersion = null;
    state.events = [];
    state.history = [];
    state.future = [];
    state.serverIsOwner = null;
    state.workspaceContext = null;
    state.relatedDocumentId = null;
    try { localStorage.removeItem('bonds_letterhead_current_document'); } catch (_) {}
    const url = new URL(location.href);
    url.searchParams.delete('document');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
    setPages([''], { markSaved: false });
    state.lastSavedSnapshot = '';
    ['corr-recipient-org','corr-recipient-name','corr-recipient-title','corr-recipient-email','corr-sender-dept'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const draftName = document.getElementById('draft-name');
    if (draftName) draftName.value = '';
    renderGovernance();
    toast(isEn ? 'New correspondence ready' : 'تم فتح مراسلة جديدة');
  }

  function startRejectedRevision() {
    if (!state.document || state.document.status !== 'rejected') return;
    if (!isOwner() && !isAdmin()) {
      return toast('⚠️ ' + (isEn ? 'Only the document owner or an administrator can create a revision copy' : 'لا يمكن إنشاء نسخة للتعديل إلا لمالك المستند أو المسؤول'));
    }

    const source = state.document;
    state.relatedDocumentId = source.id;
    state.workspaceContext = source.workspace_context && typeof source.workspace_context === 'object'
      ? { ...source.workspace_context }
      : currentWorkspaceContext();
    const sourcePages = pagesHtml();
    const sourceTitle = source.title || '';
    const sourceMetadata = {
      direction: source.direction || 'outgoing',
      priority: source.priority || 'normal',
      confidentiality: source.confidentiality || 'internal',
      recipient_organization: source.recipient_organization || '',
      recipient_name: source.recipient_name || '',
      recipient_title: source.recipient_title || '',
      recipient_email: source.recipient_email || '',
      sender_department: source.sender_department || ''
    };

    state.document = null;
    state.latestVersion = null;
    state.events = [];
    state.history = [];
    state.future = [];
    try { localStorage.removeItem('bonds_letterhead_current_document'); } catch (_) {}

    const url = new URL(location.href);
    url.searchParams.delete('document');
    history.replaceState(null, '', url.pathname + url.search + url.hash);

    setPages(sourcePages.length ? sourcePages : [''], { markSaved: false });
    state.lastSavedSnapshot = '';

    const valueMap = {
      'corr-direction': sourceMetadata.direction,
      'corr-priority': sourceMetadata.priority,
      'corr-confidentiality': sourceMetadata.confidentiality,
      'corr-recipient-org': sourceMetadata.recipient_organization,
      'corr-recipient-name': sourceMetadata.recipient_name,
      'corr-recipient-title': sourceMetadata.recipient_title,
      'corr-recipient-email': sourceMetadata.recipient_email,
      'corr-sender-dept': sourceMetadata.sender_department
    };
    Object.entries(valueMap).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    });

    const draftName = document.getElementById('draft-name');
    if (draftName) {
      draftName.value = (sourceTitle + (isEn ? ' - revision' : ' - نسخة معدلة')).trim().slice(0, 200);
    }

    renderGovernance();
    setEditorEditable(true);
    setLegacyEditorControlsDisabled(false);
    toast(isEn ? 'Revision copy is ready to edit and save as a new draft' : 'تم إنشاء نسخة قابلة للتعديل؛ احفظها كمسودة جديدة');
  }

  function setCommandDrawer(open) {
    const drawer = document.getElementById('corr-command-drawer');
    const backdrop = document.getElementById('corr-drawer-backdrop');
    if (!drawer || !backdrop) return;
    drawer.classList.toggle('open', !!open);
    backdrop.classList.toggle('open', !!open);
    drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
    backdrop.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) refreshCommandCenter().catch(() => {});
  }

  function statusLabel(status) {
    const labels = isEn
      ? { draft:'Draft', submitted:'Submitted', under_review:'Under review', approved:'Approved', issued:'Issued', sent:'Sent', archived:'Archived', returned:'Returned', rejected:'Rejected', cancelled:'Cancelled' }
      : { draft:'مسودة', submitted:'مرسل للمراجعة', under_review:'قيد المراجعة', approved:'معتمد', issued:'صادر', sent:'مرسل', archived:'مؤرشف', returned:'معاد للتعديل', rejected:'مرفوض', cancelled:'ملغي' };
    return labels[status] || status;
  }

  function renderWorkflowStrip(status) {
    const target = document.getElementById('corr-workflow');
    if (!target) return;
    const canonical = ['draft','submitted','under_review','approved','issued','sent','archived'];
    const currentIndex = canonical.indexOf(status);
    target.innerHTML = '';
    canonical.forEach((step, index) => {
      const el = document.createElement('span');
      el.className = 'corr-step' + (index < currentIndex ? ' is-complete' : '') + (step === status ? ' is-current' : '');
      el.textContent = statusLabel(step);
      target.appendChild(el);
    });
  }

  function renderGovernance() {
    buildGovernanceBar();
    const doc = state.document;
    const status = doc?.status || 'draft';
    const statusEl = document.getElementById('corr-status');
    const refEl = document.getElementById('corr-reference');
    const outgoingEl = document.getElementById('corr-outgoing-number');
    const incomingEl = document.getElementById('corr-incoming-number');
    const archiveEl = document.getElementById('corr-archive-number');
    const directionBadge = document.getElementById('corr-direction-badge');
    const priorityBadge = document.getElementById('corr-priority-badge');
    const confidentialityBadge = document.getElementById('corr-confidentiality-badge');

    if (statusEl) statusEl.textContent = statusLabel(status);
    if (refEl) {
      const active = doc?.outgoing_number || doc?.incoming_number || doc?.reference_number || '';
      refEl.textContent = active || (isEn ? 'No register number yet' : 'لا يوجد رقم قيد بعد');
    }
    if (outgoingEl) {
      outgoingEl.hidden = !doc?.outgoing_number;
      outgoingEl.textContent = doc?.outgoing_number ? (isEn ? 'Outgoing: ' : 'صادر: ') + doc.outgoing_number : '';
    }
    if (incomingEl) {
      incomingEl.hidden = !doc?.incoming_number;
      incomingEl.textContent = doc?.incoming_number ? (isEn ? 'Incoming: ' : 'وارد: ') + doc.incoming_number : '';
    }
    if (archiveEl) {
      archiveEl.hidden = !doc?.archive_number;
      archiveEl.textContent = doc?.archive_number ? (isEn ? 'Archive: ' : 'أرشفة: ') + doc.archive_number : '';
    }

    const directionMap = isEn ? { outgoing:'Outgoing', incoming:'Incoming', internal:'Internal' } : { outgoing:'صادر', incoming:'وارد', internal:'داخلي' };
    const priorityMap = isEn ? { low:'Low', normal:'Normal', high:'High', urgent:'Urgent' } : { low:'منخفضة', normal:'عادية', high:'عالية', urgent:'عاجلة' };
    const confidentialityMap = isEn ? { public:'Public', internal:'Internal', confidential:'Confidential', restricted:'Restricted' } : { public:'عام', internal:'داخلي', confidential:'سري', restricted:'مقيد' };
    if (directionBadge) directionBadge.textContent = directionMap[doc?.direction || 'outgoing'];
    if (priorityBadge) priorityBadge.textContent = priorityMap[doc?.priority || 'normal'];
    if (confidentialityBadge) confidentialityBadge.textContent = confidentialityMap[doc?.confidentiality || 'internal'];

    if (doc) {
      const p = document.getElementById('corr-priority');
      const c = document.getElementById('corr-confidentiality');
      const d = document.getElementById('corr-direction');
      if (p) { p.value = doc.priority || 'normal'; p.disabled = !canEditCurrent(); }
      if (c) { c.value = doc.confidentiality || 'internal'; c.disabled = !canEditCurrent(); }
      if (d) { d.value = doc.direction || 'outgoing'; d.disabled = !canEditCurrent(); }
      ['corr-recipient-org','corr-recipient-name','corr-recipient-title','corr-recipient-email','corr-sender-dept']
        .forEach(id => { const el = document.getElementById(id); if (el) el.disabled = !canEditCurrent(); });
    }

    renderWorkflowStrip(status);
    setEditorEditable(canEditCurrent());
    setLegacyEditorControlsDisabled(!canEditCurrent() && !canStartRejectedRevision());

    const visible = new Set(['corr-new','corr-details-toggle','corr-command-open']);
    if (status === 'rejected' && (isOwner() || isAdmin())) visible.add('corr-revise-copy');
    if (hasWorkspaceContext()) visible.add('corr-workspace-return');
    if (canEditCurrent()) visible.add('corr-save');

    if (isOwner() && ['draft','returned'].includes(status)) visible.add('corr-submit');
    if (can('review') && status === 'submitted') visible.add('corr-review');
    if (can('approve') && status === 'under_review') visible.add('corr-approve');
    if ((status === 'submitted' && can('review')) || (['under_review','approved'].includes(status) && can('approve'))) visible.add('corr-return');
    if ((status === 'submitted' && can('review')) || (['under_review','approved'].includes(status) && can('approve'))) visible.add('corr-reject');
    if ((isOwner() && ['draft','returned'].includes(status)) || (can('review') && status === 'submitted')) visible.add('corr-cancel');

    if (can('sign') && status === 'approved' && doc?.requires_signature !== false && !doc?.signed_by) {
      visible.add('corr-sign');
    } else if (can('stamp') && status === 'approved' && !!doc?.requires_stamp && !doc?.stamped_by) {
      visible.add('corr-stamp');
    } else if (can('issue') && status === 'approved' && (doc?.requires_signature === false || !!doc?.signed_by) && (!doc?.requires_stamp || !!doc?.stamped_by)) {
      visible.add('corr-issue');
    } else if (can('finalize_pdf') && status === 'issued' && !doc?.artifact_hash) {
      visible.add('corr-finalize-pdf');
    } else if (can('send') && status === 'issued' && !!doc?.artifact_hash && (doc?.direction === 'internal' || !!doc?.recipient_email)) {
      visible.add('corr-send');
    } else if (can('archive') && (status === 'sent' || (status === 'issued' && doc?.direction === 'internal'))) {
      visible.add('corr-archive');
    }

    [
      'corr-save','corr-submit','corr-review','corr-approve','corr-return','corr-reject','corr-cancel','corr-workspace-return',
      'corr-sign','corr-issue','corr-stamp','corr-finalize-pdf','corr-send','corr-archive',
      'corr-new','corr-revise-copy','corr-details-toggle','corr-command-open'
    ].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = visible.has(id) ? '' : 'none';
    });

    renderGovernanceArtifacts();
    updateVerificationQr();
    renderTimeline();
  }

  function renderTimeline() {
    const timeline = document.getElementById('corr-timeline');
    if (!timeline) return;
    timeline.innerHTML = '';
    if (!state.document) {
      timeline.textContent = isEn ? 'Open a document to see its activity' : 'افتح مستندًا لعرض سجل نشاطه';
      return;
    }
    if (!state.events.length) {
      timeline.textContent = isEn ? 'No activity recorded' : 'لا توجد أحداث مسجلة';
      return;
    }
    state.events.slice(0, 50).forEach(event => {
      const row = document.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:minmax(120px,auto) 1fr;gap:8px;padding:6px 8px;border-inline-start:3px solid #c59237;background:#f8fafc;border-radius:6px';
      const when = event.created_at ? new Date(event.created_at).toLocaleString(isEn ? 'en-US' : 'ar-SA') : '';
      const reason = event.metadata?.note ? ' · ' + String(event.metadata.note) : '';
      const timeEl = document.createElement('span');
      timeEl.style.cssText = 'font-size:11px;color:#64748b';
      timeEl.textContent = when;
      const detailEl = document.createElement('span');
      const strong = document.createElement('strong');
      strong.textContent = String(event.action || '');
      detailEl.appendChild(strong);
      if (reason) detailEl.appendChild(document.createTextNode(reason));
      row.append(timeEl, detailEl);
      timeline.appendChild(row);
    });
  }

  async function searchCommandCenter(term) {
    const resultsEl = document.getElementById('corr-command-results');
    if (!resultsEl) return;
    const q = String(term || '').trim();
    if (!q) {
      resultsEl.innerHTML = '';
      return;
    }
    const result = await api('list', { query: { ...workspaceQuery(), q, page: 1, page_size: 10 } });
    resultsEl.innerHTML = '';
    const documents = result.documents || [];
    if (!documents.length) {
      resultsEl.textContent = isEn ? 'No matching correspondence' : 'لا توجد مراسلات مطابقة';
      return;
    }
    documents.forEach(doc => {
      const row = document.createElement('button');
      row.type = 'button';
      row.style.cssText = 'text-align:start;padding:7px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;cursor:pointer';
      row.textContent = (doc.reference_number || doc.title || doc.id) + ' · ' + statusLabel(doc.status) + (doc.recipient_organization ? ' · ' + doc.recipient_organization : '');
      row.addEventListener('click', () => loadDocument(doc.id).catch(e => toast('⚠️ ' + e.message)));
      resultsEl.appendChild(row);
    });
  }

  async function refreshCommandCenter(page = state.workPage) {
    const [summaryResult, workResult] = await Promise.all([
      api('summary', { query: workspaceQuery() }),
      api('my-work', { query: { ...workspaceQuery(), page: Math.max(1, Number(page || 1)), page_size: state.workPageSize } })
    ]);
    state.summary = summaryResult;
    state.tasks = workResult.tasks || [];
    state.workPage = Number(workResult.pagination?.page || Math.max(1, Number(page || 1)));
    state.workTotal = Number(workResult.pagination?.total || state.tasks.length);
    if (Array.isArray(summaryResult.permissions)) state.permissions = summaryResult.permissions;

    const summary = document.getElementById('corr-summary');
    if (summary) {
      const cards = [
        [isEn ? 'Total' : 'الإجمالي', summaryResult.total || 0],
        [isEn ? 'Urgent' : 'عاجل', summaryResult.urgent || 0],
        [isEn ? 'Failed' : 'فشل الإرسال', summaryResult.failed_delivery || 0],
        [isEn ? 'Draft' : 'مسودة', summaryResult.by_status?.draft || 0],
        [isEn ? 'Review' : 'مراجعة', (summaryResult.by_status?.submitted || 0) + (summaryResult.by_status?.under_review || 0)],
        [isEn ? 'Issued' : 'صادر', summaryResult.by_status?.issued || 0]
      ];
      summary.innerHTML = '';
      cards.forEach(([label, value]) => {
        const card = document.createElement('div');
        card.style.cssText = 'padding:7px;border-radius:8px;background:#fff;border:1px solid #e2e8f0;text-align:center';
        card.innerHTML = '<div style="font-size:18px;font-weight:800">' + String(value) + '</div><div style="font-size:11px;color:#64748b">' + label + '</div>';
        summary.appendChild(card);
      });
    }

    const work = document.getElementById('corr-my-work');
    if (work) {
      work.innerHTML = '';
      if (!state.tasks.length) {
        work.textContent = isEn ? 'No open tasks' : 'لا توجد مهام مفتوحة';
      } else {
        state.tasks.forEach(task => {
          const row = document.createElement('button');
          row.type = 'button';
          row.style.cssText = 'text-align:start;padding:8px;border:1px solid ' + (task.overdue ? '#ef4444' : '#e2e8f0') + ';border-radius:8px;background:#fff;cursor:pointer';
          const doc = task.correspondence_documents || {};
          row.textContent = (task.overdue ? '⚠️ ' : '') + (doc.reference_number || doc.title || doc.id || '') + ' · ' + task.task_type;
          row.addEventListener('click', () => {
            if (task.document_id) loadDocument(task.document_id).catch(e => toast('⚠️ ' + e.message));
          });
          work.appendChild(row);
        });
      }

      let pager = document.getElementById('corr-work-pagination');
      if (!pager) {
        pager = document.createElement('div');
        pager.id = 'corr-work-pagination';
        pager.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px';
        work.parentNode?.appendChild(pager);
      }
      const totalPages = Math.max(1, Math.ceil(state.workTotal / state.workPageSize));
      pager.innerHTML = '';
      const prev = document.createElement('button');
      prev.type = 'button';
      prev.className = 'corr-btn';
      prev.textContent = isEn ? 'Previous' : 'السابق';
      prev.disabled = state.workPage <= 1;
      prev.addEventListener('click', () => refreshCommandCenter(state.workPage - 1).catch(e => toast('⚠️ ' + e.message)));
      const label = document.createElement('span');
      label.textContent = (isEn ? 'Page ' : 'صفحة ') + state.workPage + (isEn ? ' of ' : ' من ') + totalPages + ' · ' + state.workTotal;
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'corr-btn';
      next.textContent = isEn ? 'Next' : 'التالي';
      next.disabled = state.workPage >= totalPages;
      next.addEventListener('click', () => refreshCommandCenter(state.workPage + 1).catch(e => toast('⚠️ ' + e.message)));
      pager.append(prev, label, next);
    }
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
    document.querySelectorAll('.footer-qr-corner img').forEach(img => {
      if (!token) {
        img.style.visibility = 'hidden';
        return;
      }
      img.src = '/api/correspondence?action=qr&token=' + encodeURIComponent(token) + '&lang=' + (isEn ? 'en' : 'ar');
      img.alt = isEn ? 'Verify document' : 'تحقق من المستند';
      img.style.visibility = 'visible';
    });
  }

  async function waitForVerificationQr() {
    const images = Array.from(document.querySelectorAll('.footer-qr-corner img')).filter(img => img.style.visibility !== 'hidden');
    await Promise.all(images.map(img => {
      if (img.complete && img.naturalWidth > 0) return Promise.resolve(true);
      return new Promise(resolve => {
        const finish = ok => {
          if (!ok) img.style.visibility = 'hidden';
          resolve(ok);
        };
        const timer = setTimeout(() => finish(false), 4000);
        img.addEventListener('load', () => { clearTimeout(timer); finish(true); }, { once: true });
        img.addEventListener('error', () => { clearTimeout(timer); finish(false); }, { once: true });
      });
    }));
  }

  async function createPdfBlob() {
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
      throw new Error(isEn ? 'PDF libraries unavailable' : 'مكتبات PDF غير متوفرة');
    }
    await waitForVerificationQr();
    const sheets = Array.from(document.querySelectorAll('.sheet'));
    const pdf = new window.jspdf.jsPDF('p', 'mm', 'a4');
    const integrityMarker = state.document?.issued_hash
      ? ['BONDS-DOC', state.document.id, state.document.current_version, state.document.document_hash, state.document.issued_hash].join(':')
      : '';
    if (integrityMarker && typeof pdf.setProperties === 'function') {
      pdf.setProperties({
        title: state.document.reference_number || 'Bonds correspondence',
        subject: integrityMarker,
        keywords: integrityMarker,
        creator: 'Bonds Global Correspondence'
      });
    }
    for (let i = 0; i < sheets.length; i++) {
      const canvas = await html2canvas(sheets[i], { scale: 1.6, useCORS: true, allowTaint: false, backgroundColor: '#ffffff' });
      const img = canvas.toDataURL('image/jpeg', 0.9);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }
    return pdf.output('blob');
  }

  async function persistIssuedPdfArtifact() {
    if (!state.document || state.document.status !== 'issued') return;
    if (!can('finalize_pdf')) throw new Error(isEn ? 'Final PDF permission is required' : 'تثبيت PDF النهائي يتطلب صلاحية مستقلة');
    toast(isEn ? '⏳ Securing final PDF...' : '⏳ جاري تثبيت النسخة النهائية PDF...');
    await loadDocument(state.document.id);
    const blob = await createPdfBlob();
    if (!blob.size || blob.size > 10 * 1024 * 1024) {
      throw new Error(isEn ? 'Final PDF exceeds the 10 MB limit' : 'حجم PDF النهائي يتجاوز 10 ميجابايت');
    }
    const upload = await api('artifact-upload-url', { method: 'POST', id: state.document.id, body: {} });
    const sb = window.BondsAuth?.getSupabase?.() || (typeof getSupabase === 'function' ? getSupabase() : null);
    if (!sb) throw new Error(isEn ? 'Storage client unavailable' : 'خدمة التخزين غير متوفرة');
    const { error } = await sb.storage.from('correspondence-artifacts').uploadToSignedUrl(
      upload.path,
      upload.token,
      blob,
      { contentType: 'application/pdf', upsert: true }
    );
    if (error) throw error;
    const finalized = await api('artifact-finalize', {
      method: 'POST',
      id: state.document.id,
      body: { path: upload.path }
    });
    state.document = finalized.document;
    renderGovernance();
    toast('✅ ' + (isEn ? 'Final PDF secured and hashed' : 'تم حفظ PDF النهائي وتثبيت بصمته'));
  }

  async function downloadOfficialPdf() {
    if (!state.document?.artifact_hash) throw new Error(isEn ? 'Official PDF is not available yet' : 'النسخة الرسمية PDF غير متوفرة بعد');
    const result = await api('artifact-download-url', { method: 'POST', id: state.document.id, body: {} });
    if (!result?.signed_url) throw new Error(isEn ? 'Official PDF download link is unavailable' : 'تعذر إنشاء رابط تنزيل النسخة الرسمية');
    const a = document.createElement('a');
    a.href = result.signed_url;
    a.download = (state.document.reference_number || 'bonds-correspondence') + '.pdf';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function refreshInboxDynamic(page = state.inboxPage) {
    const safePage = Math.max(1, Number(page || 1));
    const result = await api('list', {
      query: {
        ...workspaceQuery(),
        page: safePage,
        page_size: state.inboxPageSize
      }
    });
    state.list = result.documents || [];
    state.role = result.role || state.role;
    state.inboxPage = Number(result.pagination?.page || safePage);
    state.inboxTotal = Number(result.pagination?.total || state.list.length);

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
        meta.textContent = statusLabel(doc.status) + ' · ' + new Date(doc.updated_at).toLocaleString(isEn ? 'en-US' : 'ar-SA');
        row.append(title, document.createElement('br'), meta);
        row.addEventListener('click', () => loadDocument(doc.id).catch(e => toast('⚠️ ' + e.message)));
        el.appendChild(row);
      });
    }

    renderList(draftsList, state.list.filter(d => !['sent','archived'].includes(d.status)), isEn ? 'No active correspondence on this page' : 'لا توجد مراسلات نشطة في هذه الصفحة');
    renderList(sentList, state.list.filter(d => ['sent','archived'].includes(d.status)), isEn ? 'No sent correspondence on this page' : 'لا توجد مراسلات مرسلة في هذه الصفحة');

    let pager = document.getElementById('corr-inbox-pagination');
    if (!pager) {
      pager = document.createElement('div');
      pager.id = 'corr-inbox-pagination';
      pager.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:12px';
      document.getElementById('inbox-body')?.appendChild(pager);
    }
    const totalPages = Math.max(1, Math.ceil(state.inboxTotal / state.inboxPageSize));
    pager.innerHTML = '';
    const prev = document.createElement('button');
    prev.type = 'button';
    prev.className = 'draft-btn';
    prev.textContent = isEn ? 'Previous' : 'السابق';
    prev.disabled = state.inboxPage <= 1;
    prev.addEventListener('click', () => refreshInboxDynamic(state.inboxPage - 1).catch(e => toast('⚠️ ' + e.message)));
    const label = document.createElement('span');
    label.textContent = (isEn ? 'Page ' : 'صفحة ') + state.inboxPage + (isEn ? ' of ' : ' من ') + totalPages + ' · ' + state.inboxTotal;
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'draft-btn';
    next.textContent = isEn ? 'Next' : 'التالي';
    next.disabled = state.inboxPage >= totalPages;
    next.addEventListener('click', () => refreshInboxDynamic(state.inboxPage + 1).catch(e => toast('⚠️ ' + e.message)));
    pager.append(prev, label, next);
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
    installGovernedMutationGuards();
    buildGovernanceBar();
    refreshCommandCenter().catch(() => {});
    const id = currentDocId();
    if (id) {
      try {
        await loadDocument(id);
        if (canStartRejectedRevision()) startRejectedRevision();
      } catch (e) { toast('⚠️ ' + t.loadFail + ': ' + e.message); }
    } else {
      setPages([''], { markSaved: false });
      state.lastSavedSnapshot = '';
      state.history = [];
      state.future = [];
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
    if (!canEditCurrent()) return;
    if (!state.document && !hasMeaningfulDraft()) return;
    saveVersion(true).catch(() => {
      try { localStorage.setItem('bonds_letterhead_offline_backup', snapshot()); } catch (_) {}
    });
  };
  window.saveDraft = function () {
    const titleOverride = document.getElementById('draft-name')?.value?.trim()?.slice(0, 200) || null;
    saveVersion(false, { titleOverride }).catch(e => toast('⚠️ ' + e.message));
  };
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
    if (!prepareEditableAction()) return toast('⚠️ ' + (isEn ? 'This document is locked or not owned by the current user' : 'هذا المستند مقفل أو غير مملوك للمستخدم الحالي'));
    return legacy.toggleWrite?.();
  };

  window.openSignatureModal = function () {
    if (!can('sign') || !state.document || !['approved','issued'].includes(state.document.status)) {
      return toast('⚠️ ' + (isEn ? 'Signature requires an approved document and signing permission' : 'التوقيع يتطلب مستندًا معتمدًا وصلاحية التوقيع'));
    }
    return legacy.openSignatureModal?.();
  };

  window.saveSignature = async function () {
    try {
      const canvas = document.getElementById('sig-canvas');
      if (!canvas) throw new Error(isEn ? 'Signature canvas is unavailable' : 'لوحة التوقيع غير متوفرة');
      const signatureData = canvas.toDataURL('image/png');
      await mark('mark-signature', { signature_data_url: signatureData });
      document.getElementById('sig-modal')?.classList.remove('open');
      if (typeof window.clearSignature === 'function') window.clearSignature();
      renderGovernanceArtifacts();
      toast('✅ ' + (isEn ? 'Signature persisted and recorded in audit trail' : 'تم حفظ التوقيع وتسجيله في سجل التدقيق'));
    } catch (e) {
      toast('⚠️ ' + e.message);
    }
  };

  window.insertStamp = async function () {
    if (!can('stamp') || !state.document || state.document.status !== 'approved') {
      return toast('⚠️ ' + (isEn ? 'Stamp requires an approved document and stamp permission before issuance' : 'الختم يتطلب مستندًا معتمدًا وصلاحية الختم قبل الإصدار'));
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
      await Promise.all([refreshInboxDynamic(), refreshCommandCenter()]);
      toast('📨 ' + (isEn ? 'Sent and recorded' : 'تم الإرسال وتسجيل العملية'));
    } catch (e) {
      toast('⚠️ ' + e.message);
    }
  };

  window.shareDoc = function () {
    const token = state.document?.verification_token;
    if (!token) return toast('⚠️ ' + (isEn ? 'Issue the document before sharing' : 'أصدر المستند قبل مشاركته'));
    const url = location.origin + (isEn ? '/en/verify-document.html?token=' : '/verify-document.html?token=') + encodeURIComponent(token);
    if (navigator.share) {
      navigator.share({ title: state.document.reference_number || 'Bonds', url }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(url).then(() => toast('✅ ' + (isEn ? 'Verification link copied' : 'تم نسخ رابط التحقق')));
    }
  };

  window.switchLang = function (lang) {
    const base = lang === 'en' ? '/en/letterhead.html' : '/letterhead.html';
    const params = new URLSearchParams(location.search);
    const id = state.document?.id || params.get('document') || '';
    if (id) params.set('document', id);
    else params.delete('document');
    location.href = base + (params.toString() ? '?' + params.toString() : '');
  };

  window.translateSelection = function () {
    const sel = window.getSelection();
    const text = sel ? sel.toString().trim() : '';
    if (!text) return toast('⚠️ ' + (isEn ? 'Select text first' : 'حدد النص أولاً'));
    if (!confirm(t.externalTranslate)) return;
    window.open('https://translate.google.com/?sl=' + (isEn ? 'en&tl=ar' : 'ar&tl=en') + '&text=' + encodeURIComponent(text), '_blank', 'noopener,noreferrer');
  };

  window.deletePage = function () {
    if (!prepareEditableAction()) return toast('⚠️ ' + t.notAllowed);
    const before = snapshot();
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
    recordMutation(before);
  };

  window.insertTable = function () {
    if (!prepareEditableAction()) return toast('⚠️ ' + t.notAllowed);
    const before = snapshot();
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
    recordMutation(before);
  };

  window.handleImageUpload = function (input) {
    if (!prepareEditableAction()) {
      if (input) input.value = '';
      return toast('⚠️ ' + t.notAllowed);
    }
    const file = input.files?.[0];
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) {
      input.value = '';
      return toast('⚠️ ' + (isEn ? 'Use PNG/JPEG/WebP under 5 MB' : 'استخدم PNG/JPEG/WebP بحجم أقل من 5 ميجابايت'));
    }

    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        try {
          const before = snapshot();
          const maxSide = 1600;
          const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas unavailable');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          let quality = 0.82;
          let dataUrl = canvas.toDataURL('image/jpeg', quality);
          while (dataUrl.length > 420000 && quality > 0.45) {
            quality -= 0.08;
            dataUrl = canvas.toDataURL('image/jpeg', quality);
          }
          if (dataUrl.length > 500000) {
            throw new Error(isEn ? 'Image remains too large after compression' : 'الصورة ما زالت كبيرة بعد الضغط');
          }

          const doc = document.querySelector('.doc-content[contenteditable="true"]');
          if (!doc) throw new Error(isEn ? 'Editable document area was not found' : 'لم يتم العثور على منطقة مستند قابلة للتحرير');
          if (doc.innerHTML.length + dataUrl.length > 650000) {
            throw new Error(isEn ? 'This page is too large; add the image on a new page' : 'حجم هذه الصفحة كبير؛ أضف الصورة في صفحة جديدة');
          }
          const el = document.createElement('img');
          el.src = dataUrl;
          el.alt = '';
          el.style.cssText = 'max-width:100%;height:auto;display:block;margin:10px 0;';
          doc.appendChild(el);
          recordMutation(before);
          window.autoSave?.();
        } catch (error) {
          toast('⚠️ ' + (error?.message || (isEn ? 'Image processing failed' : 'فشل تجهيز الصورة')));
        }
      };
      img.onerror = () => toast('⚠️ ' + (isEn ? 'Invalid image file' : 'ملف الصورة غير صالح'));
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
    input.value = '';
  };

  window.importDocumentFromDevice = async function (input) {
    const file = input.files?.[0];
    if (!file) return;
    try {
      if (!prepareEditableAction()) {
        throw new Error(isEn ? 'This document is locked in its current workflow status' : 'هذا المستند مقفل في حالة سير العمل الحالية');
      }
      if (file.size < 1 || file.size > 2 * 1024 * 1024) {
        throw new Error(isEn ? 'Use a document smaller than 2 MB' : 'استخدم ملفًا بحجم أقل من 2 ميجابايت');
      }
      const allowed = /\.(txt|html?|docx|pdf)$/i.test(file.name || '');
      if (!allowed) {
        throw new Error(isEn ? 'Supported formats: TXT, HTML, HTM, DOCX, PDF' : 'الصيغ المدعومة: TXT وHTML وHTM وDOCX وPDF');
      }

      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }

      const imported = await api('import-device', {
        method: 'POST',
        body: {
          filename: file.name,
          mime_type: file.type || '',
          data_base64: btoa(binary)
        }
      });

      const target = document.querySelector('.doc-content[contenteditable="true"]') || document.querySelector('.doc-content');
      if (!target) throw new Error(isEn ? 'Editable document area was not found' : 'لم يتم العثور على منطقة المستند القابلة للتحرير');

      const before = snapshot();
      target.insertAdjacentHTML('beforeend', imported.html || '');
      const after = snapshot();
      if (before !== after) {
        recordMutation(before);
        await saveVersion(true);
      }
      toast('✅ ' + (isEn ? `Imported and saved ${file.name}` : `تم استيراد وحفظ ${file.name}`));
    } catch (e) {
      toast('⚠️ ' + (e?.message || (isEn ? 'Device import failed' : 'فشل الاستيراد من الجهاز')));
    } finally {
      input.value = '';
    }
  };

  // Full-document, multi-page undo/redo.
  window.undoDoc = function () {
    if (!prepareEditableAction()) return toast('⚠️ ' + t.notAllowed);
    if (!state.history.length) return toast('⚠️ ' + (isEn ? 'Nothing to undo' : 'لا يوجد تراجع'));
    state.future.push(snapshot());
    const prev = state.history.pop();
    setPages(JSON.parse(prev), { markSaved: false });
    state.lastHistorySnapshot = prev;
  };
  window.redoDoc = function () {
    if (!prepareEditableAction()) return toast('⚠️ ' + t.notAllowed);
    if (!state.future.length) return toast('⚠️ ' + (isEn ? 'Nothing to redo' : 'لا يوجد إعادة'));
    state.history.push(snapshot());
    const next = state.future.pop();
    setPages(JSON.parse(next), { markSaved: false });
    state.lastHistorySnapshot = next;
  };

  async function restoreCanonicalLockedDocument() {
    if (!state.document || canEditCurrent()) return;
    await loadDocument(state.document.id);
    if (Array.isArray(state.latestVersion?.pages_html) && state.latestVersion.pages_html.length) {
      setPages(state.latestVersion.pages_html, { markSaved: true });
      renderGovernanceArtifacts();
    }
  }

  function installGovernedMutationGuards() {
    const mutationNames = [
      'insertDateTime','insertSubject','applyTemplate','insertRuler','addNewPage','clearAll',
      'alignText','toggleList','indentText','outdentText','toggleBold','toggleItalic',
      'toggleUnderline','setColor','findReplaceText','changeFont'
    ];
    mutationNames.forEach(name => {
      const original = window[name];
      if (typeof original !== 'function' || original.__bondsGovernedGuard) return;
      const guarded = function (...args) {
        if (!prepareEditableAction()) {
          toast('⚠️ ' + t.notAllowed);
          return;
        }
        const before = snapshot();
        const result = original.apply(this, args);
        Promise.resolve(result).finally(() => recordMutation(before));
        return result;
      };
      guarded.__bondsGovernedGuard = true;
      window[name] = guarded;
    });
  }

  window.exportWord = async function () {
    try {
      await restoreCanonicalLockedDocument();
    } catch (e) {
      return toast('⚠️ ' + (isEn ? 'Unable to reload the governed version: ' : 'تعذر تحميل النسخة المحكومة: ') + e.message);
    }
    const clone = document.getElementById('pages-container')?.cloneNode(true);
    if (!clone) return toast('⚠️ ' + (isEn ? 'Document is unavailable' : 'المستند غير متوفر'));
    clone.querySelectorAll('img').forEach(img => {
      try { img.src = new URL(img.getAttribute('src') || '', location.href).href; } catch (_) {}
    });
    clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    let css = '';
    Array.from(document.styleSheets).forEach(sheet => {
      try {
        css += Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\n');
      } catch (_) {}
    });
    const html = '<!doctype html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><style>' +
      css + '\n@page{size:A4;margin:0}.sheet{page-break-after:always}</style></head><body>' +
      clone.innerHTML + '</body></html>';
    const blob = new Blob(['\ufeff', html], { type: 'application/msword;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (state.document?.reference_number || 'bonds-letterhead') + '.doc';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast('✅ ' + (isEn ? 'Word-compatible .doc downloaded' : 'تم تنزيل ملف Word-compatible بصيغة .doc'));
  };

  // Deterministic sequential multi-page PDF export.
  window.exportPDF = async function () {
    if (state.document?.artifact_hash) {
      try {
        await downloadOfficialPdf();
        toast(isEn ? '✅ Official PDF downloaded' : '✅ تم تنزيل النسخة الرسمية PDF');
      } catch (e) {
        toast('⚠️ ' + (isEn ? 'Official PDF download failed: ' : 'فشل تنزيل النسخة الرسمية: ') + e.message);
      }
      return;
    }
    try {
      await restoreCanonicalLockedDocument();
    } catch (e) {
      return toast('⚠️ ' + (isEn ? 'Unable to reload the governed version: ' : 'تعذر تحميل النسخة المحكومة: ') + e.message);
    }
    toast(isEn ? '⏳ Creating local PDF preview...' : '⏳ جاري إنشاء نسخة PDF محلية...');
    try {
      const blob = await createPdfBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = (state.document?.reference_number || 'bonds-letterhead') + '.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(isEn ? '✅ Local PDF downloaded' : '✅ تم تحميل نسخة PDF محلية');
    } catch (e) {
      toast('⚠️ ' + (isEn ? 'PDF generation failed: ' : 'فشل إنشاء PDF: ') + e.message);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    initialize().catch(e => toast('⚠️ ' + e.message));
  });

  window.addEventListener('beforeunload', event => {
    if (!canEditCurrent()) return;
    if (persistedSnapshot() === state.lastSavedSnapshot) return;
    if (!hasMeaningfulDraft() && !state.document) return;
    event.preventDefault();
    event.returnValue = '';
  });
})();