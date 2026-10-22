'use strict';

const { evaluateAssistantActionPolicy } = require('./policy-engine');

const MAX_SIMULATIONS = 25;

function cleanString(value,max=100){
  if(value==null)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function simulateOne(action,index=0){
  const safeAction=action && typeof action==='object' && !Array.isArray(action) ? action : {};
  const decision=evaluateAssistantActionPolicy(safeAction);
  return {
    index,
    action:{
      type:cleanString(safeAction.type,80),
      capability:cleanString(safeAction.capability || safeAction.type,100),
      risk:cleanString(safeAction.risk || 'low',32)
    },
    decision:{
      policy_id:decision.policy_id,
      policy_version:decision.policy_version,
      schema_version:decision.schema_version,
      decision:decision.decision,
      code:decision.code,
      requires_confirmation:decision.requires_confirmation,
      matched_rules:Array.isArray(decision.matched_rules)?[...decision.matched_rules]:[]
    },
    simulation:{
      dry_run:true,
      writes_performed:false,
      tools_invoked:false,
      authorization_checked:false,
      authorization_granted:false,
      execution_authorized:false,
      auto_execute:false
    }
  };
}

function simulateAssistantPolicy(input={}){
  const actions=Array.isArray(input.actions)
    ? input.actions
    : input.action && typeof input.action==='object'
      ? [input.action]
      : [];
  if(actions.length===0)throw new Error('POLICY_SIMULATION_ACTION_REQUIRED');
  if(actions.length>MAX_SIMULATIONS)throw new Error('POLICY_SIMULATION_LIMIT_EXCEEDED');

  const results=actions.map((action,index)=>simulateOne(action,index));
  return {
    version:1,
    scenario_id:cleanString(input.scenario_id,120),
    count:results.length,
    summary:{
      allow:results.filter(r=>r.decision.decision==='allow').length,
      deny:results.filter(r=>r.decision.decision==='deny').length,
      requires_confirmation:results.filter(r=>r.decision.requires_confirmation).length
    },
    results,
    policy:{
      simulation_only:true,
      deterministic:true,
      writes_performed:false,
      tools_invoked:false,
      authorization_source:false,
      execution_authorized:false,
      auto_execute:false
    }
  };
}

module.exports={
  MAX_SIMULATIONS,
  simulateOne,
  simulateAssistantPolicy
};
