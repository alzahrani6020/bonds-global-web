'use strict';

const { EVENT_TYPES }=require('../dual-core/event-taxonomy');

const RISK_BY_EVENT=Object.freeze({
  [EVENT_TYPES.PRODUCTION_REGRESSION]:'critical',
  [EVENT_TYPES.CALCULATION_MISMATCH]:'critical',
  [EVENT_TYPES.CAPABILITY_FAILED]:'high',
  [EVENT_TYPES.DOCUMENT_EXTRACTION_FAILED]:'high',
  [EVENT_TYPES.CAPABILITY_MISSING]:'medium',
  [EVENT_TYPES.ASSISTANT_INTENT_FAILED]:'medium',
  [EVENT_TYPES.WORKFLOW_BLOCKED]:'medium',
  [EVENT_TYPES.WORKFLOW_ABANDONED]:'medium',
  [EVENT_TYPES.USER_CORRECTED]:'medium',
  [EVENT_TYPES.ASSISTANT_LOW_CONFIDENCE]:'low'
});

function classifyProposalRisk({eventType,diagnosis}){
  const risk_class=RISK_BY_EVENT[eventType]||'medium';
  const protected_surface=[
    EVENT_TYPES.CALCULATION_MISMATCH,
    EVENT_TYPES.PRODUCTION_REGRESSION
  ].includes(eventType);

  return {
    risk_class,
    protected_surface,
    requires_human_approval:protected_surface||['high','critical'].includes(risk_class),
    auto_execute:false,
    execution_authorized:false,
    approval_scope:'target_only'
  };
}

module.exports={ RISK_BY_EVENT, classifyProposalRisk };
