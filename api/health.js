/**
 * Bonds Global — platform health + strict readiness endpoint.
 *
 * /api/health checks the commercial core only.
 * /api/readiness is rewritten to /api/health?strict=1 so strict dependency
 * readiness does not consume an additional Vercel Serverless Function.
 */
const crypto = require('crypto');
const getSupabase = require('../lib/api/supabase');
const { getInferenceRouter } = require('../lib/ai/inference-router');
const { callBondsNative } = require('../lib/ai/orchestrator');

function readParam(req, name) {
  if (req && req.query && req.query[name] != null) return String(req.query[name]);
  try {
    return new URL(req.url, 'https://bonds-global.com').searchParams.get(name) || '';
  } catch (_) {
    return '';
  }
}

function readSmokeNonce(req) {
  return readParam(req, 'native_smoke');
}

function smokeAuthorized(req) {
  const expected = String(process.env.BONDS_E2E_SMOKE_NONCE || '');
  const supplied = readSmokeNonce(req);
  if (!expected || !supplied) return false;
  const left = Buffer.from(supplied, 'utf8');
  const right = Buffer.from(expected, 'utf8');
  return left.length === right.length && crypto.timingSafeEqual(left, right);
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

  if (smokeAuthorized(req)) {
    try {
      const response = await callBondsNative([
        {
          role: 'user',
          content: 'Return only this JSON object exactly with no extra text: {"smoke":"ok","english":"hello","arabic":"مرحبا"}'
        }
      ]);
      const validPayload = Boolean(
        response.result &&
        response.result.smoke === 'ok' &&
        response.result.english === 'hello' &&
        response.result.arabic === 'مرحبا'
      );
      return res.status(validPayload ? 200 : 500).json({
        status: validPayload ? 'ok' : 'degraded',
        smoke: validPayload,
        provider: response.provider,
        model_used: response.modelUsed,
        tokens_input: response.tokensInput,
        tokens_output: response.tokensOutput,
        inference: response.inferenceMetadata
      });
    } catch (error) {
      return res.status(500).json({
        status: 'degraded',
        smoke: false,
        error: error.code || error.message || 'native smoke failed'
      });
    }
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

  const version = process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'dev';
  const coreHealthy = supabaseStatus === 'ok';

  if (strict) {
    let nativeStatus = 'skipped';
    let nativeProvider = null;

    if (nativeMode === 'REMOTE_BONDS_NATIVE') {
      try {
        const nativeHealth = await getInferenceRouter().health();
        nativeStatus = nativeHealth.ok === true ? 'ok' : 'error';
        nativeProvider = nativeHealth.provider || 'BondsNativeProvider';
      } catch (_) {
        nativeStatus = 'error';
        nativeProvider = 'BondsNativeProvider';
      }
    }

    const nativeRequired = nativeMode === 'REMOTE_BONDS_NATIVE';
    const nativeReady = !nativeRequired || nativeStatus === 'ok';
    const ready = coreHealthy && nativeReady;

    return res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: 'bonds-global',
      version,
      timestamp: new Date().toISOString(),
      environment: process.env.VERCEL_ENV || 'development',
      checks: {
        supabase: supabaseStatus,
        native: nativeStatus,
        responseMs: Date.now() - started,
      },
      inference: {
        mode: nativeMode,
        provider: nativeProvider,
        reachable: nativeStatus === 'ok',
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
