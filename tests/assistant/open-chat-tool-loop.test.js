const fs = require('fs');
const path = require('path');

describe('BONDS governed open-chat tool loop', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', '..', 'lib', 'assistant', 'open-chat-tool-loop.js'),
    'utf8'
  );

  test('discovers only read/compute capabilities for autonomous tool selection', () => {
    expect(source).toContain("new Set(['none', 'network_read', 'database_read', 'compute'])");
    expect(source).toContain("!['ai_reason', 'native_generate', 'native_health'].includes(spec.action)");
  });

  test('fails closed when planner invents or selects a disallowed capability', () => {
    expect(source).toContain("if (!capability || capability.active === false || !ALLOWED_EFFECTS.has(capability.sideEffect || 'none'))");
  });

  test('executes selected tools only through the existing governed action fabric', () => {
    expect(source).toContain("require('../services/service-execution-router')");
    expect(source).toContain('return executeGovernedAction({');
    expect(source).toContain('action: decision.action');
  });

  test('adds a bounded multi-tool loop and blocks repeated action-input pairs', () => {
    expect(source).toContain('const MAX_TOOL_STEPS = 4;');
    expect(source).toContain('for (let index = 0; index < maxSteps; index += 1)');
    expect(source).toContain('if (seen.has(signature)) break;');
  });

  test('resolves a short search follow-up against the previous user topic', () => {
    const { searchQueryFromConversation } = require('../../lib/assistant/open-chat-tool-loop');
    const query = searchQueryFromConversation([
      { role: 'user', content: 'من هو الدكتور طلال حسن الزهراني؟' },
      { role: 'assistant', content: 'لم أتمكن من العثور على معلومات.' },
      { role: 'user', content: 'ابحث في النت' }
    ]);
    expect(query).toBe('من هو الدكتور طلال حسن الزهراني؟');
  });

  test('forces public-person, explicit-search and freshness queries into web search', () => {
    expect(source).toContain('function initialSearchDecision(messages, trace = [])');
    expect(source).toContain("action: 'web_search'");
    expect(source).toContain('personLookup');
    expect(source).toContain('freshness');
  });

  test('fails closed instead of substituting model knowledge when required research fails', () => {
    const { failureReply } = require('../../lib/assistant/open-chat-tool-loop');
    const reply = failureReply(
      [{ role: 'user', content: 'من هو محمد بن سلمان؟' }],
      'web_search',
      { ok: false, error: { code: 'SEARCH_NO_RESULTS' } }
    );
    expect(reply).toContain('لم أعتمد على معلومات غير موثقة');
    expect(reply).toContain('SEARCH_NO_RESULTS');
  });

  test('forces search results through fetched page exploration before final synthesis', () => {
    expect(source).toContain("last.action !== 'web_search'");
    expect(source).toContain("action: 'web_explore'");
    expect(source).toContain('seedUrls');
    expect(source).toContain('maxDepth: 0');
  });

  test('uses full recent conversation and tool trace for follow-up reasoning', () => {
    expect(source).toContain('slice(-12)');
    expect(source).toContain('Use the complete recent conversation to resolve short follow-ups and references.');
    expect(source).toContain('GOVERNED_TOOL_TRACE=');
  });

  test('uses governed AI only for planning and grounded synthesis', () => {
    expect(source).toContain("action: 'ai_reason'");
    expect(source).toContain('The governed tool trace below is the execution authority for this turn.');
    expect(source).toContain('Never claim execution before a governed tool result exists.');
  });
});
