'use strict';

const { enqueueAgentInboxItem } = require('../assistant/agent-inbox-queue');

const REVIEW_PRIORITIES = new Set(['high','critical']);

function clean(value,max=300){
  if(value===null||value===undefined)return null;
  const text=String(value).trim();
  return text?text.slice(0,max):null;
}

function deriveEvolutionInboxItem({proposal,eventId=null}={}){
  if(!proposal||proposal.status!=='proposed')return null;
  const priority=clean(proposal.severity,40);
  if(!REVIEW_PRIORITIES.has(priority))return null;

  const metadata=proposal.metadata&&typeof proposal.metadata==='object'?proposal.metadata:{};
  const proposalId=clean(proposal.id,100);
  const fingerprint=clean(proposal.fingerprint,64);
  if(!proposalId||!fingerprint)return null;

  const serviceCode=clean(metadata.service_code,120);
  const workflowKey=clean(metadata.workflow_key,160);
  const errorCode=clean(metadata.error_code,160);
  const eventType=clean(proposal.event_type,120);

  return {
    item_key:`evolution:${fingerprint}`,
    source_type:'system',
    source_event_id:clean(eventId,160),
    event_type:eventType,
    user_id:null,
    workflow_key:workflowKey,
    boundary:null,
    resource_id:proposalId,
    reason_code:'evolution_proposal_review_required',
    title_ar:priority==='critical'
      ?'مقترح تطور حرج يحتاج مراجعة'
      :'مقترح تطور عالي المخاطر يحتاج مراجعة',
    title_en:priority==='critical'
      ?'Critical evolution proposal requires review'
      :'High-risk evolution proposal requires review',
    summary_ar:[serviceCode,errorCode].filter(Boolean).join(' · ')||eventType,
    summary_en:null,
    priority,
    metadata:{
      proposal_id:proposalId,
      proposal_fingerprint:fingerprint,
      proposal_status:'proposed',
      proposal_event_type:eventType,
      service_code:serviceCode,
      error_code:errorCode,
      occurrence_count:Number(proposal.occurrence_count||0),
      threshold:Number(proposal.threshold||0),
      execution_authorized:false,
      auto_execute:false
    }
  };
}

async function enqueueEvolutionProposalForReview({supabase,proposal,eventId=null}={}){
  const item=deriveEvolutionInboxItem({proposal,eventId});
  if(!item)return {queued:false,skipped:true,reason:'not_reviewable'};
  return enqueueAgentInboxItem({supabase,item});
}

module.exports={
  REVIEW_PRIORITIES,
  deriveEvolutionInboxItem,
  enqueueEvolutionProposalForReview
};
