'use strict';

const fs = require('fs');
const path = require('path');
const { finite } = require('../../lib/finance/shared/math');
const { feasibilityAnalysis } = require('../../lib/finance/engines/feasibility-engine');

describe('feasibility integrity gate', () => {
  const ui = fs.readFileSync(path.join(__dirname, '../../components/service-request.js'), 'utf8');

  test('updated shared study workspace JavaScript parses without syntax errors', () => {
    expect(() => new Function(ui)).not.toThrow();
  });

  test('parses study cash-flow entries into a typed, validated array', () => {
    const vm = require('vm');
    const start = ui.indexOf('function collectValues(){');
    const end = ui.indexOf('// Never claim a saved request', start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const source = ui.slice(start, end);
    const make = (cashFlows, percentage = '10', years = '3') => {
      const elements = [
        {name:'cash_flows_text', type:'textarea', value:cashFlows},
        {name:'discount_rate_pct', type:'number', value:percentage},
        {name:'years', type:'number', value:years}
      ];
      const context = {
        serviceCode:'feasibility_studies',
        isFinancialWorkspaceService:()=>false,
        lang:'en',
        $:()=>({querySelectorAll:()=>elements})
      };
      return vm.runInNewContext(source + '; collectValues', context)();
    };
    const result = make('100; 0; -20');
    expect(Array.from(result.cash_flows)).toEqual([100, 0, -20]);
    expect(result.discount_rate).toBeCloseTo(0.1, 9);
    expect(() => make('100;;200')).toThrow('Invalid cash flows');
    expect(() => make('100;none;200')).toThrow('Invalid cash flows');
    expect(() => make('100;200', '10', '3')).toThrow('Study horizon');
    expect(() => make('100;200;300', '')).toThrow('Provide a discount rate');
  });

  test('rejects missing financial fields instead of interpreting them as zero', () => {
    expect(finite(null)).toBeNull();
    expect(finite(undefined)).toBeNull();
    expect(finite('')).toBeNull();
    expect(finite('   ')).toBeNull();
    expect(finite(false)).toBeNull();
    expect(finite('0')).toBe(0);
    expect(finite(0)).toBe(0);
  });

  test('feasibility engine fails closed for missing investment and incomplete cash flows', () => {
    const missing = feasibilityAnalysis({ initial_investment: null, cash_flows: [100, 100] });
    expect(missing.executed).toBe(false);
    expect(missing.required_inputs).toContain('initial_investment');
    expect(missing.metrics.npv).toBeNull();

    const invalid = feasibilityAnalysis({ initial_investment: 1000, cash_flows: [300, null, 400] });
    expect(invalid.executed).toBe(false);
    expect(invalid.required_inputs).toContain('cash_flows[1]_numeric');
    expect(invalid.metrics.npv).toBeNull();

    const negative = feasibilityAnalysis({ initial_investment: -1000, cash_flows: [200, 250] });
    expect(negative.executed).toBe(false);
    expect(negative.required_inputs).toContain('initial_investment_non_negative');

    const badRate = feasibilityAnalysis({ initial_investment: 1000, discount_rate: -1, cash_flows: [200, 250] });
    expect(badRate.executed).toBe(false);
  });

  test('invalid explicit discount rates and projection horizons fail closed', () => {
    const invalidRate = feasibilityAnalysis({
      initial_investment: 1000, annual_cash_flow: 400,
      discount_rate: '', years: 5
    });
    expect(invalidRate.executed).toBe(false);
    expect(invalidRate.required_inputs).toContain('discount_rate_gt_minus_one');
    expect(invalidRate.metrics.npv).toBeNull();

    for (const years of [0, 61, 1.5, 'invalid']) {
      const invalidYears = feasibilityAnalysis({
        initial_investment: 1000, annual_cash_flow: 400, years
      });
      expect(invalidYears.executed).toBe(false);
      expect(invalidYears.required_inputs).toContain('years_integer_1_to_60');
    }

    const missingYearFlow = feasibilityAnalysis({
      initial_investment: 1000, cash_flows: Array(61).fill(50)
    });
    expect(missingYearFlow.executed).toBe(false);
    expect(missingYearFlow.required_inputs).toContain('cash_flows_max_60_periods');
  });

  test.each([
    ['small', 100000],
    ['large', 10000000],
    ['mega', 1000000000]
  ])('calculates a basic cash-flow reference for %s without claiming institution-level readiness', (_size, investment) => {
    const result = feasibilityAnalysis({
      initial_investment: investment,
      cash_flows: Array(5).fill(investment * 0.3),
      discount_rate: 0.1
    });
    const expected = -investment + Array.from({ length: 5 }, (_, i) => investment * 0.3 / (1.1 ** (i + 1)))
      .reduce((sum, flow) => sum + flow, 0);
    expect(result.executed).toBe(true);
    expect(result.metrics.npv).toBeCloseTo(expected, 4);
    expect(result.metrics.irr).toBeGreaterThan(0);
  });

  test('study workspace obeys the server intake flag before considering capabilities', () => {
    expect(ui).toContain('if(isStudiesWorkspaceService())return detail?.intake?.supported===true;');
    expect(ui).toContain("if(el.type==='radio'){if(el.checked)values[el.name]=el.value;return;}");
  });

  test('does not clear study draft if the result has no project artifact', () => {
    expect(ui).toContain("const isStudyArtifact=['feasibility_studies','risk_analysis'].includes(serviceCode)");
    expect(ui).toContain("if(artifactSaved)clearWorkspaceDraft()");
    expect(ui).toContain('srDownloadExecution');
  });

  test('shows the investment decision integrity result separate from executed status', () => {
    expect(ui).toContain('result.confidence?.decisionIntegrity');
    expect(ui).toContain("blocked:lang==='ar'?'غير صالح للاعتماد'");
    expect(ui).toContain('name="project_size" required');
    expect(ui).toContain('value="mega"');
    expect(ui).toContain('name="currency" required');
    expect(ui).toContain("currency:values.currency||'SAR'");
  });
});
