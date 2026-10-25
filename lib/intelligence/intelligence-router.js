'use strict';

const { getActionDescriptor } = require('../capabilities/bonds-capability-registry');

const INTELLIGENCE_ROUTE_SCHEMA_VERSION = 1;

function available(action) {
  const descriptor = getActionDescriptor(action);
  return Boolean(descriptor && descriptor.active !== false);
}

function routeIntelligenceRequest({ intent = 'information', entityFrame = null } = {}) {
  const stages = [
    { stage:'entity_resolution', engine:'entity_resolution', required:Boolean(entityFrame) },
    { stage:'query_planning', engine:'query_planner', required:true },
    { stage:'research_acquisition', capability:'web_search', required:available('web_search') },
    { stage:'web_exploration', capability:'web_explore', required:available('web_explore') }
  ];

  if (entityFrame?.entity_type === 'person') {
    stages.push({ stage:'identity_verification', engine:'person_identity', required:true });
  }

  stages.push(
    { stage:'claim_extraction', engine:'structured_claim_extraction', required:true },
    { stage:'claim_verification', engine:'claim_verification', required:true },
    { stage:'contradiction_temporal_resolution', engine:'claim_fabric', required:true },
    { stage:'evidence_verification', capability:'evidence_verify', required:available('evidence_verify') },
    { stage:'answer_planning', engine:'answer_planner', required:true },
    { stage:'quality_guard', engine:'answer_quality', required:true }
  );

  return Object.freeze({
    intelligence_route_schema_version: INTELLIGENCE_ROUTE_SCHEMA_VERSION,
    intent: String(intent || 'information'),
    entity_type: entityFrame?.entity_type || null,
    stages,
    executable: stages.every(stage => stage.required !== false)
  });
}

module.exports = {
  INTELLIGENCE_ROUTE_SCHEMA_VERSION,
  routeIntelligenceRequest
};
