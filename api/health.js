/**
 * Bonds Global � platform health + strict readiness endpoint.
 *
 * /api/health checks the commercial core only.
 * /api/readiness is rewritten to /api/health?strict=1 so strict dependency
 * readiness does not consume an additional Vercel Serverless Function.
 */
const getSupabase = require('../lib/api/supabase');
const { getInferenceRouter } = require('../lib/ai/inference-router');
const tokenContract = require('../services/bonds_token_runtime/contract.json');
const { probeUserGovernanceReadiness } = require('../lib/capabilities/user-governance-context');
const { probeAssistantReadiness } = require('../lib/assistant/production-readiness');
const {
  resolveTokenRuntimeChannel,
  resolveRuntimeIdentityExpectation,
  matchesRuntimeIdentity,
  requestTokenRuntime,
  readIntrospectionClaims
} = require('../lib/security/service-token-verifier');
const { resolveBrokerChannel } = require('../lib/security/service-token-broker');
const { searchUpstreams, searchWeb } = require('../lib/intelligence/web-search');

function readParam(req, name) {
  if (req && req.query && req.query[name] != null) return String(req.query[name]);
  try {
    return new URL(req.url, 'https://bonds-global.com').searchParams.get(name) || '';
  } catch (_) {
    return '';
  }
}

function aiProviderMode() {
  return String(process.env.BONDS_AI_PROVIDER || 'native-first').trim().toLowerCase();
}

function openAiFallbackAllowed() {
  return String(process.env.BONDS_OPENAI_FALLBACK ?? 'true').trim().toLowerCase() !== 'false';
}


function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function probeNativeHealth(attempts = 3) {
  const timeoutMs = Math.max(500, Number(process.env.BONDS_NATIVE_HEALTH_TIMEOUT_MS || 3000));
  const delays = String(process.env.BONDS_NATIVE_HEALTH_RETRY_DELAYS_MS || '0,300,700')
    .split(',')
    .map(value => Math.max(0, Number(value) || 0));

  let lastHealth = null;
  let lastError = null;

  for (let index = 0; index < attempts; index++) {
    const delayMs = delays[index] || 0;
    if (delayMs) await sleep(delayMs);

    const startedAt = Date.now();
    try {
      const health = await getInferenceRouter({ timeoutMs }).health();
      lastHealth = health;
      lastError = null;
      if (health?.ok === true) {
        return {
          health,
          attempts: index + 1,
          recovered: index > 0,
          elapsed_ms: Date.now() - startedAt,
        };
      }
    } catch (error) {
      lastError = error;
    }
  }

  return {
    health: lastHealth,
    error: lastError,
    attempts,
    recovered: false,
    elapsed_ms: null,
  };
}

async function requestTokenRuntimeWithTransientRetry({
  channel,
  method = 'POST',
  body,
  fetchImpl = global.fetch,
  attempts = 3
}) {
  const delays = [0, 150, 400];
  let last = null;
  for (let index = 0; index < attempts; index += 1) {
    if (delays[index]) await sleep(delays[index]);
    last = await requestTokenRuntime({ channel, method, body, fetchImpl });
    if (last?.ok === true) return last;
    if (last?.code !== 'TOKEN_INTROSPECTION_FAILED') return last;
  }
  return last;
}

async function probeUnauthenticatedTokenChannel({
  channel,
  body,
  fetchImpl = global.fetch,
  attempts = 3
}) {
  const delays = [0, 150, 400];
  let last = null;
  for (let index = 0; index < attempts; index += 1) {
    if (delays[index]) await sleep(delays[index]);
    last = await requestTokenRuntime({
      channel: { ...channel, headers: { accept: 'application/json' } },
      body,
      fetchImpl
    });
    if (last?.code === 'TOKEN_CHANNEL_REJECTED' || last?.ok === true) return last;
    if (last?.code !== 'TOKEN_INTROSPECTION_FAILED') return last;
  }
  return last;
}

