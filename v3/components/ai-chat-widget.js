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
      <button class="bonds-ai-chat-toggle" aria-label="فتح المساعد الذكي">🤖</button>
      <div class="bonds-ai-chat-window" role="dialog" aria-label="مساعد بوندز الذكي">
        <div class="bonds-ai-chat-header">
          <div>
            <strong>مساعد بوندز</strong>
            <br><small>محلل فرص استثمارية</small>
          </div>
          <button class="bonds-ai-chat-close" aria-label="إغلاق">×</button>
        </div>
        <div class="bonds-ai-chat-messages"></div>
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

    function updateContext(newContext) {
      context = { ...context, ...newContext };
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
      const payload = isProjectMode
        ? { projectId: context.projectId, message: text, history: state.messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-6) }
        : { messages: state.messages.filter(m => m.role === 'user' || m.role === 'assistant').slice(-6), context };

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: await getAuthHeaders(),
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Request failed');

        addAssistantMessage(data.reply, data.source === 'fallback');
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
  }

  window.BondsAIChat = window.BondsAIChat || {};
  window.BondsAIChat.mount = mount;
})(window);
