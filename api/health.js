/**
 * Bonds Global — platform health endpoint.
 *
 * Liveness/availability semantics:
 * - Core platform health is determined by Supabase connectivity.
 * - Native AI is reported as a capability and may be degraded without
 *   taking the rest of the commercial site offline.
 * - Strict dependency readiness lives at /api/readiness.
 */
const crypto = require('crypto');
const getSupabase = require('../lib/api/supabase');
const { callBondsNative } = require('../lib/ai/orchestrator');

function readSmokeNonce(req) {
  try {
    return new URL(req.url, 'https://bonds-global.com').searchParams.get('native_smoke') || '';
  } catch (_) {
    return '';
  }
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