async function probeTokenRuntime({ fetchImpl = global.fetch } = {}) {
  const healthChannel = resolveTokenRuntimeChannel({
    url: String(process.env.BONDS_TOKEN_RUNTIME_HEALTH_URL || '').trim(),
    path: '/health'
  });
  const introspectionChannel = resolveTokenRuntimeChannel();
  const brokerChannel = resolveBrokerChannel();
  const configurationFailure = [healthChannel, introspectionChannel, brokerChannel].find(channel => !channel.ok);
  if (configurationFailure) {
    return {
      status: configurationFailure.code.endsWith('UNCONFIGURED') ? 'not_configured' : 'invalid_configuration',
      required: true,
      code: configurationFailure.code
    };
  }

  const identity = resolveRuntimeIdentityExpectation();
  if (!identity.ok) {
    return { status: identity.code.endsWith('UNCONFIGURED') ? 'not_configured' : 'invalid_configuration', required: true, code: identity.code };
  }
  const expectedBuild = identity.buildCommit;
  if (
    healthChannel.origin !== introspectionChannel.origin ||
    brokerChannel.origin !== introspectionChannel.origin
  ) {
    return { status: 'invalid_configuration', required: true, code: 'TOKEN_RUNTIME_INVALID_CONFIGURATION' };
  }

  const health = await requestTokenRuntimeWithTransientRetry({
    channel: healthChannel,
    method: 'GET',
    fetchImpl
  });
  if (!health.ok) {
    return {
      status: 'unreachable',
      required: true,
      code: health.code,
      probe_stage: 'health'
    };
  }
  const payload = health.payload;
  if (!matchesRuntimeIdentity(payload, expectedBuild)) {
    return { status: 'contract_mismatch', required: true, code: 'TOKEN_RUNTIME_CONTRACT_MISMATCH' };
  }

  // A read-only, unissued token verifies the introspection contract. The second
  // request proves the same endpoint rejects a caller without channel auth.
  const body = { token: 'bonds_readiness_probe_never_issued' };
  const [authorized, unauthenticated] = await Promise.all([
    requestTokenRuntimeWithTransientRetry({
      channel: introspectionChannel,
      body,
      fetchImpl
    }),
    probeUnauthenticatedTokenChannel({
      channel: introspectionChannel,
      body,
      fetchImpl
    })
  ]);
  if (!authorized.ok) {
    return {
      status: 'unreachable',
      required: true,
      code: authorized.code,
      probe_stage: 'introspection'
    };
  }
  const claims = readIntrospectionClaims(authorized.payload);
  if (!matchesRuntimeIdentity(authorized.payload.runtime, expectedBuild) || !claims || claims.active !== false) {
    return { status: 'contract_mismatch', required: true, code: 'TOKEN_RUNTIME_INTROSPECTION_CONTRACT_MISMATCH' };
  }
  if (unauthenticated.code !== 'TOKEN_CHANNEL_REJECTED') {
    return {
      status: 'channel_unverified', required: true,
      code: unauthenticated.ok ? 'TOKEN_CHANNEL_AUTH_NOT_ENFORCED' : 'TOKEN_CHANNEL_PROTECTION_UNVERIFIED',
      probe_code: unauthenticated.code || null
    };
  }

  return {
    status: 'ok', required: true, code: null,
    build_commit: expectedBuild, contract_version: tokenContract.contractVersion,
    schema_version: tokenContract.schemaVersion,
    channel_auth: 'verified',
    broker_auth: 'configured'
  };
}

function tokenChannelVerifyAttempts() {
  const configured = Number(process.env.BONDS_TOKEN_CHANNEL_VERIFY_ATTEMPTS || 3);
  if (!Number.isFinite(configured)) return 3;
  return Math.max(1, Math.min(5, Math.floor(configured)));
}

function tokenChannelVerifyDelaysMs() {
  return String(process.env.BONDS_TOKEN_CHANNEL_VERIFY_DELAYS_MS || '0,300,700')
    .split(',')
    .map(value => Math.max(0, Number(value) || 0));
}

// The unauthenticated channel probe is a single transport call against a
// runtime that is also serving live broker traffic; a transient timeout must
// not flip readiness to channel_unverified (or block release promotion).
// Retry only transport-level outcomes; never retry a definitive security
// verdict such as TOKEN_CHANNEL_AUTH_NOT_ENFORCED.
async function probeTokenRuntimeResilient({ fetchImpl = global.fetch } = {}) {
  const attempts = tokenChannelVerifyAttempts();
  const delaysMs = tokenChannelVerifyDelaysMs();
  let last = null;
  for (let index = 0; index < attempts; index += 1) {
    const delayMs = delaysMs[index] || 0;
    if (delayMs) await sleep(delayMs);
    const result = await probeTokenRuntime({ fetchImpl });
    last = result;
    if (result.status === 'ok') {
      return attempts > 1 ? { ...result, verify_attempts: index + 1, verify_recovered: index > 0 } : result;
    }
    const retryable = result.status === 'unreachable' || result.code === 'TOKEN_CHANNEL_PROTECTION_UNVERIFIED';
    if (!retryable) {
      return attempts > 1
        ? { ...result, verify_attempts: index + 1, verify_recovered: false }
        : result;
    }
  }
  return { ...last, verify_attempts: attempts, verify_recovered: false };
}

