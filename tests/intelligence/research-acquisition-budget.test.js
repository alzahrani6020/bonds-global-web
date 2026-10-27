/** @jest-environment node */
'use strict';

jest.mock('../../lib/services/service-execution-router', () => ({
  executeGovernedAction: jest.fn()
}));

const { executeGovernedAction } = require('../../lib/services/service-execution-router');
const {
  runResearchWorkflow,
  researchAcquisitionBudgetMs,
  RESEARCH_STOP_REASONS
} = require('../../lib/intelligence/research-workflow');
const {
  suggestUnverifiedQueryAliases,
  runResearchTurn
} = require('../../lib/assistant/open-chat-tool-loop');
const { verifyPersonIdentity, buildPersonEntityFrame } = require('../../lib/assistant/person-identity');

function noResultSearch() {
  return {
    ok: false,
    executed: true,
    error: {
      code: 'SEARCH_NO_RESULTS',
      attempts: [{ provider: 'bing', status_code: 200, code: 'SEARCH_NO_RESULTS' }]
    }
  };
}

function providerFailureSearch(failures) {
  return {
    ok: false,
    executed: true,
    error: {
      code: 'WEB_SEARCH_FAILED',
      attempts: failures.map(([provider, status_code, failure_class]) => ({
        provider, status_code, failure_class
      }))
    }
  };
}

function generalResearchRequest(query = 'فرارات مالية') {
  return {
    input: query,
    forceResearch: true,
    research: {
      enabled: true,
      query,
      queryVariants: [query, query + ' 2026', query + ' تحليل'],
      topic: query,
      minIndependentPublishers: 2
    }
  };
}

describe('research acquisition budget configuration', () => {
  const original = process.env.RESEARCH_ACQUISITION_BUDGET_MS;
  afterEach(() => {
    if (original === undefined) delete process.env.RESEARCH_ACQUISITION_BUDGET_MS;
    else process.env.RESEARCH_ACQUISITION_BUDGET_MS = original;
  });

  test('uses conservative default and clamps configured values', () => {
    delete process.env.RESEARCH_ACQUISITION_BUDGET_MS;
    expect(researchAcquisitionBudgetMs()).toBe(25000);
    process.env.RESEARCH_ACQUISITION_BUDGET_MS = '3000';
    expect(researchAcquisitionBudgetMs()).toBe(5000);
    process.env.RESEARCH_ACQUISITION_BUDGET_MS = '90000';
    expect(researchAcquisitionBudgetMs()).toBe(60000);
    process.env.RESEARCH_ACQUISITION_BUDGET_MS = 'not-a-number';
    expect(researchAcquisitionBudgetMs()).toBe(25000);
  });
});

describe('research acquisition budget enforcement', () => {
  beforeEach(() => jest.clearAllMocks());

  test('expired budget stops before any search and reports budget_exhausted', async () => {
    const executeCapability = jest.fn();
    const result = await runResearchWorkflow(generalResearchRequest(), {}, {
      executeCapability,
      researchBudget: { deadline: Date.now() - 1, totalMs: 25000, round: 1 }
    });

    expect(executeCapability).not.toHaveBeenCalled();
    expect(result.status).toBe('search_failed');
    expect(result.research_stop_reason).toBe(RESEARCH_STOP_REASONS.BUDGET_EXHAUSTED);
    expect(result.unknowns).toContain('RESEARCH_BUDGET_EXHAUSTED');
    expect(result.research_budget.total_ms).toBe(25000);
    expect(result.research_budget.remaining_ms).toBe(0);
    expect(result.research_budget.stop_reason).toBe(RESEARCH_STOP_REASONS.BUDGET_EXHAUSTED);
    expect(result.research_budget.search_round).toBe(1);
    expect(result.decisionEligible).toBe(false);
  });

  test('wrapper decorates successful results with budget telemetry and defaults to completed', async () => {
    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        return {
          ok: true,
          executed: true,
          result: {
            results: [
              { title: 'فرارات مالية', snippet: 'فرارات مالية للشركات', url: 'https://a.example/f' },
              { title: 'تحليل الفرارات', snippet: 'فرارات مالية ونمو', url: 'https://b.example/g' }
            ]
          }
        };
      }
      if (action === 'web_explore') {
        return {
          ok: true,
          executed: true,
          result: {
            pages: [
              {
                url: 'https://a.example/f',
                evidence: { content_type: 'text/html', headers: {} },
                extracted: { format: 'html', title: 'فرارات مالية', text: 'فرارات مالية توضح ربحية النمو.' }
              },
              {
                url: 'https://b.example/g',
                evidence: { content_type: 'text/html', headers: {} },
                extracted: { format: 'html', title: 'تحليل الفرارات', text: 'تحليل الفرارات المالية للشركات النامية.' }
              }
            ],
            failures: [],
            blocked: []
          }
        };
      }
      if (action === 'evidence_verify') {
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
            sources: input.sources
          }
        };
      }
      if (action === 'research_synthesize') {
        return { ok: true, executed: true, result: { known: [], unknown: [], contradictions: [] } };
      }
      throw new Error('unexpected: ' + action);
    });

    const result = await runResearchWorkflow(generalResearchRequest(), {}, { executeCapability });
    expect(result.decisionEligible).toBe(true);
    expect(result.research_budget.stop_reason).toBe(RESEARCH_STOP_REASONS.COMPLETED);
    expect(result.research_budget.attempted_query_count).toBeGreaterThan(0);
    expect(result.research_budget.provider_universe_count).toBe(4);
  });
});

