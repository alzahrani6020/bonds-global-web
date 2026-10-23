'use strict';

const corpus = require('./golden-conversations.v1.json');
const { planRegisteredAction } = require('./protocol');

const GOLDEN_CONVERSATIONS_VERSION = 1;
const ALLOWED_LANGUAGES = new Set(['ar', 'en']);
const ALLOWED_EXPECTED_STATUSES = new Set(['ready', 'denied']);
const ALLOWED_PLANNER_KEYS = new Set(['type', 'target', 'form', 'language']);

function ownKeys(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? Object.keys(value)
    : [];
}

function validateGoldenConversationCorpus(value = corpus) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid:false, errors:['CORPUS_INVALID'] };
  }
  if (value.version !== GOLDEN_CONVERSATIONS_VERSION) errors.push('VERSION_INVALID');
  if (value.name !== 'BONDS_ASSISTANT_GOLDEN_CONVERSATIONS_V1') errors.push('NAME_INVALID');
  if (!Array.isArray(value.conversations) || value.conversations.length === 0) {
    errors.push('CONVERSATIONS_REQUIRED');
    return { valid:false, errors };
  }

  const ids = new Set();
  const languages = new Set();
  let deniedCount = 0;

  for (const [index, item] of value.conversations.entries()) {
    const prefix = `CONVERSATION_${index + 1}`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${prefix}_INVALID`);
      continue;
    }

    const id = String(item.id || '').trim();
    if (!id) errors.push(`${prefix}_ID_REQUIRED`);
    else if (ids.has(id)) errors.push(`${prefix}_ID_DUPLICATE`);
    else ids.add(id);

    if (!ALLOWED_LANGUAGES.has(item.language)) errors.push(`${prefix}_LANGUAGE_INVALID`);
    else languages.add(item.language);

    if (typeof item.user_message !== 'string' || !item.user_message.trim()) {
      errors.push(`${prefix}_USER_MESSAGE_REQUIRED`);
    }

    if (!item.planner_input || typeof item.planner_input !== 'object' || Array.isArray(item.planner_input)) {
      errors.push(`${prefix}_PLANNER_INPUT_INVALID`);
    } else {
      for (const key of ownKeys(item.planner_input)) {
        if (!ALLOWED_PLANNER_KEYS.has(key)) errors.push(`${prefix}_PLANNER_KEY_FORBIDDEN:${key}`);
      }
      if (!item.planner_input.type) errors.push(`${prefix}_PLANNER_TYPE_REQUIRED`);
      if (item.planner_input.language !== item.language) errors.push(`${prefix}_LANGUAGE_DRIFT`);
    }

    const expected = item.expected;
    if (!expected || typeof expected !== 'object' || Array.isArray(expected)) {
      errors.push(`${prefix}_EXPECTED_INVALID`);
      continue;
    }
    if (!ALLOWED_EXPECTED_STATUSES.has(expected.status)) errors.push(`${prefix}_EXPECTED_STATUS_INVALID`);
    if (!Number.isInteger(expected.action_count) || expected.action_count < 0 || expected.action_count > 1) {
      errors.push(`${prefix}_ACTION_COUNT_INVALID`);
    }
    if (expected.status === 'denied') deniedCount += 1;

    if (expected.action_count === 1) {
      if (!expected.action || typeof expected.action !== 'object' || Array.isArray(expected.action)) {
        errors.push(`${prefix}_EXPECTED_ACTION_REQUIRED`);
      } else {
        if (!expected.action.type) errors.push(`${prefix}_EXPECTED_ACTION_TYPE_REQUIRED`);
        if (!expected.action.target) errors.push(`${prefix}_EXPECTED_ACTION_TARGET_REQUIRED`);
        if (expected.action.requires_confirmation === true) {
          errors.push(`${prefix}_UNEXPECTED_EXECUTION_GATE`);
        }
      }
    }

    if (expected.execution_authorized === true || expected.auto_execute === true) {
      errors.push(`${prefix}_AUTHORIZATION_FORBIDDEN`);
    }
  }

  if (!languages.has('ar') || !languages.has('en')) errors.push('BILINGUAL_COVERAGE_REQUIRED');
  if (deniedCount === 0) errors.push('DENIAL_COVERAGE_REQUIRED');

  return {
    valid: errors.length === 0,
    errors,
    conversation_count:value.conversations.length,
    languages:[...languages].sort(),
    denied_count:deniedCount
  };
}

function evaluateGoldenConversation(item) {
  const envelope = planRegisteredAction(item.planner_input);
  const expected = item.expected || {};
  const failures = [];

  if (envelope.status !== expected.status) failures.push('STATUS_DRIFT');
  if (!Array.isArray(envelope.actions) || envelope.actions.length !== expected.action_count) {
    failures.push('ACTION_COUNT_DRIFT');
  }

  if (expected.action_count === 1) {
    const action = envelope.actions?.[0];
    for (const field of ['type', 'target', 'risk', 'requires_confirmation']) {
      if (action?.[field] !== expected.action?.[field]) failures.push(`ACTION_${field.toUpperCase()}_DRIFT`);
    }
  }

  if (expected.context_code !== undefined && envelope.context?.code !== expected.context_code) {
    failures.push('CONTEXT_CODE_DRIFT');
  }

  // Golden conversations are references only. They must never authorize execution.
  if (envelope.execution_authorized === true || envelope.auto_execute === true) {
    failures.push('EXECUTION_AUTHORIZED');
  }

  return {
    id:item.id,
    pass:failures.length === 0,
    failures,
    observed:{
      status:envelope.status,
      action_count:Array.isArray(envelope.actions) ? envelope.actions.length : null,
      action:envelope.actions?.[0] || null,
      context_code:envelope.context?.code || null
    }
  };
}

function runGoldenConversations(value = corpus) {
  const validation = validateGoldenConversationCorpus(value);
  if (!validation.valid) {
    return { version:GOLDEN_CONVERSATIONS_VERSION, status:'invalid', validation, results:[] };
  }

  const results = value.conversations.map(evaluateGoldenConversation);
  return {
    version:GOLDEN_CONVERSATIONS_VERSION,
    status:results.every(result => result.pass) ? 'pass' : 'fail',
    conversation_count:results.length,
    passed:results.filter(result => result.pass).length,
    failed:results.filter(result => !result.pass).length,
    execution_authorized:false,
    results
  };
}

module.exports = {
  GOLDEN_CONVERSATIONS_VERSION,
  corpus,
  validateGoldenConversationCorpus,
  evaluateGoldenConversation,
  runGoldenConversations
};