function probeWebSearchReadiness() {
  const upstreams = searchUpstreams();
  if (!Array.isArray(upstreams) || upstreams.length === 0) {
    return { status: 'not_configured', code: 'WEB_SEARCH_UNCONFIGURED', upstream_count: 0 };
  }

  let validCount = 0;
  for (const value of upstreams) {
    try {
      const target = new URL(String(value || '').trim());
      if (target.protocol === 'https:' || target.protocol === 'http:') validCount += 1;
    } catch (_) {
      // Invalid entries are reported below without exposing configured URLs.
    }
  }

  if (validCount !== upstreams.length) {
    return {
      status: 'invalid_configuration',
      code: 'WEB_SEARCH_INVALID_CONFIGURATION',
      upstream_count: upstreams.length,
      valid_upstream_count: validCount
    };
  }

  return {
    status: 'ok',
    code: null,
    upstream_count: upstreams.length,
    verification: 'config_only'
  };
}

const LIVE_SEARCH_PROBE_TTL_MS = 5 * 60 * 1000;
let liveSearchProbeCache = null;

// Opt-in (?deep=1): proves a real upstream answers from this runtime. The
// config-only probe cannot detect datacenter-IP blocking by search engines.
// The result is cached per instance so repeated polling cannot hammer upstreams.
async function probeWebSearchLive(configProbe, { searchImpl = searchWeb, now = Date.now } = {}) {
  if (configProbe.status !== 'ok') return configProbe;
  const current = now();
  if (liveSearchProbeCache && current - liveSearchProbeCache.at < LIVE_SEARCH_PROBE_TTL_MS) {
    return { ...liveSearchProbeCache.value, cached: true };
  }

  let value;
  try {
    const result = await searchImpl('bonds global', { limit: 1, timeoutMs: 6000 });
    const count = Number(result?.result?.result_count || result?.result?.results?.length || 0);
    value = result?.ok === true && count > 0
      ? { ...configProbe, verification: 'live', live_result_count: count }
      : {
          ...configProbe,
          status: 'degraded',
          code: result?.error?.code || 'WEB_SEARCH_LIVE_NO_RESULTS',
          verification: 'live'
        };
  } catch (error) {
    value = {
      ...configProbe,
      status: 'degraded',
      code: 'WEB_SEARCH_LIVE_PROBE_FAILED',
      verification: 'live'
    };
  }
  liveSearchProbeCache = { at: current, value };
  return { ...value, cached: false };
}

