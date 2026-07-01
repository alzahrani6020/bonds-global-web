/**
 * BONDS UCP Configuration Engine
 *
 * Loads UCP runtime configuration from environment variables with sensible defaults.
 */

function getConfig(env = process.env) {
  return {
    preferStatic: env.UCP_PREFER_STATIC !== 'false',
    persistRuns: env.UCP_PERSIST_RUNS !== 'false',
    defaultScenarioCodes: (env.UCP_DEFAULT_SCENARIOS || 'scn_expected').split(',').map(s => s.trim()).filter(Boolean),
    enablePolicies: env.UCP_ENABLE_POLICIES !== 'false',
    enableWeights: env.UCP_ENABLE_WEIGHTS !== 'false',
    enableRules: env.UCP_ENABLE_RULES !== 'false',
    logErrors: env.UCP_LOG_ERRORS === 'true',
    maxScenarioCount: parseInt(env.UCP_MAX_SCENARIOS || '5', 10),
    calculationTimeoutMs: parseInt(env.UCP_CALC_TIMEOUT_MS || '5000', 10)
  };
}

function buildUcpOptions(env = process.env) {
  const cfg = getConfig(env);
  return {
    preferStatic: cfg.preferStatic,
    persistRuns: cfg.persistRuns,
    logErrors: cfg.logErrors
  };
}

module.exports = { getConfig, buildUcpOptions };
