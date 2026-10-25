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
  const SERVICE_DETAIL_API = '/api/v3/services/';
  const SERVICE_CATALOG_API = '/api/v3/services/catalog';
  const ECC_ADVISOR_URL = '/api/v3/ecc/advisor';
  const ASSISTANT_PLAN_URL = '/api/v3/assistant/plan';
  const ASSISTANT_CONFIRMATION_PREPARE_URL = '/api/v3/assistant/confirmation/prepare';
  const ASSISTANT_CONFIRMATION_RESOLVE_URL = '/api/v3/assistant/confirmation/resolve';
  const ASSISTANT_IDEMPOTENCY_CLAIM_URL = '/api/v3/assistant/idempotency/claim';
  const ASSISTANT_IDEMPOTENCY_RESOLVE_URL = '/api/v3/assistant/idempotency/resolve';
  const ASSISTANT_NOTIFICATIONS_URL = '/api/v3/assistant/notifications';
  const ASSISTANT_NOTIFICATION_READ_URL = '/api/v3/assistant/notifications/read';
  const ASSISTANT_WORKFLOW_RESUME_URL = '/api/v3/assistant/workflows/resume';
  const ASSISTANT_WORKFLOW_SAVE_URL = '/api/v3/assistant/workflows/save';
  const CAPABILITY_EXECUTE_URL = '/api/v3/capabilities/execute';
  const READINESS_URL = '/api/readiness';
  const HEALTH_REFRESH_MS = 45000;
  const CLIENT_DOCUMENTS_BUCKET = 'client-documents';
  const CLIENT_DOCUMENTS_QUARANTINE_BUCKET = 'client-documents-quarantine';
  const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
  const MAX_ATTACHMENT_BATCH_FILES = 10;
  const MAX_ATTACHMENT_BATCH_BYTES = 25 * 1024 * 1024;
  const ASSISTANT_STATE_VERSION = 1;
  const ASSISTANT_STATE_PREFIX = 'bonds.assistant.state.v1:';
  const ASSISTANT_CONTEXT_PREFERENCE_KEY = 'bonds.assistant.context.enabled.v1';
  const SERVICE_ASSISTANT_CONTEXT_KEY = 'bonds_service_assistant_context_v1';
  const ASSISTANT_LAYOUT_KEY = 'bonds.assistant.layout.v1';
  const ASSISTANT_LAYOUT_VERSION = 1;
  const ASSISTANT_LAYOUT_MARGIN = 8;
  const ASSISTANT_LAYOUT_SNAP = 24;
  const ASSISTANT_LAYOUT_MIN_WIDTH = 360;
  const ASSISTANT_LAYOUT_MIN_HEIGHT = 360;
  const ASSISTANT_DIAGNOSTICS_HISTORY_KEY = 'bonds.assistant.diagnostics.v1';

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
      cursor: move;
      user-select: none;
      touch-action: none;
    }
    .bonds-ai-chat-header-controls,
    .bonds-ai-chat-header-controls * {
      cursor: default;
      touch-action: auto;
    }
    .bonds-ai-layout-reset {
      background: transparent;
      border: 1px solid rgba(255,255,255,0.18);
      color: inherit;
      border-radius: 7px;
      width: 30px;
      height: 30px;
      padding: 0;
      cursor: pointer !important;
      font: inherit;
    }
    .bonds-ai-resize-handle {
      position: absolute;
      z-index: 4;
      display: none;
      touch-action: none;
    }
    .bonds-ai-chat-window.open.view-standard .bonds-ai-resize-handle { display: block; }
    .bonds-ai-resize-left,
    .bonds-ai-resize-right {
      top: 12px;
      bottom: 12px;
      width: 10px;
      cursor: ew-resize;
    }
    .bonds-ai-resize-left { left: -5px; }
    .bonds-ai-resize-right { right: -5px; }
    .bonds-ai-resize-bottom {
      left: 12px;
      right: 12px;
      bottom: -5px;
      height: 10px;
      cursor: ns-resize;
    }
    .bonds-ai-resize-corner {
      right: -5px;
      bottom: -5px;
      width: 18px;
      height: 18px;
      cursor: nwse-resize;
    }
    .bonds-ai-chat-window.layout-dragging,
    .bonds-ai-chat-window.layout-resizing {
      transition: none !important;
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
    .bonds-ai-message-meta {
      display: block;
      margin-top: 0.35rem;
      font-size: 0.68rem;
      line-height: 1.25;
      opacity: 0.72;
      direction: auto;
      unicode-bidi: plaintext;
    }
    .bonds-ai-message-meta[data-status="failed"] { color: #ef4444; opacity: 1; }
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
    .bonds-ai-chat-input .bonds-ai-attach-button,
    .bonds-ai-chat-input .bonds-ai-voice-button,
    .bonds-ai-chat-input .bonds-ai-send-button {
      width: 44px;
      flex: 0 0 44px;
      min-height: 40px;
      padding: 0;
      display: grid;
      place-items: center;
    }
    .bonds-ai-chat-input .bonds-ai-attach-button,
    .bonds-ai-chat-input .bonds-ai-voice-button {
      background: #eef3f8;
      color: #0b3d73;
      border: 1px solid #cfd8e3;
    }
    .bonds-ai-chat-input .bonds-ai-attach-button:hover,
    .bonds-ai-chat-input .bonds-ai-voice-button:hover { background: #e2eaf3; }
    .bonds-ai-chat-input .bonds-ai-attach-button.uploading { opacity: 0.65; cursor: progress; }
    .bonds-ai-attachments {
      display: none;
      gap: 0.45rem;
      padding: 0.55rem 0.75rem;
      overflow-x: auto;
      background: #0d1321;
      border-top: 1px solid rgba(197,160,40,0.12);
    }
    .bonds-ai-attachments.visible { display: flex; }
    .bonds-ai-attachment {
      flex: 0 0 auto;
      max-width: 220px;
      border: 1px solid rgba(197,160,40,0.2);
      border-radius: 10px;
      padding: 0.5rem 0.65rem;
      background: rgba(255,255,255,0.04);
      color: #e8ecf4;
      font-size: 0.75rem;
    }
    .bonds-ai-attachment strong {
      display: block;
      max-width: 190px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .bonds-ai-attachment small { display: block; margin-top: 0.2rem; color: #94a3b8; }
    .bonds-ai-attachment.error { border-color: rgba(239,68,68,0.5); }
    .bonds-ai-chat-window.drag-active { outline: 2px dashed #d4a853; outline-offset: -8px; }
    .bonds-ai-chat-input .bonds-ai-voice-button.listening {
      background: #fff1f0;
      color: #b42318;
      border-color: #f0aaa4;
    }
    .bonds-ai-chat-input .bonds-ai-voice-button[hidden] { display: none !important; }
    .bonds-ai-voice-status {
      display: none;
      padding: 0 12px 7px;
      background: #fff;
      color: #66758a;
      font-size: 0.72rem;
      text-align: start;
    }
    .bonds-ai-voice-status.visible { display: block; }
    .bonds-ai-message.assistant {
      position: relative;
      padding-bottom: 2rem;
    }
    .bonds-ai-speak-button {
      position: absolute;
      inset-inline-end: 7px;
      bottom: 5px;
      width: 26px;
      height: 26px;
      padding: 0;
      display: grid;
      place-items: center;
      border: 1px solid #dbe3ec;
      border-radius: 7px;
      background: #fff;
      color: #4a5d75;
      cursor: pointer;
      font: inherit;
      line-height: 1;
    }
    .bonds-ai-speak-button:hover { color: #0b3d73; border-color: #9eb1c7; }
    .bonds-ai-speak-button.speaking {
      color: #b42318;
      border-color: #f0aaa4;
      background: #fff1f0;
    }
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

    #bonds-ai-chat-root .bonds-ai-chat-toggle {
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
    #bonds-ai-chat-root .bonds-ai-chat-toggle:hover {
      transform: translateY(-1px);
      background: #0b315f;
    }
    #bonds-ai-chat-root .bonds-ai-chat-toggle > svg {
      width: 34px !important;
      height: 34px !important;
      max-width: 34px !important;
      max-height: 34px !important;
      flex: 0 0 34px !important;
      border-radius: 50%;
      background: #fff;
      padding: 4px;
    }
    #bonds-ai-chat-root .bonds-ai-chat-toggle-label {
      display: inline;
      font-size: 0.9rem;
      font-weight: 800;
      white-space: nowrap;
    }
    #bonds-ai-chat-root .bonds-ai-chat-toggle-status {
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

    #bonds-ai-chat-root .bonds-ai-chat-window {
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
    #bonds-ai-chat-root .bonds-ai-chat-header {
      background: #082446;
      border-bottom: none;
      padding: 14px 16px;
      min-height: 66px;
      color: #fff;
    }
    #bonds-ai-chat-root .bonds-ai-chat-header strong {
      color: #fff;
      font-size: 1rem;
    }
    #bonds-ai-chat-root .bonds-ai-chat-header small {
      color: #d8e3ef;
    }
    #bonds-ai-chat-root .bonds-ai-home-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      color: #d8e3ef;
      font-size: 0.75rem;
    }
    #bonds-ai-chat-root .bonds-ai-home-status::before {
      content: '';
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #94a3b8;
      box-shadow: 0 0 0 2px rgba(148,163,184,0.16);
    }
    #bonds-ai-chat-root .bonds-ai-home-status[data-status="connected"]::before { background:#22c55e; box-shadow:0 0 0 2px rgba(34,197,94,0.16); }
    #bonds-ai-chat-root .bonds-ai-home-status[data-status="degraded"]::before,
    #bonds-ai-chat-root .bonds-ai-home-status[data-status="checking"]::before { background:#f59e0b; box-shadow:0 0 0 2px rgba(245,158,11,0.16); }
    #bonds-ai-chat-root .bonds-ai-home-status[data-status="disconnected"]::before { background:#ef4444; box-shadow:0 0 0 2px rgba(239,68,68,0.16); }
    #bonds-ai-chat-root .bonds-ai-service-statuses {
      display:flex;
      flex-wrap:wrap;
      gap:5px;
      padding:7px 12px;
      background:#f8fafc;
      border-bottom:1px solid #e7edf4;
      font-size:0.7rem;
      line-height:1.2;
    }
    #bonds-ai-chat-root .bonds-ai-service-status {
      display:inline-flex;
      align-items:center;
      gap:4px;
      border:1px solid #dbe3ec;
      border-radius:999px;
      padding:4px 7px;
      color:#475569;
      background:#fff;
      white-space:nowrap;
    }
    #bonds-ai-chat-root .bonds-ai-service-status::before {
      content:'';
      width:7px;
      height:7px;
      border-radius:50%;
      background:#94a3b8;
    }
    #bonds-ai-chat-root .bonds-ai-service-status[data-status="connected"]::before { background:#22c55e; }
    #bonds-ai-chat-root .bonds-ai-service-status[data-status="degraded"]::before,
    #bonds-ai-chat-root .bonds-ai-service-status[data-status="checking"]::before { background:#f59e0b; }
    #bonds-ai-chat-root .bonds-ai-service-status[data-status="disconnected"]::before { background:#ef4444; }
    #bonds-ai-chat-root .bonds-ai-service-status[data-status="unconfigured"]::before { background:#94a3b8; }
    #bonds-ai-chat-root .bonds-ai-health-updated {
      margin-inline-start:auto;
      align-self:center;
      color:#64748b;
      white-space:nowrap;
    }
    #bonds-ai-chat-root .bonds-ai-request-diagnostics {
      display:none;
      border-bottom:1px solid #e7edf4;
      background:#fff;
      padding:8px 12px 10px;
      font-size:0.7rem;
      color:#334155;
      min-height:0;
    }
    #bonds-ai-chat-root .bonds-ai-request-diagnostics.visible { display:block; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-details {
      max-height:240px;
      overflow-y:auto;
      overflow-x:hidden;
      overscroll-behavior:contain;
    }
    #bonds-ai-chat-root .bonds-ai-request-diagnostics:not(.expanded) .bonds-ai-diagnostics-details {
      display:none;
    }
    #bonds-ai-chat-root .bonds-ai-diagnostics-head {
      display:flex;
      align-items:center;
      gap:8px;
      margin-bottom:6px;
    }
    #bonds-ai-chat-root .bonds-ai-diagnostics-head strong { color:#0b2340; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-summary { margin-inline-start:auto; font-weight:800; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-summary[data-status="PASS"] { color:#15803d; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-summary[data-status="DEGRADED"] { color:#b45309; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-summary[data-status="FAIL"] { color:#b42318; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-copy,
    #bonds-ai-chat-root .bonds-ai-diagnostics-toggle {
      border:1px solid #dbe3ec;
      background:#f8fafc;
      color:#334155;
      border-radius:7px;
      padding:3px 7px;
      cursor:pointer;
      font:inherit;
    }
    #bonds-ai-chat-root .bonds-ai-diagnostics-toggle {
      min-width:62px;
    }
    #bonds-ai-chat-root .bonds-ai-diagnostics-meta {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:3px 10px;
      margin-bottom:7px;
    }
    #bonds-ai-chat-root .bonds-ai-diagnostics-pipeline {
      display:grid;
      grid-template-columns:repeat(2,minmax(0,1fr));
      gap:4px 8px;
    }
    #bonds-ai-chat-root .bonds-ai-diagnostics-stage {
      display:flex;
      justify-content:space-between;
      gap:6px;
      border:1px solid #eef2f7;
      border-radius:6px;
      padding:4px 6px;
      background:#f8fafc;
    }
    #bonds-ai-chat-root .bonds-ai-diagnostics-stage b[data-status="PASS"] { color:#15803d; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-stage b[data-status="DEGRADED"] { color:#b45309; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-stage b[data-status="FAIL"] { color:#b42318; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-stage b[data-status="SKIPPED"],
    #bonds-ai-chat-root .bonds-ai-diagnostics-stage b[data-status="NOT_REQUIRED"],
    #bonds-ai-chat-root .bonds-ai-diagnostics-stage b[data-status="NOT_AVAILABLE"] { color:#64748b; }
    #bonds-ai-chat-root .bonds-ai-diagnostics-history {
      margin-top:7px;
      padding-top:6px;
      border-top:1px solid #eef2f7;
      color:#64748b;
    }
    #bonds-ai-chat-root .bonds-ai-chat-close {
      color: #fff;
      font-size: 1.45rem;
      line-height: 1;
    }
    #bonds-ai-chat-root .bonds-ai-chat-close:hover { color: #d4a853; }

    #bonds-ai-chat-root .bonds-ai-home-launchpad {
      display: block;
      padding: 14px 14px 6px;
      background: #fff;
      overflow-y: auto;
    }
    #bonds-ai-chat-root.conversation-started .bonds-ai-home-launchpad {
      display: none;
    }
    #bonds-ai-chat-root .bonds-ai-home-intro {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      margin-bottom: 12px;
      border: 1px solid #e7edf4;
      border-radius: 12px;
      background: #f7f9fc;
    }
    #bonds-ai-chat-root .bonds-ai-home-intro-icon {
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
    #bonds-ai-chat-root .bonds-ai-home-intro strong {
      display: block;
      color: #0b2340;
      margin-bottom: 3px;
      font-size: 0.9rem;
    }
    #bonds-ai-chat-root .bonds-ai-home-intro p {
      margin: 0;
      color: #66758a;
      font-size: 0.78rem;
      line-height: 1.55;
    }
    #bonds-ai-chat-root .bonds-ai-home-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0,1fr));
      gap: 8px;
    }
    #bonds-ai-chat-root .bonds-ai-home-service {
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
    #bonds-ai-chat-root .bonds-ai-home-service:hover {
      border-color: #c79a34;
      box-shadow: 0 8px 18px rgba(8,36,70,0.08);
      transform: translateY(-1px);
    }
    #bonds-ai-chat-root .bonds-ai-home-service svg {
      width: 22px !important;
      height: 22px !important;
      max-width: 22px !important;
      max-height: 22px !important;
      color: #0b3d73;
      stroke-width: 1.9;
    }
    #bonds-ai-chat-root .bonds-ai-home-service span {
      font-size: 0.78rem;
      font-weight: 800;
      text-align: center;
    }
    #bonds-ai-chat-root .bonds-ai-home-quick-title {
      margin: 11px 2px 7px;
      color: #66758a;
      font-size: 0.73rem;
      font-weight: 700;
    }
    #bonds-ai-chat-root .bonds-ai-home-quick {
      display: grid;
      grid-template-columns: 1fr;
      gap: 6px;
    }
    #bonds-ai-chat-root .bonds-ai-home-quick button {
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
    #bonds-ai-chat-root .bonds-ai-home-quick button:hover {
      border-color: #d4a853;
      color: #0b2340;
      background: #fffaf0;
    }

    #bonds-ai-chat-root .bonds-ai-chat-messages {
      padding: 12px 14px 8px;
      gap: 8px;
      background: #fff;
    }
    #bonds-ai-chat-root:not(.conversation-started) .bonds-ai-chat-messages {
      min-height: 0;
      flex: 0 0 auto;
      padding: 0;
    }
    #bonds-ai-chat-root .bonds-ai-message {
      max-width: 88%;
      border-radius: 12px;
      font-size: 0.83rem;
      line-height: 1.6;
      box-shadow: none;
    }
    #bonds-ai-chat-root .bonds-ai-message.user {
      align-self: flex-start;
      background: #0b5bd3;
      color: #fff;
      border-bottom-right-radius: 4px;
    }
    #bonds-ai-chat-root .bonds-ai-message.assistant {
      align-self: flex-end;
      background: #f3f6fa;
      color: #172b46;
      border: 1px solid #e4eaf1;
      border-bottom-left-radius: 4px;
    }
    #bonds-ai-chat-root .bonds-ai-message.error {
      color: #b42318;
      background: #fff1f0;
      border-color: #ffd1cc;
    }
    #bonds-ai-chat-root .bonds-ai-typing { color: #66758a; }

    #bonds-ai-chat-root .bonds-ai-notifications {
      background: #f8fafc;
      border-bottom: 1px solid #e7edf4;
    }
    #bonds-ai-chat-root .bonds-ai-notification-card,
    #bonds-ai-chat-root .bonds-ai-action-card {
      background: #fff;
      color: #172b46;
      border-color: #dbe3ec;
    }
    #bonds-ai-chat-root .bonds-ai-notification-card strong,
    #bonds-ai-chat-root .bonds-ai-action-card strong { color: #0b3d73; }
    #bonds-ai-chat-root .bonds-ai-notification-card small,
    #bonds-ai-chat-root .bonds-ai-action-card small { color: #66758a; }

    #bonds-ai-chat-root .bonds-ai-suggestions {
      padding: 4px 14px 8px;
      gap: 6px;
      background: #fff;
    }
    #bonds-ai-chat-root:not(.conversation-started) .bonds-ai-suggestions { display: none; }
    #bonds-ai-chat-root .bonds-ai-suggestion {
      flex: 1 1 100%;
      border-radius: 999px;
      background: #f8fafc;
      border-color: #e1e7ef;
      color: #35465b;
      padding: 7px 10px;
      font-size: 0.73rem;
      text-align: right;
    }
    #bonds-ai-chat-root .bonds-ai-suggestion:hover {
      background: #fffaf0;
      border-color: #d4a853;
      color: #0b2340;
    }
    #bonds-ai-chat-root .bonds-ai-chat-input {
      background: #fff;
      border-top: 1px solid #e3e9f0;
      padding: 10px 12px;
      gap: 8px;
    }
    #bonds-ai-chat-root .bonds-ai-chat-input input {
      background: #fff;
      color: #0b2340;
      border-color: #cfd8e3;
      border-radius: 10px;
      min-width: 0;
    }
    #bonds-ai-chat-root .bonds-ai-chat-input input::placeholder { color: #8491a3; }
    #bonds-ai-chat-root .bonds-ai-chat-input button {
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
    #bonds-ai-chat-root .bonds-ai-chat-input button:hover { background: #0b315f; }
    #bonds-ai-chat-root .bonds-ai-chat-input .bonds-ai-send-label { display: none; }
    #bonds-ai-chat-root .bonds-ai-send-icon {
      display: block;
      width: 18px !important;
      height: 18px !important;
      max-width: 18px !important;
      max-height: 18px !important;
      transform: rotate(180deg);
    }
    .bonds-ai-login-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-top: 10px;
      padding: 7px 12px;
      border-radius: 8px;
      background: #082446;
      color: #fff;
      text-decoration: none;
      font-weight: 800;
      font-size: 0.78rem;
    }
    .bonds-ai-login-link:hover { background: #0b315f; color: #fff; }

    .bonds-ai-human-link {
      display: block;
      width: calc(100% - 32px);
      margin: 8px 16px 0;
      padding: 0;
      border: 0;
      background: transparent;
      text-align: center;
      font: inherit;
      font-size: 0.78rem;
      text-decoration: none;
      color: inherit;
      opacity: 0.78;
      cursor: pointer;
    }
    .bonds-ai-human-link:hover { opacity: 1; text-decoration: underline; }
    .bonds-ai-message .bonds-ai-markdown-line { display: block; margin: 0 0 0.35rem; }
    .bonds-ai-message .bonds-ai-markdown-line:last-child { margin-bottom: 0; }
    .bonds-ai-message code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      padding: 0.08rem 0.28rem;
      border-radius: 4px;
      background: rgba(148,163,184,0.12);
      direction: ltr;
      unicode-bidi: isolate;
    }

    #bonds-ai-chat-root .bonds-ai-home-disclaimer {
      display: block;
      padding: 0 12px 9px;
      color: #7b8797;
      background: #fff;
      font-size: 0.64rem;
      line-height: 1.4;
      text-align: center;
    }

    #bonds-ai-chat-root.assistant-open .bonds-ai-chat-toggle { display: none; }

    #bonds-ai-chat-root .bonds-ai-chat-header-controls {
      display: flex;
      align-items: center;
      gap: 4px;
      direction: ltr;
    }
    #bonds-ai-chat-root .bonds-ai-view-button,
    #bonds-ai-chat-root .bonds-ai-chat-close {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.16);
      background: rgba(255,255,255,0.06);
      color: #fff;
      cursor: pointer;
      font: inherit;
      line-height: 1;
    }
    #bonds-ai-chat-root .bonds-ai-view-button:hover,
    #bonds-ai-chat-root .bonds-ai-chat-close:hover {
      background: rgba(255,255,255,0.12);
      color: #f0c96a;
    }
    #bonds-ai-chat-root .bonds-ai-view-button[aria-pressed="true"] {
      background: rgba(212,168,83,0.22);
      border-color: rgba(212,168,83,0.5);
      color: #f0c96a;
    }

    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen {
      display: none;
      grid-template-columns: minmax(0, 1.1fr) minmax(460px, 0.9fr);
      grid-template-rows: auto auto auto auto minmax(0, 1fr) auto auto auto auto;
      align-items: stretch;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.open.view-workspace,
    #bonds-ai-chat-root .bonds-ai-chat-window.open.view-fullscreen {
      display: grid;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace {
      left: 4vw;
      bottom: 5vh;
      width: 92vw;
      height: 90vh;
      max-width: 1440px;
      max-height: 920px;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen {
      inset: 0;
      width: 100vw;
      height: 100dvh;
      max-width: none;
      max-height: none;
      border: 0;
      border-radius: 0;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-chat-header,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-chat-header,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-service-statuses,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-service-statuses,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-notifications,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-notifications,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-home-launchpad,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-home-launchpad {
      grid-column: 1 / -1;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-chat-header,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-chat-header { grid-row: 1; }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-service-statuses,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-service-statuses { grid-row: 2; }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-notifications,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-notifications { grid-row: 3; }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-home-launchpad,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-home-launchpad { grid-row: 4 / 10; overflow-y: auto; }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-request-diagnostics,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-request-diagnostics {
      grid-column:2;
      grid-row:4;
      align-self:start;
      max-height:280px;
      overflow:hidden;
      border-inline-start:1px solid #e3e9f0;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-chat-messages,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-chat-messages {
      grid-column: 2;
      grid-row: 5;
      min-width: 0;
      min-height: 220px;
      overflow-y:auto;
      overscroll-behavior:contain;
      border-inline-start: 1px solid #e3e9f0;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-actions,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-actions {
      grid-column: 1;
      grid-row: 4 / 10;
      min-width: 0;
      min-height: 0;
      overflow-y: auto;
      padding: 16px;
      background: #f7f9fc;
      border-inline-end: 1px solid #e3e9f0;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-actions:empty::before,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-actions:empty::before {
      content: 'مساحة العمل جاهزة لعرض النتائج والجداول والإجراءات.';
      display: block;
      padding: 18px;
      border: 1px dashed #cfd8e3;
      border-radius: 12px;
      color: #66758a;
      background: #fff;
      text-align: center;
      font-size: 0.82rem;
      line-height: 1.6;
    }
    html[lang="en"] #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-actions:empty::before,
    html[lang="en"] #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-actions:empty::before {
      content: 'Workspace is ready for results, tables and governed actions.';
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-suggestions,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-suggestions {
      grid-column: 2;
      grid-row: 6;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-chat-input,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-chat-input {
      grid-column: 2;
      grid-row: 7;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-human-link,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-human-link {
      grid-column: 2;
      grid-row: 8;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-workspace .bonds-ai-home-disclaimer,
    #bonds-ai-chat-root .bonds-ai-chat-window.view-fullscreen .bonds-ai-home-disclaimer {
      grid-column: 2;
      grid-row: 9;
    }

    #bonds-ai-chat-root .bonds-ai-chat-window.view-collapsed {
      left: 24px;
      bottom: 24px;
      width: min(420px, calc(100vw - 48px));
      height: 66px;
      max-width: none;
      max-height: 66px;
      border-radius: 14px;
    }
    #bonds-ai-chat-root .bonds-ai-chat-window.view-collapsed > :not(.bonds-ai-chat-header) {
      display: none !important;
    }

    @media (max-width: 640px) {
      #bonds-ai-chat-root .bonds-ai-chat-window {
        inset: 0;
        width: 100vw;
        height: 100dvh;
        max-width: none;
        max-height: none;
        border: 0;
        border-radius: 0;
      }
      #bonds-ai-chat-root .bonds-ai-chat-toggle {
        left: 16px;
        bottom: 16px;
        min-width: 146px;
      }
      #bonds-ai-chat-root .bonds-ai-view-button[data-assistant-view="workspace"],
      #bonds-ai-chat-root .bonds-ai-view-button[data-assistant-view="fullscreen"],
      #bonds-ai-chat-root .bonds-ai-view-button[data-assistant-view="collapsed"] { display: none; }
      #bonds-ai-chat-root .bonds-ai-home-grid { gap: 7px; }
      #bonds-ai-chat-root .bonds-ai-home-service { min-height: 66px; }
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
            <br><small class="bonds-ai-default-status">محلل فرص استثمارية</small><span class="bonds-ai-home-status" data-status="checking">جاري التحقق</span>
          </div>
          <div class="bonds-ai-chat-header-controls" aria-label="أوضاع عرض مساعد بوندز">
            <button type="button" class="bonds-ai-view-button" data-assistant-view="standard" aria-label="الحجم العادي" title="الحجم العادي">▣</button>
            <button type="button" class="bonds-ai-view-button" data-assistant-view="workspace" aria-label="مساحة العمل" title="مساحة العمل">◫</button>
            <button type="button" class="bonds-ai-view-button" data-assistant-view="fullscreen" aria-label="ملء الشاشة" title="ملء الشاشة">⛶</button>
            <button type="button" class="bonds-ai-view-button" data-assistant-view="collapsed" aria-label="طي مساحة العمل" title="طي">—</button>
            <button type="button" class="bonds-ai-layout-reset" aria-label="إعادة ضبط موضع وحجم النافذة" title="إعادة ضبط النافذة">↺</button>
            <button class="bonds-ai-chat-close" aria-label="إغلاق" title="إغلاق">×</button>
          </div>
        </div>
        <div class="bonds-ai-resize-handle bonds-ai-resize-left" data-resize-edge="left" aria-hidden="true"></div>
        <div class="bonds-ai-resize-handle bonds-ai-resize-right" data-resize-edge="right" aria-hidden="true"></div>
        <div class="bonds-ai-resize-handle bonds-ai-resize-bottom" data-resize-edge="bottom" aria-hidden="true"></div>
        <div class="bonds-ai-resize-handle bonds-ai-resize-corner" data-resize-edge="right-bottom" aria-hidden="true"></div>
        <div class="bonds-ai-service-statuses" aria-label="حالة خدمات مساعد بوندز">
          <span class="bonds-ai-service-status" data-health-service="ai" data-status="checking">AI</span>
          <span class="bonds-ai-service-status" data-health-service="api" data-status="checking">API</span>
          <span class="bonds-ai-service-status" data-health-service="token" data-status="checking">Token</span>
          <span class="bonds-ai-service-status" data-health-service="search" data-status="checking">Search</span>
          <span class="bonds-ai-service-status" data-health-service="governance" data-status="checking">Governance</span>
          <span class="bonds-ai-health-updated" aria-live="polite">—</span>
        </div>
        <div class="bonds-ai-request-diagnostics" aria-live="polite">
          <div class="bonds-ai-diagnostics-head">
            <strong>Last Request Pipeline</strong>
            <span class="bonds-ai-diagnostics-summary">—</span>
            <button type="button" class="bonds-ai-diagnostics-toggle" aria-expanded="false">Details</button>
            <button type="button" class="bonds-ai-diagnostics-copy">Copy</button>
          </div>
          <div class="bonds-ai-diagnostics-details">
            <div class="bonds-ai-diagnostics-meta"></div>
            <div class="bonds-ai-diagnostics-pipeline"></div>
            <div class="bonds-ai-diagnostics-history"></div>
          </div>
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
        <div class="bonds-ai-attachments" aria-live="polite"></div>
        <div class="bonds-ai-chat-input">
          <input class="bonds-ai-file-input" type="file" multiple hidden accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.heic,.heif,.tif,.tiff,image/*">
          <button type="button" class="bonds-ai-attach-button" aria-label="إرفاق ملف أو صورة" title="إرفاق ملف أو صورة">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.7 9.6a2 2 0 0 1-2.8-2.8l8.9-8.9"/></svg>
          </button>
          <input class="bonds-ai-text-input" type="text" placeholder="اكتب سؤالك هنا..." autocomplete="off">
          <button type="button" class="bonds-ai-voice-button" aria-label="التحدث إلى مساعد بوندز" title="التحدث" hidden>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>
          </button>
          <button type="button" class="bonds-ai-send-button" aria-label="إرسال"><span class="bonds-ai-send-label">إرسال</span><svg class="bonds-ai-send-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 2 11 13"/><path d="m22 2-7 20-4-9-9-4Z"/></svg></button>
        </div>
        <div class="bonds-ai-voice-status" role="status" aria-live="polite"></div>
        <button type="button" class="bonds-ai-human-link" data-assistant-human-escalation="true">طلب مراجعة بشرية</button>
        <small class="bonds-ai-home-disclaimer">مساعد بوندز قد يخطئ؛ راجع المعلومات المهمة قبل اتخاذ القرار.</small>
      </div>
    `;
  }

  function mount(options = {}) {
    if (document.getElementById('bonds-ai-chat-root')) return;

    injectStyles();
    const root = document.createElement('div');
    root.id = 'bonds-ai-chat-root';
    root.classList.add('bonds-ai-unified');
    root.innerHTML = createWidgetHTML();
    document.body.appendChild(root);

    const toggle = root.querySelector('.bonds-ai-chat-toggle');
    const windowEl = root.querySelector('.bonds-ai-chat-window');
    const closeBtn = root.querySelector('.bonds-ai-chat-close');
    const chatHeader = root.querySelector('.bonds-ai-chat-header');
    const layoutResetBtn = root.querySelector('.bonds-ai-layout-reset');
    const resizeHandles = Array.from(root.querySelectorAll('[data-resize-edge]'));
    const viewButtons = Array.from(root.querySelectorAll('[data-assistant-view]'));
    const notificationsEl = root.querySelector('.bonds-ai-notifications');
    const notificationBadge = root.querySelector('.bonds-ai-notification-badge');
    const messagesEl = root.querySelector('.bonds-ai-chat-messages');
    const actionsEl = root.querySelector('.bonds-ai-actions');
    const suggestionsEl = root.querySelector('.bonds-ai-suggestions');
    const input = root.querySelector('.bonds-ai-text-input');
    const fileInput = root.querySelector('.bonds-ai-file-input');
    const attachBtn = root.querySelector('.bonds-ai-attach-button');
    const attachmentsEl = root.querySelector('.bonds-ai-attachments');
    const sendBtn = root.querySelector('.bonds-ai-send-button');
    const voiceBtn = root.querySelector('.bonds-ai-voice-button');
    const voiceStatus = root.querySelector('.bonds-ai-voice-status');
    const homeLaunchpad = root.querySelector('.bonds-ai-home-launchpad');
    const homePromptButtons = root.querySelectorAll('[data-assistant-prompt]');
    const homeFocusButton = root.querySelector('[data-assistant-focus]');
    const humanEscalationButton = root.querySelector('[data-assistant-human-escalation]');
    const overallHealthStatus = root.querySelector('.bonds-ai-home-status');
    const healthUpdatedEl = root.querySelector('.bonds-ai-health-updated');
    const healthServiceEls = Object.fromEntries(
      Array.from(root.querySelectorAll('[data-health-service]'))
        .map(element => [element.dataset.healthService, element])
    );
    const diagnosticsPanel = root.querySelector('.bonds-ai-request-diagnostics');
    const diagnosticsSummary = root.querySelector('.bonds-ai-diagnostics-summary');
    const diagnosticsMeta = root.querySelector('.bonds-ai-diagnostics-meta');
    const diagnosticsPipeline = root.querySelector('.bonds-ai-diagnostics-pipeline');
    const diagnosticsHistory = root.querySelector('.bonds-ai-diagnostics-history');
    const diagnosticsCopy = root.querySelector('.bonds-ai-diagnostics-copy');
    const diagnosticsToggle = root.querySelector('.bonds-ai-diagnostics-toggle');

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
      pagePath: options.pagePath || (window.location.pathname + window.location.hash) || '/',
      pageTitle: options.pageTitle || document.title || null,
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
        active_topic: null,
        active_service: null,
        active_entity: null,
        current_stage: null,
        last_intent: null,
        unresolved_question: null,
        open_tasks: [],
        required_data: [],
        confirmed_facts: {},
        important_confirmed_facts: {},
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
        active_topic: typeof value.active_topic === 'string' ? value.active_topic.slice(0, 500) : null,
        active_service: typeof value.active_service === 'string' ? value.active_service.slice(0, 120) : null,
        active_entity: typeof value.active_entity === 'string' ? value.active_entity.slice(0, 200) : null,
        current_stage: typeof value.current_stage === 'string' ? value.current_stage.slice(0, 200) : null,
        last_intent: typeof value.last_intent === 'string' ? value.last_intent.slice(0, 120) : null,
        unresolved_question: typeof value.unresolved_question === 'string' ? value.unresolved_question.slice(0, 500) : null,
        open_tasks: sanitizeStringArray(value.open_tasks),
        required_data: sanitizeStringArray(value.required_data),
        confirmed_facts: sanitizePlainObject(value.confirmed_facts),
        important_confirmed_facts: sanitizePlainObject(value.important_confirmed_facts || value.confirmed_facts),
        pending_confirmation: value.pending_confirmation && typeof value.pending_confirmation === 'object'
          ? sanitizePlainObject(value.pending_confirmation)
          : null,
        last_action: value.last_action && typeof value.last_action === 'object'
          ? sanitizePlainObject(value.last_action)
          : null,
        updated_at: typeof value.updated_at === 'string' ? value.updated_at : null
      };
    }

    function assistantContextEnabled() {
      try {
        return window.sessionStorage?.getItem(ASSISTANT_CONTEXT_PREFERENCE_KEY) !== '0';
      } catch (err) {
        return true;
      }
    }

    function loadAssistantContextState(boundary = contextBoundaryKey()) {
      if (!assistantContextEnabled()) return createAssistantContextState(boundary);
      try {
        const raw = window.sessionStorage?.getItem(assistantStateStorageKey(boundary));
        if (!raw) return createAssistantContextState(boundary);
        return sanitizeAssistantContextState(JSON.parse(raw), boundary);
      } catch (err) {
        return createAssistantContextState(boundary);
      }
    }

    function saveAssistantContextState() {
      if (!assistantContextEnabled()) {
        const boundary = contextBoundaryKey();
        try {
          window.sessionStorage?.removeItem(assistantStateStorageKey(boundary));
        } catch (err) {
          // Ignore unavailable session storage.
        }
        assistantContextState = createAssistantContextState(boundary);
        return assistantContextState;
      }
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
    let persistentCaseSyncSignature = null;

    function normalizeCasePagePath(value) {
      const raw = String(value || '/').trim() || '/';
      const hashIndex = raw.indexOf('#');
      const beforeHash = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
      const rawHash = hashIndex >= 0 ? raw.slice(hashIndex + 1) : '';
      const pathOnly = (beforeHash.split('?')[0] || '/').replace(/\/{2,}/g, '/');
      const safePath = pathOnly.startsWith('/') ? pathOnly : '/';
      const hash = rawHash.split('?')[0].trim().slice(0, 160);
      return hash ? `${safePath}#${hash}` : safePath;
    }

    function caseBoundaryKey() {
      const pagePath = normalizeCasePagePath(
        context.pagePath || (window.location.pathname + window.location.hash) || '/'
      );
      const homepage = ['/', '/index.html', '/en', '/en/', '/en/index.html'].includes(pagePath);
      if (homepage) return 'homepage/no_service_selected';
      const service = String(context.serviceCode || '').trim();
      return `page:${pagePath}|service:${service || 'none'}`;
    }

    function hasMeaningfulAssistantState(value) {
      if (!value || typeof value !== 'object') return false;
      return Boolean(
        value.goal ||
        value.current_stage ||
        (Array.isArray(value.open_tasks) && value.open_tasks.length) ||
        (Array.isArray(value.required_data) && value.required_data.length) ||
        (value.confirmed_facts && Object.keys(value.confirmed_facts).length) ||
        value.last_action
      );
    }

    function serverWorkflowState(localState, boundary) {
      const safe = sanitizeAssistantContextState(localState, contextBoundaryKey());
      return {
        ...safe,
        boundary,
        pending_confirmation: null
      };
    }

    function localWorkflowState(serverState) {
      return sanitizeAssistantContextState({
        ...(serverState || {}),
        boundary: contextBoundaryKey()
      }, contextBoundaryKey());
    }

    function mergeGuestStateIntoWorkflow(serverState, localState, caseBoundary) {
      const server = serverState && typeof serverState === 'object' ? serverState : {};
      const local = sanitizeAssistantContextState(localState, contextBoundaryKey());
      const serverUpdated = Date.parse(server.updated_at || '') || 0;
      const localUpdated = Date.parse(local.updated_at || '') || 0;

      if (!hasMeaningfulAssistantState(local) || localUpdated <= serverUpdated) {
        return { state: { ...server, boundary: caseBoundary }, changed: false };
      }

      const unique = values => Array.from(new Set((values || []).filter(Boolean))).slice(0, 50);
      return {
        changed: true,
        state: {
          ...server,
          boundary: caseBoundary,
          goal: local.goal || server.goal || null,
          current_stage: server.current_stage || local.current_stage || null,
          open_tasks: unique([...(server.open_tasks || []), ...(local.open_tasks || [])]),
          required_data: unique([...(server.required_data || []), ...(local.required_data || [])]),
          confirmed_facts: {
            ...(server.confirmed_facts || {}),
            ...(local.confirmed_facts || {})
          },
          pending_confirmation: server.pending_confirmation || null,
          last_action: server.last_action || local.last_action || null,
          updated_at: local.updated_at || server.updated_at || new Date().toISOString()
        }
      };
    }

    async function resumePersistentCaseState() {
      if (!assistantContextEnabled()) return null;
      if (!window.BondsAuth || typeof window.BondsAuth.getSession !== 'function') return null;

      try {
        const { data } = await window.BondsAuth.getSession();
        const session = data?.session || null;
        const token = session?.access_token;
        if (!token) {
          persistentCaseSyncSignature = null;
          return null;
        }

        const userRef = String(session?.user?.id || 'authenticated');
        const caseBoundary = caseBoundaryKey();
        const localState = sanitizeAssistantContextState(assistantContextState, contextBoundaryKey());
        const localStamp = localState?.updated_at || 'empty';
        const signature = `${userRef}|${caseBoundary}|${localStamp}`;
        if (persistentCaseSyncSignature === signature) return null;

        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        };
        const resumeUrl = ASSISTANT_WORKFLOW_RESUME_URL + '?boundary=' + encodeURIComponent(caseBoundary);
        const resumeRes = await fetch(resumeUrl, {
          method: 'GET',
          headers,
          credentials: 'same-origin',
          cache: 'no-store'
        });
        const resumeData = await resumeRes.json();
        if (!resumeRes.ok) throw new Error(resumeData.error || 'WORKFLOW_RESUME_FAILED');

        let workflow = resumeData.workflow || null;
        const workflowKey = resumeData.workflow_key || null;

        if (workflow) {
          const merged = mergeGuestStateIntoWorkflow(workflow.state, localState, caseBoundary);
          if (merged.changed && workflowKey) {
            const saveRes = await fetch(ASSISTANT_WORKFLOW_SAVE_URL, {
              method: 'POST',
              headers,
              credentials: 'same-origin',
              body: JSON.stringify({
                workflow_key: workflowKey,
                boundary: caseBoundary,
                state: merged.state,
                status: workflow.status || 'active',
                expected_version: workflow.version
              })
            });
            const saveData = await saveRes.json();
            if (!saveRes.ok) throw new Error(saveData.error || 'WORKFLOW_HANDOFF_FAILED');
            workflow = saveData.workflow || workflow;
          }
          assistantContextState = localWorkflowState(workflow.state);
          saveAssistantContextState();
        } else if (workflowKey && hasMeaningfulAssistantState(localState)) {
          const saveRes = await fetch(ASSISTANT_WORKFLOW_SAVE_URL, {
            method: 'POST',
            headers,
            credentials: 'same-origin',
            body: JSON.stringify({
              workflow_key: workflowKey,
              boundary: caseBoundary,
              state: serverWorkflowState(localState, caseBoundary),
              status: 'active',
              expected_version: null
            })
          });
          const saveData = await saveRes.json();
          if (!saveRes.ok) throw new Error(saveData.error || 'WORKFLOW_HANDOFF_FAILED');
          workflow = saveData.workflow || null;
          if (workflow?.state) {
            assistantContextState = localWorkflowState(workflow.state);
            saveAssistantContextState();
          }
        }

        persistentCaseSyncSignature = `${userRef}|${caseBoundary}|${assistantContextState?.updated_at || 'empty'}`;
        return workflow;
      } catch (err) {
        console.warn('[BondsAssistantTaskResume]', err);
        return null;
      }
    }

    function resetVisibleConversationForBoundary() {
      state.messages = [];
      state.attachments = [];
      context.attachments = [];
      messagesEl.innerHTML = '';
      actionsEl.innerHTML = '';
      suggestionsEl.innerHTML = '';
      renderAttachments();
    }

    function updateContext(newContext) {
      const previousBoundary = contextBoundaryKey(context);
      context = { ...context, ...newContext };
      const nextBoundary = contextBoundaryKey(context);

      if (previousBoundary !== nextBoundary) {
        assistantContextState = loadAssistantContextState(nextBoundary);
        persistentCaseSyncSignature = null;
        resetVisibleConversationForBoundary();
      }
    }

    function assistantLayoutViewport() {
      return {
        width: Math.max(1, Number(window.innerWidth) || document.documentElement.clientWidth || 1),
        height: Math.max(1, Number(window.innerHeight) || document.documentElement.clientHeight || 1)
      };
    }

    function defaultAssistantLayout() {
      const viewport = assistantLayoutViewport();
      const width = Math.min(420, Math.max(ASSISTANT_LAYOUT_MIN_WIDTH, viewport.width - 48));
      const height = Math.min(650, Math.max(ASSISTANT_LAYOUT_MIN_HEIGHT, viewport.height - 140));
      return {
        version: ASSISTANT_LAYOUT_VERSION,
        x: Math.max(ASSISTANT_LAYOUT_MARGIN, Math.min(24, viewport.width - width - ASSISTANT_LAYOUT_MARGIN)),
        y: Math.max(ASSISTANT_LAYOUT_MARGIN, viewport.height - 92 - height),
        width,
        height,
        dock: null
      };
    }

    function normalizeAssistantLayout(value) {
      const viewport = assistantLayoutViewport();
      const fallback = defaultAssistantLayout();
      const maxWidth = Math.max(240, viewport.width - (ASSISTANT_LAYOUT_MARGIN * 2));
      const maxHeight = Math.max(260, viewport.height - (ASSISTANT_LAYOUT_MARGIN * 2));
      const minWidth = Math.min(ASSISTANT_LAYOUT_MIN_WIDTH, maxWidth);
      const minHeight = Math.min(ASSISTANT_LAYOUT_MIN_HEIGHT, maxHeight);
      const width = Math.min(maxWidth, Math.max(minWidth, Number(value?.width) || fallback.width));
      const height = Math.min(maxHeight, Math.max(minHeight, Number(value?.height) || fallback.height));
      const x = Math.min(
        viewport.width - width - ASSISTANT_LAYOUT_MARGIN,
        Math.max(ASSISTANT_LAYOUT_MARGIN, Number(value?.x) || fallback.x)
      );
      const y = Math.min(
        viewport.height - height - ASSISTANT_LAYOUT_MARGIN,
        Math.max(ASSISTANT_LAYOUT_MARGIN, Number(value?.y) || fallback.y)
      );
      return {
        version: ASSISTANT_LAYOUT_VERSION,
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(width),
        height: Math.round(height),
        dock: value?.dock === 'left' || value?.dock === 'right' ? value.dock : null
      };
    }

    function readAssistantLayout() {
      try {
        const raw = window.sessionStorage?.getItem(ASSISTANT_LAYOUT_KEY);
        if (!raw) return defaultAssistantLayout();
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.version !== ASSISTANT_LAYOUT_VERSION) return defaultAssistantLayout();
        return normalizeAssistantLayout(parsed);
      } catch (_) {
        return defaultAssistantLayout();
      }
    }

    function persistAssistantLayout(layout) {
      try {
        window.sessionStorage?.setItem(ASSISTANT_LAYOUT_KEY, JSON.stringify(normalizeAssistantLayout(layout)));
      } catch (_) {
        // Layout persistence is best-effort only.
      }
    }

    function clearStandardLayoutStyles() {
      ['left','top','right','bottom','width','height','inset'].forEach(property => {
        windowEl.style[property] = '';
      });
    }

    let standardLayout = readAssistantLayout();

    function applyStandardLayout(layout = standardLayout, { persist = false } = {}) {
      if ((Number(window.innerWidth) || 0) <= 640) {
        clearStandardLayoutStyles();
        return standardLayout;
      }
      standardLayout = normalizeAssistantLayout(layout);
      windowEl.style.inset = 'auto';
      windowEl.style.right = 'auto';
      windowEl.style.bottom = 'auto';
      windowEl.style.left = standardLayout.x + 'px';
      windowEl.style.top = standardLayout.y + 'px';
      windowEl.style.width = standardLayout.width + 'px';
      windowEl.style.height = standardLayout.height + 'px';
      windowEl.dataset.layoutDock = standardLayout.dock || '';
      if (persist) persistAssistantLayout(standardLayout);
      return standardLayout;
    }

    function resetAssistantLayout() {
      try {
        window.sessionStorage?.removeItem(ASSISTANT_LAYOUT_KEY);
      } catch (_) {}
      standardLayout = defaultAssistantLayout();
      if (state?.viewMode === 'standard') applyStandardLayout(standardLayout);
      return standardLayout;
    }

    function snapAssistantLayout(layout) {
      const viewport = assistantLayoutViewport();
      const next = normalizeAssistantLayout(layout);
      const rightGap = viewport.width - (next.x + next.width);
      if (next.x <= ASSISTANT_LAYOUT_SNAP) {
        next.x = ASSISTANT_LAYOUT_MARGIN;
        next.dock = 'left';
      } else if (rightGap <= ASSISTANT_LAYOUT_SNAP) {
        next.x = viewport.width - next.width - ASSISTANT_LAYOUT_MARGIN;
        next.dock = 'right';
      } else {
        next.dock = null;
      }
      if (next.y <= ASSISTANT_LAYOUT_SNAP) next.y = ASSISTANT_LAYOUT_MARGIN;
      return normalizeAssistantLayout(next);
    }

    let layoutInteraction = null;

    function beginLayoutInteraction(type, edge, event) {
      if (state.viewMode !== 'standard' || (Number(window.innerWidth) || 0) <= 640) return;
      if (event.button !== undefined && event.button !== 0) return;
      event.preventDefault();
      layoutInteraction = {
        type,
        edge: edge || null,
        pointerId:event.pointerId,
        startX:event.clientX,
        startY:event.clientY,
        start:{ ...standardLayout }
      };
      windowEl.classList.toggle('layout-dragging', type === 'move');
      windowEl.classList.toggle('layout-resizing', type === 'resize');
      try { event.currentTarget?.setPointerCapture?.(event.pointerId); } catch (_) {}
    }

    function updateLayoutInteraction(event) {
      if (!layoutInteraction) return;
      if (
        layoutInteraction.pointerId !== undefined &&
        event.pointerId !== undefined &&
        layoutInteraction.pointerId !== event.pointerId
      ) return;

      const dx = event.clientX - layoutInteraction.startX;
      const dy = event.clientY - layoutInteraction.startY;
      const start = layoutInteraction.start;
      let next = { ...start, dock:null };

      if (layoutInteraction.type === 'move') {
        next.x = start.x + dx;
        next.y = start.y + dy;
      } else {
        const edge = layoutInteraction.edge || '';
        if (edge.includes('right')) next.width = start.width + dx;
        if (edge.includes('left')) {
          next.width = start.width - dx;
          next.x = start.x + dx;
        }
        if (edge.includes('bottom')) next.height = start.height + dy;
      }
      applyStandardLayout(next);
    }

    function finishLayoutInteraction(event) {
      if (!layoutInteraction) return;
      if (
        layoutInteraction.pointerId !== undefined &&
        event?.pointerId !== undefined &&
        layoutInteraction.pointerId !== event.pointerId
      ) return;
      standardLayout = snapAssistantLayout(standardLayout);
      applyStandardLayout(standardLayout, { persist:true });
      layoutInteraction = null;
      windowEl.classList.remove('layout-dragging', 'layout-resizing');
    }

    function readPreferredViewMode() {
      try {
        const value = window.sessionStorage?.getItem('bonds.assistant.view-mode.v1');
        return ['standard', 'workspace', 'fullscreen'].includes(value) ? value : 'standard';
      } catch (_) {
        return 'standard';
      }
    }

    const state = {
      messages: [],
      isOpen: false,
      isLoading: false,
      isUploading: false,
      attachments: [],
      voiceState: 'idle',
      recognition: null,
      activeUtterance: null,
      viewMode: readPreferredViewMode(),
      previousViewMode: 'standard',
      health: { status: 'checking', lastCheckedAt: null, payload: null, lastError: null },
      healthTimer: null,
      diagnostics: null,
      diagnosticHistory: []
    };

    function diagnosticStageLabel(stage) {
      const labels = {
        intent:'Intent', planner:'Planner', research_acquisition:'Research Acquisition',
        search_transport:'Search Transport', search_relevance:'Search Relevance',
        explore:'Explore', evidence:'Evidence', ai_generate:'AI Generate',
        initial_quality_gate:'Initial Quality Gate', repair_attempt:'Repair Attempt',
        repair_quality_gate:'Repair Quality Gate', final_answer:'Final Answer',
        http_roundtrip:'HTTP Round-trip', client_parse:'Client Parse', ui_render:'UI Render'
      };
      return labels[stage] || String(stage || 'Unknown');
    }

    function safeDiagnosticRecord(value) {
      if (!value || typeof value !== 'object') return null;
      const stages = Array.isArray(value.stages) ? value.stages.slice(0, 20).map(item => ({
        stage:String(item?.stage || '').slice(0, 50),
        status:String(item?.status || 'NOT_AVAILABLE').slice(0, 20),
        duration_ms:Number.isFinite(Number(item?.duration_ms)) ? Math.round(Number(item.duration_ms)) : null
      })) : [];
      const timing = value.timing && typeof value.timing === 'object' ? value.timing : {};
      return {
        schema_version:Number(value.schema_version) === 2 ? 2 : 1,
        request_id:String(value.request_id || '').slice(0, 120) || null,
        path:String(value.path || '').slice(0, 80) || null,
        status:String(value.status || 'NOT_AVAILABLE').slice(0, 20),
        stages,
        pipeline_stage:String(value.pipeline_stage || '').slice(0, 50) || null,
        root_cause_stage:String(value.root_cause_stage || value.failure_stage || '').slice(0, 50) || null,
        failure_stage:String(value.failure_stage || value.root_cause_stage || '').slice(0, 50) || null,
        error_code:String(value.error_code || '').slice(0, 160) || null,
        timing:{
          server_processing_ms:Number.isFinite(Number(timing.server_processing_ms ?? value.total_ms))
            ? Math.round(Number(timing.server_processing_ms ?? value.total_ms))
            : null,
          api_roundtrip_ms:Number.isFinite(Number(timing.api_roundtrip_ms)) ? Math.round(Number(timing.api_roundtrip_ms)) : null,
          client_parse_ms:Number.isFinite(Number(timing.client_parse_ms)) ? Math.round(Number(timing.client_parse_ms)) : null,
          ui_render_ms:Number.isFinite(Number(timing.ui_render_ms)) ? Math.round(Number(timing.ui_render_ms)) : null,
          end_to_end_ms:Number.isFinite(Number(timing.end_to_end_ms)) ? Math.round(Number(timing.end_to_end_ms)) : null
        },
        total_ms:Number.isFinite(Number(value.total_ms)) ? Math.round(Number(value.total_ms)) : null,
        bottleneck:value.bottleneck && typeof value.bottleneck === 'object' ? {
          stage:String(value.bottleneck.stage || '').slice(0, 50) || null,
          duration_ms:Number.isFinite(Number(value.bottleneck.duration_ms)) ? Math.round(Number(value.bottleneck.duration_ms)) : null
        } : null,
        provider:String(value.provider || '').slice(0, 80) || null,
        fallback_used:value.fallback_used === true,
        fallback_reason:String(value.fallback_reason || '').slice(0, 160) || null,
        research_quality:value.research_quality && typeof value.research_quality === 'object' ? {
          initial_quality_code:String(value.research_quality.initial_quality_code || '').slice(0, 160) || null,
          repair_attempted:value.research_quality.repair_attempted === true,
          repair_ms:Number.isFinite(Number(value.research_quality.repair_ms)) ? Math.round(Number(value.research_quality.repair_ms)) : null,
          repair_quality_code:String(value.research_quality.repair_quality_code || '').slice(0, 160) || null,
          repair_succeeded:value.research_quality.repair_succeeded === true
        } : null,
        evidence:value.evidence && typeof value.evidence === 'object' ? {
          source_count:Number.isFinite(Number(value.evidence.source_count)) ? Number(value.evidence.source_count) : null,
          evidence_count:Number.isFinite(Number(value.evidence.evidence_count)) ? Number(value.evidence.evidence_count) : null,
          decision_eligible:typeof value.evidence.decision_eligible === 'boolean' ? value.evidence.decision_eligible : null,
          unknown_count:Number(value.evidence.unknown_count || 0),
          contradiction_count:Number(value.evidence.contradiction_count || 0)
        } : null,
        acquisition_trace:value.acquisition_trace && typeof value.acquisition_trace === 'object' ? {
          search_attempt_count:Number.isFinite(Number(value.acquisition_trace.search_attempt_count)) ? Number(value.acquisition_trace.search_attempt_count) : null,
          search_result_count:Number.isFinite(Number(value.acquisition_trace.search_result_count)) ? Number(value.acquisition_trace.search_result_count) : null,
          relevant_search_result_count:Number.isFinite(Number(value.acquisition_trace.relevant_search_result_count)) ? Number(value.acquisition_trace.relevant_search_result_count) : null,
          seed_count:Number.isFinite(Number(value.acquisition_trace.seed_count)) ? Number(value.acquisition_trace.seed_count) : null,
          crawl_attempted:value.acquisition_trace.crawl_attempted === true,
          discovered_count:Number.isFinite(Number(value.acquisition_trace.discovered_count)) ? Number(value.acquisition_trace.discovered_count) : null,
          visited_count:Number.isFinite(Number(value.acquisition_trace.visited_count)) ? Number(value.acquisition_trace.visited_count) : null,
          fetched_count:Number.isFinite(Number(value.acquisition_trace.fetched_count)) ? Number(value.acquisition_trace.fetched_count) : null,
          failed_count:Number.isFinite(Number(value.acquisition_trace.failed_count)) ? Number(value.acquisition_trace.failed_count) : null,
          blocked_count:Number.isFinite(Number(value.acquisition_trace.blocked_count)) ? Number(value.acquisition_trace.blocked_count) : null,
          pending_count:Number.isFinite(Number(value.acquisition_trace.pending_count)) ? Number(value.acquisition_trace.pending_count) : null,
          relevant_page_count:Number.isFinite(Number(value.acquisition_trace.relevant_page_count)) ? Number(value.acquisition_trace.relevant_page_count) : null,
          recovery_attempt_count:Number.isFinite(Number(value.acquisition_trace.recovery_attempt_count)) ? Number(value.acquisition_trace.recovery_attempt_count) : null,
          verification_attempted:value.acquisition_trace.verification_attempted === true,
          verified_source_count:Number.isFinite(Number(value.acquisition_trace.verified_source_count)) ? Number(value.acquisition_trace.verified_source_count) : null,
          evidence_count:Number.isFinite(Number(value.acquisition_trace.evidence_count)) ? Number(value.acquisition_trace.evidence_count) : null,
          crawl_unknowns:Array.isArray(value.acquisition_trace.crawl_unknowns)
            ? value.acquisition_trace.crawl_unknowns.slice(0,8).map(item => String(item || '').slice(0,80))
            : [],
          failure_samples:Array.isArray(value.acquisition_trace.failure_samples)
            ? value.acquisition_trace.failure_samples.slice(0,8).map(item => ({
                host:String(item?.host || '').slice(0,120) || null,
                status_code:Number.isFinite(Number(item?.status_code)) ? Number(item.status_code) : null,
                failure_class:String(item?.failure_class || '').slice(0,80) || null
              }))
            : [],
          blocked_samples:Array.isArray(value.acquisition_trace.blocked_samples)
            ? value.acquisition_trace.blocked_samples.slice(0,8).map(item => ({
                host:String(item?.host || '').slice(0,120) || null,
                reason:String(item?.reason || '').slice(0,80) || null
              }))
            : []
        } : null
      };
    }

    function loadDiagnosticHistory() {
      try {
        const parsed = JSON.parse(window.sessionStorage?.getItem(ASSISTANT_DIAGNOSTICS_HISTORY_KEY) || '[]');
        state.diagnosticHistory = Array.isArray(parsed) ? parsed.map(safeDiagnosticRecord).filter(Boolean).slice(0, 5) : [];
      } catch (_) {
        state.diagnosticHistory = [];
      }
    }

    function saveDiagnosticHistory() {
      try {
        window.sessionStorage?.setItem(
          ASSISTANT_DIAGNOSTICS_HISTORY_KEY,
          JSON.stringify(state.diagnosticHistory.slice(0, 5))
        );
      } catch (_) {}
    }

    function appendClientDiagnosticStages(record, clientStages = [], timingPatch = {}) {
      const safe = safeDiagnosticRecord(record);
      if (!safe) return null;
      for (const item of clientStages) {
        safe.stages.push({
          stage:String(item.stage || '').slice(0, 50),
          status:String(item.status || 'NOT_AVAILABLE').slice(0, 20),
          duration_ms:Number.isFinite(Number(item.duration_ms)) ? Math.round(Number(item.duration_ms)) : null
        });
      }
      safe.timing = {
        ...safe.timing,
        ...Object.fromEntries(Object.entries(timingPatch).map(([key, value]) => [
          key,
          Number.isFinite(Number(value)) ? Math.round(Number(value)) : null
        ]))
      };
      const clientFailure = safe.stages.find(item => item.status === 'FAIL');
      if (clientFailure) {
        safe.status = 'FAIL';
        if (!safe.root_cause_stage) safe.root_cause_stage = clientFailure.stage;
        if (!safe.failure_stage) safe.failure_stage = clientFailure.stage;
        if (!safe.pipeline_stage) safe.pipeline_stage = 'client';
      }
      return safe;
    }

    function diagnosticCopyText(record) {
      if (!record) return '';
      const rows = [
        'schema_version=' + (record.schema_version || 'n/a'),
        'request_id=' + (record.request_id || 'n/a'),
        'path=' + (record.path || 'n/a'),
        'status=' + (record.status || 'n/a'),
        'pipeline_stage=' + (record.pipeline_stage || 'n/a'),
        'root_cause_stage=' + (record.root_cause_stage || 'n/a'),
        'failure_stage=' + (record.failure_stage || 'n/a'),
        'error_code=' + (record.error_code || 'n/a'),
        'provider=' + (record.provider || 'n/a'),
        'fallback_used=' + (record.fallback_used ? 'YES' : 'NO'),
        'server_processing_ms=' + (record.timing?.server_processing_ms ?? 'n/a'),
        'api_roundtrip_ms=' + (record.timing?.api_roundtrip_ms ?? 'n/a'),
        'client_parse_ms=' + (record.timing?.client_parse_ms ?? 'n/a'),
        'ui_render_ms=' + (record.timing?.ui_render_ms ?? 'n/a'),
        'end_to_end_ms=' + (record.timing?.end_to_end_ms ?? 'n/a'),
        'initial_quality_code=' + (record.research_quality?.initial_quality_code || 'n/a'),
        'repair_attempted=' + (record.research_quality?.repair_attempted ? 'YES' : 'NO'),
        'repair_ms=' + (record.research_quality?.repair_ms ?? 'n/a'),
        'repair_quality_code=' + (record.research_quality?.repair_quality_code || 'n/a'),
        'repair_succeeded=' + (record.research_quality?.repair_succeeded ? 'YES' : 'NO'),
        'search_attempt_count=' + (record.acquisition_trace?.search_attempt_count ?? 'n/a'),
        'search_result_count=' + (record.acquisition_trace?.search_result_count ?? 'n/a'),
        'relevant_search_result_count=' + (record.acquisition_trace?.relevant_search_result_count ?? 'n/a'),
        'seed_count=' + (record.acquisition_trace?.seed_count ?? 'n/a'),
        'crawl_attempted=' + (record.acquisition_trace?.crawl_attempted ? 'YES' : 'NO'),
        'crawl_discovered=' + (record.acquisition_trace?.discovered_count ?? 'n/a'),
        'crawl_visited=' + (record.acquisition_trace?.visited_count ?? 'n/a'),
        'crawl_fetched=' + (record.acquisition_trace?.fetched_count ?? 'n/a'),
        'crawl_failed=' + (record.acquisition_trace?.failed_count ?? 'n/a'),
        'crawl_blocked=' + (record.acquisition_trace?.blocked_count ?? 'n/a'),
        'crawl_pending=' + (record.acquisition_trace?.pending_count ?? 'n/a'),
        'relevant_page_count=' + (record.acquisition_trace?.relevant_page_count ?? 'n/a'),
        'recovery_attempt_count=' + (record.acquisition_trace?.recovery_attempt_count ?? 'n/a'),
        'verification_attempted=' + (record.acquisition_trace?.verification_attempted ? 'YES' : 'NO'),
        'verified_source_count=' + (record.acquisition_trace?.verified_source_count ?? 'n/a'),
        'acquisition_evidence_count=' + (record.acquisition_trace?.evidence_count ?? 'n/a')
      ];
      for (const stage of record.stages || []) {
        rows.push(stage.stage + '=' + stage.status + (stage.duration_ms == null ? '' : ':' + stage.duration_ms + 'ms'));
      }
      return rows.join('\n');
    }

    function renderRequestDiagnostics(record, { remember = true } = {}) {
      const safe = safeDiagnosticRecord(record);
      if (!safe || !diagnosticsPanel) return null;
      state.diagnostics = safe;
      diagnosticsPanel.classList.add('visible');
      diagnosticsSummary.textContent = [
        safe.status,
        safe.timing?.server_processing_ms == null ? null : 'Server ' + safe.timing.server_processing_ms + 'ms',
        safe.timing?.end_to_end_ms == null ? null : 'E2E ' + safe.timing.end_to_end_ms + 'ms',
        safe.bottleneck?.stage ? diagnosticStageLabel(safe.bottleneck.stage) + ' ' + (safe.bottleneck.duration_ms ?? '—') + 'ms' : null
      ].filter(Boolean).join(' · ');
      diagnosticsSummary.dataset.status = safe.status;

      const shouldExpand = safe.status !== 'PASS';
      diagnosticsPanel.classList.toggle('expanded', shouldExpand);
      if (diagnosticsToggle) {
        diagnosticsToggle.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');
        diagnosticsToggle.textContent = shouldExpand ? 'Hide' : 'Details';
      }

      const meta = [
        ['Request', safe.request_id || '—'],
        ['Path', safe.path || '—'],
        ['Pipeline', safe.pipeline_stage || '—'],
        ['Root Cause', safe.root_cause_stage || '—'],
        ['Error', safe.error_code || '—'],
        ['Server', safe.timing?.server_processing_ms == null ? '—' : safe.timing.server_processing_ms + 'ms'],
        ['End-to-End', safe.timing?.end_to_end_ms == null ? '—' : safe.timing.end_to_end_ms + 'ms'],
        ['Bottleneck', safe.bottleneck?.stage ? diagnosticStageLabel(safe.bottleneck.stage) + ' ' + (safe.bottleneck.duration_ms ?? '—') + 'ms' : '—'],
        ['Search Results', safe.acquisition_trace?.search_result_count ?? '—'],
        ['Relevant Results', safe.acquisition_trace?.relevant_search_result_count ?? '—'],
        ['Seed URLs', safe.acquisition_trace?.seed_count ?? '—'],
        ['Crawl Fetched', safe.acquisition_trace?.fetched_count ?? '—'],
        ['Crawl Failed', safe.acquisition_trace?.failed_count ?? '—'],
        ['Crawl Blocked', safe.acquisition_trace?.blocked_count ?? '—'],
        ['Relevant Pages', safe.acquisition_trace?.relevant_page_count ?? '—'],
        ['Verified Sources', safe.acquisition_trace?.verified_source_count ?? '—'],
        ['Evidence Items', safe.acquisition_trace?.evidence_count ?? '—']
      ];
      diagnosticsMeta.innerHTML = '';
      for (const [key, value] of meta) {
        const item = document.createElement('span');
        item.textContent = key + ': ' + value;
        diagnosticsMeta.appendChild(item);
      }

      diagnosticsPipeline.innerHTML = '';
      for (const stage of safe.stages) {
        const row = document.createElement('div');
        row.className = 'bonds-ai-diagnostics-stage';
        const name = document.createElement('span');
        name.textContent = diagnosticStageLabel(stage.stage);
        const status = document.createElement('b');
        status.dataset.status = stage.status;
        status.textContent = stage.status + (stage.duration_ms == null ? '' : ' · ' + stage.duration_ms + 'ms');
        row.append(name, status);
        diagnosticsPipeline.appendChild(row);
      }

      if (remember) {
        state.diagnosticHistory = [safe, ...state.diagnosticHistory.filter(item => item.request_id !== safe.request_id)].slice(0, 5);
        saveDiagnosticHistory();
      }
      diagnosticsHistory.textContent = state.diagnosticHistory.length > 1
        ? 'Recent: ' + state.diagnosticHistory.slice(1).map(item =>
            (item.status || '—') + ' ' + (item.timing?.end_to_end_ms ?? item.timing?.server_processing_ms ?? item.total_ms ?? '—') + 'ms'
          ).join(' · ')
        : '';
      return safe;
    }

    if (diagnosticsToggle) {
      diagnosticsToggle.addEventListener('click', () => {
        const expanded = !diagnosticsPanel.classList.contains('expanded');
        diagnosticsPanel.classList.toggle('expanded', expanded);
        diagnosticsToggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        diagnosticsToggle.textContent = expanded ? 'Hide' : 'Details';
      });
    }

    loadDiagnosticHistory();

    function healthState(value) {
      const normalized = String(value || '').toLowerCase();
      if (['ok', 'ready', 'available'].includes(normalized)) return 'connected';
      if (['not_configured', 'invalid_configuration', 'unconfigured'].includes(normalized)) return 'unconfigured';
      if (['checking', 'unknown', 'not_checked', 'skipped'].includes(normalized)) return 'checking';
      return 'disconnected';
    }

    function healthText(status) {
      const english = languageCode() === 'en';
      if (status === 'connected') return english ? 'Connected' : 'متصل';
      if (status === 'degraded') return english ? 'Degraded' : 'متاح جزئياً';
      if (status === 'unconfigured') return english ? 'Not configured' : 'غير مهيأ';
      if (status === 'checking') return english ? 'Checking' : 'جاري التحقق';
      return english ? 'Disconnected' : 'غير متصل';
    }

    function setHealthBadge(name, status, detail = '') {
      const element = healthServiceEls[name];
      if (!element) return;
      element.dataset.status = status;
      const label = element.dataset.healthLabel || element.textContent.split(' · ')[0];
      element.dataset.healthLabel = label;
      element.textContent = label + ' · ' + healthText(status);
      element.title = detail || element.textContent;
    }

    function renderServiceHealth(payload, error = null) {
      const checks = payload?.checks || {};
      const apiState = payload && checks.supabase === 'ok' ? 'connected' : 'disconnected';
      const nativeState = healthState(checks.native);
      const fallbackState = healthState(checks.fallback);
      const aiState = nativeState === 'connected' || fallbackState === 'connected'
        ? 'connected'
        : (nativeState === 'unconfigured' ? 'unconfigured' : 'disconnected');
      const tokenState = healthState(checks.token_runtime);
      const searchState = healthState(checks.web_search);
      const governanceState = healthState(checks.user_governance);

      setHealthBadge('ai', aiState, payload?.inference?.native_diagnostic?.code || '');
      setHealthBadge('api', apiState, checks.supabase || '');
      setHealthBadge('token', tokenState, payload?.token_runtime?.code || '');
      setHealthBadge('search', searchState, payload?.web_search?.code || '');
      setHealthBadge('governance', governanceState, payload?.user_governance?.code || '');

      const serviceStates = [aiState, apiState, tokenState, searchState, governanceState];
      const overall = payload?.status === 'ready' && serviceStates.every(value => value === 'connected')
        ? 'connected'
        : (apiState === 'connected' && serviceStates.some(value => value === 'connected') ? 'degraded' : 'disconnected');

      state.health = {
        status: overall,
        lastCheckedAt: new Date().toISOString(),
        payload: payload || null,
        lastError: error ? String(error.message || error) : null
      };

      if (overallHealthStatus) {
        overallHealthStatus.dataset.status = overall;
        overallHealthStatus.textContent = healthText(overall);
      }
      if (healthUpdatedEl) {
        const now = new Date();
        healthUpdatedEl.textContent = (languageCode() === 'en' ? 'Checked ' : 'فحص ') +
          now.toLocaleTimeString(languageCode() === 'en' ? 'en-GB' : 'ar-SA', { hour:'2-digit', minute:'2-digit' });
        healthUpdatedEl.title = state.health.lastError || '';
      }
      return state.health;
    }

    async function refreshServiceHealth() {
      if (document.hidden) return state.health;
      if (window.navigator && window.navigator.onLine === false) {
        renderServiceHealth(null, new Error('BROWSER_OFFLINE'));
        return state.health;
      }

      if (overallHealthStatus) {
        overallHealthStatus.dataset.status = 'checking';
        overallHealthStatus.textContent = healthText('checking');
      }

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = controller ? setTimeout(() => controller.abort(), 7000) : null;
      try {
        const response = await fetch(READINESS_URL, {
          method:'GET',
          headers:{ Accept:'application/json' },
          cache:'no-store',
          signal:controller?.signal
        });
        const payload = await response.json().catch(() => null);
        return renderServiceHealth(payload, response.ok ? null : new Error(payload?.status || 'READINESS_FAILED'));
      } catch (error) {
        return renderServiceHealth(null, error);
      } finally {
        if (timer) clearTimeout(timer);
      }
    }

    function setViewMode(mode, { persist = true } = {}) {
      const safeMode = ['standard', 'workspace', 'fullscreen', 'collapsed'].includes(mode)
        ? mode
        : 'standard';

      if (safeMode === 'collapsed') {
        if (state.viewMode !== 'collapsed') state.previousViewMode = state.viewMode || 'standard';
      } else {
        state.previousViewMode = safeMode;
      }

      state.viewMode = safeMode;
      if (safeMode === 'standard') {
        applyStandardLayout(standardLayout);
      } else {
        clearStandardLayoutStyles();
      }
      ['standard', 'workspace', 'fullscreen', 'collapsed'].forEach(item => {
        windowEl.classList.toggle('view-' + item, item === safeMode);
      });
      windowEl.dataset.viewMode = safeMode;

      viewButtons.forEach(button => {
        button.setAttribute(
          'aria-pressed',
          button.dataset.assistantView === safeMode ? 'true' : 'false'
        );
      });

      if (persist && safeMode !== 'collapsed') {
        try {
          window.sessionStorage?.setItem('bonds.assistant.view-mode.v1', safeMode);
        } catch (_) {
          // View persistence is best-effort only.
        }
      }

      return safeMode;
    }

    setViewMode(state.viewMode, { persist: false });

    chatHeader.addEventListener('pointerdown', event => {
      if (event.target.closest('.bonds-ai-chat-header-controls, button, a, input')) return;
      beginLayoutInteraction('move', null, event);
    });
    resizeHandles.forEach(handle => {
      handle.addEventListener('pointerdown', event => {
        event.stopPropagation();
        beginLayoutInteraction('resize', handle.dataset.resizeEdge, event);
      });
    });
    window.addEventListener('pointermove', updateLayoutInteraction);
    window.addEventListener('pointerup', finishLayoutInteraction);
    window.addEventListener('pointercancel', finishLayoutInteraction);
    window.addEventListener('resize', () => {
      if (state.viewMode !== 'standard' || (Number(window.innerWidth) || 0) <= 640) return;
      standardLayout = normalizeAssistantLayout(standardLayout);
      applyStandardLayout(standardLayout, { persist:true });
    });
    layoutResetBtn.addEventListener('click', event => {
      event.stopPropagation();
      resetAssistantLayout();
      if (state.viewMode !== 'standard') setViewMode('standard');
      input.focus();
    });

    voiceBtn.hidden = !voiceInputSupported();
    voiceBtn.disabled = !voiceInputSupported();
    voiceBtn.setAttribute('aria-pressed', 'false');

    function getCityName() {
      const citySelect = document.getElementById('citySelect');
      return citySelect ? citySelect.options[citySelect.selectedIndex]?.text : null;
    }

    function getActivityName() {
      const activitySelect = document.getElementById('activitySelect');
      return activitySelect ? activitySelect.options[activitySelect.selectedIndex]?.text : null;
    }

    let loadedServiceProfileCode = null;

    function compactServiceProfile(data) {
      const service = data?.service || {};
      return {
        serviceCode: service.code || context.serviceCode || null,
        serviceName: service.name_ar || service.name_en || context.serviceName || null,
        serviceNameEn: service.name_en || service.name_ar || null,
        serviceDeliveryType: service.delivery_type || null,
        serviceCapabilities: Array.isArray(data?.capabilities)
          ? data.capabilities.map(row => row.capability_code).filter(Boolean).slice(0, 50)
          : [],
        serviceRequirements: Array.isArray(data?.requirements)
          ? data.requirements.map(row => ({
              type: row.requirement_type || null,
              label: row.label_ar || row.label_en || null,
              required: row.is_required === true
            })).filter(row => row.label).slice(0, 50)
          : [],
        serviceDeliverables: Array.isArray(data?.deliverables)
          ? data.deliverables.map(row => row.name_ar || row.name_en || row.code).filter(Boolean).slice(0, 30)
          : [],
        serviceDependencies: Array.isArray(data?.dependencies)
          ? data.dependencies.map(row => row?.service?.code).filter(Boolean).slice(0, 30)
          : []
      };
    }

    function routeIdentity(route) {
      try {
        const url = new URL(route || '/', window.location.origin);
        return url.pathname + (url.hash || '');
      } catch (_) {
        return String(route || '').trim();
      }
    }

    async function resolveServiceContextFromPage() {
      if (context.serviceCode) return;
      try {
        const res = await fetch(SERVICE_CATALOG_API, {
          headers: await getAuthHeaders(),
          credentials: 'same-origin',
          cache: 'no-store'
        });
        if (!res.ok) return;
        const data = await res.json();
        const current = routeIdentity(window.location.pathname + window.location.hash);
        const service = (data.services || []).find(row =>
          [row.default_route_ar, row.default_route_en]
            .filter(Boolean)
            .some(route => routeIdentity(route) === current)
        );
        if (!service) return;
        updateContext({
          serviceCode: service.code || null,
          serviceName: service.name_ar || service.name_en || service.code || null,
          serviceNameEn: service.name_en || service.name_ar || null
        });
      } catch (err) {
        console.warn('[BondsAssistantPageServiceResolution]', err);
      }
    }

    async function loadVerifiedServiceProfile() {
      await resolveServiceContextFromPage();
      const serviceCode = String(context.serviceCode || '').trim();
      if (!serviceCode || loadedServiceProfileCode === serviceCode) return;
      const params = new URLSearchParams();
      if (context.countryCode) params.set('country', context.countryCode);
      if (context.sectorCode) params.set('sector', context.sectorCode);
      if (context.activityCode) params.set('activity', context.activityCode);
      const suffix = params.toString() ? '?' + params.toString() : '';
      try {
        const res = await fetch(SERVICE_DETAIL_API + encodeURIComponent(serviceCode) + suffix, {
          headers: await getAuthHeaders(),
          credentials: 'same-origin',
          cache: 'no-store'
        });
        if (!res.ok) return;
        const data = await res.json();
        updateContext(compactServiceProfile(data));
        loadedServiceProfileCode = serviceCode;
      } catch (err) {
        console.warn('[BondsAssistantServiceContext]', err);
      }
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
      context.pagePath = (window.location.pathname + window.location.hash) || context.pagePath || '/';
      context.pageTitle = document.title || context.pageTitle || null;
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

    async function toggleOpen() {
      state.isOpen = !state.isOpen;
      windowEl.classList.toggle('open', state.isOpen);
      root.classList.toggle('assistant-open', state.isOpen);

      if (state.isOpen && state.messages.length === 0) {
        root.classList.remove('conversation-started');
        refreshContext();
        await loadVerifiedServiceProfile();
        await resumePersistentCaseState();

        if (context.mode === 'project' && context.projectId) {
          root.classList.add('conversation-started');
          addAssistantMessage('مرحباً! أنا مستشار بوندز التنفيذي. أسألني عن مشروعك: أين وصلنا؟ ما الذي ينقص؟ ما الخطوة التالية؟');
          renderSuggestions();
        } else if (context.serviceCode) {
          root.classList.add('conversation-started');
          const service = context.serviceName || context.serviceCode;
          addAssistantMessage(`مرحباً! أنا مساعد بوندز. أنت الآن ضمن خدمة "${service}". أستطيع مساعدتك في المتطلبات، البيانات والمستندات المطلوبة، القدرات المتاحة، والخطوة التالية.`);
          renderSuggestions();
        }
      }

      if (state.isOpen) {
        refreshServiceHealth();
        if (state.viewMode === 'collapsed') {
          setViewMode(state.previousViewMode || 'standard', { persist: false });
        }
        refreshNotifications();
        input.focus();
      } else {
        stopRecognition();
        stopSpeaking();
        setVoiceStatus('idle');
      }
    }

    function appendSafeInlineMarkdown(container, text) {
      const value = String(text || '');
      const tokenPattern = /(\*\*[^*]+\*\*|\`[^\`]+\`)/g;
      let cursor = 0;
      let match;
      while ((match = tokenPattern.exec(value)) !== null) {
        if (match.index > cursor) {
          container.appendChild(document.createTextNode(value.slice(cursor, match.index)));
        }
        const token = match[0];
        if (token.startsWith('**') && token.endsWith('**')) {
          const strong = document.createElement('strong');
          strong.textContent = token.slice(2, -2);
          container.appendChild(strong);
        } else if (token.startsWith('`') && token.endsWith('`')) {
          const code = document.createElement('code');
          code.textContent = token.slice(1, -1);
          container.appendChild(code);
        }
        cursor = match.index + token.length;
      }
      if (cursor < value.length) {
        container.appendChild(document.createTextNode(value.slice(cursor)));
      }
    }

    function renderSafeMarkdown(container, text) {
      const lines = String(text || '').split(/\r?\n/);
      lines.forEach((rawLine, index) => {
        const line = document.createElement('span');
        line.className = 'bonds-ai-markdown-line';
        let content = rawLine;
        if (/^#{1,6}\s+/.test(content)) {
          content = content.replace(/^#{1,6}\s+/, '');
          const strong = document.createElement('strong');
          appendSafeInlineMarkdown(strong, content);
          line.appendChild(strong);
        } else if (/^[-*•]\s+/.test(content)) {
          line.appendChild(document.createTextNode('• '));
          appendSafeInlineMarkdown(line, content.replace(/^[-*•]\s+/, ''));
        } else {
          appendSafeInlineMarkdown(line, content);
        }
        container.appendChild(line);
        if (index === lines.length - 1 && rawLine === '') line.remove();
      });
    }

    function createMessageTrackingId(prefix) {
      const safePrefix = String(prefix || 'msg').replace(/[^a-z0-9_-]/gi, '').slice(0, 20) || 'msg';
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return safePrefix + '-' + window.crypto.randomUUID();
      }
      return safePrefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
    }

    function formatMessageTimestamp(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const locale = languageCode() === 'en' ? 'en-GB' : 'ar-SA-u-ca-gregory';
      try {
        return new Intl.DateTimeFormat(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        }).format(date);
      } catch (err) {
        return date.toLocaleString();
      }
    }

    function messageStatusLabel(message) {
      if (!message || message.role !== 'user') return '';
      const english = languageCode() === 'en';
      if (message.status === 'sending') return english ? 'Sending' : 'قيد الإرسال';
      if (message.status === 'failed') return english ? 'Failed' : 'تعذر الإرسال';
      return english ? 'Sent' : 'تم الإرسال';
    }

    function renderMessageMeta(msgEl, message) {
      if (!msgEl || !message) return;
      let meta = msgEl.querySelector('.bonds-ai-message-meta');
      if (!meta) {
        meta = document.createElement('small');
        meta.className = 'bonds-ai-message-meta';
        msgEl.appendChild(meta);
      }
      meta.dataset.status = message.status || 'sent';
      const timestamp = formatMessageTimestamp(message.created_at);
      const status = messageStatusLabel(message);
      meta.textContent = [timestamp, status].filter(Boolean).join(' · ');
    }

    function updateMessageTracking(messageId, patch = {}) {
      const message = state.messages.find(item => item?.message_id === messageId);
      if (!message) return null;
      Object.assign(message, patch);
      const msgEl = Array.from(messagesEl.querySelectorAll('.bonds-ai-message'))
        .find(element => element.dataset.messageId === messageId);
      if (msgEl) {
        msgEl.dataset.status = message.status || 'sent';
        renderMessageMeta(msgEl, message);
      }
      return message;
    }

    function addMessage(role, text, isError = false, metadata = {}) {
      const message = {
        role,
        content: text,
        message_id: metadata.message_id || createMessageTrackingId('msg'),
        turn_id: metadata.turn_id || createMessageTrackingId('turn'),
        created_at: metadata.created_at || new Date().toISOString(),
        status: metadata.status || (isError ? 'failed' : 'sent'),
        source: metadata.source || (role === 'assistant' ? 'assistant-ui' : 'user-input'),
        reply_to_message_id: metadata.reply_to_message_id || null
      };
      state.messages.push(message);
      const msgEl = document.createElement('div');
      msgEl.className = `bonds-ai-message ${role}${isError ? ' error' : ''}`;
      msgEl.dataset.messageId = message.message_id;
      msgEl.dataset.turnId = message.turn_id;
      msgEl.dataset.status = message.status;
      if (role === 'assistant') {
        renderSafeMarkdown(msgEl, text);
        if (!isError && speechOutputSupported()) {
          const speakBtn = document.createElement('button');
          speakBtn.type = 'button';
          speakBtn.className = 'bonds-ai-speak-button';
          speakBtn.setAttribute('aria-label', languageCode() === 'en' ? 'Read response aloud' : 'قراءة الرد صوتيًا');
          speakBtn.setAttribute('aria-pressed', 'false');
          speakBtn.title = languageCode() === 'en' ? 'Read aloud' : 'قراءة صوتية';
          speakBtn.textContent = '◖';
          speakBtn.addEventListener('click', () => speakAssistantText(text, speakBtn));
          msgEl.appendChild(speakBtn);
        }
      } else {
        msgEl.textContent = text;
      }
      renderMessageMeta(msgEl, message);
      messagesEl.appendChild(msgEl);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return message;
    }

    function addAssistantMessage(text, isError, metadata = {}) {
      return addMessage('assistant', text, isError, metadata);
    }

    function authenticationLoginHref() {
      const returnPath = window.location.pathname + window.location.search + window.location.hash;
      const base = languageCode() === 'en' ? '/en/calculators/auth/' : '/calculators/auth/';
      return base + '?redirect=' + encodeURIComponent(returnPath);
    }

    function addAuthenticationRequiredMessage(metadata = {}) {
      const text = languageCode() === 'en'
        ? 'You need to sign in to use BONDS Assistant.'
        : 'يلزم تسجيل الدخول لاستخدام مساعد بوندز.';
      addAssistantMessage(text, false, { source: 'authentication', ...metadata });
      const message = messagesEl.lastElementChild;
      if (!message) return;
      const link = document.createElement('a');
      link.className = 'bonds-ai-login-link';
      link.href = authenticationLoginHref();
      link.textContent = languageCode() === 'en' ? 'Sign in' : 'تسجيل الدخول';
      message.appendChild(link);
    }

    function addUserMessage(text, metadata = {}) {
      return addMessage('user', text, false, metadata);
    }

    function setLoading(loading) {
      state.isLoading = loading;
      sendBtn.disabled = loading;
      input.disabled = loading;
      voiceBtn.disabled = loading || !voiceInputSupported();
      attachBtn.disabled = loading || state.isUploading;
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

    function formatAttachmentBytes(bytes) {
      const value = Number(bytes) || 0;
      if (value >= 1024 * 1024) return (value / (1024 * 1024)).toFixed(1) + ' MB';
      if (value >= 1024) return Math.round(value / 1024) + ' KB';
      return value + ' B';
    }

    function renderAttachments() {
      attachmentsEl.innerHTML = '';
      state.attachments.forEach(item => {
        const card = document.createElement('div');
        card.className = 'bonds-ai-attachment' + (item.error ? ' error' : '');
        const name = document.createElement('strong');
        name.textContent = item.filename || item.name || 'file';
        const meta = document.createElement('small');
        const status = item.error
          ? (languageCode() === 'en' ? 'Blocked or scan failed' : 'موقوف أو فشل الفحص')
          : item.uploading
            ? (languageCode() === 'en' ? 'Uploading to quarantine…' : 'جارٍ الرفع إلى الحجر…')
            : item.security_status === 'quarantined' || item.security_status === 'scanning'
              ? (languageCode() === 'en' ? 'Security scan pending' : 'بانتظار الفحص الأمني')
              : item.security_verdict === 'suspicious'
                ? (languageCode() === 'en' ? 'Suspicious · blocked' : 'مشبوه · موقوف')
                : item.security_verdict === 'malicious'
                  ? (languageCode() === 'en' ? 'Malicious · blocked' : 'خبيث · موقوف')
                  : item.status === 'analyzed'
                    ? (item.extracted?.method === 'vision-required'
                        ? (languageCode() === 'en' ? 'Clean · Vision required' : 'نظيف · يحتاج محرك الرؤية')
                        : (languageCode() === 'en' ? 'Clean · Ready for assistant' : 'نظيف · جاهز للمساعد'))
                    : item.security_verdict === 'clean'
                      ? (languageCode() === 'en' ? 'Security scan passed' : 'اجتاز الفحص الأمني')
                      : (languageCode() === 'en' ? 'Quarantined' : 'في الحجر');
        meta.textContent = status + (item.size_bytes ? ' · ' + formatAttachmentBytes(item.size_bytes) : '');
        card.append(name, meta);
        attachmentsEl.appendChild(card);
      });
      attachmentsEl.classList.toggle('visible', state.attachments.length > 0);
      context.attachments = state.attachments
        .filter(item => item.document_id && !item.error)
        .slice(-8)
        .map(item => ({
          document_id:item.document_id,
          filename:item.filename,
          mime_type:item.mime_type,
          size_bytes:item.size_bytes,
          status:item.status,
          extracted:item.extracted || null,
          assistant_analysis:item.assistant_analysis || null
        }));
    }

    async function executeAttachmentCapability(action, inputValue) {
      if (!window.BondsAuth || typeof window.BondsAuth.authenticatedFetch !== 'function') {
        throw new Error('AUTH_RUNTIME_UNAVAILABLE');
      }
      const response = await window.BondsAuth.authenticatedFetch(CAPABILITY_EXECUTE_URL, {
        method:'POST',
        redirectOnAuth:false,
        headers:{ 'Content-Type':'application/json' },
        body:JSON.stringify({ action, input:inputValue })
      });
      const data = await response.json();
      if (!response.ok || data?.ok === false) {
        throw new Error(data?.error?.code || data?.error || 'CAPABILITY_EXECUTION_FAILED');
      }
      return data.result;
    }

    async function ensureAttachmentClient(sb, user) {
      const { data:clientId, error:rpcError } = await sb.rpc('get_my_client_id');
      if (rpcError) throw new Error('CLIENT_LOOKUP_FAILED');
      if (clientId) return clientId;

      const displayName = String(
        user?.user_metadata?.full_name ||
        user?.user_metadata?.name ||
        user?.email ||
        'BONDS Client'
      ).slice(0, 200);
      const { data:created, error:createError } = await sb
        .from('advisory_clients')
        .insert({
          auth_user_id:user.id,
          name:displayName,
          email:user.email || null,
          status:'active'
        })
        .select('id')
        .single();
      if (createError || !created?.id) throw new Error('CLIENT_CREATE_FAILED');
      return created.id;
    }

    function safeStorageExtension(name) {
      const match = String(name || '').toLowerCase().match(/\.([a-z0-9]{1,10})$/);
      return match ? '.' + match[1] : '';
    }

    async function uploadOneAttachment(file) {
      const placeholder = {
        name:file.name,
        filename:file.name,
        mime_type:file.type || 'application/octet-stream',
        size_bytes:file.size,
        uploading:true
      };
      state.attachments.push(placeholder);
      renderAttachments();

      let sb = null;
      let storagePath = null;
      let metadataCreated = false;
      try {
        const classification = await executeAttachmentCapability('media_classify', {
          name:file.name,
          size:file.size,
          type:file.type || 'application/octet-stream'
        });
        if (!classification?.valid) throw new Error(classification?.code || 'UNSUPPORTED_FILE_TYPE');

        await window.BondsAuth.ensureEnv();
        const userResult = await window.BondsAuth.getUser();
        const user = userResult?.data?.user;
        if (!user) throw new Error('AUTH_REQUIRED');
        sb = window.BondsAuth.getSupabase();
        if (!sb) throw new Error('STORAGE_RUNTIME_UNAVAILABLE');

        const clientId = await ensureAttachmentClient(sb, user);
        const token = window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : (Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
        storagePath = user.id + '/' + token + safeStorageExtension(file.name);

        const { error:uploadError } = await sb.storage
          .from(CLIENT_DOCUMENTS_QUARANTINE_BUCKET)
          .upload(storagePath, file, {
            contentType:file.type || 'application/octet-stream',
            cacheControl:'3600',
            upsert:false
          });
        if (uploadError) throw new Error('FILE_UPLOAD_FAILED');

        const { data:documentRow, error:insertError } = await sb
          .from('client_documents')
          .insert({
            client_id:clientId,
            project_id:context.projectId || null,
            filename:String(file.name || 'file').slice(0, 255),
            storage_path:storagePath,
            mime_type:file.type || 'application/octet-stream',
            size_bytes:file.size
          })
          .select('id,filename,mime_type,size_bytes,status,security_status,security_verdict')
          .single();
        if (insertError || !documentRow?.id) throw new Error('DOCUMENT_METADATA_FAILED');
        metadataCreated = true;

        const security = await executeAttachmentCapability('file_security_scan', {
          document_id:documentRow.id
        });
        Object.assign(placeholder, documentRow, security || {}, { uploading:false, error:false });

        if (security?.verdict !== 'clean' || security?.security_status !== 'clean') {
          placeholder.error = true;
          placeholder.error_code = security?.verdict === 'malicious'
            ? 'FILE_REJECTED_MALICIOUS'
            : security?.verdict === 'suspicious'
              ? 'FILE_REJECTED_SUSPICIOUS'
              : 'FILE_SECURITY_NOT_APPROVED';
          renderAttachments();
          return placeholder;
        }

        const analyzed = await executeAttachmentCapability('document_analyze', {
          document_id:documentRow.id
        });
        Object.assign(placeholder, analyzed || documentRow, security || {}, { uploading:false, error:false });
        renderAttachments();
        root.classList.add('conversation-started');
        if (window.innerWidth > 640 && state.viewMode === 'standard') setViewMode('workspace');
        return placeholder;
      } catch (error) {
        if (sb && storagePath && !metadataCreated) {
          try { await sb.storage.from(CLIENT_DOCUMENTS_QUARANTINE_BUCKET).remove([storagePath]); } catch (_) {}
        }
        placeholder.uploading = false;
        placeholder.error = true;
        placeholder.error_code = String(error?.message || 'ATTACHMENT_FAILED');
        renderAttachments();
        if (placeholder.error_code === 'AUTH_REQUIRED') addAuthenticationRequiredMessage();
        return placeholder;
      }
    }

    async function handleAttachmentFiles(fileList) {
      const files = Array.from(fileList || []).filter(Boolean);
      if (!files.length || state.isUploading) return;
      if (files.length > MAX_ATTACHMENT_BATCH_FILES) {
        addAssistantMessage(languageCode() === 'en'
          ? 'You can upload up to 10 files at a time.'
          : 'يمكن رفع 10 ملفات كحد أقصى في الدفعة الواحدة.', true);
        return;
      }
      const totalBytes = files.reduce((sum, file) => sum + (Number(file.size) || 0), 0);
      if (totalBytes > MAX_ATTACHMENT_BATCH_BYTES) {
        addAssistantMessage(languageCode() === 'en'
          ? 'The selected batch is larger than 25 MB.'
          : 'الحجم الإجمالي للدفعة يتجاوز 25 MB.', true);
        return;
      }
      if (files.some(file => Number(file.size) > MAX_ATTACHMENT_BYTES)) {
        addAssistantMessage(languageCode() === 'en'
          ? 'Each file must currently be 10 MB or smaller.'
          : 'الحد الحالي لكل ملف هو 10 MB.', true);
        return;
      }

      state.isUploading = true;
      attachBtn.classList.add('uploading');
      attachBtn.disabled = true;
      try {
        for (const file of files) await uploadOneAttachment(file);
      } finally {
        state.isUploading = false;
        attachBtn.classList.remove('uploading');
        attachBtn.disabled = state.isLoading;
        fileInput.value = '';
      }
    }

    function languageCode() {
      return document.documentElement.lang === 'en' ? 'en' : 'ar';
    }

    const ARABIC_SPEECH_LOCALES = Object.freeze({
      DZ: 'ar-DZ', BH: 'ar-BH', KM: 'ar-KM', DJ: 'ar-DJ', EG: 'ar-EG', IQ: 'ar-IQ',
      JO: 'ar-JO', KW: 'ar-KW', LB: 'ar-LB', LY: 'ar-LY', MR: 'ar-MR', MA: 'ar-MA',
      OM: 'ar-OM', PS: 'ar-PS', QA: 'ar-QA', SA: 'ar-SA', SO: 'ar-SO', SD: 'ar-SD',
      SY: 'ar-SY', TN: 'ar-TN', AE: 'ar-AE', YE: 'ar-YE'
    });

    function speechLocale() {
      if (languageCode() === 'en') return 'en-US';
      const country = String(context.countryCode || '').trim().toUpperCase();
      return ARABIC_SPEECH_LOCALES[country] || 'ar';
    }

    function setVoiceStatus(nextState, message = '') {
      state.voiceState = nextState;
      const listening = nextState === 'listening';
      voiceBtn.classList.toggle('listening', listening);
      voiceBtn.setAttribute('aria-pressed', listening ? 'true' : 'false');
      voiceBtn.setAttribute(
        'aria-label',
        listening
          ? (languageCode() === 'en' ? 'Stop listening' : 'إيقاف الاستماع')
          : (languageCode() === 'en' ? 'Speak to BONDS Assistant' : 'التحدث إلى مساعد بوندز')
      );
      voiceStatus.textContent = message;
      voiceStatus.classList.toggle('visible', Boolean(message));
    }

    function stopRecognition() {
      const recognition = state.recognition;
      state.recognition = null;
      if (recognition) {
        try { recognition.stop(); } catch (_) {}
      }
      if (state.voiceState === 'listening') setVoiceStatus('idle');
    }

    function stopSpeaking() {
      if (window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (_) {}
      }
      state.activeUtterance = null;
      root.querySelectorAll('.bonds-ai-speak-button.speaking').forEach(button => {
        button.classList.remove('speaking');
        button.setAttribute('aria-pressed', 'false');
      });
      if (state.voiceState === 'speaking') setVoiceStatus('idle');
    }

    function speechRecognitionConstructor() {
      return window.SpeechRecognition || window.webkitSpeechRecognition || null;
    }

    function voiceInputSupported() {
      return typeof speechRecognitionConstructor() === 'function';
    }

    function speechOutputSupported() {
      return typeof window.SpeechSynthesisUtterance === 'function' && Boolean(window.speechSynthesis);
    }

    function createRecognition() {
      const Recognition = speechRecognitionConstructor();
      if (!Recognition) return null;
      const recognition = new Recognition();
      recognition.lang = speechLocale();
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;
      return recognition;
    }

    function startRecognition() {
      if (!voiceInputSupported() || state.isLoading) return;
      stopSpeaking();
      if (state.voiceState === 'listening') {
        stopRecognition();
        return;
      }

      const recognition = createRecognition();
      if (!recognition) return;
      state.recognition = recognition;
      let finalTranscript = '';

      recognition.onstart = () => {
        setVoiceStatus(
          'listening',
          languageCode() === 'en' ? 'Listening… speak now.' : 'أستمع الآن… تحدث.'
        );
      };

      recognition.onresult = event => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = String(event.results[i][0]?.transcript || '').trim();
          if (!transcript) continue;
          if (event.results[i].isFinal) {
            finalTranscript = [finalTranscript, transcript].filter(Boolean).join(' ').trim();
          } else {
            interim = [interim, transcript].filter(Boolean).join(' ').trim();
          }
        }
        const transcript = [finalTranscript, interim].filter(Boolean).join(' ').trim();
        if (transcript) input.value = transcript;
      };

      recognition.onerror = event => {
        const code = String(event?.error || '');
        const denied = code === 'not-allowed' || code === 'service-not-allowed';
        setVoiceStatus(
          'idle',
          denied
            ? (languageCode() === 'en'
                ? 'Microphone permission is unavailable. You can continue by typing.'
                : 'تعذر استخدام الميكروفون. يمكنك متابعة المحادثة بالكتابة.')
            : (languageCode() === 'en'
                ? 'Voice input stopped. You can try again or continue by typing.'
                : 'توقف الإدخال الصوتي. يمكنك المحاولة مجددًا أو المتابعة بالكتابة.')
        );
      };

      recognition.onend = () => {
        if (state.recognition === recognition) state.recognition = null;
        if (state.voiceState === 'listening') {
          setVoiceStatus(
            'idle',
            input.value.trim()
              ? (languageCode() === 'en' ? 'Voice captured. Review it, then send.' : 'تم التقاط الكلام. راجعه ثم أرسله.')
              : ''
          );
        }
        input.focus();
      };

      try {
        recognition.start();
      } catch (_) {
        state.recognition = null;
        setVoiceStatus(
          'idle',
          languageCode() === 'en'
            ? 'Voice input could not start. You can continue by typing.'
            : 'تعذر بدء الإدخال الصوتي. يمكنك متابعة المحادثة بالكتابة.'
        );
      }
    }

    function selectSpeechVoice(locale) {
      if (!window.speechSynthesis) return null;
      const voices = window.speechSynthesis.getVoices?.() || [];
      if (!voices.length) return null;
      const exact = voices.find(voice => String(voice.lang || '').toLowerCase() === locale.toLowerCase());
      if (exact) return exact;
      const base = locale.split('-')[0].toLowerCase();
      return voices.find(voice => String(voice.lang || '').toLowerCase().startsWith(base)) || null;
    }

    function speakAssistantText(text, button) {
      const value = String(text || '').trim();
      if (!value || !speechOutputSupported()) return;

      if (button.classList.contains('speaking')) {
        stopSpeaking();
        return;
      }

      stopRecognition();
      stopSpeaking();

      const utterance = new window.SpeechSynthesisUtterance(value);
      const locale = speechLocale();
      utterance.lang = locale;
      const voice = selectSpeechVoice(locale);
      if (voice) utterance.voice = voice;
      utterance.rate = 1;
      utterance.pitch = 1;

      const finish = () => {
        if (state.activeUtterance === utterance) state.activeUtterance = null;
        button.classList.remove('speaking');
        button.setAttribute('aria-pressed', 'false');
        if (state.voiceState === 'speaking') setVoiceStatus('idle');
      };

      utterance.onend = finish;
      utterance.onerror = finish;
      state.activeUtterance = utterance;
      button.classList.add('speaking');
      button.setAttribute('aria-pressed', 'true');
      setVoiceStatus(
        'speaking',
        languageCode() === 'en' ? 'Reading the response aloud…' : 'جارٍ قراءة الرد صوتيًا…'
      );
      window.speechSynthesis.speak(utterance);
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
          const link = document.createElement('a');
          link.href = route;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          link.remove();
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

    function renderStructuredCards(cards = []) {
      cards
        .filter(card => card && typeof card === 'object')
        .forEach(card => {
          const el = document.createElement('div');
          el.className = 'bonds-ai-action-card bonds-ai-structured-card';
          el.dataset.messageType = String(card.type || 'result_card');

          const title = document.createElement('strong');
          title.textContent = String(card.title || card.type || 'Result');
          el.appendChild(title);

          if (card.body) {
            const body = document.createElement('small');
            renderSafeMarkdown(body, String(card.body));
            el.appendChild(body);
          }

          if (Array.isArray(card.items)) {
            card.items.slice(0, 25).forEach(item => {
              const row = document.createElement('small');
              row.textContent = `• ${String(item)}`;
              el.appendChild(row);
            });
          }

          actionsEl.appendChild(el);
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

      const uiCards = Array.isArray(envelope.ui) ? envelope.ui : [];
      renderActionCards(actions);
      renderStructuredCards(uiCards);

      if (
        window.innerWidth > 640 &&
        state.isOpen &&
        state.viewMode === 'standard' &&
        (actions.length > 0 || uiCards.length > 0)
      ) {
        setViewMode('workspace');
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

      if (context.serviceCode) {
        const service = context.serviceName || context.serviceCode;
        const defaults = [
          `ما متطلبات خدمة ${service}؟`,
          'ما البيانات أو المستندات الناقصة؟',
          'ما القدرات والأدوات المتاحة لهذه الخدمة؟',
          'ما الخطوة التالية؟'
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

    function setStreamingStatus(phase) {
      const typing = root.querySelector('.bonds-ai-typing');
      if (!typing) return;
      const en = languageCode() === 'en';
      const labels = {
        preparing: en ? 'Preparing…' : 'جارٍ التجهيز…',
        inference: en ? 'Generating…' : 'جارٍ التوليد…'
      };
      typing.textContent = labels[phase] || (en ? 'Working…' : 'جارٍ العمل…');
    }

    async function readAssistantEventStream(response) {
      if (!response.body || typeof response.body.getReader !== 'function') {
        throw new Error('STREAM_BODY_UNAVAILABLE');
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let finalPayload = null;

      const consumeBlock = block => {
        const lines = String(block || '').split(/\r?\n/);
        let event = 'message';
        const dataLines = [];
        for (const line of lines) {
          if (line.startsWith('event:')) event = line.slice(6).trim();
          if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
        }
        if (!dataLines.length) return;
        let data;
        try { data = JSON.parse(dataLines.join('\n')); }
        catch (_) { throw new Error('INVALID_STREAM_EVENT'); }

        if (event === 'status') {
          setStreamingStatus(data?.phase);
          return;
        }
        if (event === 'error') {
          throw new Error(data?.error || 'Streaming request failed');
        }
        if (event === 'final') {
          finalPayload = data;
        }
      };

      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        let boundary;
        while ((boundary = buffer.indexOf('\n\n')) !== -1) {
          const block = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          if (block.trim()) consumeBlock(block);
        }
        if (done) break;
      }
      if (buffer.trim()) consumeBlock(buffer);
      if (!finalPayload) throw new Error('STREAM_FINAL_EVENT_MISSING');
      return finalPayload;
    }

    async function sendMessage(text) {
      if (!text.trim() || state.isLoading) return;
      refreshContext();
      await loadVerifiedServiceProfile();
      await resumePersistentCaseState();
      root.classList.add('conversation-started');
      const turnId = createMessageTrackingId('turn');
      const userMessage = addUserMessage(text, {
        turn_id: turnId,
        status: 'sending',
        source: 'user-input'
      });
      setLoading(true);
      input.value = '';

      const isProjectMode = context.mode === 'project' && context.projectId;
      const url = isProjectMode ? ECC_ADVISOR_URL : API_URL;
      const structuredState = assistantContextEnabled()
        ? sanitizeAssistantContextState(assistantContextState, contextBoundaryKey())
        : null;
      const apiHistory = state.messages
        .filter(message => message.role === 'user' || message.role === 'assistant')
        .slice(-10)
        .map(message => ({ role: message.role, content: message.content }));
      const payload = isProjectMode
        ? {
            projectId: context.projectId,
            message: text,
            history: apiHistory,
            assistantState: structuredState
          }
        : {
            messages: apiHistory,
            context,
            assistantState: structuredState,
            options: { stream: true }
          };

      let responseDiagnostics = null;
      const clientStartedAt = Date.now();
      let fetchStartedAt = null;
      let responseReceivedAt = null;
      let parseStartedAt = null;
      let parseCompletedAt = null;
      try {
        const headers = await getAuthHeaders();
        if (!isProjectMode) headers.Accept = 'text/event-stream';
        fetchStartedAt = Date.now();
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload)
        });
        responseReceivedAt = Date.now();

        const contentType = String(res.headers.get('content-type') || '').toLowerCase();
        parseStartedAt = Date.now();
        const data = contentType.includes('text/event-stream')
          ? await readAssistantEventStream(res)
          : await res.json();
        parseCompletedAt = Date.now();
        responseDiagnostics = data?.diagnostics || null;

        if (res.status === 401 && data?.error === 'AUTHENTICATION_REQUIRED') {
          updateMessageTracking(userMessage.message_id, { status: 'failed' });
          addAuthenticationRequiredMessage({
            turn_id: turnId,
            reply_to_message_id: userMessage.message_id
          });
          return;
        }
        if (!res.ok) throw new Error(data.error || 'Request failed');

        updateMessageTracking(userMessage.message_id, { status: 'sent' });
        const uiRenderStartedAt = Date.now();
        addAssistantMessage(data.reply, data.source === 'fallback', {
          turn_id: turnId,
          status: 'sent',
          source: data.source || 'bonds-assistant',
          reply_to_message_id: userMessage.message_id
        });
        const uiRenderCompletedAt = Date.now();
        const latestAssistantMessage = messagesEl?.lastElementChild;
        latestAssistantMessage?.scrollIntoView?.({ block:'nearest', behavior:'smooth' });
        if (responseDiagnostics) {
          const apiRoundtripMs = fetchStartedAt == null || parseCompletedAt == null
            ? null
            : parseCompletedAt - fetchStartedAt;
          const clientParseMs = parseStartedAt == null || parseCompletedAt == null
            ? null
            : parseCompletedAt - parseStartedAt;
          const uiRenderMs = uiRenderCompletedAt - uiRenderStartedAt;
          const endToEndMs = uiRenderCompletedAt - clientStartedAt;
          renderRequestDiagnostics(appendClientDiagnosticStages(responseDiagnostics, [
            { stage:'http_roundtrip', status:'PASS', duration_ms:apiRoundtripMs },
            { stage:'client_parse', status:'PASS', duration_ms:clientParseMs },
            { stage:'ui_render', status:'PASS', duration_ms:uiRenderMs }
          ], {
            api_roundtrip_ms:apiRoundtripMs,
            client_parse_ms:clientParseMs,
            ui_render_ms:uiRenderMs,
            end_to_end_ms:endToEndMs
          }));
        }
        if (assistantContextEnabled() && data.context && typeof data.context === 'object') {
          const statePatch = {};
          if (typeof data.context.lastIntent === 'string') statePatch.last_intent = data.context.lastIntent;
          if (typeof data.context.activeTopic === 'string') statePatch.active_topic = data.context.activeTopic;
          if (typeof data.context.serviceCode === 'string') statePatch.active_service = data.context.serviceCode;
          if (typeof data.context.activeEntity === 'string') statePatch.active_entity = data.context.activeEntity;
          if (typeof data.context.unresolvedQuestion === 'string') statePatch.unresolved_question = data.context.unresolvedQuestion;
          if (Object.keys(statePatch).length) patchAssistantContextState(statePatch);
        }
        if (Array.isArray(data.actions) || Array.isArray(data.ui)) {
          renderStructuredEnvelope(data);
        }
      } catch (err) {
        if (responseDiagnostics) {
          const now = Date.now();
          const apiRoundtripMs = fetchStartedAt == null
            ? null
            : (parseCompletedAt || responseReceivedAt || now) - fetchStartedAt;
          const clientParseMs = parseStartedAt == null || parseCompletedAt == null
            ? null
            : parseCompletedAt - parseStartedAt;
          renderRequestDiagnostics(appendClientDiagnosticStages(responseDiagnostics, [
            { stage:'http_roundtrip', status:responseReceivedAt == null ? 'FAIL' : 'PASS', duration_ms:apiRoundtripMs },
            { stage:'client_parse', status:parseCompletedAt == null ? 'FAIL' : 'PASS', duration_ms:clientParseMs },
            { stage:'ui_render', status:'FAIL' }
          ], {
            api_roundtrip_ms:apiRoundtripMs,
            client_parse_ms:clientParseMs,
            ui_render_ms:null,
            end_to_end_ms:now - clientStartedAt
          }));
        }
        console.error('[BondsAIChat]', err);
        updateMessageTracking(userMessage.message_id, { status: 'failed' });
        addAssistantMessage('عذراً، حدث خطأ أثناء الاتصال بالمساعد. حاول مرة أخرى.', true, {
          turn_id: turnId,
          status: 'failed',
          source: 'assistant-error',
          reply_to_message_id: userMessage.message_id
        });
      } finally {
        setLoading(false);
      }
    }

    if (diagnosticsCopy) {
      diagnosticsCopy.addEventListener('click', async () => {
        const text = diagnosticCopyText(state.diagnostics);
        if (!text) return;
        try {
          await window.navigator.clipboard.writeText(text);
          diagnosticsCopy.textContent = languageCode() === 'en' ? 'Copied' : 'تم النسخ';
          setTimeout(() => { diagnosticsCopy.textContent = 'Copy'; }, 1200);
        } catch (_) {
          diagnosticsCopy.title = text;
        }
      });
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

    viewButtons.forEach(button => {
      button.addEventListener('click', () => {
        const requested = button.dataset.assistantView;
        if (requested === 'collapsed') {
          setViewMode('collapsed', { persist: false });
          return;
        }
        setViewMode(requested);
        input.focus();
      });
    });

    toggle.addEventListener('click', toggleOpen);
    closeBtn.addEventListener('click', toggleOpen);
    attachBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => handleAttachmentFiles(fileInput.files));
    windowEl.addEventListener('dragover', event => {
      event.preventDefault();
      windowEl.classList.add('drag-active');
    });
    windowEl.addEventListener('dragleave', () => windowEl.classList.remove('drag-active'));
    windowEl.addEventListener('drop', event => {
      event.preventDefault();
      windowEl.classList.remove('drag-active');
      handleAttachmentFiles(event.dataTransfer?.files);
    });
    input.addEventListener('paste', event => {
      const files = Array.from(event.clipboardData?.files || []);
      if (files.length) handleAttachmentFiles(files);
    });
    voiceBtn.addEventListener('click', startRecognition);
    sendBtn.addEventListener('click', () => sendMessage(input.value));
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') sendMessage(input.value);
    });
    if (humanEscalationButton) {
      humanEscalationButton.addEventListener('click', () => {
        sendMessage(languageCode() === 'en'
          ? 'I want a human advisor to review this case.'
          : 'أريد مستشاراً بشرياً لمراجعة هذه الحالة.');
      });
    }

    window.BondsAIChat.updateContext = updateContext;
    window.BondsAssistant = window.BondsAssistant || {};
    window.BondsAssistant.execute = executeStructuredAction;
    window.BondsAssistant.renderEnvelope = envelope => renderStructuredEnvelope(envelope, { appendReply: true });
    window.BondsAssistant.getState = () => assistantContextEnabled()
      ? sanitizeAssistantContextState(assistantContextState, contextBoundaryKey())
      : null;
    window.BondsAssistant.updateState = patch => assistantContextEnabled()
      ? patchAssistantContextState(patch)
      : createAssistantContextState(contextBoundaryKey());
    window.BondsAssistant.isContextEnabled = assistantContextEnabled;
    window.BondsAssistant.refreshNotifications = refreshNotifications;
    window.BondsAssistant.resumeCase = resumePersistentCaseState;
    window.BondsAssistant.markNotificationRead = markNotificationRead;
    window.BondsAssistant.resetLayout = resetAssistantLayout;
    window.BondsAssistant.getLayout = () => ({ ...standardLayout });
    window.BondsAssistant.refreshHealth = refreshServiceHealth;
    window.BondsAssistant.getHealth = () => ({ ...state.health });
    window.BondsAssistant.getDiagnostics = () => state.diagnostics ? JSON.parse(JSON.stringify(state.diagnostics)) : null;
    window.BondsAssistant.getAttachments = () => state.attachments.map(item => ({
      document_id:item.document_id || null,
      filename:item.filename || item.name || null,
      mime_type:item.mime_type || null,
      size_bytes:item.size_bytes || null,
      status:item.status || null,
      extracted:item.extracted || null,
      error_code:item.error_code || null
    }));
    window.BondsAssistant.voice = Object.freeze({
      inputSupported: voiceInputSupported(),
      outputSupported: speechOutputSupported(),
      stop: () => {
        stopRecognition();
        stopSpeaking();
        setVoiceStatus('idle');
      }
    });
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
