'use strict';

const GLOBAL_ASSISTANT_FEATURE = 'assistant';

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

function publicKillSwitchState({feature,row}){
  return {
    feature,
    disabled:true,
    expires_at:row?.expires_at||null,
    execution_authorized:false,
    auto_execute:false
  };
}

async function getAssistantKillSwitchState({supabase,feature,nowMs=Date.now()}){
  if(!feature)return {blocked:false,feature:null};
  if(!supabase||typeof supabase.from!=='function'){
    throw new Error('ASSISTANT_KILL_SWITCH_UNAVAILABLE');
  }

  const {data,error}=await supabase
    .from('admin_ai_kill_switches')
    .select('feature,disabled,reason,expires_at,updated_at')
    .in('feature',[GLOBAL_ASSISTANT_FEATURE,feature]);

  if(error)throw new Error('ASSISTANT_KILL_SWITCH_LOOKUP_FAILED');

  const rows=Array.isArray(data)?data:[];
  const globalRow=rows.find(row=>row.feature===GLOBAL_ASSISTANT_FEATURE);
  const featureRow=rows.find(row=>row.feature===feature);
  const blockingRow=switchIsActive(globalRow,nowMs)
    ?globalRow
    :switchIsActive(featureRow,nowMs)
      ?featureRow
      :null;

  if(!blockingRow)return {blocked:false,feature};

  return {
    blocked:true,
    ...publicKillSwitchState({feature:blockingRow.feature,row:blockingRow})
  };
}

async function assertAssistantMutationEnabled(args){
  const state=await getAssistantKillSwitchState(args);
  if(!state.blocked)return state;

  const err=new Error('ASSISTANT_FEATURE_DISABLED');
  err.code='ASSISTANT_FEATURE_DISABLED';
  err.feature=state.feature;
  err.expires_at=state.expires_at;
  throw err;
}

module.exports={
  GLOBAL_ASSISTANT_FEATURE,
  MUTATING_ROUTE_FEATURES,
  featureForAssistantMutation,
  switchIsActive,
  publicKillSwitchState,
  getAssistantKillSwitchState,
  assertAssistantMutationEnabled
};
