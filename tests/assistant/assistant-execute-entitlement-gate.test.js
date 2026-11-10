const fs = require('fs');
const path = require('path');

describe('execute-mode entitlement gate remains display-only', () => {
  const widget = fs.readFileSync(path.join(process.cwd(), 'v3/components/ai-chat-widget.js'), 'utf8');
  const aiApi = fs.readFileSync(path.join(process.cwd(), 'v3/api/ai.js'), 'utf8');

  test('execute banner reads existing subscription entitlement without calling checkout APIs', () => {
    expect(widget).toContain("await window.BondsAuth.checkFeatureAccess('pdfExport')");
    expect(widget).toContain("typeof window.BondsAuth.checkFeatureAccess !== 'function'");
    expect(widget).toContain("access.reason === 'not_logged_in'");
    expect(widget).toContain("String(access.status || '') === 'trialing'");
    expect(widget).toContain("en ? '/en/pricing.html' : '/pricing.html'");
    expect(widget).toContain("en ? 'Start 14-day Pro trial' : 'ابدأ تجربة Pro لـ14 يوماً'");
    expect(widget).toContain("en ? 'Pro trial is active.' : 'تجربة Pro سارية.'");
    expect(widget).toContain('class="bonds-ai-execute-entitlement" hidden');
    expect(widget).toContain('void renderExecuteEntitlementBanner();');
    expect(widget).not.toContain('/api/create-checkout');
    expect(widget).not.toContain('/api/v3/billing');
    expect(widget).not.toContain('window.localStorage');
    expect(widget).not.toContain('execution_authorized: true');
  });

  test('sendMessage stays available for authenticated users regardless of entitlement', () => {
    const start = widget.indexOf('async function sendMessage(text) {');
    expect(start).toBeGreaterThan(-1);
    const afterSend = widget.slice(start);
    const end = afterSend.indexOf('\n    if (diagnosticsCopy)');
    expect(end).toBeGreaterThan(-1);
    const sendSource = afterSend.slice(0, end);
    expect(sendSource).toContain('conversation_mode: state.conversationMode');
    expect(sendSource).not.toContain('checkFeatureAccess');
    expect(sendSource).not.toContain('/pricing.html');
    expect(sendSource).not.toContain('renderExecuteEntitlementBanner');
  });

  test('setConversationMode still refreshes suggestions and the execute banner', () => {
    const setMode = widget.match(/function setConversationMode\(mode\) \{[\s\S]*?return state\.conversationMode;\n    \}/)?.[0] || '';
    expect(setMode).toContain('renderSuggestions();');
    expect(setMode).toContain('void renderExecuteEntitlementBanner();');
    expect(setMode).not.toContain('async function setConversationMode');
  });

  test('launchpad contracts and execute protocol stay unchanged', () => {
    const serviceMatches = widget.match(/class="bonds-ai-home-service"/g) || [];
    expect(serviceMatches).toHaveLength(7);
    const promptButtons = widget.match(/<button[^>]*data-assistant-prompt="[^"]*"[^>]*>/g) || [];
    const executePrompts = promptButtons.filter(button => button.includes('data-conversation-mode="execute"'));
    expect(executePrompts).toHaveLength(1);
    expect(widget).toContain('<span>تنفيذ على الموقع</span>');
    expect(aiApi).toContain("const EXECUTE_ALLOWED_ACTION_TYPES = new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft']);");
    expect(aiApi).toContain("return sendJson(res, 401, {");
    expect(aiApi).toContain("error: 'AUTHENTICATION_REQUIRED'");
    expect(aiApi).not.toContain('checkFeatureAccess');
    expect(aiApi).not.toContain('execution_authorized: true');
  });
});
