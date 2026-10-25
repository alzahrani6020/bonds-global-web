'use strict';

const ANSWER_PLAN_SCHEMA_VERSION = 1;

function language(languagePlan = {}) {
  const value = languagePlan?.language?.language ||
    languagePlan?.language?.dominant_language ||
    languagePlan?.language ||
    '';
  return String(value).toLowerCase();
}

function buildDirectPersonAnswer(entityFrame, claim, languagePlan) {
  if (!entityFrame?.canonical_name || !claim?.value) return null;
  return language(languagePlan) === 'en'
    ? entityFrame.canonical_name + ' is ' + claim.value + '.'
    : entityFrame.canonical_name + ' هو ' + claim.value + '.';
}

function buildDirectRelationAnswer(entityFrame, claim, languagePlan) {
  const organization =
    entityFrame?.organizations?.[0]?.value ||
    entityFrame?.canonical_name ||
    claim?.subject;
  const relation =
    entityFrame?.relations?.[0]?.value ||
    claim?.relation ||
    (language(languagePlan) === 'en' ? 'role holder' : 'صاحب المنصب');
  const person = claim?.value;
  if (!organization || !relation || !person) return null;

  return language(languagePlan) === 'en'
    ? person + ' is the ' + relation + ' of ' + organization + '.'
    : person + ' هو ' + relation + ' ' + organization + '.';
}

function buildAnswerPlan({
  intent = 'information',
  languagePlan = null,
  entityFrame = null,
  verifiedIdentity = null,
  claimFabric = null
} = {}) {
  const fused = Array.isArray(claimFabric?.fused_claims) ? claimFabric.fused_claims : [];

  if (intent === 'relation_lookup') {
    const relationClaim = fused.find(claim => claim.predicate === 'relation.holder');
    if (relationClaim) {
      return Object.freeze({
        answer_plan_schema_version: ANSWER_PLAN_SCHEMA_VERSION,
        mode:'direct_verified_claim',
        direct_answer:buildDirectRelationAnswer(entityFrame, relationClaim, languagePlan),
        claims:[relationClaim],
        requires_ai_synthesis:false,
        fail_closed:true
      });
    }
  }

  if (
    intent === 'person_lookup' &&
    verifiedIdentity?.verification_state === 'VERIFIED'
  ) {
    const role = fused.find(claim => claim.predicate === 'person.role');
    if (role) {
      return Object.freeze({
        answer_plan_schema_version: ANSWER_PLAN_SCHEMA_VERSION,
        mode:'direct_verified_claim',
        direct_answer:buildDirectPersonAnswer(entityFrame, role, languagePlan),
        claims:[role],
        requires_ai_synthesis:false,
        fail_closed:true
      });
    }
  }

  if (fused.length) {
    return Object.freeze({
      answer_plan_schema_version: ANSWER_PLAN_SCHEMA_VERSION,
      mode:'structured_verified_claims',
      direct_answer:null,
      claims:fused.slice(0, 12),
      requires_ai_synthesis:true,
      fail_closed:true
    });
  }

  return Object.freeze({
    answer_plan_schema_version: ANSWER_PLAN_SCHEMA_VERSION,
    mode:'verified_source_digest',
    direct_answer:null,
    claims:[],
    requires_ai_synthesis:true,
    fail_closed:true
  });
}

module.exports = {
  ANSWER_PLAN_SCHEMA_VERSION,
  buildAnswerPlan
};
