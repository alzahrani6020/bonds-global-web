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

  test('routes public-person, explicit-search and freshness queries through the language resolver', () => {
    const { researchIntent } = require('../../lib/assistant/open-chat-tool-loop');
    const person = researchIntent([{ role:'user', content:'من هو عمر موسى؟' }]);
    expect(person.required).toBe(true);
    expect(person.language_plan.intent).toBe('person_lookup');
    expect(person.language_plan.entity.text).toBe('عمر موسى');
    expect(person.query).toBe('عمر موسى');
    expect(person.query_variants).toContain('عمر موسى biography');

    expect(researchIntent([{ role:'user', content:'ابحث في النت عن بوندز' }]).required).toBe(true);
    expect(source).toContain("runResearchWorkflow");
    expect(source).toContain("evidence_ready");
    expect(source).toContain("VERIFIED_RESEARCH_SOURCES=");
  });

  test('fails closed instead of substituting model knowledge when required research fails', () => {
    const { failureReply } = require('../../lib/assistant/open-chat-tool-loop');
    const reply = failureReply(
      [{ role: 'user', content: 'من هو محمد بن سلمان؟' }],
      'web_search',
      { ok: false, error: { code: 'SEARCH_NO_RESULTS' } }
    );
    expect(reply).toContain('لم أعتمد على معلومات غير موثقة');
    expect(reply).not.toContain('SEARCH_NO_RESULTS');
    expect(reply).not.toContain('رمز الخطأ');
  });

  test('forces public research through search, exploration, evidence verification and synthesis', () => {
    expect(source).toContain("runResearchWorkflow");
    expect(source).toContain("action:'web_search'");
    expect(source).toContain("action:'web_explore'");
    expect(source).toContain("action:'evidence_verify'");
    expect(source).toContain("action:'research_synthesize'");
    expect(source).toContain('decision_eligible:false');
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

  test('parses unverified multilingual alias candidates without treating them as facts', () => {
    const { parseAliasCandidates } = require('../../lib/assistant/open-chat-tool-loop');
    expect(parseAliasCandidates('{"candidates":["عمرو موسى","Amr Moussa","عمرو موسى"]}')).toEqual([
      'عمرو موسى',
      'Amr Moussa'
    ]);
    expect(source).toContain('Candidates are NOT facts and will be verified by web search before use.');
    expect(source).toContain("status:'alias_candidates_generated'");
  });

  test('parses the final grounding verifier verdict and fails invalid verifier output closed', () => {
    const { parseGroundingDecision } = require('../../lib/assistant/open-chat-tool-loop');
    expect(parseGroundingDecision('{"grounded":true,"unsupported_claims":[],"missing_citations":[]}')).toEqual({
      grounded:true,
      unsupported_claims:[],
      missing_citations:[]
    });
    expect(parseGroundingDecision('not-json')).toBeNull();
    expect(source).toContain('ANSWER_GROUNDING_FAILED');
    expect(source).toContain("status:'grounding_blocked'");
  });
  test('never exposes internal research identifiers or internal failure codes to the user', () => {
    const {
      sanitizeResearchReply,
      researchFailureReply,
      failureReply
    } = require('../../lib/assistant/open-chat-tool-loop');

    const sanitized = sanitizeResearchReply(
      'ولي العهد السعودي. المصدر: web-source-1 source_id=web-source-1',
      [{
        id:'web-source-1',
        title:'Public source',
        publisher:'example.com',
        url:'https://example.com/profile'
      }]
    );

    expect(sanitized).toContain('https://example.com/profile');
    expect(sanitized).not.toContain('web-source-1');
    expect(sanitized).not.toContain('source_id');

    const researchBlocked = researchFailureReply(
      [{ role:'user', content:'من محمد بن سلمان؟' }],
      { status:'blocked', unknowns:['INTERNAL_SOURCE_ID_LEAK'] }
    );
    expect(researchBlocked).not.toContain('INTERNAL_SOURCE_ID_LEAK');
    expect(researchBlocked).not.toContain('رمز الحالة');

    const searchBlocked = failureReply(
      [{ role:'user', content:'من محمد بن سلمان؟' }],
      'web_search',
      { ok:false, error:{ code:'INTERNAL_SOURCE_ID_LEAK' } }
    );
    expect(searchBlocked).not.toContain('INTERNAL_SOURCE_ID_LEAK');
    expect(searchBlocked).not.toContain('رمز الخطأ');
  });

});
