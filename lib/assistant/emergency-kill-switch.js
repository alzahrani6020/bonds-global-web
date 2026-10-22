'use strict';

const GLOBAL_ASSISTANT_FEATURE = 'assistant';
const READ_ONLY_ASSISTANT_FEATURE = 'assistant.read_only';

const MUTATING_ROUTE_FEATURES = Object.freeze({
  'POST /assistant/notifications/read':'assistant.notifications.read',
  'POST /assistant/confirmation/prepare':'assistant.confirmation.prepare',
  'POST /assistant/confirmation/resolve':'assistant.confirmation.resolve',
  'POST /assistant/idempotency/claim':'assistant.idempotency.claim',
  'POST /assistant/idempotency/resolve':'assistant.idempotency.resolve',
  'POST /assistant/workflows/save':'assistant.workflows.save',
  'POST /assistant/workflows/transition':'assistant.workflows.transition',
  'POST /assistant/workflows/status':'assistant.workflows.status',
  'POST /assistant/events/apply':'assistant.events.apply',
  'POST /assistant/approvals':'assistant.approvals.request',
  'POST /assistant/escalations':'assistant.escalations.create'
});

function featureForAssistantMutation(path,method){
  return MUTATING_ROUTE_FEATURES[`${String(method||'').toUpperCase()} ${String(path||'')}`]||null;
}

function switchIsActive(row,nowMs=Date.now()){
  if(!row||row.disabled!==true)return false;
  if(!row.expires_at)return true;
  const expiresAt=new Date(row.expires_at).getTime();
  if(!Number.isFinite(expiresAt))return true;
  return expiresAt>nowMs;
}

function publicKillSwitchState({feature,row,mode='disabled'}){
  return {
    feature,
    disabled:true,
    mode,
    expires_at:row?.expires_at||null,
    execution_authorized:false,
    auto_execute:false
  };
}

async function loadAssistantControlRows({supabase,features}){
  if(!supabase||typeof supabase.from!=='function'){
    throw new Error('ASSISTANT_KILL_SWITCH_UNAVAILABLE');
  }
  const unique=[...new Set(features.filter(Boolean))];
  const {data,error}=await supabase
    .from('admin_ai_kill_switches')
    .select('feature,disabled,reason,expires_at,updated_at')
    .in('feature',unique);
  if(error)throw new Error('ASSISTANT_KILL_SWITCH_LOOKUP_FAILED');
  return Array.isArray(data)?data:[];
}

async function getAssistantKillSwitchState({supabase,feature,nowMs=Date.now()}){
  if(!feature)return {blocked:false,feature:null};
  const rows=await loadAssistantControlRows({
    supabase,
    features:[GLOBAL_ASSISTANT_FEATURE,READ_ONLY_ASSISTANT_FEATURE,feature]
  });

  const globalRow=rows.find(row=>row.feature===GLOBAL_ASSISTANT_FEATURE);
  const readOnlyRow=rows.find(row=>row.feature===READ_ONLY_ASSISTANT_FEATURE);
  const featureRow=rows.find(row=>row.feature===feature);

  if(switchIsActive(globalRow,nowMs)){
    return {
      blocked:true,
      ...publicKillSwitchState({
        feature:GLOBAL_ASSISTANT_FEATURE,
        row:globalRow,
        mode:'disabled'
      })
    };
  }

  if(switchIsActive(readOnlyRow,nowMs)){
    return {
      blocked:true,
      ...publicKillSwitchState({
        feature:READ_ONLY_ASSISTANT_FEATURE,
        row:readOnlyRow,
        mode:'read_only_emergency'
      })
    };
  }

  if(switchIsActive(featureRow,nowMs)){
    return {
      blocked:true,
      ...publicKillSwitchState({
        feature,
        row:featureRow,
        mode:'feature_disabled'
      })
    };
  }

  return {blocked:false,feature,mode:'normal'};
}

async function getAssistantEmergencyModeState({supabase,nowMs=Date.now()}){
  const rows=await loadAssistantControlRows({
    supabase,
    features:[GLOBAL_ASSISTANT_FEATURE,READ_ONLY_ASSISTANT_FEATURE]
  });
  const globalRow=rows.find(row=>row.feature===GLOBAL_ASSISTANT_FEATURE);
  const readOnlyRow=rows.find(row=>row.feature===READ_ONLY_ASSISTANT_FEATURE);

  if(switchIsActive(globalRow,nowMs)){
    return publicKillSwitchState({
      feature:GLOBAL_ASSISTANT_FEATURE,
      row:globalRow,
      mode:'disabled'
    });
  }
  if(switchIsActive(readOnlyRow,nowMs)){
    return publicKillSwitchState({
      feature:READ_ONLY_ASSISTANT_FEATURE,
      row:readOnlyRow,
      mode:'read_only_emergency'
    });
  }
  return {
    feature:READ_ONLY_ASSISTANT_FEATURE,
    disabled:false,
    mode:'normal',
    expires_at:null,
    execution_authorized:false,
    auto_execute:false
  };
}

async function getAssistantEmergencyMode({supabase,nowMs=Date.now()}) {
  if(!supabase||typeof supabase.from!=='function'){
    throw new Error('ASSISTANT_KILL_SWITCH_UNAVAILABLE');
  }

  const {data,error}=await supabase
    .from('admin_ai_kill_switches')
    .select('feature,disabled,expires_at,updated_at')
    .eq('feature',GLOBAL_ASSISTANT_FEATURE)
    .maybeSingle();

  if(error)throw new Error('ASSISTANT_KILL_SWITCH_LOOKUP_FAILED');

  const readOnly=switchIsActive(data,nowMs);
  return {
    mode:readOnly?'read_only':'normal',
    read_only:readOnly,
    expires_at:readOnly?(data?.expires_at||null):null,
    execution_authorized:false,
    auto_execute:false
  };
}

async function assertAssistantMutationEnabled(args){
  const state=await getAssistantKillSwitchState(args);
  if(!state.blocked)return state;

  const readOnly=state.feature===READ_ONLY_ASSISTANT_FEATURE;
  const err=new Error(readOnly?'ASSISTANT_READ_ONLY_MODE':'ASSISTANT_FEATURE_DISABLED');
  err.code=readOnly?'ASSISTANT_READ_ONLY_MODE':'ASSISTANT_FEATURE_DISABLED';
  err.feature=state.feature;
  err.mode=state.mode;
  err.expires_at=state.expires_at;
  throw err;
}

module.exports={
  GLOBAL_ASSISTANT_FEATURE,
  READ_ONLY_ASSISTANT_FEATURE,
  MUTATING_ROUTE_FEATURES,
  featureForAssistantMutation,
  switchIsActive,
  publicKillSwitchState,
  getAssistantKillSwitchState,
  getAssistantEmergencyModeState,
  assertAssistantMutationEnabled
};