describe('provider collapse and retry semantics', () => {
  beforeEach(() => jest.clearAllMocks());

  test('all providers down (403) stops after the first query without retries', async () => {
    const executeCapability = jest.fn(async () => providerFailureSearch([
      ['searxng', 403, 'HTTP_STATUS'],
      ['bing', 403, 'HTTP_STATUS'],
      ['duckduckgo', 403, 'HTTP_STATUS'],
      ['brave', 403, 'HTTP_STATUS']
    ]));

    const result = await runResearchWorkflow(generalResearchRequest(), {}, { executeCapability });

    expect(executeCapability.mock.calls.filter(([action]) => action === 'web_search')).toHaveLength(1);
    expect(result.status).toBe('search_failed');
    expect(result.research_stop_reason).toBe(RESEARCH_STOP_REASONS.PROVIDERS_EXHAUSTED);
    expect(result.research_budget.provider_disabled_count).toBe(4);
    expect(result.decisionEligible).toBe(false);
  });

  test('all providers rate-limited (429) does not waste a worthless retry', async () => {
    const executeCapability = jest.fn(async () => providerFailureSearch([
      ['searxng', 429, 'RATE_LIMITED'],
      ['bing', 429, 'RATE_LIMITED'],
      ['duckduckgo', 429, 'RATE_LIMITED'],
      ['brave', 429, 'RATE_LIMITED']
    ]));

    const result = await runResearchWorkflow(generalResearchRequest(), {}, { executeCapability });

    expect(executeCapability.mock.calls.filter(([action]) => action === 'web_search')).toHaveLength(1);
    expect(result.research_stop_reason).toBe(RESEARCH_STOP_REASONS.PROVIDERS_EXHAUSTED);
    expect(result.search_attempts.every(record => !record.retry)).toBe(true);
  });

  test('does not report providers_exhausted while Bing remains healthy', async () => {
    let searchCalls = 0;
    const executeCapability = jest.fn(async (action) => {
      if (action !== 'web_search') throw new Error('unexpected: ' + action);
      searchCalls += 1;
      if (searchCalls === 1) {
        return {
          ok: false,
          executed: true,
          error: {
            code: 'SEARCH_NO_RESULTS',
            attempts: [
              { provider: 'searxng', status_code: 429, failure_class: 'HTTP_429' },
              { provider: 'duckduckgo', status_code: 403, failure_class: 'HTTP_403' },
              { provider: 'brave', status_code: 429, failure_class: 'HTTP_429' },
              { provider: 'bing', status_code: 200, code: 'SEARCH_NO_RESULTS' }
            ]
          }
        };
      }
      return noResultSearch();
    });

    const result = await runResearchWorkflow(generalResearchRequest(), {}, { executeCapability });

    expect(searchCalls).toBeGreaterThan(1);
    expect(result.disabled_search_providers).toEqual(
      expect.arrayContaining(['searxng', 'duckduckgo', 'brave'])
    );
    expect(result.disabled_search_providers).not.toContain('bing');
    expect(result.research_stop_reason).not.toBe(RESEARCH_STOP_REASONS.PROVIDERS_EXHAUSTED);
    expect(result.research_budget.provider_universe_count).toBe(4);
  });

  test('a 403 provider is disabled and not retried by itself', async () => {
    const calls = [];
    const executeCapability = jest.fn(async (action, input) => {
      calls.push(input);
      return providerFailureSearch([['bing', 403, 'HTTP_STATUS']]);
    });

    const result = await runResearchWorkflow(generalResearchRequest(), {}, { executeCapability });

    expect(result.search_attempts.every(record => !record.retry)).toBe(true);
    expect(result.disabled_search_providers).toContain('bing');
  });

  test('a single unhealthy provider still allows one useful retry with the remaining providers', async () => {
    let searchCalls = 0;
    const executeCapability = jest.fn(async (action) => {
      if (action !== 'web_search') throw new Error('unexpected: ' + action);
      searchCalls += 1;
      if (searchCalls === 1) {
        return providerFailureSearch([['bing', 429, 'RATE_LIMITED']]);
      }
      return noResultSearch();
    });

    const result = await runResearchWorkflow(generalResearchRequest(), {}, { executeCapability });

    expect(result.search_attempts.some(record => record.retry === true)).toBe(true);
    expect(result.research_stop_reason).toBe(RESEARCH_STOP_REASONS.COMPLETED);
  });
});

