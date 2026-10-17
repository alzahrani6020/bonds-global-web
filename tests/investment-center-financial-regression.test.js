/**
 * @jest-environment node
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const InvestmentEngine = require('../calculators/investment-center/investment-engine');
const DecisionIntelligence = require('../calculators/investment-center/decision-intelligence');

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unclosed function ${name}`);
}

describe('investment-center end-to-end financial regression', () => {
  test('preserves canonical revenue, market share, competition, and base investment semantics', () => {
    const engineResult = InvestmentEngine.analyze({
      totalInvestment: 5000000,
      monthlyRevenue: 1000000,
      monthlyFixedCosts: 500000,
      monthlyVariableCosts: 400000,
      unitPrice: 100,
      unitVariableCost: 40,
      projectMonths: 60
    });

    expect(engineResult.metrics.monthlyRevenue).toBe(1000000);
    expect(engineResult.metrics.monthlyNetCashFlow).toBe(100000);

    const decision = DecisionIntelligence.analyze({
      marketSize: 100000000,
      competitorCount: 20,
      marketGrowthRate: 8
    }, engineResult, 'en');

    expect(engineResult.metrics.monthlyRevenue * 12).toBe(12000000);
    expect(decision.marketAnalysis.marketShare).toBeCloseTo(12, 6);
    expect(decision.marketAnalysis.competitionAssessment).toBe('high');

    const page = fs.readFileSync(
      path.resolve(__dirname, '..', 'calculators', 'investment-center', 'water-factory.html'),
      'utf8'
    );
    const fnSource = extractFunction(page, 'calculateEngineInputs');
    const context = {
      currentMode: 'expert',
      sectorId: 'water-factory',
      baseRiskWeight: 1.1
    };
    vm.createContext(context);
    vm.runInContext(fnSource, context);

    const inputs = new Proxy({
      factoryCost: 5000000,
      workingCapital: 300000,
      analysisDuration: 60,
      directSalesRate: 100,
      bottlePrice: 1
    }, {
      get(target, key) {
        return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : 0;
      }
    });

    const expertEngineInputs = context.calculateEngineInputs(inputs);
    expect(expertEngineInputs.totalInvestment).toBe(5000000);
    expect(expertEngineInputs.totalInvestment).not.toBe(300000);
  });
});
