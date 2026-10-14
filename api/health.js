/**
 * Bonds Global — Health Check endpoint
 * Returns service status and a lightweight Supabase connectivity check.
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

  const started = Date.now();
  let supabaseStatus = 'unknown';
  let nativeStatus = 'skipped';
  let nativeMode = String(process.env.BONDS_INFERENCE_MODE || '').trim().toUpperCase() || null;
  let nativeProvider = null;

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).limit(1);
    supabaseStatus = error ? 'error' : 'ok';
  } catch (e) {
    supabaseStatus = 'error';
  }

  if (nativeMode === 'REMOTE_BONDS_NATIVE') {
    try {
      const nativeHealth = await getInferenceRouter().health();
      nativeStatus = nativeHealth.ok === true ? 'ok' : 'error';
      nativeProvider = nativeHealth.provider || 'BondsNativeProvider';
    } catch (e) {
      nativeStatus = 'error';
      nativeProvider = 'BondsNativeProvider';
    }
  }

  const version = process.env.VERCEL_GIT_COMMIT_SHA ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : 'dev';

  const healthy = supabaseStatus === 'ok' && (nativeMode !== 'REMOTE_BONDS_NATIVE' || nativeStatus === 'ok');
  return res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
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
