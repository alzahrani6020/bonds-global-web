/**
 * Bonds Global — strict dependency readiness endpoint.
 *
 * Returns 200 only when the core data dependency and the configured
 * Native AI dependency are both ready for production traffic.
 */
const getSupabase = require('../lib/api/supabase');
const { getInferenceRouter } = require('../lib/ai/inference-router');

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

  const started = Date.now();
  let supabaseStatus = 'unknown';
  let nativeStatus = 'skipped';
  const nativeMode = String(process.env.BONDS_INFERENCE_MODE || '').trim().toUpperCase() || null;
  let nativeProvider = null;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
    supabaseStatus = error ? 'error' : 'ok';
  } catch (_) {
    supabaseStatus = 'error';
  }

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
  const ready = supabaseStatus === 'ok' && nativeReady;
  const version = process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'dev';

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
};
