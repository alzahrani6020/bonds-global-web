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
  claimFabric = null,
  officialSourceUrl = null
} = {}) {
  const fused = Array.isArray(claimFabric?.fused_claims) ? claimFabric.fused_claims : [];

  const asksForOfficialUrl =
    /(?:الرابط|الموقع)(?:\s+الإلكتروني)?\s+الرسمي|official\s+(?:website|site|link|url)|(?:website|site|link|url)\s+official/iu
      .test(String(languagePlan?.raw_text || languagePlan?.normalized_text || ''));

  if (
    asksForOfficialUrl &&
    officialSourceUrl &&
    ['official_site', 'official_url', 'information', 'current_fact', 'company_lookup'].includes(intent)
  ) {
    const officialName = entityFrame?.canonical_name ||
      languagePlan?.entity?.text ||
      languagePlan?.entity?.organization ||
      null;
    if (officialName) {
      const directAnswer = language(languagePlan) === 'en'
        ? 'The official website of ' + officialName + ': ' + officialSourceUrl
        : 'الموقع الرسمي لـ' + officialName + ': ' + officialSourceUrl;
      return Object.freeze({
        answer_plan_schema_version: ANSWER_PLAN_SCHEMA_VERSION,
        mode:'direct_official_url',
        direct_answer:directAnswer,
        claims:[],
        requires_ai_synthesis:false,
        fail_closed:true
      });
    }
  }

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

  // A single verified claim that directly documents the asked fact can be
  // rendered deterministically. Narrow on purpose: analytical or multi-claim
  // questions keep flowing to governed synthesis.
  if (
    ['information', 'current_fact', 'company_lookup', 'general'].includes(intent) &&
    fused.length === 1 &&
    fused[0]?.verification_state === 'VERIFIED' &&
    typeof fused[0]?.value === 'string'
  ) {
    const value = fused[0].value.trim();
    if (value.length >= 10 && value.length <= 240) {
      const subject = fused[0].subject || entityFrame?.canonical_name || languagePlan?.entity?.text || null;
      if (subject) {
        const directAnswer = language(languagePlan) === 'en'
          ? subject + ': ' + value + '.'
          : subject + ': ' + value + '.';
        return Object.freeze({
          answer_plan_schema_version: ANSWER_PLAN_SCHEMA_VERSION,
          mode:'direct_verified_claim',
          direct_answer:directAnswer,
          claims:[fused[0]],
          requires_ai_synthesis:false,
          fail_closed:true
        });
      }
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
