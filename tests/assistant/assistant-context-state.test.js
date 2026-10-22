const fs = require('fs');
const path = require('path');

describe('BONDS Assistant context state', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'v3', 'components', 'ai-chat-widget.js'),
    'utf8'
  );

  test('uses session-scoped structured state rather than persistent local storage', () => {
    expect(source).toContain("const ASSISTANT_STATE_VERSION = 1;");
    expect(source).toContain("const ASSISTANT_STATE_PREFIX = 'bonds.assistant.state.v1:';");
    expect(source).toContain('window.sessionStorage?.getItem');
    expect(source).toContain('window.sessionStorage?.setItem');
    expect(source).toContain('window.sessionStorage?.removeItem');
    expect(source).not.toContain('window.localStorage');
  });

  test('defines project and city boundaries explicitly', () => {
    expect(source).toContain("return projectId ? `project:${projectId}` : 'project:unbound';");
    expect(source).toContain('return `city:${city}|activity:${activity}|model:${model}`;');
    expect(source).toContain('const previousBoundary = contextBoundaryKey(context);');
    expect(source).toContain('const nextBoundary = contextBoundaryKey(context);');
    expect(source).toContain('if (previousBoundary !== nextBoundary)');
  });

  test('loads a different state when the context boundary changes', () => {
    expect(source).toContain('assistantContextState = loadAssistantContextState(nextBoundary);');
    expect(source).toContain('resetVisibleConversationForBoundary();');
    expect(source).toContain('state.messages = [];');
    expect(source).toContain("messagesEl.innerHTML = '';");
    expect(source).toContain("actionsEl.innerHTML = '';");
  });

  test('keeps a bounded structured state contract', () => {
    for (const field of [
      'goal',
      'current_stage',
      'open_tasks',
      'required_data',
      'confirmed_facts',
      'pending_confirmation',
      'last_action'
    ]) {
      expect(source).toContain(field);
    }
    expect(source).toContain('.slice(0, 50)');
    expect(source).toContain('Object.entries(value).slice(0, 100)');
  });

  test('passes only sanitized assistant state into chat payloads', () => {
    expect(source).toContain('const structuredState = sanitizeAssistantContextState(');
    expect(source).toContain('assistantState: structuredState');
    expect(source).not.toContain('assistantState: assistantContextState');
  });

  test('does not silently promote AI envelope context into confirmed facts', () => {
    const renderStart = source.indexOf('function renderStructuredEnvelope');
    const renderEnd = source.indexOf('function renderSuggestions', renderStart);
    const renderSource = source.slice(renderStart, renderEnd);

    expect(renderSource).toContain('last_action');
    expect(renderSource).toContain('current_stage');
    expect(renderSource).not.toContain('confirmed_facts');
  });

  test('exposes bounded state access without executable code paths', () => {
    expect(source).toContain('window.BondsAssistant.getState = () => sanitizeAssistantContextState');
    expect(source).toContain('window.BondsAssistant.updateState = patch => patchAssistantContextState(patch);');
    expect(source).toContain('window.BondsAssistant.clearState = () =>');
    expect(source).not.toMatch(/eval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\s*\(/);
  });
});
