/* Bonds Global — authenticated calculator snapshots inside existing project records.
 * No localStorage claim of permanent persistence; all reads/writes are user-scoped by API/RLS.
 */
(function(root){
  'use strict';
  var VALID_TYPES = ['cash-flow','loan','roi','pricing'];
  function requireType(type){
    if(VALID_TYPES.indexOf(type)<0)throw new Error('CALCULATOR_TYPE_INVALID');
  }
  function snapshotControls(){
    var controls=[];
    document.querySelectorAll('input[id],select[id],textarea[id]').forEach(function(el){
      var type=(el.type||'').toLowerCase();
      if(!el.id||el.disabled||['password','email','file','hidden','button','submit','reset','search'].indexOf(type)>=0)return;
      if(el.id.length>150)return;
      var value=String(el.value==null?'':el.value);
      if(value.length>2000)throw new Error('CALCULATOR_INPUT_TOO_LARGE');
      controls.push({id:el.id,value:value,checked:!!el.checked,kind:type});
    });
    if(!controls.length||controls.length>1000)throw new Error('CALCULATOR_INPUTS_INVALID');
    return controls;
  }
  function restoreControls(controls){
    var restored=0;
    controls.forEach(function(saved){
      if(!saved||typeof saved.id!=='string')return;
      var el=document.getElementById(saved.id);
      if(!el||!('value' in el)||el.disabled)return;
      var type=(el.type||'').toLowerCase();
      if(['password','email','file','hidden','button','submit','reset','search'].indexOf(type)>=0)return;
      if(typeof saved.value!=='string'||saved.value.length>2000)return;
      el.value=saved.value;
      if(type==='checkbox'||type==='radio')el.checked=saved.checked===true;
      el.dispatchEvent(new Event('input',{bubbles:true}));
      el.dispatchEvent(new Event('change',{bubbles:true}));
      restored++;
    });
    return restored;
  }
  async function sessionToken(){
    if(!root.BondsAuth?.getSession)throw new Error('AUTHENTICATION_REQUIRED');
    var auth=await root.BondsAuth.getSession();
    var token=auth?.data?.session?.access_token;
    if(!token)throw new Error('AUTHENTICATION_REQUIRED');
    return token;
  }
  async function request(url,opts){
    var token=await sessionToken();
    var response=await fetch(url,{
      ...opts,
      credentials:'same-origin',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+token,...(opts?.headers||{})}
    });
    var data=await response.json().catch(function(){return {}});
    if(!response.ok)throw new Error(typeof data.error==='string'?data.error:('HTTP_'+response.status));
    return data;
  }
  function savedId(){
    var id=new URLSearchParams(location.search).get('saved_project_id');
    return id&&/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id)?id:null;
  }
  async function save(input){
    requireType(input.type);
    var controls=snapshotControls();
    var existing=savedId();
    // Always create a new, durable snapshot rather than silently modifying an existing
    // financial record. Re-saving produces a separate version visible in My Bonds.
    var payload={
      name:input.title,
      sector:input.sector||'التحليل المالي',
      activity:input.activity||input.type,
      cityCode:null,
      currency:'SAR',capital:0,revenue:0,annualProfit:0,language:'ar',
      metadata:{
        source:input.type,
        summary:input.summary,
        href:location.pathname+'?saved_project_id=__PROJECT_ID__',
        calculator:{schema_version:1,type:input.type,controls:controls,metrics:input.metrics||{},saved_at:new Date().toISOString()}
      }
    };
    // Link will be reconstructed from the project id by My Bonds, rather than
    // storing an incorrect placeholder URL in the persistent record.
    payload.metadata.href=location.pathname;
    var response=await request('/api/v3/projects',{method:'POST',body:JSON.stringify(payload)});
    var id=response?.project?.id;
    if(!id)throw new Error('PROJECT_PERSISTENCE_UNCONFIRMED');
    var url=new URL(location.href);
    url.searchParams.set('saved_project_id',id);
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    return response.project;
  }
  async function restore(input){
    requireType(input.type);
    var id=savedId();
    if(!id)return {restored:false};
    var response=await request('/api/v3/projects/'+encodeURIComponent(id),{method:'GET'});
    var project=response?.project;
    var state=project?.metadata?.calculator;
    if(!state||state.schema_version!==1||state.type!==input.type||!Array.isArray(state.controls)){
      throw new Error('CALCULATOR_PROJECT_SNAPSHOT_NOT_FOUND');
    }
    var count=restoreControls(state.controls);
    if(count!==state.controls.length)throw new Error('CALCULATOR_SNAPSHOT_PARTIAL_RESTORE');
    if(typeof input.calculate==='function')input.calculate();
    return {restored:true,project:project};
  }
  root.BondsCalculatorProjects=Object.freeze({save:save,restore:restore});
})(window);
