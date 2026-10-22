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

const ALLOWED_ASSISTANT_FEATURES = Object.freeze([
  GLOBAL_ASSISTANT_FEATURE,
  ...new Set(Object.values(MUTATING_ROUTE_FEATURES))
]);

function featureForAssistantMutation(path,method){
  return MUTATING_ROUTE_FEATURES[`${String(method||'').toUpperCase()} ${String(path||'')}`]||null;
}

function normalizeAssistantFeature(feature){
  const value=String(feature||'').trim();
  if(!ALLOWED_ASSISTANT_FEATURES.includes(value))throw new Error('ASSISTANT_KILL_SWITCH_FEATURE_INVALID');
  return value;
}

function normalizeExpiry(value){
  if(value===null||value===undefined||value==='')return null;
  const date=new Date(value);
  if(Number.isNaN(date.getTime()))throw new Error('ASSISTANT_KILL_SWITCH_EXPIRY_INVALID');
  if(date.getTime()<=Date.now())throw new Error('ASSISTANT_KILL_SWITCH_EXPIRY_NOT_FUTURE');
  return date.toISOString();
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

async function listAssistantKillSwitches({supabase,nowMs=Date.now()}){
  if(!supabase||typeof supabase.from!=='function')throw new Error('ASSISTANT_KILL_SWITCH_UNAVAILABLE');
  const {data,error}=await supabase
    .from('admin_ai_kill_switches')
    .select('feature,disabled,reason,disabled_by,disabled_at,expires_at,updated_at')
    .in('feature',ALLOWED_ASSISTANT_FEATURES)
    .order('feature');
  if(error)throw new Error('ASSISTANT_KILL_SWITCH_LIST_FAILED');
  return {
    version:1,
    items:(data||[]).map(row=>({
      ...row,
      active:switchIsActive(row,nowMs)
    })),
    allowed_features:ALLOWED_ASSISTANT_FEATURES,
    policy:{attributable_admin_required:true,legacy_token_allowed:false,support_allowed:false}
  };
}

async function setAssistantKillSwitch({
  supabase,feature,disabled,reason,expiresAt,actorUserId
}){
  if(!supabase||typeof supabase.from!=='function')throw new Error('ASSISTANT_KILL_SWITCH_UNAVAILABLE');
  if(!actorUserId)throw new Error('ASSISTANT_KILL_SWITCH_ACTOR_REQUIRED');
  const safeFeature=normalizeAssistantFeature(feature);
  if(typeof disabled!=='boolean')throw new Error('ASSISTANT_KILL_SWITCH_DISABLED_REQUIRED');
  const safeReason=reason===null||reason===undefined?null:String(reason).trim().slice(0,1000)||null;
  const now=new Date().toISOString();
  const row=disabled ? {
    feature:safeFeature,
    disabled:true,
    reason:safeReason,
    disabled_by:actorUserId,
    disabled_at:now,
    expires_at:normalizeExpiry(expiresAt),
    updated_at:now
  } : {
    feature:safeFeature,
    disabled:false,
    reason:null,
    disabled_by:actorUserId,
    disabled_at:null,
    expires_at:null,
    updated_at:now
  };
  const {data,error}=await supabase
    .from('admin_ai_kill_switches')
    .upsert(row,{onConflict:'feature'})
    .select('feature,disabled,reason,disabled_by,disabled_at,expires_at,updated_at')
    .single();
  if(error)throw new Error('ASSISTANT_KILL_SWITCH_UPDATE_FAILED');
  return {...data,active:switchIsActive(data)};
}

module.exports={
  GLOBAL_ASSISTANT_FEATURE,
  MUTATING_ROUTE_FEATURES,
  ALLOWED_ASSISTANT_FEATURES,
  featureForAssistantMutation,
  normalizeAssistantFeature,
  normalizeExpiry,
  switchIsActive,
  publicKillSwitchState,
  getAssistantKillSwitchState,
  assertAssistantMutationEnabled,
  listAssistantKillSwitches,
  setAssistantKillSwitch
};
