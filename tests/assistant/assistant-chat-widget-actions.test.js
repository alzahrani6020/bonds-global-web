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
    expect(executeSource).toContain('window.location.assign(route);');
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

  test('does not add arbitrary URL, selector, script or SQL execution paths', () => {
    expect(source).not.toMatch(/action\.input\.(url|selector|script|javascript|sql)/i);
    expect(source).not.toMatch(/eval\s*\(/);
    expect(source).not.toMatch(/new\s+Function\s*\(/);
  });
});
