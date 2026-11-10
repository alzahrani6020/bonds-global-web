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
    const executePrompts = promptButtons.filter(button => button.includes('data-conversation-mode="execute"'));
    const financialPrompts = promptButtons.filter(button => button.includes('data-conversation-mode="financial"'));
    expect(executePrompts).toHaveLength(1);
    expect(financialPrompts.length + executePrompts.length).toBe(promptButtons.length);
    expect(widget).toMatch(/<button[^>]*data-assistant-focus="true"[^>]*data-conversation-mode="general"[^>]*>/);

    const promptHandler = widget.match(/homePromptButtons\.forEach[\s\S]*?\n    \}\);/)?.[0] || '';
    expect(promptHandler.indexOf('setConversationMode(')).toBeGreaterThan(-1);
    expect(promptHandler.indexOf('sendMessage(')).toBeGreaterThan(promptHandler.indexOf('setConversationMode('));

    const focusHandler = widget.match(/if \(homeFocusButton\) \{[\s\S]*?\n    \}/)?.[0] || '';
    expect(focusHandler.indexOf('setConversationMode(')).toBeGreaterThan(-1);
    expect(focusHandler.indexOf('input.focus(')).toBeGreaterThan(focusHandler.indexOf('setConversationMode('));
  });

  test('execute home tile and mode-aware suggestions stay aligned with governed actions', () => {
    expect(widget).toContain('data-conversation-mode="execute"');
    expect(widget).toContain('data-assistant-prompt="أريد تنفيذ إجراء على هذا الموقع: افتح الصفحة أو النموذج المناسب، أو احفظ مسودة. لا ترسل نهائياً."');
    expect(widget).toContain('<span>تنفيذ على الموقع</span>');

    const setMode = widget.match(/function setConversationMode\(mode\) \{[\s\S]*?return state\.conversationMode;\n    \}/)?.[0] || '';
    expect(setMode).toContain('renderSuggestions();');

    expect(widget).toContain("'افتح الصفحة المناسبة في هذا الموقع'");
    expect(widget).toContain("'ابحث عن النموذج المطلوب'");
    expect(widget).toContain("'حمّل النموذج الحالي'");
    expect(widget).toContain("'احفظ مسودة بدون إرسال نهائي'");
    expect(widget).toContain("'ماذا يمكن أن يساعدني به مساعد بوندز؟'");
    expect(widget).toContain("'لخّص هذه الصفحة'");
    expect(widget).toContain("'ما الخطوة التالية بدون حسابات مالية؟'");
    expect(widget).toContain("'كيف أستخدم خدمات بوندز؟'");
  });

  test('execute tile and default suggestions are bilingual without changing governed action contracts', () => {
    expect(widget).toContain('data-label-ar="تنفيذ على الموقع"');
    expect(widget).toContain('data-label-en="On-site actions"');
    expect(widget).toContain('data-assistant-prompt-en="I want to perform an on-site action: open the matching page or form, or save a draft. Do not submit."');
    expect(widget).toContain("'Open the matching page on this site'");
    expect(widget).toContain("'Find the required form'");
    expect(widget).toContain("'Load the current form'");
    expect(widget).toContain("'Save a draft without final submit'");
    expect(widget).toContain("'What can BONDS Assistant help me with?'");
    expect(widget).toContain("'Summarize this page'");
    expect(widget).toContain("'What is the next step without financial calculations?'");
    expect(widget).toContain("'How do I use BONDS services?'");
    expect(widget).toContain('How do you assess the opportunity for ${activity} in ${city}?');
    expect(widget).toContain('What is the best city for this activity?');
    expect(widget).toContain('What are the investment risks in ${city}?');
    expect(widget).toContain('How can I improve the payback period?');
    expect(widget).toContain("languageCode() === 'en' && button.dataset.assistantPromptEn");
  });

  test('shared widget persists and sends the selected mode with English labels available', () => {
    expect(widget).toContain("const CONVERSATION_MODE_STORAGE_KEY = 'bonds_assistant_conversation_mode';");
    expect(widget).toContain('conversation_mode: state.conversationMode');
    expect(widget).toContain('data-label-en="Financial"');
    expect(widget).toContain('data-label-en="General"');
    expect(widget).toContain('data-label-en="Execute"');
  });
  test('home launchpad bilingual attributes remain independently locked', () => {
    expect(widget).toContain('data-label-en="Financial calculators"');
    expect(widget).toContain('data-assistant-prompt-en="I want to use the financial calculators. Help me choose the right calculator."');
    expect(widget).toContain('data-label-en="Funding request"');
    expect(widget).toContain('data-assistant-prompt-en="I want to submit a funding request. What are the steps and requirements?"');
    expect(widget).toContain('data-label-en="Advisory and services"');
    expect(widget).toContain('data-assistant-prompt-en="Which advisory or service best fits my need?"');
    expect(widget).toContain('data-label-en="Feasibility studies"');
    expect(widget).toContain('data-assistant-prompt-en="I want to prepare a feasibility study. What information is required to start?"');
    expect(widget).toContain('data-label-en="Sectors and opportunities"');
    expect(widget).toContain('data-assistant-prompt-en="Help me explore the right sectors and investment opportunities."');
    expect(widget).toContain('data-label-en="General questions"');
    expect(widget).toMatch(/data-assistant-focus="true"[^>]*data-conversation-mode="general"/);
    expect(widget).toContain('data-label-en="How do I get suitable funding?"');
    expect(widget).toContain('data-assistant-prompt-en="How do I get suitable funding?"');
    expect(widget).toContain('data-label-en="What is required to prepare a feasibility study?"');
    expect(widget).toContain('data-assistant-prompt-en="What is required to prepare a feasibility study?"');
    expect(widget).toContain('data-label-en="Which sectors can I study?"');
    expect(widget).toContain('data-assistant-prompt-en="Which investment sectors can I study?"');
  });

});
