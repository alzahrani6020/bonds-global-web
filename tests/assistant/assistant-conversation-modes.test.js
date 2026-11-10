const fs = require('fs');
const path = require('path');

describe('authenticated assistant conversation modes', () => {
  const aiApi = fs.readFileSync(path.join(process.cwd(), 'v3/api/ai.js'), 'utf8');
  const widget = fs.readFileSync(path.join(process.cwd(), 'v3/components/ai-chat-widget.js'), 'utf8');

  test('invalid conversation modes fall back to financial', () => {
    expect(aiApi).toContain("const CONVERSATION_MODES = new Set(['financial', 'general', 'execute']);");
    expect(aiApi).toContain("return CONVERSATION_MODES.has(mode) ? mode : 'financial';");
  });

  test('guest chat remains authenticated-only with 401', () => {
    expect(aiApi).toContain("return sendJson(res, 401, {");
    expect(aiApi).toContain("error: 'AUTHENTICATION_REQUIRED'");
    expect(aiApi).toContain('requires_authentication: true');
  });

  test('removed service/data reply fallbacks stay removed', () => {
    expect(aiApi).not.toContain('function generateServiceDrivenReply');
    expect(aiApi).not.toContain('function generateDataDrivenReply');
  });

  test('execute mode cannot grant execution authorization and only exposes current structured actions', () => {
    expect(aiApi).toContain("const EXECUTE_ALLOWED_ACTION_TYPES = new Set(['site_navigate', 'form_find', 'form_load', 'form_save_draft']);");
    expect(aiApi).not.toContain("new Set(['navigate', 'form_find', 'form_load', 'draft'])");
    expect(aiApi).toContain("if (key === 'execution_authorized') continue;");
    expect(aiApi).toContain("conversationMode === 'execute'");
    expect(aiApi).not.toContain('execution_authorized: true');
  });

  test('general mode keeps numeric financial calculations on verified calculator paths', () => {
    expect(aiApi).toContain('function looksLikeFinancialCalculationRequest(text)');
    expect(aiApi).toContain("conversationMode === 'general' && looksLikeFinancialCalculationRequest(lastUserText)");
    expect(aiApi).toContain("source: 'bonds-assistant-calculator-required'");
  });

  test('general mode keeps the same auth gate and skips service orchestration without explicit serviceCode', () => {
    const authGate = aiApi.indexOf("error: 'AUTHENTICATION_REQUIRED'");
    const modeGate = aiApi.indexOf("const allowServiceOrchestration = conversationMode !== 'general'");
    expect(authGate).toBeGreaterThan(-1);
    expect(modeGate).toBeGreaterThan(authGate);
    expect(aiApi).toContain("Boolean(String(context?.serviceCode || '').trim())");
  });

  test('home launchpad binds prompts to financial mode and general questions to general mode before action', () => {
    const promptButtons = widget.match(/<button[^>]*data-assistant-prompt="[^"]*"[^>]*>/g) || [];
    expect(promptButtons.length).toBeGreaterThan(0);
    expect(promptButtons.every(button => button.includes('data-conversation-mode="financial"'))).toBe(true);
    expect(widget).toMatch(/<button[^>]*data-assistant-focus="true"[^>]*data-conversation-mode="general"[^>]*>/);

    const promptHandler = widget.match(/homePromptButtons\.forEach[\s\S]*?\n    \}\);/)?.[0] || '';
    expect(promptHandler.indexOf('setConversationMode(')).toBeGreaterThan(-1);
    expect(promptHandler.indexOf('sendMessage(')).toBeGreaterThan(promptHandler.indexOf('setConversationMode('));

    const focusHandler = widget.match(/if \(homeFocusButton\) \{[\s\S]*?\n    \}/)?.[0] || '';
    expect(focusHandler.indexOf('setConversationMode(')).toBeGreaterThan(-1);
    expect(focusHandler.indexOf('input.focus(')).toBeGreaterThan(focusHandler.indexOf('setConversationMode('));
  });

  test('shared widget persists and sends the selected mode with English labels available', () => {
    expect(widget).toContain("const CONVERSATION_MODE_STORAGE_KEY = 'bonds_assistant_conversation_mode';");
    expect(widget).toContain('conversation_mode: state.conversationMode');
    expect(widget).toContain('data-label-en="Financial"');
    expect(widget).toContain('data-label-en="General"');
    expect(widget).toContain('data-label-en="Execute"');
  });
});
