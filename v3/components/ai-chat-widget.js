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
  const ASSISTANT_NOTIFICATIONS_URL = '/api/v3/assistant/notifications';
  const ASSISTANT_NOTIFICATION_READ_URL = '/api/v3/assistant/notifications/read';
  const ASSISTANT_STATE_VERSION = 1;
  const ASSISTANT_STATE_PREFIX = 'bonds.assistant.state.v1:';
  const SERVICE_ASSISTANT_CONTEXT_KEY = 'bonds_service_assistant_context_v1';

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
    .bonds-ai-notification-badge {
      position: absolute;
      top: -4px;
      right: -4px;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 999px;
      background: #ef4444;
      color: #fff;
      font-size: 0.72rem;
      font-weight: 800;
      display: none;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.35);
    }
    .bonds-ai-notification-badge.visible { display: flex; }
    .bonds-ai-notifications {
      display: none;
      max-height: 180px;
      overflow-y: auto;
      padding: 0.6rem 0.75rem;
      border-bottom: 1px solid rgba(197,160,40,0.15);
      background: rgba(255,255,255,0.02);
    }
    .bonds-ai-notifications.visible { display: block; }
    .bonds-ai-notification-card {
      border: 1px solid rgba(197,160,40,0.2);
      border-radius: 10px;
      padding: 0.55rem 0.65rem;
      margin-bottom: 0.5rem;
      background: rgba(255,255,255,0.04);
      color: #e8ecf4;
    }
    .bonds-ai-notification-card:last-child { margin-bottom: 0; }
    .bonds-ai-notification-card strong {
      display: block;
      color: #f0c96a;
      font-size: 0.82rem;
      margin-bottom: 0.2rem;
    }
    .bonds-ai-notification-card small {
      display: block;
      color: #cbd5e1;
      line-height: 1.45;
      margin-bottom: 0.45rem;
    }
    .bonds-ai-notification-card button {
      margin-inline-end: 0.35rem;
      background: rgba(212,168,83,0.14);
      border: 1px solid rgba(197,160,40,0.3);
      color: #f0c96a;
      border-radius: 7px;
      padding: 0.3rem 0.55rem;
      cursor: pointer;
      font-size: 0.74rem;
    }
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

    /* Homepage assistant — institutional light treatment */
    .bonds-ai-chat-toggle-label,
    .bonds-ai-chat-toggle-status,
    .bonds-ai-home-launchpad,
    .bonds-ai-home-status,
    .bonds-ai-send-icon { display: none; }

    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-toggle {
      width: auto;
      min-width: 156px;
      height: 54px;
      padding: 0 16px 0 10px;
      gap: 10px;
      border-radius: 999px;
      background: #082446;
      color: #fff;
      box-shadow: 0 12px 28px rgba(8,36,70,0.24);
      border: 1px solid rgba(255,255,255,0.14);
      direction: rtl;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-toggle:hover {
      transform: translateY(-1px);
      background: #0b315f;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-toggle > svg {
      width: 34px !important;
      height: 34px !important;
      max-width: 34px !important;
      max-height: 34px !important;
      flex: 0 0 34px !important;
      border-radius: 50%;
      background: #fff;
      padding: 4px;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-toggle-label {
      display: inline;
      font-size: 0.9rem;
      font-weight: 800;
      white-space: nowrap;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-toggle-status {
      display: block;
      position: absolute;
      left: 8px;
      bottom: 5px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #22c55e;
      border: 2px solid #fff;
      box-sizing: border-box;
    }

    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-window {
      bottom: 92px;
      left: 24px;
      width: min(420px, calc(100vw - 48px));
      height: min(650px, calc(100vh - 140px));
      max-width: none;
      max-height: none;
      background: #fff;
      border: 1px solid #dbe3ec;
      border-radius: 16px;
      box-shadow: 0 22px 60px rgba(8,36,70,0.22);
      color: #0b2340;
      direction: rtl;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-header {
      background: #082446;
      border-bottom: none;
      padding: 14px 16px;
      min-height: 66px;
      color: #fff;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-header strong {
      color: #fff;
      font-size: 1rem;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-header small {
      color: #d8e3ef;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #d8e3ef;
      font-size: 0.75rem;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-status::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 0 2px rgba(34,197,94,0.16);
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-close {
      color: #fff;
      font-size: 1.45rem;
      line-height: 1;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-close:hover { color: #d4a853; }

    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-launchpad {
      display: block;
      padding: 14px 14px 6px;
      background: #fff;
      overflow-y: auto;
    }
    #bonds-ai-chat-root.bonds-ai-home.conversation-started .bonds-ai-home-launchpad {
      display: none;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-intro {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: 12px;
      border: 1px solid #e7edf4;
      border-radius: 12px;
      background: #f7f9fc;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-intro-icon {
      width: 34px;
      height: 34px;
      flex: 0 0 34px;
      border-radius: 50%;
      display: grid;
      place-items: center;
      background: #e8f5fb;
      color: #0b4b78;
      font-size: 1.05rem;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-intro strong {
      display: block;
      color: #0b2340;
      margin-bottom: 3px;
      font-size: 0.9rem;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-intro p {
      margin: 0;
      color: #66758a;
      font-size: 0.78rem;
      line-height: 1.55;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: 8px;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-service {
      min-height: 72px;
      border: 1px solid #dbe3ec;
      border-radius: 12px;
      background: #fff;
      color: #0b2340;
      cursor: pointer;
      font-family: inherit;
      padding: 9px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-service:hover {
      border-color: #c79a34;
      box-shadow: 0 8px 18px rgba(8,36,70,0.08);
      transform: translateY(-1px);
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-service svg {
      width: 22px !important;
      height: 22px !important;
      max-width: 22px !important;
      max-height: 22px !important;
      color: #0b3d73;
      stroke-width: 1.9;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-service span {
      font-size: 0.78rem;
      font-weight: 800;
      text-align: center;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-quick-title {
      margin: 11px 2px 7px;
      color: #66758a;
      font-size: 0.73rem;
      font-weight: 700;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-quick {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-quick button {
      border: 1px solid #e1e7ef;
      border-radius: 999px;
      background: #f8fafc;
      color: #35465b;
      padding: 7px 10px;
      font-family: inherit;
      font-size: 0.73rem;
      text-align: right;
      cursor: pointer;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-quick button:hover {
      border-color: #d4a853;
      color: #0b2340;
      background: #fffaf0;
    }

    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-messages {
      padding: 12px 14px 8px;
      gap: 8px;
      background: #fff;
    }
    #bonds-ai-chat-root.bonds-ai-home:not(.conversation-started) .bonds-ai-chat-messages {
      min-height: 0;
      flex: 0 0 auto;
      padding: 0;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-message {
      max-width: 88%;
      border-radius: 12px;
      font-size: 0.83rem;
      line-height: 1.6;
      box-shadow: none;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-message.user {
      align-self: flex-start;
      background: #0b5bd3;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-message.assistant {
      align-self: flex-end;
      background: #f3f6fa;
      color: #172b46;
      border: 1px solid #e4eaf1;
      border-bottom-left-radius: 4px;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-message.error {
      color: #b42318;
      background: #fff1f0;
      border-color: #ffd1cc;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-typing { color: #66758a; }

    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-notifications {
      background: #f8fafc;
      border-bottom: 1px solid #e7edf4;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-notification-card,
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-action-card {
      background: #fff;
      color: #172b46;
      border-color: #dbe3ec;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-notification-card strong,
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-action-card strong { color: #0b3d73; }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-notification-card small,
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-action-card small { color: #66758a; }

    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-suggestions {
      padding: 4px 14px 8px;
      gap: 6px;
      background: #fff;
    }
    #bonds-ai-chat-root.bonds-ai-home:not(.conversation-started) .bonds-ai-suggestions { display: none; }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-suggestion {
      flex: 1 1 100%;
      border-radius: 999px;
      background: #f8fafc;
      border-color: #e1e7ef;
      color: #35465b;
      padding: 7px 10px;
      font-size: 0.73rem;
      text-align: right;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-suggestion:hover {
      background: #fffaf0;
      border-color: #d4a853;
      color: #0b2340;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-input {
      background: #fff;
      border-top: 1px solid #e3e9f0;
      padding: 10px 12px;
      gap: 8px;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-input input {
      background: #fff;
      color: #0b2340;
      border-color: #cfd8e3;
      border-radius: 10px;
      min-width: 0;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-input input::placeholder { color: #8491a3; }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-input button {
      width: 44px;
      flex: 0 0 44px;
      min-height: 40px;
      padding: 0;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: #082446;
      color: #fff;
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-input button:hover { background: #0b315f; }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-input .bonds-ai-send-label { display: none; }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-send-icon {
      display: block;
      width: 18px !important;
      height: 18px !important;
      max-width: 18px !important;
      max-height: 18px !important;
      transform: rotate(180deg);
    }
    #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-disclaimer {
      display: block;
      padding: 0 12px 9px;
      color: #7b8797;
      background: #fff;
      font-size: 0.64rem;
      line-height: 1.4;
      text-align: center;
    }

    @media (max-width: 640px) {
      #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-window {
        inset: 0;
        width: 100vw;
        height: 100dvh;
        max-width: none;
        max-height: none;
        border: 0;
        border-radius: 0;
      }
      #bonds-ai-chat-root.bonds-ai-home .bonds-ai-chat-toggle {
        left: 16px;
        bottom: 16px;
        min-width: 146px;
      }
      #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-grid { gap: 7px; }
      #bonds-ai-chat-root.bonds-ai-home .bonds-ai-home-service { min-height: 66px; }
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
      <button class="bonds-ai-chat-toggle" aria-label="فتح مساعد بوندز"><span class="bonds-ai-notification-badge" aria-label="إشعارات غير مقروءة"></span><span class="bonds-ai-chat-toggle-status" aria-hidden="true"></span><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><ellipse fill="#F4900C" cx="33.5" cy="14.5" rx="2.5" ry="3.5"/><ellipse fill="#F4900C" cx="2.5" cy="14.5" rx="2.5" ry="3.5"/><path fill="#FFAC33" d="M34 19c0 .553-.447 1-1 1h-3c-.553 0-1-.447-1-1v-9c0-.552.447-1 1-1h3c.553 0 1 .448 1 1v9zM7 19c0 .553-.448 1-1 1H3c-.552 0-1-.447-1-1v-9c0-.552.448-1 1-1h3c.552 0 1 .448 1 1v9z"/><path fill="#FFCC4D" d="M28 5c0 2.761-4.478 4-10 4C12.477 9 8 7.761 8 5s4.477-5 10-5c5.522 0 10 2.239 10 5z"/><path fill="#F4900C" d="M25 4.083C25 5.694 21.865 7 18 7c-3.866 0-7-1.306-7-2.917 0-1.611 3.134-2.917 7-2.917 3.865 0 7 1.306 7 2.917z"/><path fill="#269" d="M30 5.5C30 6.881 28.881 7 27.5 7h-19C7.119 7 6 6.881 6 5.5S7.119 3 8.5 3h19C28.881 3 30 4.119 30 5.5z"/><path fill="#55ACEE" d="M30 6H6c-1.104 0-2 .896-2 2v26h28V8c0-1.104-.896-2-2-2z"/><path fill="#3B88C3" d="M35 33v-1c0-1.104-.896-2-2-2H22.071l-3.364 3.364c-.391.391-1.023.391-1.414 0L13.929 30H3c-1.104 0-2 .896-2 2v1c0 1.104-.104 2 1 2h32c1.104 0 1-.896 1-2z"/><circle fill="#FFF" cx="24.5" cy="14.5" r="4.5"/><circle fill="#DD2E44" cx="24.5" cy="14.5" r="2.721"/><circle fill="#FFF" cx="11.5" cy="14.5" r="4.5"/><path fill="#F5F8FA" d="M29 25.5c0 1.381-1.119 2.5-2.5 2.5h-17C8.119 28 7 26.881 7 25.5S8.119 23 9.5 23h17c1.381 0 2.5 1.119 2.5 2.5z"/><path fill="#CCD6DD" d="M17 23h2v5h-2zm-5 0h2v5h-2zm10 0h2v5h-2zM7 25.5c0 1.21.859 2.218 2 2.45v-4.9c-1.141.232-2 1.24-2 2.45zm20-2.45v4.899c1.141-.232 2-1.24 2-2.45s-.859-2.217-2-2.449z"/><circle fill="#DD2E44" cx="11.5" cy="14.5" r="2.721"/></svg><span class="bonds-ai-chat-toggle-label">مساعد بوندز</span></button>
      <div class="bonds-ai-chat-window" role="dialog" aria-label="مساعد بوندز الذكي">
        <div class="bonds-ai-chat-header">
          <div>
            <strong>مساعد بوندز</strong>
            <br><small class="bonds-ai-default-status">محلل فرص استثمارية</small><span class="bonds-ai-home-status">متصل الآن</span>
          </div>
          <button class="bonds-ai-chat-close" aria-label="إغلاق">×</button>
        </div>
        <div class="bonds-ai-notifications" aria-live="polite"></div>
        <div class="bonds-ai-home-launchpad" aria-label="ابدأ مع مساعد بوندز">
          <div class="bonds-ai-home-intro">
            <div class="bonds-ai-home-intro-icon" aria-hidden="true">●</div>
            <div>
              <strong>مرحباً بك في مساعد بوندز</strong>
              <p>يمكنني مساعدتك في الخدمات والحاسبات والتمويل ودراسات الجدوى والفرص الاستثمارية.</p>
            </div>
          </div>
          <div class="bonds-ai-home-grid">
            <button type="button" class="bonds-ai-home-service" data-assistant-prompt="أريد استخدام الحاسبات المالية. ساعدني في اختيار الحاسبة المناسبة.">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 10h2M12 10h2M16 10h1M8 14h2M12 14h2M16 14h1M8 18h2M12 18h5"/></svg><span>الحاسبات المالية</span>
            </button>
            <button type="button" class="bonds-ai-home-service" data-assistant-prompt="أريد تقديم طلب تمويل. ما الخطوات والمتطلبات؟">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 5h16v14H4z"/><path d="M7 9h10M7 13h6M7 17h4"/></svg><span>طلب تمويل</span>
            </button>
            <button type="button" class="bonds-ai-home-service" data-assistant-prompt="ما الاستشارة أو الخدمة الأنسب لاحتياجي؟">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M5 3h10l4 4v14H5z"/><path d="M14 3v5h5M8 12h8M8 16h8"/></svg><span>الاستشارات والخدمات</span>
            </button>
            <button type="button" class="bonds-ai-home-service" data-assistant-prompt="أريد إعداد دراسة جدوى. ما المعلومات المطلوبة للبدء؟">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg><span>دراسات الجدوى</span>
            </button>
            <button type="button" class="bonds-ai-home-service" data-assistant-prompt="ساعدني في استكشاف القطاعات والفرص الاستثمارية المناسبة.">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M3 21h18M5 21V9l4-3v15M11 21V5l4-2v18M17 21v-9l3 2v7"/></svg><span>القطاعات والفرص</span>
            </button>
            <button type="button" class="bonds-ai-home-service" data-assistant-focus="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3 1.6-4.8A7 7 0 0 1 3 12V8a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg><span>الأسئلة العامة</span>
            </button>
          </div>
          <div class="bonds-ai-home-quick-title">أو اطرح سؤالاً مباشراً</div>
          <div class="bonds-ai-home-quick">
            <button type="button" data-assistant-prompt="كيف أحصل على تمويل مناسب؟">كيف أحصل على تمويل مناسب؟</button>
            <button type="button" data-assistant-prompt="ما متطلبات إعداد دراسة جدوى؟">ما متطلبات إعداد دراسة جدوى؟</button>
            <button type="button" data-assistant-prompt="ما القطاعات الاستثمارية التي يمكنني دراستها؟">ما القطاعات التي يمكنني دراستها؟</button>
          </div>
        </div>
        <div class="bonds-ai-chat-messages"></div>
        <div class="bonds-ai-actions"></div>
        <div class="bonds-ai-suggestions"></div>
        <div class="bonds-ai-chat-input">
          <input type="text" placeholder="اكتب سؤالك هنا..." autocomplete="off">
          <button aria-label="إرسال"><span class="bonds-ai-send-label">إرسال</span><svg class="bonds-ai-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg></button>
        </div>
        <small class="bonds-ai-home-disclaimer">مساعد بوندز قد يخطئ؛ راجع المعلومات المهمة قبل اتخاذ القرار.</small>
      </div>
    `;
  }

  function mount(options = {}) {
    if (document.getElementById('bonds-ai-chat-root')) return;

    injectStyles();
    const root = document.createElement('div');
    root.id = 'bonds-ai-chat-root';
    if (options.home === true) root.classList.add('bonds-ai-home');
    root.innerHTML = createWidgetHTML();
    document.body.appendChild(root);

    const toggle = root.querySelector('.bonds-ai-chat-toggle');
    const windowEl = root.querySelector('.bonds-ai-chat-window');
    const closeBtn = root.querySelector('.bonds-ai-chat-close');
    const notificationsEl = root.querySelector('.bonds-ai-notifications');
    const notificationBadge = root.querySelector('.bonds-ai-notification-badge');
    const messagesEl = root.querySelector('.bonds-ai-chat-messages');
    const actionsEl = root.querySelector('.bonds-ai-actions');
    const suggestionsEl = root.querySelector('.bonds-ai-suggestions');
    const input = root.querySelector('.bonds-ai-chat-input input');
    const sendBtn = root.querySelector('.bonds-ai-chat-input button');
    const homeLaunchpad = root.querySelector('.bonds-ai-home-launchpad');
    const homePromptButtons = root.querySelectorAll('[data-assistant-prompt]');
    const homeFocusButton = root.querySelector('[data-assistant-focus]');

    function readServiceAssistantContext() {
      try {
        const raw = window.sessionStorage?.getItem(SERVICE_ASSISTANT_CONTEXT_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== 1 || parsed.source !== 'service_discovery') return {};
        return {
          serviceCode: typeof parsed.serviceCode === 'string' ? parsed.serviceCode.slice(0, 100) : null,
          serviceName: typeof parsed.serviceName === 'string' ? parsed.serviceName.slice(0, 200) : null,
          countryCode: typeof parsed.countryCode === 'string' ? parsed.countryCode.slice(0, 20) : null,
          regionCode: typeof parsed.regionCode === 'string' ? parsed.regionCode.slice(0, 100) : null,
          regionName: typeof parsed.regionName === 'string' ? parsed.regionName.slice(0, 200) : null,
          localityCode: typeof parsed.localityCode === 'string' ? parsed.localityCode.slice(0, 100) : null,
          localityName: typeof parsed.localityName === 'string' ? parsed.localityName.slice(0, 200) : null,
          sectorCode: typeof parsed.sectorCode === 'string' ? parsed.sectorCode.slice(0, 100) : null,
          sectorName: typeof parsed.sectorName === 'string' ? parsed.sectorName.slice(0, 200) : null,
          activityCode: typeof parsed.activityCode === 'string' ? parsed.activityCode.slice(0, 100) : null,
          activityName: typeof parsed.activityName === 'string' ? parsed.activityName.slice(0, 200) : null,
          language: parsed.language === 'en' ? 'en' : 'ar'
        };
      } catch (_) {
        return {};
      }
    }

    const serviceContext = readServiceAssistantContext();
    let context = {
      ...serviceContext,
      cityCode: options.cityCode || serviceContext.localityCode || null,
      activityCode: options.activityCode || serviceContext.activityCode || null,
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
      const service = String(value.serviceCode || '').trim();
      const base = `city:${city}|activity:${activity}|model:${model}`;
      return service ? `${base}|service:${service}` : base;
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
      const bridge = readServiceAssistantContext();
      if (Object.keys(bridge).length) {
        updateContext({
          ...bridge,
          cityCode: context.cityCode || bridge.localityCode || null,
          activityCode: context.activityCode || bridge.activityCode || null
        });
      }
      context.cityName = getCityName() || context.localityName || context.cityName || null;
      context.activityName = getActivityName() || context.activityName || null;
    }

    function notificationText(notification, field) {
      const lang = languageCode();
      const preferred = lang === 'en' ? notification[field + '_en'] : notification[field + '_ar'];
      const fallback = lang === 'en' ? notification[field + '_ar'] : notification[field + '_en'];
      return String(preferred || fallback || '');
    }

    function updateNotificationBadge(count) {
      const safeCount = Math.max(0, Number(count) || 0);
      notificationBadge.textContent = safeCount > 99 ? '99+' : String(safeCount);
      notificationBadge.classList.toggle('visible', safeCount > 0);
    }

    async function markNotificationRead(notificationId) {
      const res = await fetch(ASSISTANT_NOTIFICATION_READ_URL, {
        method:'POST',
        headers:await getAuthHeaders(),
        body:JSON.stringify({ notification_id:notificationId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'NOTIFICATION_READ_FAILED');
      return data.notification;
    }

    function renderNotifications(notifications = []) {
      notificationsEl.innerHTML = '';
      const unread = (notifications || []).filter(item => item && !item.read);
      updateNotificationBadge(unread.length);
      notificationsEl.classList.toggle('visible', unread.length > 0);

      unread.forEach(notification => {
        const card = document.createElement('div');
        card.className = 'bonds-ai-notification-card';
        card.dataset.notificationId = String(notification.id || '');

        const title = document.createElement('strong');
        title.textContent = notificationText(notification, 'title');

        const message = document.createElement('small');
        message.textContent = notificationText(notification, 'message');

        const readButton = document.createElement('button');
        readButton.type = 'button';
        readButton.textContent = languageCode() === 'en' ? 'Mark read' : 'تمت القراءة';
        readButton.addEventListener('click', async () => {
          readButton.disabled = true;
          try {
            await markNotificationRead(notification.id);
            await refreshNotifications();
          } catch (err) {
            console.error('[BondsAssistantNotifications]', err);
            readButton.disabled = false;
          }
        });

        card.appendChild(title);
        card.appendChild(message);

        if (notification.action && notification.action.type) {
          const actionButton = document.createElement('button');
          actionButton.type = 'button';
          actionButton.textContent = languageCode() === 'en' ? 'Open' : 'فتح';
          actionButton.addEventListener('click', () => executeStructuredAction({
            id:'notification-' + String(notification.id || ''),
            type:String(notification.action.type || ''),
            capability:String(notification.action.type || ''),
            target:notification.action.target == null ? null : String(notification.action.target),
            risk:'low',
            requires_confirmation:false,
            status:'ready'
          }, actionButton));
          card.appendChild(actionButton);
        }

        card.appendChild(readButton);
        notificationsEl.appendChild(card);
      });
    }

    async function refreshNotifications() {
      try {
        const res = await fetch(ASSISTANT_NOTIFICATIONS_URL + '?unread=1&limit=25', {
          method:'GET',
          headers:await getAuthHeaders()
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'NOTIFICATION_LIST_FAILED');
        renderNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        return data.notifications || [];
      } catch (err) {
        console.error('[BondsAssistantNotifications]', err);
        return [];
      }
    }

    function toggleOpen() {
      state.isOpen = !state.isOpen;
      windowEl.classList.toggle('open', state.isOpen);
      if (state.isOpen && state.messages.length === 0) {
        refreshContext();
        if (options.home === true) {
          root.classList.remove('conversation-started');
        } else if (context.mode === 'project' && context.projectId) {
          addAssistantMessage('مرحباً! أنا مستشار بوندز التنفيذي. أسألني عن مشروعك: أين وصلنا؟ ما الذي ينقص؟ ما الخطوة التالية؟');
          renderSuggestions();
        } else {
          const city = context.cityName || context.cityCode || 'مدينة محددة';
          const activity = context.activityName || context.activityCode || 'نشاط محدد';
          addAssistantMessage(`مرحباً! أنا مساعد بوندز. يمكنك سؤالي عن فرصة "${activity}" في ${city}، أو عن أي مدينة/نشاط آخر.`);
          renderSuggestions();
        }
      }
      if (state.isOpen) {
        refreshNotifications();
        input.focus();
      }
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
        language: languageCode(),
        boundary: contextBoundaryKey()
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
          idempotency_key:idempotencyKey,
          boundary: contextBoundaryKey()
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
          result,
          boundary: contextBoundaryKey()
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
      if (options.home === true) {
        root.classList.add('conversation-started');
      }
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

    homePromptButtons.forEach(button => {
      button.addEventListener('click', () => {
        const prompt = String(button.dataset.assistantPrompt || '').trim();
        if (prompt) sendMessage(prompt);
      });
    });
    if (homeFocusButton) {
      homeFocusButton.addEventListener('click', () => {
        input.focus();
      });
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
    window.BondsAssistant.refreshNotifications = refreshNotifications;
    window.BondsAssistant.markNotificationRead = markNotificationRead;
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
