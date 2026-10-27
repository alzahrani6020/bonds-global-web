/** @jest-environment node */
'use strict';

jest.mock('../../lib/services/service-execution-router', () => ({
  executeGovernedAction: jest.fn()
}));

const { executeGovernedAction } = require('../../lib/services/service-execution-router');
const { buildAnswerPlan } = require('../../lib/intelligence/answer-planner');
const {
  researchAnswerSynthesisTimeoutMs,
  resolveOfficialSourceRow,
  isEvidenceFallbackEligible,
  buildEvidenceDigestAnswer,
  runResearchTurn
} = require('../../lib/assistant/open-chat-tool-loop');

describe('answer synthesis budget configuration', () => {
  const original = process.env.RESEARCH_ANSWER_SYNTHESIS_TIMEOUT_MS;
  afterEach(() => {
    if (original === undefined) delete process.env.RESEARCH_ANSWER_SYNTHESIS_TIMEOUT_MS;
    else process.env.RESEARCH_ANSWER_SYNTHESIS_TIMEOUT_MS = original;
  });

  test('defaults to 15s and clamps to the 8-25s window', () => {
    delete process.env.RESEARCH_ANSWER_SYNTHESIS_TIMEOUT_MS;
    expect(researchAnswerSynthesisTimeoutMs()).toBe(15000);
    process.env.RESEARCH_ANSWER_SYNTHESIS_TIMEOUT_MS = '4000';
    expect(researchAnswerSynthesisTimeoutMs()).toBe(8000);
    process.env.RESEARCH_ANSWER_SYNTHESIS_TIMEOUT_MS = '60000';
    expect(researchAnswerSynthesisTimeoutMs()).toBe(25000);
    process.env.RESEARCH_ANSWER_SYNTHESIS_TIMEOUT_MS = 'not-a-number';
    expect(researchAnswerSynthesisTimeoutMs()).toBe(15000);
  });
});

describe('buildAnswerPlan deterministic extensions', () => {
  const verifiedClaim = {
    predicate: 'company.margin',
    subject: 'شركة X',
    value: 'هامش الربح التشغيلي للشركة يبلغ 18 بالمئة',
    verification_state: 'VERIFIED',
    supporting_sources: ['s1']
  };

  test('official URL request with a verified official source bypasses AI synthesis', () => {
    const plan = buildAnswerPlan({
      intent: 'information',
      languagePlan: {
        language: 'ar',
        raw_text: 'ما الموقع الرسمي لوزارة المالية؟',
        entity: { text: 'وزارة المالية' }
      },
      entityFrame: { canonical_name: 'وزارة المالية' },
      officialSourceUrl: 'https://www.mof.example'
    });

    expect(plan.mode).toBe('direct_official_url');
    expect(plan.requires_ai_synthesis).toBe(false);
    expect(plan.direct_answer).toContain('https://www.mof.example');
    expect(plan.direct_answer).toContain('وزارة المالية');
  });

  test('production official URL phrasing under web_research intent bypasses AI synthesis', () => {
    const plan = buildAnswerPlan({
      intent: 'web_research',
      languagePlan: {
        language: 'ar',
        raw_text: 'ابحث في الإنترنت عن الموقع الرسمي لوزارة المالية السعودية، واذكر اسم الجهة والرابط الرسمي فقط.',
        entity: { text: 'الموقع الرسمي لوزارة المالية السعودية' }
      },
      entityFrame: { canonical_name: 'وزارة المالية السعودية' },
      officialSourceUrl: 'https://www.mof.gov.sa/'
    });

    expect(plan.mode).toBe('direct_official_url');
    expect(plan.requires_ai_synthesis).toBe(false);
    expect(plan.direct_answer).toContain('https://www.mof.gov.sa/');
  });

  test('official source is ignored when the question does not ask for the official URL', () => {
    const plan = buildAnswerPlan({
      intent: 'information',
      languagePlan: { language: 'ar', raw_text: 'ما هو هامش ربح شركة X؟', entity: { text: 'شركة X' } },
      claimFabric: { fused_claims: [verifiedClaim], extracted_claim_count: 1 },
      officialSourceUrl: 'https://www.x.example'
    });

    expect(plan.mode).not.toBe('direct_official_url');
  });

  test('a single verified claim renders deterministically without AI synthesis', () => {
    const plan = buildAnswerPlan({
      intent: 'information',
      languagePlan: { language: 'ar', raw_text: 'ما هامش ربح شركة X؟', entity: { text: 'شركة X' } },
      entityFrame: { canonical_name: 'شركة X' },
      claimFabric: { fused_claims: [verifiedClaim], extracted_claim_count: 1 }
    });

    expect(plan.mode).toBe('direct_verified_claim');
    expect(plan.requires_ai_synthesis).toBe(false);
    expect(plan.direct_answer).toContain('18 بالمئة');
  });

  test('analytical multi-claim questions keep flowing to governed synthesis', () => {
    const plan = buildAnswerPlan({
      intent: 'information',
      languagePlan: { language: 'ar', raw_text: 'حلل فرارات شركة X', entity: { text: 'شركة X' } },
      claimFabric: { fused_claims: [verifiedClaim, { ...verifiedClaim, predicate: 'company.growth' }], extracted_claim_count: 2 }
    });

    expect(plan.mode).toBe('structured_verified_claims');
    expect(plan.requires_ai_synthesis).toBe(true);
  });

  test('existing person role and relation direct paths do not regress', () => {
    const person = buildAnswerPlan({
      intent: 'person_lookup',
      languagePlan: { language: 'ar', entity: { text: 'خالد محمد' } },
      entityFrame: { canonical_name: 'خالد محمد' },
      verifiedIdentity: { verification_state: 'VERIFIED', canonical_name: 'خالد محمد' },
      claimFabric: { fused_claims: [{ predicate: 'person.role', value: 'رئيس مجلس الإدارة' }] }
    });
    expect(person.mode).toBe('direct_verified_claim');
    expect(person.requires_ai_synthesis).toBe(false);

    const relation = buildAnswerPlan({
      intent: 'relation_lookup',
      languagePlan: { language: 'ar' },
      entityFrame: { canonical_name: 'شركة X', organizations: [{ value: 'شركة X' }], relations: [{ value: 'الرئيس التنفيذي' }] },
      claimFabric: { fused_claims: [{ predicate: 'relation.holder', value: 'خالد محمد' }] }
    });
    expect(relation.mode).toBe('direct_verified_claim');
  });
});

