/**
 * Bonds AI Analyze API Handler
 *
 * POST /api/v3/ai/analyze
 * Body: { type, payload, projectId?, model? }
 */

const { getUserFromToken } = require('../../v3/lib/auth');
const getSupabase = require('../api/supabase');
const { analyze } = require('./orchestrator');

const HOURLY_LIMIT = 20;
const DAILY_COST_LIMIT_USD = 5;

async function checkRateLimit(userId) {
  const supabase = getSupabase();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: hourCount, error: hourError } = await supabase
    .from('ai_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', oneHourAgo);

  if (hourError) {
    console.error('[ai/analyze] rate limit hour query error:', hourError.message);
  } else if (hourCount >= HOURLY_LIMIT) {
    throw new Error(`Hourly AI request limit reached (${HOURLY_LIMIT}). Please try again later.`);
  }

  const { data: dayRows, error: dayError } = await supabase
    .from('ai_requests')
    .select('cost_usd')
    .eq('user_id', userId)
    .gte('created_at', oneDayAgo);

  if (dayError) {
    console.error('[ai/analyze] rate limit day query error:', dayError.message);
  } else {
    const dayCost = (dayRows || []).reduce((sum, r) => sum + (Number(r.cost_usd) || 0), 0);
    if (dayCost >= DAILY_COST_LIMIT_USD) {
      throw new Error(`Daily AI cost limit reached ($${DAILY_COST_LIMIT_USD}). Please try again tomorrow.`);
    }
  }
}

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

async function handleAiAnalyze(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  // Auth
  const user = await getUserFromToken(req);
  if (!user) {
    return sendJson(res, 401, { error: 'Unauthorized' });
  }

  let body;
  try {
    body = await parseBody(req);
  } catch (err) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const { type, payload, projectId, model } = body;

  if (!type || !payload || typeof payload !== 'object') {
    return sendJson(res, 400, { error: 'type and payload are required' });
  }

  try {
    await checkRateLimit(user.id);
    const result = await analyze({
      userId: user.id,
      projectId,
      type,
      payload,
      model,
    });

    sendJson(res, 200, {
      success: true,
      cached: result.cached,
      request_id: result.requestId || null,
      result: result.result,
      usage: result.cached
        ? { cached: true, cost_usd: 0 }
        : {
            tokens_input: result.tokensInput,
            tokens_output: result.tokensOutput,
            cost_usd: result.costUsd,
          },
    });
  } catch (err) {
    console.error('[ai/analyze]', err.message);
    sendJson(res, 500, { error: err.message });
  }
}

module.exports = { handleAiAnalyze };
