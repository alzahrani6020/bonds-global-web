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
    expect(ui).toContain("studiesSelectMarkup('studiesActivity','activity_code',L.activityPh,sector?activity:'')");
    expect(ui).toContain("'/api/v3/catalog/countries'");
    expect(ui).toContain('/api/v3/investment-taxonomy?country=');
    expect(ui).not.toContain('<input type="text" name="country_code"');
    expect(ui).not.toContain('<input type="text" name="sector_code"');
    expect(ui).not.toContain('<input type="text" name="activity_code"');
  });

  test('never offers a standalone activity without a selected sector',async()=>{
    const vm=require('vm');
    const start=ui.indexOf('async function studiesOnSector(');
    const end=ui.indexOf('function studiesBindCatalogEvents()',start);
    expect(start).toBeGreaterThan(0);
    expect(end).toBeGreaterThan(start);
    const source=ui.slice(start,end);
    const fields={
      studiesSector:{value:''},
      studiesCountry:{value:'SA'},
      studiesActivity:{value:'retail',options:[{value:'retail'}]}
    };
    const fills=[];
    let urlWrites=0;
    let fetches=0;
    const context={
      $:selector=>fields[selector.replace(/^#/,'')]||null,
      lang:'ar',
      studiesCatalogLabel:()=>'', studiesFillSelect:(el,rows,key,label,placeholder,selected)=>{
        fills.push({rows,selected});
        el.options=[{value:''},...rows.map(row=>({value:row.code}))];
        el.value=selected&&el.options.some(row=>row.value===selected)?selected:'';
      },
      studiesCatalogJson:async()=>{fetches++;return {activities:[{code:'retail'}]}},
      studiesWriteLocationToUrl:()=>{urlWrites++},
      encodeURIComponent
    };
    const onSector=vm.runInNewContext(source+';studiesOnSector',context);
    await onSector(false);
    expect(fields.studiesActivity.value).toBe('');
    expect(fields.studiesActivity.options.map(x=>x.value)).toEqual(['']);
    expect(fills).toHaveLength(1);
    expect(fetches).toBe(0);
    expect(urlWrites).toBe(1);
  });

  test('only allows activities belonging to the selected sector and ignores stale responses',async()=>{
    const vm=require('vm');
    const start=ui.indexOf('async function studiesOnSector(');
    const end=ui.indexOf('function studiesBindCatalogEvents()',start);
    const source=ui.slice(start,end);
    const fields={
      studiesSector:{value:'SECTOR_A'},
      studiesCountry:{value:'SA'},
      studiesActivity:{value:'retail',options:[{value:'retail'}]}
    };
    let resolveFetch;
    let writes=0;
    const context={
      $:selector=>fields[selector.replace(/^#/,'')]||null,
      lang:'ar',studiesCatalogLabel:()=>'',encodeURIComponent,
      studiesFillSelect:(el,rows,key,label,placeholder,selected)=>{
        el.options=[{value:''},...rows.map(row=>({value:row.code}))];
        el.value=selected&&el.options.some(row=>row.value===selected)?selected:'';
      },
      studiesCatalogJson:()=>new Promise(resolve=>{resolveFetch=resolve}),
      studiesWriteLocationToUrl:()=>{writes++}
    };
    const onSector=vm.runInNewContext(source+';studiesOnSector',context);
    const pending=onSector(false);
    expect(fields.studiesActivity.value).toBe('');
    fields.studiesSector.value='SECTOR_B';
    resolveFetch({activities:[{code:'retail'}]});
    await pending;
    expect(fields.studiesActivity.value).toBe('');
    expect(fields.studiesActivity.options.map(x=>x.value)).toEqual(['']);
    expect(writes).toBe(0);
    context.studiesCatalogJson=async()=>({activities:[{code:'b_activity'}]});
    await onSector(false,'retail');
    expect(fields.studiesActivity.value).toBe('');
    expect(fields.studiesActivity.options.map(x=>x.value)).toEqual(['','b_activity']);
    expect(writes).toBe(1);
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
