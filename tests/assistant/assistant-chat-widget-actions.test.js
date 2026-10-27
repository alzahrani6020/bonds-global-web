const fs = require('fs');
const path = require('path');

describe('BONDS Assistant chat widget action renderer', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
    'utf8'
  );

  test('uses the governed assistant planning endpoint for UI actions', () => {
    expect(source).toContain("const ASSISTANT_PLAN_URL = '/api/v3/assistant/plan';");
    expect(source).toContain('async function requestGovernedPlan(action)');
    expect(source).toContain("type: action.type");
    expect(source).toContain("language: languageCode()");
  });

  test('renders structured action cards instead of executable model fields', () => {
    expect(source).toContain('function renderActionCards(actions = [])');
    expect(source).toContain("card.className = 'bonds-ai-action-card'");
    expect(source).toContain('button.addEventListener');
    expect(source).toContain('executeStructuredAction(action, button)');
  });

  test('site navigation is re-planned before browser navigation', () => {
    const executeStart = source.indexOf('async function executeStructuredAction');
    const executeEnd = source.indexOf('function renderActionCards', executeStart);
    const executeSource = source.slice(executeStart, executeEnd);

    expect(executeSource).toContain("if (action.type === 'site_navigate')");
    expect(executeSource).toContain('const plan = await requestGovernedPlan(action);');
    expect(executeSource).toContain("const route = plan?.context?.navigation?.route;");
    expect(executeSource).toContain("if (!safeInternalRoute(route)) throw new Error('UNSAFE_NAVIGATION_ROUTE');");
    expect(executeSource).toContain("link.href = route;");
    expect(executeSource).toContain("link.target = '_blank';");
    expect(executeSource).toContain("link.rel = 'noopener noreferrer';");
    expect(executeSource).not.toContain('window.location.assign(action.');
    expect(executeSource).not.toContain('window.open(action.');
  });

  test('rejects protocol-relative and non-internal navigation routes', () => {
    expect(source).toContain("route.startsWith('/')");
    expect(source).toContain("!route.startsWith('//')");
    expect(source).toContain("!route.includes('\\\\')");
  });

  test('routes confirmation-required actions through the confirmation engine before execution', () => {
    expect(source).toContain('if (action.requires_confirmation)');
    expect(source).toContain('const confirmation = await requestConfirmation(action);');
    expect(source).toContain('renderConfirmationCard(action, confirmation);');
    expect(source).toContain("'confirmed_pending_governance'");
    expect(source).toContain('Sensitive execution still requires the governed execution layer.');
  });

  test('exposes one governed UI action bus', () => {
    expect(source).toContain('window.BondsAssistant.execute = executeStructuredAction;');
    expect(source).toContain('window.BondsAssistant.renderEnvelope');
  });


  test('renders persistent notification inbox through governed assistant endpoints', () => {
    expect(source).toContain("const ASSISTANT_NOTIFICATIONS_URL = '/api/v3/assistant/notifications';");
    expect(source).toContain("const ASSISTANT_NOTIFICATION_READ_URL = '/api/v3/assistant/notifications/read';");
    expect(source).toContain('async function refreshNotifications()');
    expect(source).toContain('async function markNotificationRead(notificationId)');
    expect(source).toContain("notificationBadge.classList.toggle('visible', safeCount > 0)");
    expect(source).toContain('window.BondsAssistant.refreshNotifications = refreshNotifications;');
    expect(source).toContain('window.BondsAssistant.markNotificationRead = markNotificationRead;');
  });

  test('notification actions still use the governed action bus and never direct URLs', () => {
    const start = source.indexOf('function renderNotifications');
    const end = source.indexOf('async function refreshNotifications', start);
    const notificationSource = source.slice(start, end);

    expect(notificationSource).toContain('executeStructuredAction({');
    expect(notificationSource).not.toContain('window.location.assign(notification');
    expect(notificationSource).not.toContain('window.open(notification');
    expect(notificationSource).not.toContain('notification.action.url');
    expect(notificationSource).not.toContain('notification.action.href');
  });

  test('does not add arbitrary URL, selector, script or SQL execution paths', () => {
    expect(source).not.toMatch(/action\.input\.(url|selector|script|javascript|sql)/i);
    expect(source).not.toMatch(/eval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\s*\(/);
  });

  test('tracks every chat message with stable metadata and visible timestamp', () => {
    expect(source).toContain('message_id: metadata.message_id || createMessageTrackingId');
    expect(source).toContain('turn_id: metadata.turn_id || createMessageTrackingId');
    expect(source).toContain("created_at: metadata.created_at || new Date().toISOString()");
    expect(source).toContain("status: metadata.status || (isError ? 'failed' : 'sent')");
    expect(source).toContain("source: metadata.source || (role === 'assistant' ? 'assistant-ui' : 'user-input')");
    expect(source).toContain('reply_to_message_id: metadata.reply_to_message_id || null');
    expect(source).toContain("meta.className = 'bonds-ai-message-meta'");
    expect(source).toContain('formatMessageTimestamp(message.created_at)');
  });

  test('keeps message tracking metadata client-side and preserves the existing API contract', () => {
    expect(source).toContain(".map(message => ({ role: message.role, content: message.content }))");
    expect(source).toContain('messages: apiHistory');
    expect(source).toContain('history: apiHistory');
  });

  test('links each assistant reply to the originating user turn and records send outcome', () => {
    expect(source).toContain("status: 'sending'");
    expect(source).toContain("updateMessageTracking(userMessage.message_id, { status: 'sent' })");
    expect(source).toContain("updateMessageTracking(userMessage.message_id, { status: 'failed' })");
    expect(source).toContain('reply_to_message_id: userMessage.message_id');
    expect(source).toContain("source: data.source || 'bonds-assistant'");
  });

  test('renders a server reply on non-OK chat responses before falling back to the generic connection error', () => {
    const start = source.indexOf('async function sendMessage');
    const end = source.indexOf('if (diagnosticsCopy)', start);
    const sendSource = source.slice(start, end);

    expect(sendSource).toContain("const serverReply = typeof data?.reply === 'string' ? data.reply.trim() : '';");
    expect(sendSource).toContain('if (serverReply)');
    expect(sendSource).toContain('addAssistantMessage(serverReply, true');
    expect(sendSource.indexOf('if (serverReply)')).toBeLessThan(sendSource.indexOf("throw new Error(data.error || 'Request failed')"));
    expect(sendSource).toContain('عذراً، حدث خطأ أثناء الاتصال بالمساعد. حاول مرة أخرى.');
  });

  test('renders live runtime health instead of a fixed connected label', () => {
    expect(source).toContain("const READINESS_URL = '/api/readiness';");
    expect(source).toContain('async function refreshServiceHealth()');
    expect(source).toContain('function renderServiceHealth(payload, error = null)');
    expect(source).toContain('data-health-service="ai"');
    expect(source).toContain('data-health-service="api"');
    expect(source).toContain('data-health-service="token"');
    expect(source).toContain('data-health-service="search"');
    expect(source).toContain('data-health-service="governance"');
    expect(source).toContain('window.BondsAssistant.refreshHealth = refreshServiceHealth;');
    expect(source).toContain('window.BondsAssistant.getHealth = () => ({ ...state.health });');
    expect(source).not.toContain('<span class="bonds-ai-home-status">متصل الآن</span>');
  });

});
