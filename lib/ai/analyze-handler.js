/**
 * Bonds AI Analyze API Handler
 *
 * POST /api/v3/ai/analyze
 * Body: { type, payload, projectId?, model? }
 */

const { getUserFromToken } = require('../../v3/lib/auth');
const { analyze } = require('./orchestrator');

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
