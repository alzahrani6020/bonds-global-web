'use strict';

const { feasibilityAnalysis } = require('../../lib/finance/engines/feasibility-engine');
const { assessFeasibilityArtifact } = require('../../lib/finance/feasibility-artifact-gate');
const { render } = require('../../components/feasibility-report');

const run = (extra={}) => feasibilityAnalysis({
  initial_investment:100000,
  discount_rate:0.1,
  years:5,
  cash_flows:[30000,30000,30000,30000,30000],
  ...extra
});
const wrap = computed => ({result:{engineResults:{feasibility:computed}}});

describe('institutional feasibility report and financial boundaries', () => {
  test('independent annuity benchmark remains unchanged', () => {
    const out=run();
    expect(out.executed).toBe(true);
    expect(out.metrics.npv).toBeCloseTo(13723.60308225351,5);
    expect(out.metrics.irr).toBeCloseTo(0.15238237116630649,7);
    expect(assessFeasibilityArtifact(wrap(out)).complete).toBe(true);
  });

  test('rejects unsupported or assumed discount, zero investment and mismatched horizon', () => {
    const base={initial_investment:100000,cash_flows:[30000,30000],years:2};
    for(const input of [
      base,
      {...base,discount_rate:null},
      {...base,discount_rate:-0.01},
      {...base,discount_rate:1.01},
      {...base,discount_rate:0.1,initial_investment:0},
      {...base,discount_rate:0.1,years:3}
    ]) {
      const result=feasibilityAnalysis(input);
      expect(result.executed).toBe(false);
      expect(assessFeasibilityArtifact(wrap(result)).complete).toBe(false);
    }
  });

  test('computes a unique conventional IRR above the old 1000 percent ceiling', () => {
    const out=feasibilityAnalysis({initial_investment:1,discount_rate:0.1,years:1,cash_flows:[100]});
    expect(out.metrics.irr).toBeCloseTo(99,6);
    expect(out.diagnostics.irr_issue).toBeNull();
  });

  test('refuses arbitrary IRR from nonconventional flows with multiple sign changes', () => {
    const out=feasibilityAnalysis({initial_investment:100,discount_rate:0.1,years:2,cash_flows:[230,-132]});
    expect(out.metrics.npv).not.toBeNull();
    expect(out.metrics.irr).toBeNull();
    expect(out.diagnostics.irr_issue).toBe('multiple_irr_possible');
    expect(assessFeasibilityArtifact(wrap(out)).complete).toBe(false);
  });

  test('report is calculated-only, escaped, bilingual and never claims unsupported statements', () => {
    const payload={...wrap(run()),artifact_persistence:{status:'saved',artifact_id:'a-123'}};
    const inputs={project_name:'<img src=x onerror=alert(1)>',currency:'SAR'};
    const html=render({payload,inputs,lang:'ar',projectId:'project-1'});
    expect(html).toContain('13,723.6031');
    expect(html).toContain('15.2382');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).toContain('a-123');
    expect(html).toContain('لا تُنشأ أرقام');
    expect(html).toContain('لم تُتحقق المصادر التجارية');
    const en=render({payload,inputs,lang:'en',projectId:'project-1'});
    expect(en).toContain('Annual cash flow schedule');
    expect(en).toContain('Financial statements');
  });

  test('never produces a report for partial or non-unique IRR results', () => {
    const payload=wrap(feasibilityAnalysis({initial_investment:100,discount_rate:0.1,years:2,cash_flows:[230,-132]}));
    expect(()=>render({payload,inputs:{}})).toThrow('FEASIBILITY_REPORT_REQUIRES_CALCULATED_METRICS');
  });

  test('UI prints the exact submitted snapshot and preserves JSON download', () => {
    const fs=require('fs'),path=require('path');
    const client=fs.readFileSync(path.join(__dirname,'../../components/service-request.js'),'utf8');
    expect(client).toContain("renderExecutionResult(execution, values)");
    expect(client).toContain("window.BondsFeasibilityReport.render");
    expect(client).toContain("id=\"srPrintFeasibilityReport\"");
    expect(client).toContain("id=\"srDownloadExecution\"");
    const sw=fs.readFileSync(path.join(__dirname,'../../sw.js'),'utf8');
    expect(sw).toContain("'/components/feasibility-report.js?v=1'");
  });
});
