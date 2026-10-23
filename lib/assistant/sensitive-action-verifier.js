'use strict';

const { normalizeAction } = require('./protocol');
const { actionSnapshot, actionFingerprint } = require('./confirmation-engine');

const SENSITIVE_ACTION_VERIFIER_VERSION = 1;
const SENSITIVE_RISKS = Object.freeze(['high','critical']);

function clean(value,max=160) {
  if(value===null||value===undefined) return null;
  const text=String(value).trim();
  return text ? text.slice(0,max) : null;
}

function check(id,status,code=null) {
  return {
    id,
    status,
    code:code || null
  };
}

function baseVerification() {
  return {
    version:SENSITIVE_ACTION_VERIFIER_VERSION,
    verifier:'deterministic_sensitive_action_verifier',
    verdict:'rejected',
    sensitive:false,
    action_id:null,
    action_fingerprint:null,
    risk:null,
    human_review_required:true,
    confirmation_status:null,
    approval_status:null,
    checks:[],
    execution_authorized:false,
    auto_execute:false,
    authorization_source:false,
    model_used:false,
    multi_agent:false
  };
}

function publicSensitiveVerification(verification) {
  if(!verification || typeof verification!=='object') return null;
  return {
    version:Number(verification.version)||SENSITIVE_ACTION_VERIFIER_VERSION,
    verifier:'deterministic_sensitive_action_verifier',
    verdict:clean(verification.verdict,40),
    sensitive:Boolean(verification.sensitive),
    action_id:clean(verification.action_id,160),
    action_fingerprint:clean(verification.action_fingerprint,64),
    risk:clean(verification.risk,30),
    human_review_required:true,
    confirmation_status:clean(verification.confirmation_status,30),
    approval_status:clean(verification.approval_status,30),
    checks:Array.isArray(verification.checks)
      ? verification.checks.slice(0,16).map(item=>({
          id:clean(item?.id,80),
          status:clean(item?.status,20),
          code:clean(item?.code,100)
        }))
      : [],
    execution_authorized:false,
    auto_execute:false,
    authorization_source:false,
    model_used:false,
    multi_agent:false
  };
}

function verifySensitiveAction({
  action,
  confirmation=null,
  approval=null
}={}) {
  const verification=baseVerification();

  let normalized;
  try {
    normalized=normalizeAction(action);
    verification.checks.push(check('structured_action','pass'));
  } catch (error) {
    verification.checks.push(check(
      'structured_action',
      'fail',
      clean(error?.message || 'INVALID_ASSISTANT_ACTION',100)
    ));
    return verification;
  }

  const snapshot=actionSnapshot(normalized);
  const fingerprint=actionFingerprint(normalized);

  verification.action_id=snapshot.id;
  verification.action_fingerprint=fingerprint;
  verification.risk=snapshot.risk;
  verification.sensitive=SENSITIVE_RISKS.includes(snapshot.risk);

  if(!verification.sensitive) {
    verification.checks.push(check(
      'sensitive_risk',
      'fail',
      'SENSITIVE_ACTION_RISK_NOT_ELIGIBLE'
    ));
    return verification;
  }
  verification.checks.push(check('sensitive_risk','pass'));

  if(snapshot.requires_confirmation!==true) {
    verification.checks.push(check(
      'confirmation_required',
      'fail',
      'SENSITIVE_ACTION_CONFIRMATION_REQUIRED'
    ));
    return verification;
  }
  verification.checks.push(check('confirmation_required','pass'));
  verification.checks.push(check('fingerprint_stable','pass'));

  if(confirmation && typeof confirmation==='object') {
    verification.confirmation_status=clean(confirmation.status,30);

    if(clean(confirmation.action_id,160)!==snapshot.id) {
      verification.checks.push(check(
        'confirmation_action_match',
        'fail',
        'SENSITIVE_ACTION_CONFIRMATION_ACTION_MISMATCH'
      ));
      return verification;
    }
    verification.checks.push(check('confirmation_action_match','pass'));

    if(clean(confirmation.action_fingerprint,64)!==fingerprint) {
      verification.checks.push(check(
        'confirmation_fingerprint_match',
        'fail',
        'SENSITIVE_ACTION_CONFIRMATION_FINGERPRINT_MISMATCH'
      ));
      return verification;
    }
    verification.checks.push(check('confirmation_fingerprint_match','pass'));

    if(verification.confirmation_status==='cancelled') {
      verification.checks.push(check(
        'confirmation_not_cancelled',
        'fail',
        'SENSITIVE_ACTION_CONFIRMATION_CANCELLED'
      ));
      return verification;
    }
    verification.checks.push(check('confirmation_not_cancelled','pass'));
  } else {
    verification.checks.push(check('confirmation_evidence','not_provided'));
  }

  if(approval && typeof approval==='object') {
    verification.approval_status=clean(approval.status,30);

    const approvalFingerprint=clean(
      approval.action_fingerprint || approval?.payload?.action_fingerprint,
      64
    );
    if(approvalFingerprint && approvalFingerprint!==fingerprint) {
      verification.checks.push(check(
        'approval_fingerprint_match',
        'fail',
        'SENSITIVE_ACTION_APPROVAL_FINGERPRINT_MISMATCH'
      ));
      return verification;
    }
    verification.checks.push(check(
      'approval_fingerprint_match',
      approvalFingerprint ? 'pass' : 'not_provided'
    ));

    const approvalRisk=clean(approval.risk || approval?.payload?.risk,30);
    if(approvalRisk && approvalRisk!==snapshot.risk) {
      verification.checks.push(check(
        'approval_risk_match',
        'fail',
        'SENSITIVE_ACTION_APPROVAL_RISK_MISMATCH'
      ));
      return verification;
    }
    verification.checks.push(check(
      'approval_risk_match',
      approvalRisk ? 'pass' : 'not_provided'
    ));

    if(['rejected','cancelled'].includes(verification.approval_status)) {
      verification.checks.push(check(
        'approval_not_rejected',
        'fail',
        'SENSITIVE_ACTION_APPROVAL_REJECTED'
      ));
      return verification;
    }
    verification.checks.push(check('approval_not_rejected','pass'));
  } else {
    verification.checks.push(check('approval_evidence','not_provided'));
  }

  verification.verdict='verified_for_review';
  return verification;
}

module.exports={
  SENSITIVE_ACTION_VERIFIER_VERSION,
  SENSITIVE_RISKS,
  publicSensitiveVerification,
  verifySensitiveAction
};