describe('official source resolution', () => {
  test('prefers authoritative search rows, then institutional verification sources', () => {
    const fromSearch = resolveOfficialSourceRow({
      search: { result: { results: [
        { title: 'الموقع الرسمي', url: 'https://a.example', authoritative_routed_source: 'ministry.mof' },
        { title: 'أخرى', url: 'https://b.example' }
      ] } }
    }, []);
    expect(fromSearch.url).toBe('https://a.example');

    const fromSources = resolveOfficialSourceRow({}, [
      { publisher: 'وزارة المالية', url: 'https://c.example', institutional_source_id: 'ministry.mof' }
    ]);
    expect(fromSources.url).toBe('https://c.example');

    expect(resolveOfficialSourceRow({}, [])).toBeNull();
  });

  test('resolves a routed institutional search URL even when metadata is absent', () => {
    const resolved = resolveOfficialSourceRow({
      search: { result: { results: [
        { title: 'وزارة المالية السعودية', url: 'https://www.mof.gov.sa/' }
      ] } },
      search_route: {
        institutional_sources: [{ id: 'ministry_finance_sa' }]
      }
    }, []);

    expect(resolved).toEqual({
      name: 'Ministry of Finance',
      url: 'https://www.mof.gov.sa/'
    });
  });

  test('does not promote an unrelated institutional domain outside the routed source set', () => {
    const resolved = resolveOfficialSourceRow({
      search: { result: { results: [
        { title: 'البنك المركزي السعودي', url: 'https://www.sama.gov.sa/' }
      ] } },
      search_route: {
        institutional_sources: [{ id: 'ministry_finance_sa' }]
      }
    }, []);

    expect(resolved).toBeNull();
  });

  test('resolves verified institutional source URLs even when institutional_source_id is absent', () => {
    const resolved = resolveOfficialSourceRow({
      search_route: {
        institutional_sources: [{ id: 'ministry_finance_sa' }]
      }
    }, [
      { publisher: 'www.mof.gov.sa', url: 'https://www.mof.gov.sa/' }
    ]);

    expect(resolved).toEqual({
      name: 'Ministry of Finance',
      url: 'https://www.mof.gov.sa/'
    });
  });
});

describe('evidence fallback eligibility and digest builder', () => {
  test('eligibility requires decision eligibility, evidence, and no contradictions', () => {
    expect(isEvidenceFallbackEligible({ decisionEligible: true, evidence: [{}], contradictions: [] })).toBe(true);
    expect(isEvidenceFallbackEligible({ decisionEligible: false, evidence: [{}] })).toBe(false);
    expect(isEvidenceFallbackEligible({ decisionEligible: true, evidence: [] })).toBe(false);
    expect(isEvidenceFallbackEligible({ decisionEligible: true, evidence: [{}], contradictions: ['c'] })).toBe(false);
  });

  test('digest renders verified claims and sources in the request language without new inference', () => {
    const arabic = buildEvidenceDigestAnswer(
      { language_plan: { language: 'ar' } },
      {
        known: [{ claim: 'الهامش التشغيلي', value: '18 بالمئة' }],
        sources: [{ publisher: 'مصدر أ', url: 'https://a.example' }]
      },
      [], {}
    );
    expect(arabic).toContain('خلاصة مباشرة من الأدلة الموثقة');
    expect(arabic).toContain('الهامش التشغيلي: 18 بالمئة');
    expect(arabic).toContain('مصدر أ — https://a.example');

    const english = buildEvidenceDigestAnswer(
      { language_plan: { language: 'en' } },
      { known: [{ claim: 'operating margin', value: '18 percent' }], sources: [] },
      [], {}
    );
    expect(english).toContain('direct digest of the verified evidence');

    expect(buildEvidenceDigestAnswer({ language_plan: { language: 'ar' } }, {}, [], {})).toBeNull();
  });
});

