/** @jest-environment node */
'use strict';
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../../calculators/project-snapshots.js'),'utf8');

function harness(options={}){
  const id='123e4567-e89b-42d3-a456-426614174000';
  const control={id:'amount',type:'number',value:'1250',disabled:false,checked:false,
    dispatchEvent:jest.fn()};
  const document={
    querySelectorAll:jest.fn(selector=>selector.startsWith('input')?[control]:[]),
    getElementById:jest.fn(key=>key===control.id?control:null)
  };
  const window={BondsAuth:{getSession:async()=>({data:{session:{access_token:options.token===false?null:'test-token'}}})}};
  const location={search:'',pathname:'/calculators/loan',href:'https://bonds-global.com/calculators/loan',origin:'https://bonds-global.com'};
  const history={state:null,replaceState:jest.fn((_state,_unused,url)=>{
    location.search=new URL(url,location.origin).search;
  })};
  const fetch=jest.fn(async(url,opts)=>{
    if(options.status===503)return {ok:false,status:503,json:async()=>({error:'UNAVAILABLE'})};
    if(opts.method==='POST')return {ok:true,status:201,json:async()=>({project:{id}})};
    return {ok:true,status:200,json:async()=>({project:{
      id,metadata:{calculator:{schema_version:1,type:'loan',
        controls:[{id:'amount',value:'990',checked:false,kind:'number'}]}}}
    })};
  });
  vm.runInNewContext(source,{window,document,location,history,fetch,URL,URLSearchParams,
    Event:function Event(){},console});
  return {api:window.BondsCalculatorProjects,document,control,fetch,history,location,id};
}

describe('durable calculator project snapshots',()=>{
  test('creates an authenticated project and only confirms after an ID is returned',async()=>{
    const h=harness();
    const p=await h.api.save({type:'loan',title:'دراسة قرض وتمويل',summary:'قسط 100'});
    expect(p.id).toBe(h.id);
    expect(h.fetch).toHaveBeenCalledTimes(1);
    const [url,opts]=h.fetch.mock.calls[0];
    expect(url).toBe('/api/v3/projects');
    expect(opts.headers.Authorization).toBe('Bearer test-token');
    const payload=JSON.parse(opts.body);
    expect(payload.metadata.calculator.controls[0].value).toBe('1250');
    expect(payload.metadata.calculator.type).toBe('loan');
    expect(h.location.search).toContain('saved_project_id=');
  });
  test('returns failure without showing a saved project when server rejects the write',async()=>{
    const h=harness({status:503});
    await expect(h.api.save({type:'loan',title:'Loan',summary:'x'})).rejects.toThrow('UNAVAILABLE');
    expect(h.history.replaceState).not.toHaveBeenCalled();
  });
  test('requires login and does not write when session is absent',async()=>{
    const h=harness({token:false});
    await expect(h.api.save({type:'loan',title:'Loan',summary:'x'})).rejects.toThrow('AUTHENTICATION_REQUIRED');
    expect(h.fetch).not.toHaveBeenCalled();
  });
  test('loads the owned snapshot, restores inputs, recalculates',async()=>{
    const h=harness();
    h.location.search='?saved_project_id='+h.id;
    const calculate=jest.fn();
    const result=await h.api.restore({type:'loan',calculate});
    expect(result.restored).toBe(true);
    expect(h.fetch.mock.calls[0][0]).toBe('/api/v3/projects/'+h.id);
    expect(h.control.value).toBe('990');
    expect(calculate).toHaveBeenCalledTimes(1);
  });
  test('blocks mismatch between snapshot type and current calculator',async()=>{
    const h=harness();
    h.location.search='?saved_project_id='+h.id;
    await expect(h.api.restore({type:'pricing'})).rejects.toThrow('CALCULATOR_PROJECT_SNAPSHOT_NOT_FOUND');
  });
});

describe('calculator page integration',()=>{
  const names=[['cash-flow','saveCashFlowProject'],['loan','saveLoanProject'],['roi','saveROIProject'],['pricing','savePricingProject']];
  for(const [name,fn] of names){
    test(name+' stores via the authenticated API instead of local summary',()=>{
      const html=fs.readFileSync(path.join(__dirname,'../../calculators/'+name+'.html'),'utf8');
      expect(html).toContain('project-snapshots.js?v=1');
      expect(html).toContain('window.'+fn+' = async function()');
      expect(html).toContain('BondsCalculatorProjects.save(');
      expect(html).toContain("BondsCalculatorProjects.restore({type:'"+name+"'");
      expect(html).not.toContain("localStorage.setItem('bonds_guest_projects'");
    });
  }
  test('My Bonds opens the original calculator from a server-owned project',()=>{
    const html=fs.readFileSync(path.join(__dirname,'../../my-bonds/index.html'),'utf8');
    expect(html).toContain("p.metadata?.calculator?.type");
    expect(html).toContain("'?saved_project_id=' + encodeURIComponent(p.id)");
  });
});