describe('candidate discovery defers to verification', () => {
  beforeEach(() => jest.clearAllMocks());

  test('person candidate below 0.75 name_score reaches verification instead of being dropped', async () => {
    const frame = buildPersonEntityFrame('الدكتور طلال حسن الزهراني');
    const executeCapability = jest.fn(async (action) => {
      if (action === 'web_search') {
        return {
          ok: true,
          executed: true,
          result: {
            results: [
              { title: 'طلال حسن', snippet: 'طلال حسن رجل أعمال', url: 'https://a.example/p1' },
              { title: 'حسن الزهراني', snippet: 'حسن الزهراني أكاديمي', url: 'https://b.example/p2' }
            ]
          }
        };
      }
      if (action === 'web_explore') {
        return {
          ok: true,
          executed: true,
          result: {
            pages: [
              {
                url: 'https://a.example/p1',
                evidence: { content_type: 'text/html', headers: {} },
                extracted: { format: 'html', title: 'طلال حسن', text: 'طلال حسن رجل أعمال.' }
              },
              {
                url: 'https://b.example/p2',
                evidence: { content_type: 'text/html', headers: {} },
                extracted: { format: 'html', title: 'حسن الزهراني', text: 'حسن الزهراني أكاديمي.' }
              }
            ],
            failures: [],
            blocked: []
          }
        };
      }
      throw new Error('unexpected: ' + action);
    });

    const result = await runResearchWorkflow({
      input: 'من هو الدكتور طلال حسن الزهراني',
      forceResearch: true,
      research: {
        enabled: true,
        query: 'من هو الدكتور طلال حسن الزهراني',
        queryVariants: ['طلال حسن الزهراني'],
        topic: 'طلال حسن الزهراني',
        personEntityFrame: frame,
        minIndependentPublishers: 2
      }
    }, {}, { executeCapability });

    // Under the old discovery threshold this was search_low_relevance; now the
    // candidates survive discovery and verification decides fail-closed.
    expect(result.status).toBe('identity_unverified');
    expect(result.candidate_identities.length).toBeGreaterThan(0);
    expect(result.verified_identity.verification_state).toBe('INSUFFICIENT_EVIDENCE');
    expect(result.decisionEligible).toBe(false);
    expect(result.research_budget.candidate_count_before_verification)
      .toBe(result.candidate_identities.length);
  });

  test('verifyPersonIdentity keeps the final say: strong candidate verifies, weak stays insufficient, contradictions fail closed', () => {
    const frame = { entity_type: 'person', canonical_name: 'خالد محمد' };
    const strong = {
      source_id: 's1', name_score: 0.8, confidence: 0.7,
      resolution_basis: ['name'], contradictions: []
    };

    expect(verifyPersonIdentity(frame, [strong]).verification_state).toBe('VERIFIED');

    const weak = { ...strong, name_score: 0.6, confidence: 0.5 };
    expect(verifyPersonIdentity(frame, [weak]).verification_state).toBe('INSUFFICIENT_EVIDENCE');

    const contradicted = {
      source_id: 's2', name_score: 0.9, confidence: 0.8,
      resolution_basis: ['name'], contradictions: [{ field: 'qualifier', detail: 'x' }]
    };
    expect(verifyPersonIdentity(frame, [contradicted]).verification_state).toBe('CONTRADICTED');
  });
});

