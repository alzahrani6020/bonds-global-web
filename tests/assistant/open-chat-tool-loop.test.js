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

  test('retries bounded entity aliases when search succeeds but relevance is too low', () => {
    expect(source).toContain("['search_failed', 'search_low_relevance'].includes(workflow?.status)");
    expect(source).toContain('const aliases = await suggestUnverifiedQueryAliases(intent, options);');
    expect(source).toContain('const mergedVariants = [...new Set([...aliases, ...(intent.query_variants || [])])].slice(0, 8);');
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

  test('research runtime uses one generation pass plus at most one bounded quality repair', () => {
    expect(source).toContain('const rawReply = await generateResearchAnswer(intent, workflow, answerPackage, options);');
    expect(source).toContain('REPAIRABLE_QUALITY_CODES.has(quality.code)');
    expect(source).toContain('const repairedRawReply = await repairResearchAnswer(');
    expect(source).toContain('repairAttempted = true;');
    expect(source).not.toContain('while (!quality.ok)');
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

  test('blocks planner/tool orchestration meta-text from user-visible replies', () => {
    const {
      containsPlannerMetaLeak,
      assessResearchAnswer
    } = require('../../lib/assistant/open-chat-tool-loop');

    const leaked = 'The query translates to "Who is Mohammed bin Salman?" Since this is a request for general public information, I will use the web_search tool to gather current and reliable information.';

    expect(containsPlannerMetaLeak(leaked)).toBe(true);
    expect(assessResearchAnswer(leaked, {
      language_plan:{
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    }).code).toBe('PLANNER_META_LEAK');

    expect(containsPlannerMetaLeak('محمد بن سلمان ولي العهد السعودي.')).toBe(false);
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
      ).code
    ).toBe('PERSON_IDENTITY_TOO_GENERIC');
  });

  test('person lookup quality gate rejects generic identity-only answers', () => {
    const { assessResearchAnswer } = require('../../lib/assistant/open-chat-tool-loop');
    const intent = {
      language_plan:{
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    expect(
      assessResearchAnswer(
        'محمد بن سلمان هو شخصية عامة سعودية، وتوجد معلومات عنه في المصادر.',
        intent
      ).code
    ).toBe('PERSON_IDENTITY_TOO_GENERIC');

    expect(
      assessResearchAnswer(
        'محمد بن سلمان هو ولي عهد المملكة العربية السعودية ورئيس مجلس الوزراء.',
        intent
      ).ok
    ).toBe(true);
  });

  test('person identity gate requires a positive concrete identity signal', () => {
    const { assessResearchAnswer, hasConcretePersonIdentity } =
      require('../../lib/assistant/open-chat-tool-loop');

    const intent = {
      language_plan:{
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    expect(
      assessResearchAnswer(
        'محمد بن سلمان هو شخصية مرتبطة بمجالات العمل السياسي والإصلاحات الداخلية.',
        intent
      ).code
    ).toBe('PERSON_IDENTITY_TOO_GENERIC');

    expect(
      assessResearchAnswer(
        'محمد بن سلمان هو ولي العهد ورئيس مجلس الوزراء في المملكة العربية السعودية.',
        intent
      ).ok
    ).toBe(true);

    expect(hasConcretePersonIdentity('محمد بن سلمان يعمل في مجالات السياسة والإصلاح.')).toBe(false);
    expect(hasConcretePersonIdentity('محمد بن سلمان هو ولي العهد.')).toBe(true);
    expect(hasConcretePersonIdentity('محمد بن سلمان هو ولي عهد المملكة العربية السعودية.')).toBe(true);
    expect(hasConcretePersonIdentity('Jane Doe is the chief executive of the company.')).toBe(true);
  });

  test('repairs person identity deterministically from verified evidence before model repair', () => {
    const {
      evidenceGroundedPersonIdentityRepair,
      assessResearchAnswer
    } = require('../../lib/assistant/open-chat-tool-loop');

    const intent = {
      language_plan:{
        language:{language:'ar'},
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    const repaired = evidenceGroundedPersonIdentityRepair(intent, {
      mode:'verified_source_digest',
      known:[],
      sources:[
        {
          claims:[],
          excerpt:'محمد بن سلمان هو ولي عهد المملكة العربية السعودية ورئيس مجلس الوزراء.'
        }
      ]
    });

    expect(repaired).toBe('محمد بن سلمان هو ولي عهد المملكة العربية السعودية ورئيس مجلس الوزراء.');
    expect(assessResearchAnswer(repaired, intent).ok).toBe(true);
  });

  test('repairs person identity from verified sourceRows when compact answer evidence is generic', () => {
    const {
      evidenceGroundedPersonIdentityRepair,
      assessResearchAnswer
    } = require('../../lib/assistant/open-chat-tool-loop');

    const intent = {
      language_plan:{
        language:{language:'ar'},
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    const repaired = evidenceGroundedPersonIdentityRepair(
      intent,
      {
        mode:'verified_source_digest',
        known:[],
        sources:[
          {
            claims:[],
            excerpt:'محمد بن سلمان شخصية سعودية بارزة.'
          }
        ]
      },
      [
        {
          title:'سيرة محمد بن سلمان',
          text:'محمد بن سلمان هو ولي عهد المملكة العربية السعودية ورئيس مجلس الوزراء.'
        }
      ]
    );

    expect(repaired).toBe('محمد بن سلمان هو ولي عهد المملكة العربية السعودية ورئيس مجلس الوزراء.');
    expect(assessResearchAnswer(repaired, intent).ok).toBe(true);
  });

  test('rejects raw Wikipedia/page-chrome dumps as person identity answers', () => {
    const {
      assessResearchAnswer,
      isCleanPersonIdentitySentence
    } = require('../../lib/assistant/open-chat-tool-loop');

    const intent = {
      language_plan:{
        language:{language:'ar'},
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    const raw = 'محمد بن سلمان آل سعود - ويكيبيديا انتقل إلى المحتوى القائمة الرئيسة إنشاء حساب تسجيل دخول أدوات شخصية ولي العهد رئيس مجلس الوزراء';
    expect(isCleanPersonIdentitySentence(raw, 'محمد بن سلمان')).toBe(false);
    expect(assessResearchAnswer(raw, intent)).toEqual({
      ok:false,
      code:'PERSON_IDENTITY_CONTAMINATED'
    });
  });

  test('accepts a short direct person identity sentence', () => {
    const {
      assessResearchAnswer,
      isCleanPersonIdentitySentence
    } = require('../../lib/assistant/open-chat-tool-loop');

    const intent = {
      language_plan:{
        language:{language:'ar'},
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    const answer = 'محمد بن سلمان هو ولي عهد المملكة العربية السعودية ورئيس مجلس الوزراء.';
    expect(isCleanPersonIdentitySentence(answer, 'محمد بن سلمان')).toBe(true);
    expect(assessResearchAnswer(answer, intent)).toEqual({ ok:true, code:'PASS' });
  });

  test('person identity repair rejects source-title shaped text and prefers direct identity sentences', () => {
    const {
      evidenceGroundedPersonIdentityRepair,
      assessResearchAnswer
    } = require('../../lib/assistant/open-chat-tool-loop');

    const intent = {
      language_plan:{
        language:{language:'ar'},
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    const repaired = evidenceGroundedPersonIdentityRepair(
      intent,
      {
        mode:'verified_source_digest',
        known:[],
        sources:[]
      },
      [
        {
          title:'لقاء ولي العهد السعودي محمد بن سلمان مع مجلة تايم',
          text:[
            'لقاء ولي العهد السعودي محمد بن سلمان مع مجلة تايم.',
            'محمد بن سلمان هو ولي عهد المملكة العربية السعودية ورئيس مجلس الوزراء.'
          ].join(' ')
        }
      ]
    );

    expect(repaired).toBe('محمد بن سلمان هو ولي عهد المملكة العربية السعودية ورئيس مجلس الوزراء.');
    expect(assessResearchAnswer(repaired, intent).ok).toBe(true);
  });

  test('person identity repair does not return a source title as the final answer', () => {
    const { evidenceGroundedPersonIdentityRepair } =
      require('../../lib/assistant/open-chat-tool-loop');

    const intent = {
      language_plan:{
        language:{language:'ar'},
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    expect(
      evidenceGroundedPersonIdentityRepair(
        intent,
        { mode:'verified_source_digest', known:[], sources:[] },
        [
          {
            title:'لقاء ولي العهد السعودي محمد بن سلمان مع مجلة تايم',
            text:'لقاء ولي العهد السعودي محمد بن سلمان مع مجلة تايم.'
          }
        ]
      )
    ).toBeNull();
  });

  test('evidence-grounded person repair fails closed when no concrete verified identity exists', () => {
    const { evidenceGroundedPersonIdentityRepair } =
      require('../../lib/assistant/open-chat-tool-loop');

    const intent = {
      language_plan:{
        language:{language:'ar'},
        intent:'person_lookup',
        entity:{text:'محمد بن سلمان'}
      }
    };

    expect(
      evidenceGroundedPersonIdentityRepair(intent, {
        mode:'verified_source_digest',
        known:[],
        sources:[
          {
            claims:[],
            excerpt:'محمد بن سلمان شخصية عامة معروفة ومرتبطة بمجالات العمل السياسي.'
          }
        ]
      })
    ).toBeNull();
  });

  test('research acquisition trace summarizes crawl metadata without page text or full URLs', () => {
    const { researchAcquisitionTrace } = require('../../lib/assistant/open-chat-tool-loop');
    const trace = researchAcquisitionTrace({
      search_attempts:[
        { relevant_result_count:2 },
        { relevant_result_count:1 }
      ],
      search:{ result:{ results:[{url:'https://example.com/a'}], result_count:1 } },
      seeds:['https://example.com/a','https://blocked.example/x'],
      exploration:{
        result:{
          pages:[],
          failures:[
            {
              url:'https://example.com/private/person-profile',
              evidence:{status_code:403, failure_class:'HTTP_403', text:'PRIVATE PAGE TEXT'}
            }
          ],
          blocked:[
            {url:'https://blocked.example/private/path', reason:'ROBOTS_DISALLOW'}
          ],
          coverage:{
            discovered_count:2,
            visited_count:2,
            successful_count:0,
            failed_count:1,
            blocked_count:1,
            pending_count:0,
            unknowns:['NO_SUCCESSFUL_ACQUISITION']
          },
          recovery_attempts:[{seed:'https://example.com/a'}],
          relevant_pages:[]
        }
      },
      evidence:[]
    });

    expect(trace).toEqual(expect.objectContaining({
      search_attempt_count:2,
      relevant_search_result_count:3,
      seed_count:2,
      crawl_attempted:true,
      fetched_count:0,
      failed_count:1,
      blocked_count:1,
      relevant_page_count:0,
      recovery_attempt_count:1,
      verified_source_count:0,
      evidence_count:0
    }));
    expect(trace.failure_samples[0]).toEqual({
      host:'example.com',
      status_code:403,
      failure_class:'HTTP_403'
    });
    expect(trace.blocked_samples[0]).toEqual({
      host:'blocked.example',
      reason:'ROBOTS_DISALLOW'
    });
    const serialized = JSON.stringify(trace);
    expect(serialized).not.toContain('/private/person-profile');
    expect(serialized).not.toContain('/private/path');
    expect(serialized).not.toContain('PRIVATE PAGE TEXT');
  });

  test('repairs only answer-shape failures and keeps safety failures fail-closed', () => {
    expect(source).toContain("'PERSON_IDENTITY_TOO_GENERIC'");
    expect(source).toContain("'PERSON_IDENTITY_NOT_ANSWERED'");
    expect(source).toContain("'META_ONLY_ANSWER'");
    expect(source).not.toContain("'INTERNAL_SOURCE_ID_LEAK',\n  'PLANNER_META_LEAK'");
    expect(source).toContain('Use only the supplied ANSWER_CONTEXT and the rejected answer. Do not search, request new information, or add unsupported facts.');
  });

  test('person lookup contract requires a concrete distinguishing identity fact', () => {
    const { researchAnswerContract } = require('../../lib/assistant/open-chat-tool-loop');
    const contract = researchAnswerContract({
      language_plan:{ intent:'person_lookup' }
    });

    expect(contract).toContain('specific identifying role');
    expect(contract).toContain('supported by the supplied evidence');
    expect(contract).toContain('Do not use public figure');
  });

  test('uses failure-specific repair instructions for supported quality codes', () => {
    const { repairQualityInstruction } = require('../../lib/assistant/open-chat-tool-loop');

    const generic = repairQualityInstruction('PERSON_IDENTITY_TOO_GENERIC');
    expect(generic).toContain('identified the person too generically');
    expect(generic).toContain('one concrete distinguishing role');
    expect(generic).toContain('absent from ANSWER_CONTEXT');

    const missing = repairQualityInstruction('PERSON_IDENTITY_NOT_ANSWERED');
    expect(missing).toContain('did not directly identify the requested person');
    expect(missing).toContain('directly names the requested person');

    const meta = repairQualityInstruction('META_ONLY_ANSWER');
    expect(meta).toContain('talks about sources');
    expect(meta).toContain('direct substantive answer');
  });

  test('repair prompt uses the failure-specific instruction and stays evidence-bounded', () => {
    const repairFunction = source.slice(
      source.indexOf('async function repairResearchAnswer'),
      source.indexOf('function assessResearchAnswer')
    );

    expect(repairFunction).toContain("'REPAIR_INSTRUCTION=' + repairQualityInstruction(qualityCode)");
    expect(repairFunction).toContain('Use only the supplied ANSWER_CONTEXT and the rejected answer.');
    expect(repairFunction).not.toContain('runResearchWorkflow');
    expect(repairFunction).not.toContain('web_search');
    expect(repairFunction).not.toContain('web_explore');
    expect(repairFunction).not.toContain('evidence_verify');
  });

  test('records explicit acquisition and repair timing without re-running research', () => {
    expect(source).toContain('const researchAcquisitionMs = Date.now() - startedAt;');
    expect(source).toContain('research_acquisition_ms:researchAcquisitionMs');
    expect(source).toContain('repair_ms:repairMs');
    expect(source).toContain('repair_quality_code:repairQualityCode');
    expect(source).toContain('repair_succeeded:repairSucceeded');
    const repairFunction = source.slice(
      source.indexOf('async function repairResearchAnswer'),
      source.indexOf('function assessResearchAnswer')
    );
    expect(repairFunction).not.toContain('runResearchWorkflow');
    expect(repairFunction).not.toContain('web_search');
    expect(repairFunction).not.toContain('web_explore');
    expect(repairFunction).not.toContain('evidence_verify');
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

  test('preserves a long current user request while keeping prior turns bounded', () => {
    expect(source).toContain("index === latestUserIndex ? 12000 : 2400");
    expect(source).toContain("currentRequest.slice(0, 12000)");
    expect(source).toContain("String(intent?.current || '').slice(0, 12000)");
    expect(source).not.toContain("content: String((item && item.content) || '').slice(0, 1400)");
  });

});
