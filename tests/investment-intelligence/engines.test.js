/**
 * @jest-environment node
 */

const {
  evaluateReadiness,
  generateMemorandum,
  generateStory,
  reviewMemorandum,
  toHtml
} = require('../../lib/investment-intelligence');

function buildSampleContext(overrides = {}) {
  return {
    project: {
      id: 'proj-1',
      name: 'Test Restaurant',
      sector: 'restaurant',
      capital: 1_000_000,
      revenue: 2_000_000,
      annual_profit: 400_000,
      language: 'ar',
      currency: 'SAR'
    },
    asset: { asset_class: 'business', market_value: 1_200_000 },
    valuation: { value: 1_200_000, confidence_score: 80 },
    financing: { amount: 500_000, interest_rate: 0.065, tenor: 60, dscr: 1.4 },
    city: { name_ar: 'الرياض', name_en: 'Riyadh', country_code: 'SA', code: 'riyadh' },
    ucpResult: {
      confidence: 0.82,
      outputs: {
        annual_revenue: { value: 2_000_000 },
        net_profit: { value: 400_000 },
        dscr: { value: 1.4 }
      },
      engineResults: {
        valuation: { value: 1_200_000, confidence: 82 },
        feasibility: { npv: 850_000, irr: 0.22, payback: 3.5, confidence: 80 },
        financing: { dscr: 1.4, ltv: 0.6, confidence: 78 },
        risk: { risk_grade: 'B', confidence: 75 }
      },
      scenarios: [
        { scenarioType: 'expected', resultValue: 400_000 },
        { scenarioType: 'optimistic', resultValue: 550_000 }
      ]
    },
    ...overrides
  };
}

describe('Investment Intelligence Engines', () => {
  test('evaluates investment readiness', async () => {
    const context = buildSampleContext();
    const result = await evaluateReadiness({ projectData: context });
    expect(result.engine).toBe('investment_readiness');
    expect(result.output.readinessScore).toBeGreaterThan(0);
    expect(result.output.grade).toBeDefined();
    expect(Array.isArray(result.output.missingItems)).toBe(true);
    expect(Array.isArray(result.output.actionPlan)).toBe(true);
  });

  test('generates investment memorandum with all sections', async () => {
    const context = buildSampleContext();
    const result = await generateMemorandum({ projectData: context, options: { useAi: false } });
    expect(result.engine).toBe('investment_memorandum');
    expect(result.confidence).toBeGreaterThan(0);
    const sections = result.output.sections;
    expect(sections.executiveSummary).toBeDefined();
    expect(sections.investmentHighlights).toBeDefined();
    expect(sections.valuation).toBeDefined();
    expect(sections.riskAnalysis).toBeDefined();
    expect(sections.swot).toBeDefined();
    expect(result.output.readiness).toBeDefined();
    expect(result.output.story).toBeDefined();
  });

  test('generates investment story with seven whys', async () => {
    const context = buildSampleContext();
    const result = await generateStory({ projectData: context, options: { useAi: false } });
    expect(result.engine).toBe('investment_story');
    expect(result.output.whyThisProject).toBeDefined();
    expect(result.output.whyNow).toBeDefined();
    expect(result.output.whyThisMarket).toBeDefined();
    expect(result.output.whyThisTeam).toBeDefined();
    expect(result.output.whyThisOpportunity).toBeDefined();
    expect(result.output.whyThisValuation).toBeDefined();
    expect(result.output.whyThisFunding).toBeDefined();
  });

  test('reviews a memorandum with fallback', async () => {
    const memorandum = {
      id: 'memo-1',
      project_id: 'proj-1',
      type: 'investment_memorandum',
      language: 'ar',
      content: {
        sections: {
          executiveSummary: { text: 'Good opportunity' },
          riskAnalysis: { grade: 'B' },
          valuation: { value: 1200000 }
        }
      },
      confidence_score: 75
    };
    const result = await reviewMemorandum(memorandum, { useAi: false });
    expect(result.engine).toBe('ai_investment_review');
    expect(result.output.verdict).toBeDefined();
    expect(Array.isArray(result.output.issues)).toBe(true);
  });

  test('renders HTML document', async () => {
    const context = buildSampleContext();
    const result = await generateMemorandum({ projectData: context, options: { useAi: false } });
    const html = toHtml({
      id: 'memo-1',
      content: result.output,
      confidence_score: result.confidence,
      language: 'ar'
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain(result.output.title);
    expect(html).toContain('executiveSummary');
  });
});