async function probeOpenAI(timeoutMs = 5000) {
  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return { ok: false, reason: 'not_configured' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });
    return {
      ok: response.ok,
      status: response.status,
      reason: response.ok ? null : 'http_error',
    };
  } catch (error) {
    return {
      ok: false,
      reason: error && error.name === 'AbortError' ? 'timeout' : 'unreachable',
    };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ status: 'method_not_allowed' });
  }

  const strict = readParam(req, 'strict') === '1';
  const started = Date.now();
  let supabaseStatus = 'unknown';
  const nativeMode = String(process.env.BONDS_INFERENCE_MODE || '').trim().toUpperCase() || null;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
    supabaseStatus = error ? 'error' : 'ok';
  } catch (_) {
    supabaseStatus = 'error';
  }

  const releaseSha = process.env.BONDS_RELEASE_SHA || process.env.VERCEL_GIT_COMMIT_SHA || '';
  const version = releaseSha ? releaseSha.slice(0, 7) : 'dev';
  const coreHealthy = supabaseStatus === 'ok';

  if (strict) {
    const nativeModeConfigured = ['LOCAL_NATIVE', 'REMOTE_BONDS_NATIVE'].includes(nativeMode);
    let nativeStatus = nativeMode ? 'invalid_configuration' : 'not_configured';
    let nativeProvider = null;
    let nativeDiagnostic = nativeModeConfigured ? null : {
      code: nativeMode ? 'NATIVE_MODE_INVALID' : 'NATIVE_MODE_UNCONFIGURED',
      executed: false, attempts: 0, retry_recovered: false
    };

    if (nativeModeConfigured) {
      const nativeProbe = await probeNativeHealth();
      const nativeHealth = nativeProbe.health || {};
      const nativeError = nativeHealth.error || nativeProbe.error || {};

      nativeStatus = nativeHealth.ok === true ? 'ok' : 'error';
      nativeProvider = nativeHealth.provider || 'BondsNativeProvider';
      nativeDiagnostic = {
        code: nativeStatus === 'ok'
          ? null
          : (nativeError.code || nativeError.name || 'NATIVE_HEALTH_FAILED'),
        http_status: Number.isFinite(Number(nativeError.status)) ? Number(nativeError.status) : null,
        executed: nativeHealth.executed === true,
        elapsed_ms: Number.isFinite(Number(nativeError.elapsed_ms))
          ? Number(nativeError.elapsed_ms)
          : (Number.isFinite(Number(nativeProbe.elapsed_ms)) ? Number(nativeProbe.elapsed_ms) : null),
        attempts: nativeProbe.attempts,
        retry_recovered: nativeProbe.recovered === true,
      };
    }

    const providerMode = aiProviderMode();
    const nativeRequired = providerMode === 'native-only';
    const nativeReady = nativeModeConfigured && nativeStatus === 'ok';

    let fallbackStatus = 'skipped';
    let fallbackReason = null;
    let fallbackHttpStatus = null;
    const fallbackEligible =
      providerMode !== 'native-only' &&
      openAiFallbackAllowed() &&
      nativeModeConfigured &&
      nativeStatus !== 'ok';

    if (fallbackEligible) {
      const fallbackHealth = await probeOpenAI();
      fallbackStatus = fallbackHealth.ok ? 'ok' : 'error';
      fallbackReason = fallbackHealth.reason || null;
      fallbackHttpStatus = fallbackHealth.status || null;
    }

    const fallbackReady = fallbackStatus === 'ok';
    const inferenceReady = nativeModeConfigured && (nativeRequired ? nativeReady : (nativeReady || fallbackReady));
    const [tokenRuntime, userGovernance, assistant] = await Promise.all([
      probeTokenRuntimeResilient(), probeUserGovernanceReadiness(), probeAssistantReadiness()
    ]);
    const configuredWebSearch = probeWebSearchReadiness();
    const webSearch = readParam(req, 'deep') === '1'
      ? await probeWebSearchLive(configuredWebSearch)
      : configuredWebSearch;
    const ready = coreHealthy && inferenceReady && tokenRuntime.status === 'ok' &&
      userGovernance.status === 'ok' && assistant.status === 'ok';
    // Assistant chat only ever runs on Bonds Native (the fallback serves analysis
    // flows, not chat), so chat readiness must not be inferred from the fallback.
    const assistantChatStatus = nativeModeConfigured ? (nativeReady ? 'ok' : 'error') : nativeStatus;
    const activeProvider = nativeReady
      ? (nativeProvider || 'BondsNativeProvider')
      : (fallbackReady ? 'openai_fallback' : null);

    return res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: 'bonds-global',
      version,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'development',
      checks: {
        supabase: supabaseStatus,
        native: nativeStatus,
        fallback: fallbackStatus,
        token_runtime: tokenRuntime.status,
        user_governance: userGovernance.status,
        assistant: assistant.status,
        assistant_chat: assistantChatStatus,
        web_search: webSearch.status,
        responseMs: Date.now() - started,
      },
      token_runtime: tokenRuntime,
      user_governance: userGovernance,
      assistant,
      web_search: webSearch,
      inference: {
        mode: nativeMode,
        provider: activeProvider,
        native_provider: nativeProvider,
        native_reachable: nativeStatus === 'ok',
        chat_ready: assistantChatStatus === 'ok',
        chat_provider: nativeReady ? (nativeProvider || 'BondsNativeProvider') : null,
        fallback_provider: fallbackEligible ? 'openai' : null,
        fallback_reason: fallbackReason,
        fallback_http_status: fallbackHttpStatus,
        native_diagnostic: nativeDiagnostic,
      },
    });
  }

  return res.status(coreHealthy ? 200 : 503).json({
    status: coreHealthy ? 'ok' : 'unhealthy',
    service: 'bonds-global',
    version,
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL_ENV || 'development',
    checks: {
      supabase: supabaseStatus,
      native: 'not_checked',
      responseMs: Date.now() - started,
    },
    capabilities: {
      core_platform: coreHealthy ? 'available' : 'unavailable',
      native_ai: 'see_readiness',
    },
    readiness: {
      endpoint: '/api/readiness',
    },
    inference: {
      mode: nativeMode,
      provider: nativeMode === 'REMOTE_BONDS_NATIVE' ? 'BondsNativeProvider' : null,
      reachable: null,
    },
  });
};

// Reused by the isolated acceptance harness without substituting runtime calls.
module.exports.probeTokenRuntime = probeTokenRuntime;
module.exports.probeWebSearchReadiness = probeWebSearchReadiness;
module.exports.probeWebSearchLive = probeWebSearchLive;
module.exports._resetLiveSearchProbeCache = () => { liveSearchProbeCache = null; };
