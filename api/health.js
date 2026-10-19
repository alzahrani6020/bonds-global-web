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
  const retryDelaysMs = [0, 500, 1500];
  let lastResponse = null;
  const diagnostics = [];

  for (let index = 0; index < attempts; index++) {
    const delayMs = retryDelaysMs[index] || 0;
    if (delayMs > 0) await sleep(delayMs);

    const startedAt = Date.now();
    try {
      const response = await getInferenceRouter().health();
      lastResponse = response;
      diagnostics.push({
        attempt: index + 1,
        ok: response?.ok === true,
        code: response?.error?.code || null,
        status: response?.error?.status || null,
        elapsed_ms: response?.error?.elapsed_ms ?? response?.meta?.elapsed_ms ?? (Date.now() - startedAt),
      });
      if (response?.ok === true) {
        return { response, attempts: index + 1, diagnostics };
      }
    } catch (error) {
      lastResponse = {
        ok: false,
        error: {
          code: 'NATIVE_HEALTH_EXCEPTION',
          elapsed_ms: Date.now() - startedAt,
        },
      };
      diagnostics.push({
        attempt: index + 1,
        ok: false,
        code: 'NATIVE_HEALTH_EXCEPTION',
        status: null,
        elapsed_ms: Date.now() - startedAt,
      });
    }
  }

  return { response: lastResponse, attempts, diagnostics };
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
    let nativeProbeAttempts = 0;
    let nativeRetryRecovered = false;
    let nativeErrorCode = null;
    let nativeHttpStatus = null;
    let nativeElapsedMs = null;

    if (nativeMode === 'REMOTE_BONDS_NATIVE') {
      const nativeProbe = await probeNativeHealth();
      const nativeHealth = nativeProbe.response || {};
      nativeProbeAttempts = nativeProbe.attempts;
      nativeRetryRecovered = nativeHealth.ok === true && nativeProbeAttempts > 1;
      nativeStatus = nativeHealth.ok === true ? 'ok' : 'error';
      nativeProvider = nativeHealth.provider || 'BondsNativeProvider';
      nativeErrorCode = nativeHealth.error?.code || null;
      nativeHttpStatus = nativeHealth.error?.status || null;
      nativeElapsedMs = nativeHealth.error?.elapsed_ms ?? nativeHealth.meta?.elapsed_ms ?? null;
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
    const ready = coreHealthy && inferenceReady;
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
        responseMs: Date.now() - started,
      },
      inference: {
        mode: nativeMode,
        provider: activeProvider,
        native_provider: nativeProvider,
        native_reachable: nativeStatus === 'ok',
        native_probe_attempts: nativeProbeAttempts,
        native_retry_recovered: nativeRetryRecovered,
        native_error_code: nativeErrorCode,
        native_http_status: nativeHttpStatus,
        native_elapsed_ms: nativeElapsedMs,
        fallback_provider: fallbackEligible ? 'openai' : null,
        fallback_reason: fallbackReason,
        fallback_http_status: fallbackHttpStatus,
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
