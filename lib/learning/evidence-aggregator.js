'use strict';

const MATCH_KEYS=Object.freeze([
  'service_code',
  'workflow_key',
  'error_code',
  'event_type',
  'resource_id'
]);

function cleanScalar(value,maxLength=200){
  if(value===null||['number','boolean'].includes(typeof value))return value;
  if(typeof value!=='string')return undefined;
  const trimmed=value.trim();
  return trimmed?trimmed.slice(0,maxLength):undefined;
}

function sanitizeEvidenceMetadata(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return {};
  const out={};
  for(const key of MATCH_KEYS){
    const value=cleanScalar(input[key]);
    if(value!==undefined)out[key]=value;
  }
  return out;
}

function eventMatchesProposal(event,proposal){
  if(!event||!proposal)return false;
  if(event.event_type!==proposal.event_type)return false;
  const p=sanitizeEvidenceMetadata(proposal.metadata);
  const e=sanitizeEvidenceMetadata(event.metadata);
  for(const key of MATCH_KEYS){
    if(p[key]!==undefined && e[key]!==p[key])return false;
  }
  return true;
}

function aggregateEvidence({proposal,events=[]}){
  const matches=(Array.isArray(events)?events:[]).filter(event=>eventMatchesProposal(event,proposal));
  const errorCodes=[...new Set(matches.map(row=>row.metadata?.error_code).filter(Boolean))].slice(0,20);
  const serviceCodes=[...new Set(matches.map(row=>row.metadata?.service_code).filter(Boolean))].slice(0,20);
  const workflowKeys=[...new Set(matches.map(row=>row.metadata?.workflow_key).filter(Boolean))].slice(0,20);
  const timestamps=matches.map(row=>row.created_at).filter(Boolean).sort();

  return {
    evidence_count:matches.length,
    proposal_occurrence_count:Number(proposal.occurrence_count||0),
    threshold:Number(proposal.threshold||0),
    first_evidence_at:timestamps[0]||proposal.first_seen_at||null,
    last_evidence_at:timestamps[timestamps.length-1]||proposal.last_seen_at||null,
    distinct_error_codes:errorCodes,
    distinct_service_codes:serviceCodes,
    distinct_workflow_keys:workflowKeys,
    threshold_reached:Number(proposal.occurrence_count||0)>=Number(proposal.threshold||1),
    evidence_source:'bonds_learning_events'
  };
}

module.exports={
  MATCH_KEYS,
  sanitizeEvidenceMetadata,
  eventMatchesProposal,
  aggregateEvidence
};