describe('runResearchTurn synthesis budget and fallback (integration)', () => {
  beforeEach(() => jest.clearAllMocks());

  function happyWorkflowMocks(aiReasonResult) {
    return async (args) => {
      if (args.action === 'web_search') {
        return {
          ok: true,
          executed: true,
          result: {
            results: [
              { title: 'أهم الفرارات المالية للشركات النامية', snippet: 'أهم الفرارات المالية للشركات النامية ونموها', url: 'https://a.example/f' },
              { title: 'تحليل الفرارات المالية', snippet: 'تحليل الفرارات المالية للشركات النامية', url: 'https://b.example/g' }
            ]
          }
        };
      }
      if (args.action === 'web_explore') {
        return {
          ok: true,
          executed: true,
          result: {
            pages: [
              {
                url: 'https://a.example/f',
                evidence: { content_type: 'text/html', headers: {} },
                extracted: { format: 'html', title: 'أهم الفرارات المالية', text: 'أهم الفرارات المالية للشركات النامية توضح ربحية النمو.' }
              },
              {
                url: 'https://b.example/g',
                evidence: { content_type: 'text/html', headers: {} },
                extracted: { format: 'html', title: 'تحليل الفرارات المالية', text: 'تحليل الفرارات المالية للشركات النامية.' }
              }
            ],
            failures: [],
            blocked: []
          }
        };
      }
      if (args.action === 'evidence_verify') {
        return {
          ok: true,
          executed: true,
          result: {
            verification_state: 'SUPPORTED',
            source_count: 2,
            independent_publisher_count: 2,
            supported_claims: [],
            contradictions: [],
            residual_uncertainty: [],
            sources: args.input?.sources || []
          }
        };
      }
      if (args.action === 'research_synthesize') {
        return { ok: true, executed: true, result: { known: [], unknown: [], contradictions: [] } };
      }
      if (args.action === 'ai_reason') {
        return aiReasonResult;
      }
      throw new Error('unexpected action: ' + args.action);
    };
  }

  test('native synthesis receives a bounded timeout within the configured budget', async () => {
    executeGovernedAction.mockImplementation(happyWorkflowMocks(null));

    const result = await runResearchTurn(
      [{ role: 'user', content: 'ابحث عن أهم الفرارات المالية للشركات النامية' }],
      {},
      { req: {}, user: { id: 'user-1' }, supabase: {}, requestId: 'req-budget' }
    );

    const aiReasonCalls = executeGovernedAction.mock.calls.filter(([args]) => args.action === 'ai_reason');
    expect(aiReasonCalls.length).toBeGreaterThan(0);
    for (const [args] of aiReasonCalls) {
      expect(args.runtimeContext.timeoutMs).toBeLessThanOrEqual(15000);
      expect(args.runtimeContext.timeoutMs).toBeGreaterThanOrEqual(1000);
    }

    expect(result.failed).toBeFalsy();
    expect(result.research.answer_synthesis_budget_ms).toBe(15000);
    expect(result.research.repair_skipped_budget).toBe(false);
    expect(result.research.fallback_used).toBe(true);
  });

  test('native failure with sufficient evidence yields a deterministic evidence fallback, not a generic failure', async () => {
    executeGovernedAction.mockImplementation(happyWorkflowMocks(null));

    const result = await runResearchTurn(
      [{ role: 'user', content: 'ابحث عن أهم الفرارات المالية للشركات النامية' }],
      {},
      { req: {}, user: { id: 'user-1' }, supabase: {}, requestId: 'req-fallback' }
    );

    expect(result.failed).not.toBe(true);
    expect(result.research.answer_mode).toBe('evidence_fallback');
    expect(result.research.fallback_used).toBe(true);
    expect(result.research.decision_eligible).toBe(true);
    expect(result.research.evidence_count).toBeGreaterThan(0);
    expect(result.reply).toContain('الأدلة الموثقة');
    expect(result.research.repair_attempted).toBe(false);
  });

  test('source contract: generate and repair draw from one shared remaining budget', () => {
    const fs = require('fs');
    const path = require('path');
    const source = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'assistant', 'open-chat-tool-loop.js'),
      'utf8'
    );

    expect(source).toContain('Math.min(answerSynthesisBudgetMs, remainingAnswerSynthesisMs())');
    expect(source).toContain('remainingBeforeRepair >= ANSWER_REPAIR_MIN_REMAINING_MS');
    expect(source).toContain('repairSkippedBudget = true');
    expect(source).toContain('isEvidenceFallbackEligible(workflow)');
    expect(source).toContain('buildEvidenceDigestAnswer(intent, answerPackage, sourceRows, workflow)');
    expect(source).toContain('answer_synthesis_budget_ms:answerSynthesisBudgetMs');
    expect(source).toContain('repair_budget_ms:repairBudgetMs');
    expect(source).not.toContain('await generateResearchAnswer(intent, workflow, answerPackage, options);');
  });
});
