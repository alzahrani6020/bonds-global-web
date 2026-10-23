'use strict';

const corpus = require('./red-team-scenarios.v1.json');
const { normalizeAction, planRegisteredAction } = require('./protocol');

const RED_TEAM_SCENARIOS_VERSION = 1;
const ALLOWED_KINDS = new Set([
  'planner_denial',
  'normalize_rejection',
  'confirmation_enforcement'
]);

function validateRedTeamScenarioCorpus(value = corpus) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid:false, errors:['CORPUS_INVALID'] };
  }
  if (value.version !== RED_TEAM_SCENARIOS_VERSION) errors.push('VERSION_INVALID');
  if (value.name !== 'BONDS_ASSISTANT_RED_TEAM_SCENARIOS_V1') errors.push('NAME_INVALID');
  if (!Array.isArray(value.scenarios) || value.scenarios.length === 0) {
    errors.push('SCENARIOS_REQUIRED');
    return { valid:false, errors };
  }

  const ids = new Set();
  const languages = new Set();
  const kinds = new Set();

  for (const [index, scenario] of value.scenarios.entries()) {
    const prefix = `SCENARIO_${index + 1}`;
    if (!scenario || typeof scenario !== 'object' || Array.isArray(scenario)) {
      errors.push(`${prefix}_INVALID`);
      continue;
    }
    const id = String(scenario.id || '').trim();
    if (!id) errors.push(`${prefix}_ID_REQUIRED`);
    else if (ids.has(id)) errors.push(`${prefix}_ID_DUPLICATE`);
    else ids.add(id);

    if (!ALLOWED_KINDS.has(scenario.kind)) errors.push(`${prefix}_KIND_INVALID`);
    else kinds.add(scenario.kind);

    if (!scenario.input || typeof scenario.input !== 'object' || Array.isArray(scenario.input)) {
      errors.push(`${prefix}_INPUT_INVALID`);
    }
    if (!scenario.expected || typeof scenario.expected !== 'object' || Array.isArray(scenario.expected)) {
      errors.push(`${prefix}_EXPECTED_INVALID`);
    }

    if (scenario.kind === 'planner_denial') {
      if (!['ar','en'].includes(scenario.language)) errors.push(`${prefix}_LANGUAGE_INVALID`);
      else languages.add(scenario.language);
      if (scenario.expected?.status !== 'denied') errors.push(`${prefix}_DENIAL_REQUIRED`);
      if (scenario.expected?.action_count !== 0) errors.push(`${prefix}_ZERO_ACTIONS_REQUIRED`);
      if (!scenario.expected?.context_code) errors.push(`${prefix}_CONTEXT_CODE_REQUIRED`);
    }

    if (scenario.kind === 'normalize_rejection' && !scenario.expected?.error) {
      errors.push(`${prefix}_ERROR_REQUIRED`);
    }

    if (
      scenario.kind === 'confirmation_enforcement' &&
      scenario.expected?.requires_confirmation !== true
    ) {
      errors.push(`${prefix}_CONFIRMATION_REQUIRED`);
    }
  }

  if (!languages.has('ar') || !languages.has('en')) errors.push('BILINGUAL_ATTACK_COVERAGE_REQUIRED');
  for (const kind of ALLOWED_KINDS) {
    if (!kinds.has(kind)) errors.push(`KIND_COVERAGE_REQUIRED:${kind}`);
  }

  return {
    valid:errors.length === 0,
    errors,
    scenario_count:value.scenarios.length,
    languages:[...languages].sort(),
    kinds:[...kinds].sort()
  };
}

function runRedTeamScenario(scenario) {
  const failures = [];
  let observed = null;

  if (scenario.kind === 'planner_denial') {
    const envelope = planRegisteredAction(scenario.input);
    observed = {
      status:envelope.status,
      context_code:envelope.context?.code || null,
      action_count:Array.isArray(envelope.actions) ? envelope.actions.length : null
    };
    if (observed.status !== scenario.expected.status) failures.push('STATUS_DRIFT');
    if (observed.context_code !== scenario.expected.context_code) failures.push('CONTEXT_CODE_DRIFT');
    if (observed.action_count !== scenario.expected.action_count) failures.push('ACTION_COUNT_DRIFT');
    if (envelope.execution_authorized === true || envelope.auto_execute === true) {
      failures.push('EXECUTION_AUTHORIZED');
    }
  } else if (scenario.kind === 'normalize_rejection') {
    let error = null;
    try {
      normalizeAction(scenario.input);
    } catch (caught) {
      error = caught?.message || String(caught);
    }
    observed = { error };
    if (error !== scenario.expected.error) failures.push('REJECTION_DRIFT');
  } else if (scenario.kind === 'confirmation_enforcement') {
    let action = null;
    let error = null;
    try {
      action = normalizeAction(scenario.input);
    } catch (caught) {
      error = caught?.message || String(caught);
    }
    observed = {
      error,
      requires_confirmation:action?.requires_confirmation ?? null
    };
    if (error) failures.push('UNEXPECTED_REJECTION');
    if (observed.requires_confirmation !== true) failures.push('CONFIRMATION_BYPASS');
  } else {
    failures.push('SCENARIO_KIND_UNSUPPORTED');
  }

  return {
    id:scenario.id,
    kind:scenario.kind,
    pass:failures.length === 0,
    failures,
    observed
  };
}

function runRedTeamScenarios(value = corpus) {
  const validation = validateRedTeamScenarioCorpus(value);
  if (!validation.valid) {
    return {
      version:RED_TEAM_SCENARIOS_VERSION,
      status:'invalid',
      execution_authorized:false,
      writes_performed:false,
      validation,
      results:[],
      failures:validation.errors.slice()
    };
  }

  const results = value.scenarios.map(runRedTeamScenario);
  const failures = [];
  for (const result of results) {
    for (const failure of result.failures) failures.push(`${result.id}:${failure}`);
  }

  return {
    version:RED_TEAM_SCENARIOS_VERSION,
    status:failures.length === 0 ? 'pass' : 'fail',
    scenario_count:results.length,
    passed:results.filter(item => item.pass).length,
    failed:results.filter(item => !item.pass).length,
    execution_authorized:false,
    writes_performed:false,
    validation,
    results,
    failures
  };
}

module.exports = {
  RED_TEAM_SCENARIOS_VERSION,
  corpus,
  validateRedTeamScenarioCorpus,
  runRedTeamScenario,
  runRedTeamScenarios
};
