/**
 * @jest-environment node
 */
const fs=require('fs');
const path=require('path');

describe('studies and market research workspace',()=>{
  const ui=fs.readFileSync(path.join(process.cwd(),'components/service-request.js'),'utf8');
  const css=fs.readFileSync(path.join(process.cwd(),'components/service-workspace.css'),'utf8');
  const ar=fs.readFileSync(path.join(process.cwd(),'my-bonds/workspace/index.html'),'utf8');
  const en=fs.readFileSync(path.join(process.cwd(),'en/my-bonds/workspace/index.html'),'utf8');

  test('market research and sibling studies share an execution workspace',()=>{
    for(const code of ['market_research','scientific_research','feasibility_studies','risk_analysis']){
      expect(ui).toContain("'"+code+"'");
    }
    expect(ui).toContain('name="research_problem"');
    expect(ui).toContain("['scientific_research','البحث العلمي','Scientific research']");
    expect(ui).toContain('function studiesFallbackDetail()');
    expect(ui).toContain('function syncStudiesAssistantContext()');
    expect(ui).toContain("sessionStorage.setItem('bonds_service_assistant_context_v1'");
    expect(ui).toContain('research:runtime.packet');
    expect(ui).not.toContain('studiesBindingStrip');
    expect(ui).not.toContain('function renderStudiesBindingStrip()');
    expect(css).not.toContain('.studies-binding-strip');
    expect(ui).toContain('function renderStudiesWorkspaceShell()');
    expect(ui).toContain('function renderStudiesOperationalInputs()');
    expect(ui).toContain('function renderStudiesExecution(');
    expect(ui).toContain('studies-workspace-mode');
    expect(ui).toContain('if(!form?.fields?.length&&!isStudiesWorkspaceService())renderRequestProfile()');
    expect(ui).toContain('name="research_question"');
    expect(ui).toContain("'/v3/city-intelligence.html'");
    expect(ui).toContain("'/v3/investment-map.html'");
    expect(ui).toContain("if(!next.get('city') && next.get('locality')) next.set('city', next.get('locality'))");
    expect(ui).toContain('function studiesLocationFieldsHtml()');
    expect(ui).toContain('function bindStudiesCatalogDropdowns()');
    expect(ui).toContain("studiesSelectMarkup('studiesCountry'");
    expect(ui).toContain("'/api/v3/catalog/countries'");
    expect(ui).toContain('/api/v3/investment-taxonomy?country=');
    expect(ui).not.toContain('<input type="text" name="country_code"');
    expect(ui).not.toContain('<input type="text" name="sector_code"');
    expect(ui).not.toContain('<input type="text" name="activity_code"');
  });

  test('workspace HTML puts the work form before procedure chrome',()=>{
    expect(ar.indexOf('id="srRequestForm"')).toBeGreaterThan(-1);
    expect(ar.indexOf('id="srRequestForm"')).toBeLessThan(ar.indexOf('id="srProcedures"'));
    expect(en.indexOf('id="srRequestForm"')).toBeLessThan(en.indexOf('id="srProcedures"'));
    expect(ar).toContain('sr-work-card');
    expect(en).toContain('sr-work-card');
  });

  test('compact workspace hero overrides the marketing banner',()=>{
    expect(css).toContain('.canva-site .service-workspace-page .sr-hero');
    expect(css).toContain('studies-workspace-mode .sr-hero .sr-badges');
    expect(css).toContain('.studies-workspace-tabs');
    expect(css).toContain('.studies-workspace-context');
  });
});
