'use strict';

const { EVENT_TYPES } = require('../dual-core/event-taxonomy');

const DIAGNOSIS = Object.freeze({
  [EVENT_TYPES.CAPABILITY_MISSING]: {
    proposal_type:'capability_development',
    problem_class:'capability_gap',
    target_component:'capability_registry',
    recommended_path:'capability_development'
  },
  [EVENT_TYPES.CAPABILITY_FAILED]: {
    proposal_type:'execution_repair',
    problem_class:'execution_defect',
    target_component:'capability_execution',
    recommended_path:'development_candidate'
  },
  [EVENT_TYPES.ASSISTANT_INTENT_FAILED]: {
    proposal_type:'routing_improvement',
    problem_class:'intent_gap',
    target_component:'assistant_intent_routing',
    recommended_path:'routing_training'
  },
  [EVENT_TYPES.ASSISTANT_LOW_CONFIDENCE]: {
    proposal_type:'confidence_improvement',
    problem_class:'confidence_gap',
    target_component:'assistant_context_or_model',
    recommended_path:'prompt_or_routing_optimization'
  },
  [EVENT_TYPES.WORKFLOW_BLOCKED]: {
    proposal_type:'workflow_repair',
    problem_class:'workflow_defect',
    target_component:'assistant_workflow',
    recommended_path:'workflow_development'
  },
  [EVENT_TYPES.WORKFLOW_ABANDONED]: {
    proposal_type:'workflow_improvement',
    problem_class:'workflow_gap',
    target_component:'assistant_workflow',
    recommended_path:'workflow_development'
  },
  [EVENT_TYPES.DOCUMENT_EXTRACTION_FAILED]: {
    proposal_type:'document_engine_repair',
    problem_class:'document_engine_defect',
    target_component:'document_parser',
    recommended_path:'development_candidate'
  },
  [EVENT_TYPES.CALCULATION_MISMATCH]: {
    proposal_type:'calculation_integrity_repair',
    problem_class:'calculation_defect',
    target_component:'deterministic_calculation_engine',
    recommended_path:'deterministic_engine_review'
  },
  [EVENT_TYPES.USER_CORRECTED]: {
    proposal_type:'knowledge_or_prompt_update',
    problem_class:'user_correction_gap',
    target_component:'assistant_knowledge_or_prompt',
    recommended_path:'knowledge_or_prompt_update'
  },
  [EVENT_TYPES.PRODUCTION_REGRESSION]: {
    proposal_type:'production_regression_repair',
    problem_class:'production_regression',
    target_component:'production_system',
    recommended_path:'rollback_then_repair'
  }
});

function detectGapOrDefect(eventType) {
  const diagnosis=DIAGNOSIS[eventType];
  if(!diagnosis) {
    return {
      proposal_type:'observation',
      problem_class:'unclassified_signal',
      target_component:'unknown',
      recommended_path:'manual_classification'
    };
  }
  return { ...diagnosis };
}

module.exports={ DIAGNOSIS, detectGapOrDefect };
