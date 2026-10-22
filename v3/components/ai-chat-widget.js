/**
 * Bonds V3 — AI Chat Widget
 *
 * Usage:
 *   <script src="/v3/components/ai-chat-widget.js"></script>
 *   <script>BondsAIChat.mount({ cityCode: 'riyadh', activityCode: 'dental_clinics' });</script>
 *   <script>BondsAIChat.mount({ projectId: 'uuid', mode: 'project' });</script>
 */
(function (window) {
  const API_URL = '/api/v3/ai/chat';
  const ECC_ADVISOR_URL = '/api/v3/ecc/advisor';
  const ASSISTANT_PLAN_URL = '/api/v3/assistant/plan';
  const ASSISTANT_CONFIRMATION_PREPARE_URL = '/api/v3/assistant/confirmation/prepare';
  const ASSISTANT_CONFIRMATION_RESOLVE_URL = '/api/v3/assistant/confirmation/resolve';
  const ASSISTANT_IDEMPOTENCY_CLAIM_URL = '/api/v3/assistant/idempotency/claim';
  const ASSISTANT_IDEMPOTENCY_RESOLVE_URL = '/api/v3/assistant/idempotency/resolve';
  const ASSISTANT_STATE_VERSION = 1;
  const ASSISTANT_STATE_PREFIX = 'bonds.assistant.state.v1:';

  async function getAuthHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    try {
      if (window.BondsAuth && window.BondsAuth.getSession) {
        const { data } = await window.BondsAuth.getSession();
        const token = data?.session?.access_token;
        if (token) headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // ignore
    }
    return headers;
  }

  const styles = `
    .bonds-ai-chat-toggle {
      position: fixed;
      bottom: 1.5rem;
      left: 1.5rem;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: linear-gradient(135deg, #d4a853, #f0c96a);
      color: #0a0f1a;
      border: none;
      box-shadow: 0 6px 20px rgba(212,168,83,0.35);
      cursor: pointer;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.5rem;
      transition: transform 0.2s;
    }
    .bonds-ai-chat-toggle:hover { transform: scale(1.05); }
    .bonds-ai-chat-window {
      position: fixed;
      bottom: 90px;
      left: 1.5rem;
      width: 360px;
      max-width: calc(100vw - 2rem);
      height: 480px;
      max-height: calc(100vh - 120px);
      background: #10182d;
      border: 1px solid rgba(197,160,40,0.25);
      border-radius: 16px;
      box-shadow: 0 20px 50px rgba(0,0,0,0.5);
      z-index: 9998;
      display: none;
      flex-direction: column;
      overflow: hidden;
      font-family: 'Vazirmatn', 'Segoe UI', sans-serif;
    }
    .bonds-ai-chat-window.open { display: flex; }
    .bonds-ai-chat-header {
      background: rgba(212,168,83,0.12);
      padding: 0.9rem 1rem;
      border-bottom: 1px solid rgba(197,160,40,0.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .bonds-ai-chat-header strong { color: #f0c96a; font-size: 0.95rem; }
    .bonds-ai-chat-header small { color: #94a3b8; font-size: 0.75rem; }
    .bonds-ai-chat-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 1.1rem;
    }
    .bonds-ai-chat-messages {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .bonds-ai-message {
      max-width: 85%;
      padding: 0.7rem 0.9rem;
      border-radius: 14px;
      font-size: 0.9rem;
      line-height: 1.5;
      white-space: pre-wrap;
    }
    .bonds-ai-message.user {
      align-self: flex-start;
      background: rgba(212,168,83,0.15);
      color: #e8ecf4;
      border-bottom-right-radius: 4px;
    }
    .bonds-ai-message.assistant {
      align-self: flex-end;
      background: rgba(255,255,255,0.06);
      color: #e8ecf4;
      border-bottom-left-radius: 4px;
    }
    .bonds-ai-message.error { color: #ef4444; background: rgba(239,68,68,0.1); }
    .bonds-ai-suggestions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      padding: 0 1rem 0.5rem;
    }
    .bonds-ai-suggestion {
      background: rgba(212,168,83,0.1);
      border: 1px solid rgba(197,160,40,0.25);
      color: #f0c96a;
      border-radius: 20px;
      padding: 0.35rem 0.75rem;
      font-size: 0.78rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .bonds-ai-suggestion:hover { background: rgba(212,168,83,0.2); }
    .bonds-ai-chat-input {
      display: flex;
      gap: 0.5rem;
      padding: 0.75rem;
      border-top: 1px solid rgba(197,160,40,0.15);
      background: #0d1321;
    }
    .bonds-ai-chat-input input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(197,160,40,0.15);
      border-radius: 10px;
      padding: 0.6rem 0.9rem;
      color: #e8ecf4;
      font-size: 0.9rem;
      outline: none;
    }
    .bonds-ai-chat-input button {
      background: #d4a853;
      border: none;
      border-radius: 10px;
      color: #0a0f1a;
      padding: 0 1rem;
      font-weight: 700;
      cursor: pointer;
    }
    .bonds-ai-chat-input button:disabled { opacity: 0.5; cursor: not-allowed; }
    .bonds-ai-typing {
      align-self: flex-end;
      color: #94a3b8;
      font-size: 0.8rem;
      padding: 0.25rem 0.5rem;
    }
    .bonds-ai-actions {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      padding: 0 1rem 0.65rem;
    }
    .bonds-ai-action-card {
      border: 1px solid rgba(197,160,40,0.2);
      background: rgba(255,255,255,0.04);
      border-radius: 12px;
      padding: 0.7rem;
      color: #e8ecf4;
    }
    .bonds-ai-action-card strong {
      display: block;
      margin-bottom: 0.35rem;
      color: #f0c96a;
      font-size: 0.86rem;
    }
    .bonds-ai-action-card small {
      display: block;
      color: #94a3b8;
      margin-bottom: 0.55rem;
      line-height: 1.4;
    }
    .bonds-ai-action-card button {
      background: rgba(212,168,83,0.14);
      border: 1px solid rgba(197,160,40,0.3);
      color: #f0c96a;
      border-radius: 8px;
      padding: 0.45rem 0.7rem;
      cursor: pointer;
      font-weight: 700;
    }
    .bonds-ai-action-card button:disabled { opacity: 0.5; cursor: not-allowed; }
  `;

  function injectStyles() {
    if (document.getElementById('bonds-ai-chat-styles')) return;
    const style = document.createElement('style');
    style.id = 'bonds-ai-chat-styles';
    style.textContent = styles;
    document.head.appendChild(style);
  }

  function createWidgetHTML() {
    return `
      <button class="bonds-ai-chat-toggle" aria-label="فتح المساعد الذكي"><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><ellipse fill="#F4900C" cx="33.5" cy="14.5" rx="2.5" ry="3.5"/><ellipse fill="#F4900C" cx="2.5" cy="14.5" rx="2.5" ry="3.5"/><path fill="#FFAC33" d="M34 19c0 .553-.447 1-1 1h-3c-.553 0-1-.447-1-1v-9c0-.552.447-1 1-1h3c.553 0 1 .448 1 1v9zM7 19c0 .553-.448 1-1 1H3c-.552 0-1-.447-1-1v-9c0-.552.448-1 1-1h3c.552 0 1 .448 1 1v9z"/><path fill="#FFCC4D" d="M28 5c0 2.761-4.478 4-10 4C12.477 9 8 7.761 8 5s4.477-5 10-5c5.522 0 10 2.239 10 5z"/><path fill="#F4900C" d="M25 4.083C25 5.694 21.865 7 18 7c-3.866 0-7-1.306-7-2.917 0-1.611 3.134-2.917 7-2.917 3.865 0 7 1.306 7 2.917z"/><path fill="#269" d="M30 5.5C30 6.881 28.881 7 27.5 7h-19C7.119 7 6 6.881 6 5.5S7.119 3 8.5 3h19C28.881 3 30 4.119 30 5.5z"/><path fill="#55ACEE" d="M30 6H6c-1.104 0-2 .896-2 2v26h28V8c0-1.104-.896-2-2-2z"/><path fill="#3B88C3" d="M35 33v-1c0-1.104-.896-2-2-2H22.071l-3.364 3.364c-.391.391-1.023.391-1.414 0L13.929 30H3c-1.104 0-2 .896-2 2v1c0 1.104-.104 2 1 2h32c1.104 0 1-.896 1-2z"/><circle fill="#FFF" cx="24.5" cy="14.5" r="4.5"/><circle fill="#DD2E44" cx="24.5" cy="14.5" r="2.721"/><circle fill="#FFF" cx="11.5" cy="14.5" r="4.5"/><path fill="#F5F8FA" d="M29 25.5c0 1.381-1.119 2.5-2.5 2.5h-17C8.119 28 7 26.881 7 25.5S8.119 23 9.5 23h17c1.381 0 2.5 1.119 2.5 2.5z"/><path fill="#CCD6DD" d="M17 23h2v5h-2zm-5 0h2v5h-2zm10 0h2v5h-2zM7 25.5c0 1.21.859 2.218 2 2.45v-4.9c-1.141.232-2 1.24-2 2.45zm20-2.45v4.899c1.141-.232 2-1.24 2-2.45s-.859-2.217-2-2.449z"/><circle fill="#DD2E44" cx="11.5" cy="14.5" r="2.721"/></svg></button>
      <div class="bonds-ai-chat-window" role="dialog" aria-label="مساعد بوندز الذكي">
        <div class="bonds-ai-chat-header">
          <div>
            <strong>مساعد بوندز</strong>
            <br><small>محلل فرص استثمارية</small>
          </div>
          <button class="bonds-ai-chat-close" aria-label="إغلاق">×</button>
        </div>
        <div class="bonds-ai-chat-messages"></div>
        <div class="bonds-ai-actions"></div>
        <div class="bonds-ai-suggestions"></div>
        <div class="bonds-ai-chat-input">
          <input type="text" placeholder="اسأل عن فرصة أو مدينة..." autocomplete="off">
          <button>إرسال</button>
        </div>
      </div>
    `;
  }

  function mount(options = {}) {
    if (document.getElementById('bonds-ai-chat-root')) return;

    injectStyles();
    const root = document.createElement('div');
    root.id = 'bonds-ai-chat-root';
    root.innerHTML = createWidgetHTML();
    document.body.appendChild(root);

    const toggle = root.querySelector('.bonds-ai-chat-toggle');
    const windowEl = root.querySelector('.bonds-ai-chat-window');
    const closeBtn = root.querySelector('.bonds-ai-chat-close');
    const messagesEl = root.querySelector('.bonds-ai-chat-messages');
    const actionsEl = root.querySelector('.bonds-ai-actions');
    const suggestionsEl = root.querySelector('.bonds-ai-suggestions');
    const input = root.querySelector('.bonds-ai-chat-input input');
    const sendBtn = root.querySelector('.bonds-ai-chat-input button');

    let context = {
      cityCode: options.cityCode || null,
      activityCode: options.activityCode || null,
      modelCode: options.modelCode || null,
      calculationResult: options.calculationResult || null,
      projectId: options.projectId || null,
      mode: options.mode || 'city'
    };

    function contextBoundaryKey(value = context) {
      const mode = value.mode === 'project' ? 'project' : 'city';
      if (mode === 'project') {
        const projectId = String(value.projectId || '').trim();
        return projectId ? `project:${projectId}` : 'project:unbound';
      }

      const city = String(value.cityCode || 'none').trim();
      const activity = String(value.activityCode || 'none').trim();
      const model = String(value.modelCode || 'none').trim();
      return `city:${city}|activity:${activity}|model:${model}`;
    }

    function assistantStateStorageKey(boundary = contextBoundaryKey()) {
      return ASSISTANT_STATE_PREFIX + encodeURIComponent(boundary);
    }

    function createAssistantContextState(boundary = contextBoundaryKey()) {
      return {
        version: ASSISTANT_STATE_VERSION,
        boundary,
        goal: null,
        current_stage: null,
        open_tasks: [],
        required_data: [],
        confirmed_facts: {},
        pending_confirmation: null,
        last_action: null,
        updated_at: null
      };
    }

    function sanitizeStringArray(value) {
      if (!Array.isArray(value)) return [];
      return value
        .filter(item => typeof item === 'string' && item.trim())
        .map(item => item.trim())
        .slice(0, 50);
    }

    function sanitizePlainObject(value) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
      const result = {};
      Object.entries(value).slice(0, 100).forEach(([key, item]) => {
        if (
          typeof key === 'string' &&
          key.length <= 100 &&
          (item === null || ['string', 'number', 'boolean'].includes(typeof item))
        ) {
          result[key] = item;
        }
      });
      return result;
    }

    function sanitizeAssistantContextState(value, boundary = contextBoundaryKey()) {
      const base = createAssistantContextState(boundary);
      if (!value || typeof value !== 'object' || Array.isArray(value)) return base;
      if (value.boundary && value.boundary !== boundary) return base;

      return {
        version: ASSISTANT_STATE_VERSION,
        boundary,
        goal: typeof value.goal === 'string' ? value.goal.slice(0, 500) : null,
        current_stage: typeof value.current_stage === 'string' ? value.current_stage.slice(0, 200) : null,
        open_tasks: sanitizeStringArray(value.open_tasks),
        required_data: sanitizeStringArray(value.required_data),
        confirmed_facts: sanitizePlainObject(value.confirmed_facts),
        pending_confirmation: value.pending_confirmation && typeof value.pending_confirmation === 'object'
          ? sanitizePlainObject(value.pending_confirmation)
          : null,
        last_action: value.last_action && typeof value.last_action === 'object'
          ? sanitizePlainObject(value.last_action)
          : null,
        updated_at: typeof value.updated_at === 'string' ? value.updated_at : null
      };
    }

    function loadAssistantContextState(boundary = contextBoundaryKey()) {
      try {
        const raw = window.sessionStorage?.getItem(assistantStateStorageKey(boundary));
        if (!raw) return createAssistantContextState(boundary);
        return sanitizeAssistantContextState(JSON.parse(raw), boundary);
      } catch (err) {
        return createAssistantContextState(boundary);
      }
    }

    function saveAssistantContextState() {
      assistantContextState.updated_at = new Date().toISOString();
      assistantContextState = sanitizeAssistantContextState(
        assistantContextState,
        assistantContextState.boundary
      );
      try {
        window.sessionStorage?.setItem(
          assistantStateStorageKey(assistantContextState.boundary),
          JSON.stringify(assistantContextState)
        );
      } catch (err) {
        // Session persistence is best-effort; the current page state remains usable.
      }
      return assistantContextState;
    }

    function replaceAssistantContextState(nextState) {
      assistantContextState = sanitizeAssistantContextState(
        nextState,
        contextBoundaryKey()
      );
      return saveAssistantContextState();
    }

    function patchAssistantContextState(patch = {}) {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return assistantContextState;
      }
      return replaceAssistantContextState({
        ...assistantContextState,
        ...patch,
        boundary: contextBoundaryKey()
      });
    }

    let assistantContextState = loadAssistantContextState();

    function resetVisibleConversationForBoundary() {
      state.messages = [];
      messagesEl.innerHTML = '';
      actionsEl.innerHTML = '';
      suggestionsEl.innerHTML = '';
    }

    function updateContext(newContext) {
      const previousBoundary = contextBoundaryKey(context);
      context = { ...context, ...newContext };
      const nextBoundary = contextBoundaryKey(context);

      if (previousBoundary !== nextBoundary) {
        assistantContextState = loadAssistantContextState(nextBoundary);
        resetVisibleConversationForBoundary();
      }
    }

    const state = {
      messages: [],
      isOpen: false,
      isLoading: false
    };

    function getCityName() {
      const citySelect = document.getElementById('citySelect');
      return citySelect ? citySelect.options[citySelect.selectedIndex]?.text : null;
    }

    function getActivityName() {
      const activitySelect = document.getElementById('activitySelect');
      return activitySelect ? activitySelect.options[activitySelect.selectedIndex]?.text : null;
    }

    function refreshContext() {
      context.cityName = getCityName();
      context.activityName = getActivityName();
    }

    function toggleOpen() {
      state.isOpen = !state.isOpen;
      windowEl.classList.toggle('open', state.isOpen);
      if (state.isOpen && state.messages.length === 0) {
        refreshContext();
        if (context.mode === 'project' && context.projectId) {
          addAssistantMessage('مرحباً! أنا مستشار بوندز التنفيذي. أسألني عن مشروعك: أين وصلنا؟ ما الذي ينقص؟ ما الخطوة التالية؟');
        } else {
          const city = context.cityName || context.cityCode || 'مدينة محددة';
          const activity = context.activityName || context.activityCode || 'نشاط محدد';
          addAssistantMessage(`مرحباً! أنا مساعد بوندز. يمكنك سؤالي عن فرصة "${activity}" في ${city}، أو عن أي مدينة/نشاط آخر.`);
        }
        renderSuggestions();
      }
      if (state.isOpen) input.focus();
    }

    function addMessage(role, text, isError = false) {
      state.messages.push({ role, content: text });
      const msgEl = document.createElement('div');
      msgEl.className = `bonds-ai-message ${role}${isError ? ' error' : ''}`;
      msgEl.textContent = text;
      messagesEl.appendChild(msgEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addAssistantMessage(text, isError) {
      addMessage('assistant', text, isError);
    }

    function addUserMessage(text) {
      addMessage('user', text);
    }

    function setLoading(loading) {
      state.isLoading = loading;
      sendBtn.disabled = loading;
      input.disabled = loading;
      const typing = root.querySelector('.bonds-ai-typing');
      if (loading) {
        if (!typing) {
          const el = document.createElement('div');
          el.className = 'bonds-ai-typing';
          el.textContent = 'يكتب...';
          messagesEl.appendChild(el);
          messagesEl.scrollTop = messagesEl.scrollHeight;
        }
      } else if (typing) {
        typing.remove();
      }
    }

    function languageCode() {
      return document.documentElement.lang === 'en' ? 'en' : 'ar';
    }

    function safeInternalRoute(route) {
      return typeof route === 'string' &&
        route.startsWith('/') &&
        !route.startsWith('//') &&
        !route.includes('\\');
    }

    async function requestGovernedPlan(action) {
      const body = {
        type: action.type,
        target: action.target || undefined,
        form: ['form_find', 'form_load', 'form_save_draft'].includes(action.type)
          ? action.target
          : undefined,
        language: languageCode()
      };

      const res = await fetch(ASSISTANT_PLAN_URL, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || data.status === 'denied') {
        const code = data?.context?.code || data?.error || 'ASSISTANT_ACTION_DENIED';
        throw new Error(code);
      }
      return data;
    }

    function actionLabel(action) {
      if (action.type === 'site_navigate') return languageCode() === 'en' ? 'Open destination' : 'فتح الوجهة';
      if (action.type === 'form_find') return languageCode() === 'en' ? 'Find form' : 'العثور على النموذج';
      if (action.type === 'form_load') return languageCode() === 'en' ? 'Open form' : 'فتح النموذج';
      if (action.type === 'form_save_draft') return languageCode() === 'en' ? 'Save draft' : 'حفظ المسودة';
      return languageCode() === 'en' ? 'Review action' : 'مراجعة الإجراء';
    }

    function actionTitle(action) {
      if (action.type === 'site_navigate') return languageCode() === 'en' ? 'Navigation' : 'تنقل معتمد';
      if (action.type === 'form_find' || action.type === 'form_load' || action.type === 'form_save_draft') return languageCode() === 'en' ? 'Registered form' : 'نموذج مسجل';
      return languageCode() === 'en' ? 'Assistant action' : 'إجراء المساعد';
    }

    async function requestConfirmation(action, confirmation = null, decision = null) {
      const url = confirmation
        ? ASSISTANT_CONFIRMATION_RESOLVE_URL
        : ASSISTANT_CONFIRMATION_PREPARE_URL;
      const body = confirmation
        ? { action, confirmation, decision }
        : { action, language: languageCode() };

      const res = await fetch(url, {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'CONFIRMATION_FAILED');
      return data.confirmation;
    }

    function stableFormSnapshot(form) {
      const entries = [];
      const data = new FormData(form);
      data.forEach((value, name) => {
        let normalized;
        if (typeof File !== 'undefined' && value instanceof File) {
          normalized = {
            file_name:String(value.name || ''),
            size:Number(value.size || 0),
            type:String(value.type || ''),
            last_modified:Number(value.lastModified || 0)
          };
        } else {
          normalized = String(value);
        }
        entries.push([String(name), normalized]);
      });
      entries.sort((a, b) => {
        const byName = a[0].localeCompare(b[0]);
        if (byName) return byName;
        return JSON.stringify(a[1]).localeCompare(JSON.stringify(b[1]));
      });
      return entries;
    }

    async function draftIdempotencyKey(formCode, boundary = contextBoundaryKey()) {
      const form = document.querySelector('form');
      if (!form) throw new Error('IDEMPOTENCY_FORM_UNAVAILABLE');
      if (!window.crypto?.subtle || typeof TextEncoder === 'undefined') {
        throw new Error('IDEMPOTENCY_CRYPTO_UNAVAILABLE');
      }
      const snapshot = JSON.stringify({
        version:1,
        boundary:String(boundary || ''),
        action_type:'form_save_draft',
        form_code:String(formCode || ''),
        form:stableFormSnapshot(form)
      });
      const bytes = new TextEncoder().encode(snapshot);
      const digest = await window.crypto.subtle.digest('SHA-256', bytes);
      return Array.from(new Uint8Array(digest))
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
    }

    async function requestIdempotencyClaim(action, idempotencyKey) {
      const res = await fetch(ASSISTANT_IDEMPOTENCY_CLAIM_URL, {
        method:'POST',
        headers:await getAuthHeaders(),
        body:JSON.stringify({
          action,
          idempotency_key:idempotencyKey
        })
      });
      const data = await res.json();
      const state = data?.idempotency?.state || data?.error || 'IDEMPOTENCY_CLAIM_FAILED';
      if (!res.ok && !['in_progress', 'uncertain', 'key_conflict'].includes(state)) {
        throw new Error(state);
      }
      return data.idempotency || { state };
    }

    async function requestIdempotencyResolve(action, idempotencyKey, status, result) {
      const res = await fetch(ASSISTANT_IDEMPOTENCY_RESOLVE_URL, {
        method:'POST',
        headers:await getAuthHeaders(),
        body:JSON.stringify({
          action,
          idempotency_key:idempotencyKey,
          status,
          result
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.idempotency?.state || data?.error || 'IDEMPOTENCY_RESOLVE_FAILED');
      return data.idempotency;
    }

    function confirmationStateSummary(confirmation) {
      if (!confirmation || typeof confirmation !== 'object') return null;
      return {
        version: confirmation.version ?? null,
        required: confirmation.required === true,
        status: String(confirmation.status || ''),
        action_id: String(confirmation.action_id || ''),
        action_fingerprint: String(confirmation.action_fingerprint || ''),
        risk: String(confirmation.risk || ''),
        prompt: String(confirmation.prompt || ''),
        execution_authorized: confirmation.execution_authorized === true
      };
    }

    function renderConfirmationCard(action, confirmation) {
      actionsEl.innerHTML = '';
      const card = document.createElement('div');
      card.className = 'bonds-ai-action-card';
      card.dataset.actionId = String(action.id || '');

      const title = document.createElement('strong');
      title.textContent = languageCode() === 'en' ? 'Confirmation required' : 'التأكيد مطلوب';

      const detail = document.createElement('small');
      detail.textContent = confirmation.prompt || actionTitle(action);

      const confirmButton = document.createElement('button');
      confirmButton.type = 'button';
      confirmButton.textContent = languageCode() === 'en' ? 'Confirm' : 'تأكيد';

      const cancelButton = document.createElement('button');
      cancelButton.type = 'button';
      cancelButton.textContent = languageCode() === 'en' ? 'Cancel' : 'إلغاء';

      async function resolve(decision) {
        confirmButton.disabled = true;
        cancelButton.disabled = true;
        try {
          const resolved = await requestConfirmation(action, confirmation, decision);
          patchAssistantContextState({
            pending_confirmation: null,
            last_action: {
              id: String(action.id || ''),
              type: String(action.type || ''),
              target: action.target == null ? null : String(action.target),
              status: resolved.status === 'confirmed'
                ? 'confirmed_pending_governance'
                : 'cancelled'
            }
          });
          actionsEl.innerHTML = '';
          addAssistantMessage(
            resolved.status === 'confirmed'
              ? (languageCode() === 'en'
                  ? 'Confirmation recorded. Sensitive execution still requires the governed execution layer.'
                  : 'تم تسجيل التأكيد. التنفيذ الحساس ما زال خاضعًا لطبقة التنفيذ المحكوم.')
              : (languageCode() === 'en' ? 'Action cancelled.' : 'تم إلغاء الإجراء.')
          );
        } catch (err) {
          console.error('[BondsAssistantConfirmation]', err);
          confirmButton.disabled = false;
          cancelButton.disabled = false;
          addAssistantMessage(
            languageCode() === 'en'
              ? 'Confirmation could not be recorded.'
              : 'تعذر تسجيل التأكيد.',
            true
          );
        }
      }

      confirmButton.addEventListener('click', () => resolve('confirm'));
      cancelButton.addEventListener('click', () => resolve('cancel'));

      card.appendChild(title);
      card.appendChild(detail);
      card.appendChild(confirmButton);
      card.appendChild(cancelButton);
      actionsEl.appendChild(card);
    }

    async function executeStructuredAction(action, button) {
      if (!action || action.status === 'denied') return;
      if (action.requires_confirmation) {
        if (button) button.disabled = true;
        try {
          const confirmation = await requestConfirmation(action);
          patchAssistantContextState({
            pending_confirmation: confirmationStateSummary(confirmation)
          });
          renderConfirmationCard(action, confirmation);
        } catch (err) {
          console.error('[BondsAssistantConfirmation]', err);
          if (button) button.disabled = false;
          addAssistantMessage(
            languageCode() === 'en'
              ? 'The confirmation request could not be prepared.'
              : 'تعذر تجهيز طلب التأكيد.',
            true
          );
        }
        return;
      }

      if (button) button.disabled = true;
      try {
        if (action.type === 'site_navigate') {
          const plan = await requestGovernedPlan(action);
          const route = plan?.context?.navigation?.route;
          if (!safeInternalRoute(route)) throw new Error('UNSAFE_NAVIGATION_ROUTE');
          window.location.assign(route);
          return;
        }

        if (action.type === 'form_save_draft') {
          const plan = await requestGovernedPlan(action);
          const planned = Array.isArray(plan?.actions)
            ? plan.actions.find(item => item?.type === 'form_save_draft')
            : null;
          if (!planned || planned.target !== action.target) {
            throw new Error('DRAFT_PLAN_MISMATCH');
          }

          const adapter = window.BondsAssistantFormAdapter;
          if (!adapter || adapter.form_code !== planned.target || typeof adapter.saveDraft !== 'function') {
            throw new Error('DRAFT_ADAPTER_NOT_AVAILABLE');
          }

          const idempotencyKey = await draftIdempotencyKey(
            planned.target,
            contextBoundaryKey()
          );
          const claim = await requestIdempotencyClaim(planned, idempotencyKey);

          if (
            claim.state === 'replay_succeeded' &&
            claim.result?.ok === true &&
            claim.result?.record_id &&
            claim.result?.status === 'draft'
          ) {
            patchAssistantContextState({
              last_action:{
                id:String(action.id || ''),
                type:'form_save_draft',
                target:String(planned.target || ''),
                status:'replayed'
              }
            });
            addAssistantMessage(
              languageCode() === 'en'
                ? 'This exact draft was already saved. The verified result was reused.'
                : 'تم حفظ هذه المسودة نفسها مسبقًا. أُعيد استخدام النتيجة المتحقق منها.'
            );
            return;
          }

          if (claim.state !== 'claimed') {
            const code = claim.state === 'uncertain'
              ? 'IDEMPOTENCY_UNCERTAIN'
              : claim.state === 'in_progress'
                ? 'IDEMPOTENCY_IN_PROGRESS'
                : 'IDEMPOTENCY_KEY_CONFLICT';
            throw new Error(code);
          }

          try {
            const result = await adapter.saveDraft({ idempotency_key:idempotencyKey });
            if (
              !result ||
              result.ok !== true ||
              !result.record_id ||
              result.status !== 'draft'
            ) {
              throw new Error('DRAFT_VERIFICATION_FAILED');
            }

            const resolved = await requestIdempotencyResolve(
              planned,
              idempotencyKey,
              'succeeded',
              result
            );
            if (
              !resolved ||
              !['resolved_succeeded', 'replay_succeeded'].includes(resolved.state)
            ) {
              throw new Error('IDEMPOTENCY_RESOLVE_NOT_VERIFIED');
            }

            patchAssistantContextState({
              last_action:{
                id:String(action.id || ''),
                type:'form_save_draft',
                target:String(planned.target || ''),
                status:'completed'
              }
            });
            addAssistantMessage(
              languageCode() === 'en'
                ? 'Draft saved and verified.'
                : 'تم حفظ المسودة والتحقق منها.'
            );
            return;
          } catch (err) {
            try {
              await requestIdempotencyResolve(
                planned,
                idempotencyKey,
                'uncertain',
                null
              );
            } catch (_) {
              // If resolve itself is unreachable, the server ledger remains
              // started, which intentionally blocks replay of the same write.
            }
            throw err;
          }
        }

        if (action.type === 'form_find' || action.type === 'form_load') {
          const plan = await requestGovernedPlan(action);
          renderStructuredEnvelope(plan, { appendReply: true });
          if (action.type === 'form_load') {
            const navTarget = plan?.context?.form?.navigation_target;
            if (navTarget) {
              renderActionCards([{
                id: action.id + '-navigate',
                type: 'site_navigate',
                capability: 'site_navigate',
                target: navTarget,
                risk: 'low',
                requires_confirmation: false,
                status: 'ready'
              }]);
            }
          }
          return;
        }

        addAssistantMessage(
          languageCode() === 'en'
            ? 'This action is not executable in the current widget phase.'
            : 'هذا الإجراء غير قابل للتنفيذ في مرحلة الواجهة الحالية.',
          true
        );
      } catch (err) {
        console.error('[BondsAssistantAction]', err);
        addAssistantMessage(
          languageCode() === 'en'
            ? 'The governed action could not be completed.'
            : 'تعذر تنفيذ الإجراء عبر المسار المحكوم.',
          true
        );
      } finally {
        if (button) button.disabled = false;
      }
    }

    function renderActionCards(actions = []) {
      actionsEl.innerHTML = '';
      actions
        .filter(action => action && action.status !== 'denied')
        .forEach(action => {
          const card = document.createElement('div');
          card.className = 'bonds-ai-action-card';
          card.dataset.actionId = String(action.id || '');

          const title = document.createElement('strong');
          title.textContent = actionTitle(action);

          const detail = document.createElement('small');
          detail.textContent = String(action.target || action.capability || action.type || '');

          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = actionLabel(action);
          button.addEventListener('click', () => executeStructuredAction(action, button));

          card.appendChild(title);
          card.appendChild(detail);
          card.appendChild(button);
          actionsEl.appendChild(card);
        });
    }

    function renderStructuredEnvelope(envelope, { appendReply = false } = {}) {
      if (!envelope || typeof envelope !== 'object') return;
      if (appendReply && envelope.reply) addAssistantMessage(envelope.reply);

      const actions = Array.isArray(envelope.actions) ? envelope.actions : [];
      const firstAction = actions.find(action => action && action.status !== 'denied') || null;
      if (firstAction) {
        patchAssistantContextState({
          last_action: {
            id: String(firstAction.id || ''),
            type: String(firstAction.type || ''),
            target: firstAction.target == null ? null : String(firstAction.target),
            status: String(firstAction.status || 'ready')
          }
        });
      }

      if (typeof envelope.context?.current_stage === 'string') {
        patchAssistantContextState({
          current_stage: envelope.context.current_stage
        });
      }

      renderActionCards(actions);
    }

    function renderSuggestions() {
      if (context.mode === 'project' && context.projectId) {
        const defaults = [
          'أين وصل مشروعي؟',
          'ما الذي ينقص لإكمال المرحلة الحالية؟',
          'ما الخطوة التالية؟',
          'ما المخاطر الحرجة؟'
        ];
        const suggestions = options.suggestions || defaults;
        suggestionsEl.innerHTML = '';
        suggestions.forEach(text => {
          const chip = document.createElement('button');
          chip.className = 'bonds-ai-suggestion';
          chip.textContent = text;
          chip.addEventListener('click', () => sendMessage(text));
          suggestionsEl.appendChild(chip);
        });
        return;
      }

      const city = context.cityName || context.cityCode || 'هذه المدينة';
      const activity = context.activityName || context.activityCode || 'هذا النشاط';
      const defaults = [
        `كيف تقيم فرصة ${activity} في ${city}؟`,
        'ما أفضل مدينة لهذا النشاط؟',
        `ما مخاطر الاستثمار في ${city}؟`,
        'كيف أحسن فترة الاسترداد؟'
      ];
      const suggestions = options.suggestions || defaults;
      suggestionsEl.innerHTML = '';
      suggestions.forEach(text => {
        const chip = document.createElement('button');
        chip.className = 'bonds-ai-suggestion';
        chip.textContent = text;
        chip.addEventListener('click', () => sendMessage(text));
        suggestionsEl.appendChild(chip);
      });
    }

    async function sendMessage(text) {
      if (!text.trim() || state.isLoading) return;
      refreshContext();
      addUserMessage(text);
      setLoading(true);
      input.value = '';

      const isProjectMode = context.mode === 'project' && context.projectId;
      const url = isProjectMode ? ECC_ADVISOR_URL : API_URL;
      const structuredState = sanitizeAssistantContextState(
        assistantContextState,
        contextBoundaryKey()
      );
      const payload = isProjectMode
        ? {
            projectId: context.projectId,
            message: text,
            history: state.messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-6),
            assistantState: structuredState
          }
        : {
            messages: state.messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-6),
            context,
            assistantState: structuredState
          };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');

        addAssistantMessage(data.reply, data.source === 'fallback');
        if (Array.isArray(data.actions) || Array.isArray(data.ui)) {
          renderStructuredEnvelope(data);
        }
      } catch (err) {
        console.error('[BondsAIChat]', err);
        addAssistantMessage('عذراً، حدث خطأ أثناء الاتصال بالمساعد. حاول مرة أخرى.', true);
      } finally {
        setLoading(false);
      }
    }

    toggle.addEventListener('click', toggleOpen);
    closeBtn.addEventListener('click', toggleOpen);
    sendBtn.addEventListener('click', () => sendMessage(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMessage(input.value);
    });

    window.BondsAIChat.updateContext = updateContext;
    window.BondsAssistant = window.BondsAssistant || {};
    window.BondsAssistant.execute = executeStructuredAction;
    window.BondsAssistant.renderEnvelope = envelope => renderStructuredEnvelope(envelope, { appendReply: true });
    window.BondsAssistant.getState = () => sanitizeAssistantContextState(
      assistantContextState,
      contextBoundaryKey()
    );
    window.BondsAssistant.updateState = patch => patchAssistantContextState(patch);
    window.BondsAssistant.clearState = () => {
      const boundary = contextBoundaryKey();
      try {
        window.sessionStorage?.removeItem(assistantStateStorageKey(boundary));
      } catch (err) {
        // Ignore unavailable session storage.
      }
      assistantContextState = createAssistantContextState(boundary);
      return assistantContextState;
    };
  }

  window.BondsAIChat = window.BondsAIChat || {};
  window.BondsAIChat.mount = mount;
})(window);
