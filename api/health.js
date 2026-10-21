/**
 * Bonds Global — platform health + strict readiness endpoint.
 *
 * /api/health checks the commercial core only.
 * /api/readiness is rewritten to /api/health?strict=1 so strict dependency
 * readiness does not consume an additional Vercel Serverless Function.
 */
const getSupabase = require('../lib/api/supabase');
const { getInferenceRouter } = require('../lib/ai/inference-router');

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

function getTokenRuntimeAuthorization() {
  const value = String(process.env.BONDS_TOKEN_RUNTIME_AUTHORIZATION || '').trim();
  return value || null;
}

async function probeTokenRuntime() {
  const configured = String(process.env.BONDS_TOKEN_RUNTIME_HEALTH_URL || '').trim();
  if (!configured) return { status: 'not_configured', required: false };
  let target;
  try {
    target = new URL(configured);
    if (target.protocol !== 'https:' || target.username || target.password ||
        target.search || target.hash || target.pathname !== '/health') {
      return { status: 'invalid_configuration', required: true };
    }
  } catch (_) {
    return { status: 'invalid_configuration', required: true };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const authorization = getTokenRuntimeAuthorization();
    const headers = authorization ? { Authorization: authorization } : {};
    const response = await fetch(target.toString(), {
      method: 'GET', headers, signal: controller.signal, redirect: 'error'
    });
    if (!response.ok) {
      return {
        status: 'error',
        required: true,
        http_status: response.status,
        reported_status: null,
        service: null,
      };
    }

    let payload = null;
    try {
      payload = await response.json();
    } catch (_) {
      return {
        status: 'invalid_response',
        required: true,
        http_status: response.status,
        reported_status: null,
        service: null,
      };
    }

    return {
      status: payload && payload.status === 'ok' ? 'ok' : 'error',
      required: true,
      http_status: response.status,
      reported_status: typeof payload?.status === 'string' ? payload.status : null,
      service: typeof payload?.service === 'string' ? payload.service : null,
    };
  } catch (_) {
    return { status: 'unreachable', required: true };
  } finally {
    clearTimeout(timer);
  }
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
    let nativeStatus = 'skipped';
    let nativeProvider = null;
    let nativeDiagnostic = null;

    if (nativeMode === 'REMOTE_BONDS_NATIVE') {
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
    const nativeRequired = nativeMode === 'REMOTE_BONDS_NATIVE' && providerMode === 'native-only';
    const nativeReady = nativeMode !== 'REMOTE_BONDS_NATIVE' || nativeStatus === 'ok';

    let fallbackStatus = 'skipped';
    let fallbackReason = null;
    let fallbackHttpStatus = null;
    const fallbackEligible =
      providerMode !== 'native-only' &&
      openAiFallbackAllowed() &&
      nativeMode === 'REMOTE_BONDS_NATIVE' &&
      nativeStatus !== 'ok';

    if (fallbackEligible) {
      const fallbackHealth = await probeOpenAI();
      fallbackStatus = fallbackHealth.ok ? 'ok' : 'error';
      fallbackReason = fallbackHealth.reason || null;
      fallbackHttpStatus = fallbackHealth.status || null;
    }

    const fallbackReady = fallbackStatus === 'ok';
    const inferenceReady = nativeRequired ? nativeReady : (nativeReady || fallbackReady);
    const tokenRuntime = await probeTokenRuntime();
    const ready = coreHealthy && inferenceReady && (!tokenRuntime.required || tokenRuntime.status === 'ok');
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
        token_runtime_http_status: tokenRuntime.http_status ?? null,
        token_runtime_reported_status: tokenRuntime.reported_status ?? null,
        token_runtime_service: tokenRuntime.service ?? null,
        responseMs: Date.now() - started,
      },
      inference: {
        mode: nativeMode,
        provider: activeProvider,
        native_provider: nativeProvider,
        native_reachable: nativeStatus === 'ok',
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
