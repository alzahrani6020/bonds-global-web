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
    // Validate the entire snapshot before modifying any visible input.
    // Do not report a partial restore as a successful one.
    if(!Array.isArray(controls)||controls.length===0||controls.length>1000)throw new Error('CALCULATOR_SNAPSHOT_INVALID');
    var prepared=controls.map(function(saved){
      if(!saved||typeof saved.id!=='string'||typeof saved.value!=='string'||saved.value.length>2000){
        throw new Error('CALCULATOR_SNAPSHOT_INVALID');
      }
      var el=document.getElementById(saved.id);
      if(!el||!('value' in el)||el.disabled)throw new Error('CALCULATOR_SNAPSHOT_PARTIAL_RESTORE');
      var type=(el.type||'').toLowerCase();
      if(['password','email','file','hidden','button','submit','reset','search'].indexOf(type)>=0){
        throw new Error('CALCULATOR_SNAPSHOT_INVALID');
      }
      if((type==='checkbox'||type==='radio')&&saved.checked!==true&&saved.checked!==false){
        throw new Error('CALCULATOR_SNAPSHOT_INVALID');
      }
      return {el:el,value:saved.value,checked:saved.checked,type:type};
    });
    // Apply controls as a batch: dispatching change per input here can reset
    // dependent fields (pricing profile, financial options) during restoration.
    prepared.forEach(function(item){
      item.el.value=item.value;
      if(item.type==='checkbox'||item.type==='radio')item.el.checked=item.checked;
    });
    return prepared.length;
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
  function outputSnapshot(){
    var outputs={};
    document.querySelectorAll('[id^="res"],[id$="Result"],[id$="Period"],[id^="becKpi"]').forEach(function(el){
      if(!el.id||Object.keys(outputs).length>=120)return;
      var text=String(el.textContent||'').trim();
      if(text&&text.length<=300)outputs[el.id]=text;
    });
    return outputs;
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
        href:location.pathname,
        calculator:{schema_version:1,type:input.type,controls:controls,outputs:outputSnapshot(),saved_at:new Date().toISOString()}
      }
    };
    var response=await request('/api/v3/projects',{method:'POST',body:JSON.stringify(payload)});
    var id=response?.project?.id;
    if(!id)throw new Error('PROJECT_PERSISTENCE_UNCONFIRMED');
    // The creation response is insufficient: verify a subsequent user-scoped read
    // before reporting that the calculator inputs were saved.
    // Preserve the new project's link even if verification fails; retrying POST
    // could otherwise create an unintended duplicate record.
    var url=new URL(location.href);
    url.searchParams.set('saved_project_id',id);
    history.replaceState(history.state,'',url.pathname+url.search+url.hash);
    var persisted;
    try{
      persisted=(await request('/api/v3/projects/'+encodeURIComponent(id),{method:'GET'}))?.project;
    }catch(readError){
      throw new Error('PROJECT_SAVED_READBACK_UNCONFIRMED');
    }
    var state=persisted?.metadata?.calculator;
    if(persisted?.id!==id||state?.schema_version!==1||state?.type!==input.type||
       !Array.isArray(state.controls)||state.controls.length!==controls.length||
       state.controls.some(function(item,index){
         return item?.id!==controls[index].id||item.value!==controls[index].value||
                item.checked!==controls[index].checked;
       })){
      throw new Error('PROJECT_SAVED_READBACK_MISMATCH');
    }
    return persisted;
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
