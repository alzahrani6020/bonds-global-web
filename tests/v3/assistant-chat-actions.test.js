const fs = require('fs');
const path = require('path');

describe('Bonds AI chat governed assistant actions', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
    'utf8'
  );

  test('consumes only the versioned assistant protocol envelope', () => {
    expect(source).toContain("const ASSISTANT_PROTOCOL = 'BONDS_ASSISTANT_PROTOCOL_V1'");
    expect(source).toContain("envelope.protocol !== ASSISTANT_PROTOCOL");
    expect(source).toContain("throw new Error('INVALID_ASSISTANT_PROTOCOL')");
  });

  test('plans through the authenticated assistant endpoint', () => {
    expect(source).toContain("const ASSISTANT_PLAN_URL = '/api/v3/assistant/plan'");
    expect(source).toContain('postAssistantJson(ASSISTANT_PLAN_URL, payload)');
  });

  test('executes structured actions only through capability governance', () => {
    expect(source).toContain("const CAPABILITY_EXECUTE_URL = '/api/v3/capabilities/execute'");
    expect(source).toContain('postAssistantJson(CAPABILITY_EXECUTE_URL');
    expect(source).toContain('action: action.capability || action.type');
  });

  test('never navigates directly to the model supplied action target', () => {
    expect(source).not.toContain('window.location.assign(action.target)');
    expect(source).not.toContain('window.location.href = action.target');
    expect(source).toContain('window.location.assign(data.result.route)');
    expect(source).toContain('window.location.assign(data.result.navigation.route)');
  });

  test('keeps confirmation-required actions blocked in the widget', () => {
    expect(source).toContain('if (!action || action.requires_confirmation === true) return;');
    expect(source).toContain("button.textContent = action.requires_confirmation === true");
    expect(source).toContain("button.disabled = action.requires_confirmation === true || action.status === 'blocked'");
  });

  test('exposes a controlled action bus without exposing arbitrary execution primitives', () => {
    expect(source).toContain('window.BondsAIChat.planAction = planAction');
    expect(source).toContain('window.BondsAIChat.renderEnvelope = renderAssistantEnvelope');
    expect(source).not.toMatch(/eval\s*\(/);
    expect(source).not.toMatch(/new Function\s*\(/);
    expect(source).not.toContain('querySelector(action.selector)');
  });
});