describe('bounded alias generation', () => {
  beforeEach(() => jest.clearAllMocks());

  const personIntent = {
    language_plan: {
      language: 'ar',
      intent: 'person_lookup',
      raw_text: 'من هو الدكتور طلال حسن الزهراني',
      normalized_text: 'من هو طلال حسن الزهراني',
      entity: {
        text: 'طلال حسن الزهراني',
        type: 'person',
        person_entity_frame: buildPersonEntityFrame('الدكتور طلال حسن الزهراني')
      }
    }
  };

  test('person lookup uses deterministic aliases first and never calls the native reasoner', async () => {
    const aliases = await suggestUnverifiedQueryAliases(personIntent, {});
    expect(aliases.length).toBeGreaterThanOrEqual(3);
    expect(executeGovernedAction).not.toHaveBeenCalled();
  });

  test('native fallback receives a bounded timeout derived from the remaining budget', async () => {
    const generalIntent = {
      language_plan: {
        language: 'ar',
        intent: 'research',
        raw_text: 'شركة X',
        normalized_text: 'شركة X',
        entity: { text: 'شركة X', type: 'general' }
      }
    };
    executeGovernedAction.mockResolvedValue({
      ok: true,
      executed: true,
      result: { result: { text: JSON.stringify({ candidates: ['شركة X القابضة'] }) } }
    });

    const aliases = await suggestUnverifiedQueryAliases(generalIntent, { remainingBudgetMs: 5000 });
    expect(executeGovernedAction).toHaveBeenCalledTimes(1);
    const runtimeContext = executeGovernedAction.mock.calls[0][0].runtimeContext;
    expect(runtimeContext.timeoutMs).toBeLessThanOrEqual(3000);
    expect(runtimeContext.timeoutMs).toBeLessThanOrEqual(8000);
    expect(aliases).toContain('شركة X القابضة');
  });

  test('native fallback is skipped when the remaining budget is too small', async () => {
    const generalIntent = {
      language_plan: {
        language: 'ar',
        intent: 'research',
        raw_text: 'شركة X',
        normalized_text: 'شركة X',
        entity: { text: 'شركة X', type: 'general' }
      }
    };

    const aliases = await suggestUnverifiedQueryAliases(generalIntent, { remainingBudgetMs: 1000 });
    expect(executeGovernedAction).not.toHaveBeenCalled();
    expect(aliases).toEqual(['شركة X']);
  });
});

describe('second search round never repeats round-one queries', () => {
  beforeEach(() => jest.clearAllMocks());

  test('workflow excludes queries that already ran in a previous round', async () => {
    const callQueries = [];
    const executeCapability = jest.fn(async (action, input) => {
      if (action === 'web_search') {
        callQueries.push(String(input.query || ''));
        return noResultSearch();
      }
      throw new Error('unexpected action: ' + action);
    });

    const request = generalResearchRequest();
    const roundOneAttempted = [request.research.queryVariants[0]];
    const result = await runResearchWorkflow({
      ...request,
      research: {
        ...request.research,
        excludedQueries: roundOneAttempted
      }
    }, {}, { executeCapability });

    const normalize = value => String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
    const excluded = new Set(roundOneAttempted.map(normalize));
    const attempted = (result.attempted_queries || []).map(normalize);
    expect(attempted.length).toBeGreaterThan(0);
    for (const query of attempted) {
      expect(excluded.has(query)).toBe(false);
    }
    for (const query of callQueries) {
      expect(excluded.has(normalize(query))).toBe(false);
    }
  });
});
