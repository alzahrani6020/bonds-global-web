/**
 * Tests for lib/ai/orchestrator.js
 *
 * These tests verify model routing, cost calculation, financial guardrails,
 * and OpenAI fallback behaviour without making real network calls.
 */

const mockSupabaseClient = {
  from: jest.fn(() => mockSupabaseClient),
  select: jest.fn(() => mockSupabaseClient),
  insert: jest.fn(() => mockSupabaseClient),
  update: jest.fn(() => mockSupabaseClient),
  upsert: jest.fn(() => mockSupabaseClient),
  eq: jest.fn(() => mockSupabaseClient),
  single: jest.fn(() => Promise.resolve({ data: null, error: new Error('not found') })),
};

jest.mock('../../lib/api/supabase', () => () => mockSupabaseClient);

const {
  analyze,
  calculateCost,
  selectModel,
  applyFinancialGuardrails,
  MODEL_TIERS,
} = require('../../lib/ai/orchestrator');

describe('AI Orchestrator', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    delete process.env.OPENAI_MODEL;
    process.env.OPENAI_API_KEY = 'test-key';

    // Default Supabase mocks
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.upsert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: new Error('not found') });
  });

  afterEach(() => {
    global.fetch = undefined;
  });

  describe('selectModel', () => {
    it('selects the right tier model per analysis type', () => {
      expect(selectModel('feasibility_study')).toBe(MODEL_TIERS.feasibility_study);
      expect(selectModel('credit_assessment')).toBe(MODEL_TIERS.credit_assessment);
      expect(selectModel('city_analysis')).toBe(MODEL_TIERS.city_analysis);
    });

    it('honours an explicitly requested model', () => {
      expect(selectModel('feasibility_study', 'gpt-4o-mini')).toBe('gpt-4o-mini');
    });

    it('honours OPENAI_MODEL env override', () => {
      process.env.OPENAI_MODEL = 'gpt-5.4-mini';
      expect(selectModel('feasibility_study')).toBe('gpt-5.4-mini');
    });
  });

  describe('calculateCost', () => {
    it('calculates cost for gpt-5.5', () => {
      // 1k input @ $5/M + 500 output @ $30/M = 0.005 + 0.015
      expect(calculateCost('gpt-5.5', 1000, 500)).toBe(0.02);
    });

    it('falls back to default model pricing for unknown models', () => {
      const cost = calculateCost('unknown-model', 1_000_000, 0);
      expect(cost).toBeGreaterThan(0);
    });
  });

  describe('applyFinancialGuardrails', () => {
    it('overrides AI invest recommendation when financials are bad', () => {
      const result = applyFinancialGuardrails(
        { recommendations: ['المشروع مُوصى به للاستثمار'], risk_score: 30 },
        'feasibility_study',
        { investment: 1_000_000, npv: -50_000, irr: 5, dscr: 0.8 }
      );

      expect(result.guardrails.computed_verdict).toBe('avoid');
      expect(result.guardrails.ai_overridden).toBe(true);
      expect(result.recommendations[0]).toContain('تجنب');
    });

    it('does not override when AI recommendation matches financials', () => {
      const result = applyFinancialGuardrails(
        { recommendations: ['المشروع مُوصى به للاستثمار'], risk_score: 30 },
        'feasibility_study',
        { investment: 1_000_000, npv: 250_000, irr: 22, dscr: 1.6 }
      );

      expect(result.guardrails.computed_verdict).toBe('invest');
      expect(result.guardrails.ai_overridden).toBe(false);
    });
  });

  describe('analyze', () => {
    function mockOpenAiResponse(content) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: JSON.stringify(content) } }],
          usage: { prompt_tokens: 1000, completion_tokens: 500 },
        }),
      };
    }

    function makeAiResult(recommendations = ['المشروع مُوصى به']) {
      return {
        executive_summary: 'ملخص',
        analysis: 'تحليل',
        risk_score: 30,
        risk_level: 'منخفض',
        recommendations,
        strengths: [],
        weaknesses: [],
        financial_summary: { key_metrics: [], notes: '' },
        confidence: 80,
        missing_data: [],
      };
    }

    it('uses gpt-5.5 and applies guardrails for a feasibility study', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockOpenAiResponse(makeAiResult())
      );

      mockSupabaseClient.insert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'req-123' }, error: null }),
        }),
      });

      const res = await analyze({
        userId: 'user-1',
        type: 'feasibility_study',
        payload: {
          sector: 'restaurant',
          city: 'Jeddah',
          investment: 1_000_000,
          monthly_revenue: 50_000,
          monthly_costs: 60_000,
          npv: -100_000,
          irr: 4,
          dscr: 0.7,
        },
      });

      expect(res.cached).toBe(false);
      expect(res.result.guardrails.ai_overridden).toBe(true);
      expect(res.result.guardrails.computed_verdict).toBe('avoid');
      expect(res.costUsd).toBeGreaterThan(0);
      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.model).toBe('gpt-5.5');
    });

    it('falls back to the next model if the preferred model is unavailable', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: async () => 'The model gpt-5.5 does not exist',
        })
        .mockResolvedValue(mockOpenAiResponse(makeAiResult(['توصية محايدة'])));

      mockSupabaseClient.insert.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: { id: 'req-124' }, error: null }),
        }),
      });

      const res = await analyze({
        userId: 'user-1',
        type: 'city_analysis',
        payload: { city: 'Jeddah', sector: 'restaurant', population: 5_000_000 },
      });

      expect(res.cached).toBe(false);
      expect(global.fetch).toHaveBeenCalledTimes(2);
      const firstBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
      expect(firstBody.model).toBe('gpt-5.4');
      expect(secondBody.model).toBe('gpt-4o');
    });
  });
});
