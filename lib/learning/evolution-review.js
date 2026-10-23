'use strict';

const ALLOWED_STATUSES=new Set(['observing','proposed','approved','rejected','superseded']);

function boundedLimit(value,fallback=50){
  const parsed=Number.parseInt(String(value??''),10);
  if(!Number.isFinite(parsed))return fallback;
  return Math.max(1,Math.min(200,parsed));
}

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function publicLearningAnalysis(metadata){
  const analysis=metadata&&typeof metadata==='object'?metadata.learning_analysis:null;
  if(!analysis||typeof analysis!=='object')return null;
  return {
    version:Number(analysis.version||1),
    proposal_id:clean(analysis.proposal_id,100),
    fingerprint:clean(analysis.fingerprint,64),
    event_type:clean(analysis.event_type,120),
    status:clean(analysis.status,40),
    diagnosis:analysis.diagnosis&&typeof analysis.diagnosis==='object'?{
      proposal_type:clean(analysis.diagnosis.proposal_type,120),
      problem_class:clean(analysis.diagnosis.problem_class,120),
      target_component:clean(analysis.diagnosis.target_component,120),
      recommended_path:clean(analysis.diagnosis.recommended_path,120)
    }:null,
    evidence:analysis.evidence&&typeof analysis.evidence==='object'?{
      evidence_count:Number(analysis.evidence.evidence_count||0),
      proposal_occurrence_count:Number(analysis.evidence.proposal_occurrence_count||0),
      threshold:Number(analysis.evidence.threshold||0),
      first_evidence_at:clean(analysis.evidence.first_evidence_at,80),
      last_evidence_at:clean(analysis.evidence.last_evidence_at,80),
      threshold_reached:Boolean(analysis.evidence.threshold_reached),
      evidence_source:clean(analysis.evidence.evidence_source,120)
    }:null,
    risk:analysis.risk&&typeof analysis.risk==='object'?{
      risk_class:clean(analysis.risk.risk_class,40),
      protected_surface:Boolean(analysis.risk.protected_surface),
      requires_human_approval:Boolean(analysis.risk.requires_human_approval),
      auto_execute:false,
      execution_authorized:false,
      approval_scope:clean(analysis.risk.approval_scope,80)
    }:null,
    policy:{
      analysis_only:true,
      execution_authorized:false,
      auto_execute:false,
      code_mutation:false,
      status_change:false
    }
  };
}

function publicEvolutionProposal(row){
  const metadata=row?.metadata&&typeof row.metadata==='object'?row.metadata:{};
  return {
    id:row?.id||null,
    fingerprint:clean(row?.fingerprint,64),
    event_type:clean(row?.event_type,120),
    severity:clean(row?.severity,40),
    status:clean(row?.status,40),
    occurrence_count:Number(row?.occurrence_count||0),
    threshold:Number(row?.threshold||0),
    first_seen_at:row?.first_seen_at||null,
    last_seen_at:row?.last_seen_at||null,
    updated_at:row?.updated_at||null,
    signal:{
      service_code:clean(metadata.service_code,120),
      workflow_key:clean(metadata.workflow_key,160),
      error_code:clean(metadata.error_code,160),
      event_type:clean(metadata.event_type,120),
      resource_id:clean(metadata.resource_id,160)
    },
    learning_analysis:publicLearningAnalysis(metadata),
    policy:{
      analysis_only:true,
      execution_authorized:false,
      auto_execute:false,
      code_mutation:false
    }
  };
}

async function listEvolutionProposals({supabase,status='proposed',limit=50}={}){
  if(!supabase||typeof supabase.from!=='function')throw new Error('EVOLUTION_REVIEW_STORE_UNAVAILABLE');
  const safeStatus=ALLOWED_STATUSES.has(String(status))?String(status):'proposed';
  const safeLimit=boundedLimit(limit);
  const {data,error}=await supabase
    .from('evolution_proposals')
    .select('id,fingerprint,event_type,severity,status,occurrence_count,threshold,first_seen_at,last_seen_at,metadata,created_at,updated_at,execution_authorized,auto_execute')
    .eq('status',safeStatus)
    .eq('execution_authorized',false)
    .order('updated_at',{ascending:false})
    .limit(safeLimit);
  if(error)throw new Error('EVOLUTION_REVIEW_READ_FAILED');
  return {
    version:1,
    status:safeStatus,
    items:(data||[]).map(publicEvolutionProposal),
    policy:{
      admin_review_only:true,
      analysis_only:true,
      execution_authorized:false,
      auto_execute:false,
      code_mutation:false
    }
  };
}

module.exports={
  ALLOWED_STATUSES,
  boundedLimit,
  publicLearningAnalysis,
  publicEvolutionProposal,
  listEvolutionProposals
};
