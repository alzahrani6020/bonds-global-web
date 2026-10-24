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

  test('research runtime uses one LLM answer-generation pass', () => {
    expect(source).toContain('const reply = await generateResearchAnswer(intent, workflow, answerPackage, options);');
    expect(source).toContain('const quality = assessResearchAnswer(reply, intent);');
    expect(source).not.toContain('ANSWER_CONSISTENCY_FAILED');
    expect(source).not.toContain("status:'consistency_blocked'");
    expect(source).not.toContain('async function checkResearchAnswerConsistency');
  });

  test('separates public answer evidence from internal verification evidence', () => {
    const {
      buildResearchAnswerPackage,
      buildResearchVerificationPackage
    } = require('../../lib/assistant/open-chat-tool-loop');

    const rows = [{
      id:'web-source-1',
      title:'Official profile',
      publisher:'example.gov',
      url:'https://example.gov/profile',
      text:'Mohammed bin Salman is Crown Prince of Saudi Arabia.',
      candidate_claims:[
        {text:'Mohammed bin Salman is Crown Prince of Saudi Arabia.'}
      ]
    }];

    const workflow = {
      status:'SUPPORTED',
      verification:{
        result:{
          verification_state:'SUPPORTED',
          supported_claims:[],
          sources:rows
        }
      },
      synthesis:{
        result:{
          known:[],
          unknown:['NO_STRUCTURED_CLAIMS'],
          contradictions:[]
        }
      }
    };

    const answer = buildResearchAnswerPackage(
      workflow,
      rows,
      'Mohammed bin Salman'
    );

    const verify = buildResearchVerificationPackage(
      workflow,
      rows,
      'Mohammed bin Salman'
    );

    expect(JSON.stringify(answer)).not.toContain('web-source-1');
    expect(JSON.stringify(answer)).toContain('https://example.gov/profile');
    expect(JSON.stringify(verify)).toContain('web-source-1');
  });

  test('quality gate rejects internal IDs and meta-only research answers', () => {
    const { assessResearchAnswer } =
      require('../../lib/assistant/open-chat-tool-loop');

    const intent = {
      language_plan:{
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    expect(
      assessResearchAnswer(
        'محمد بن سلمان وفق web-source-1.',
        intent
      ).code
    ).toBe('INTERNAL_SOURCE_ID_LEAK');

    expect(
      assessResearchAnswer(
        'توجد مقالات ومصادر عديدة عن محمد بن سلمان.',
        intent
      ).code
    ).toBe('META_ONLY_ANSWER');

    expect(
      assessResearchAnswer(
        'محمد بن سلمان شخصية عامة سعودية وفق الأدلة المتاحة.',
        intent
      ).ok
    ).toBe(true);
  });

  test('person lookup has an explicit direct-answer contract', () => {
    const { researchAnswerContract } =
      require('../../lib/assistant/open-chat-tool-loop');

    const contract = researchAnswerContract({
      language_plan:{intent:'person_lookup'}
    });

    expect(contract).toContain('first sentence');
    expect(contract).toContain('Do not answer by merely saying');
  });

  test('research completion exposes stage-level latency metrics', () => {
    expect(source).toContain('search_ms:workflow?.timings?.search_ms');
    expect(source).toContain('answer_synthesis_ms:synthesisMs');
  });


  test('uses isolated answer context with one generation pass', () => {
    expect(source).toContain("ANSWER_CONTEXT=' + compactJson(answerContext, 8500)");
    expect(source).not.toContain("'VERIFIED_RESEARCH_SOURCES=' + compactJson(verificationPackage, 6000)");
    expect(source).not.toContain('buildResearchEvidencePackage');
  });

  test('new research answer layer is isolated and non-restrictive', () => {
    const source = fs.readFileSync(require.resolve('../../lib/assistant/open-chat-tool-loop'), 'utf8');
    expect(source).toContain('function buildResearchAnswerContext');
    expect(source).toContain('async function generateResearchAnswer');
    expect(source).not.toContain('async function checkResearchAnswerConsistency');
    expect(source).not.toContain("RECENT_MESSAGES=' + compactJson(recent.slice(0, -1), 7000)");
    expect(source).not.toContain('Every factual statement must be explicitly supported by VERIFIED_RESEARCH_SOURCES.');
    expect(source).not.toContain('Do not use model memory to add facts that are absent from the package.');
    expect(source).toContain('You may use stable general knowledge for background explanation.');
  });

});
