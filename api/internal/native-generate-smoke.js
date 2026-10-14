const crypto = require('crypto');
const { callBondsNative } = require('../../lib/ai/orchestrator');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readNonce(req) {
  try {
    return new URL(req.url, 'https://bonds-global.com').searchParams.get('nonce') || '';
  } catch (_) {
    return '';
  }
}

function safeEqual(leftValue, rightValue) {
  const left = Buffer.from(String(leftValue || ''), 'utf8');
  const right = Buffer.from(String(rightValue || ''), 'utf8');
  return left.length > 0 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
  }

  if (!safeEqual(readNonce(req), process.env.BONDS_E2E_SMOKE_NONCE)) {
    return sendJson(res, 404, { ok: false, error: 'Not found' });
  }

  try {
    const response = await callBondsNative([
      {
        role: 'user',
        content: 'Return only this JSON object exactly: {"smoke":"ok","language":"en"}'
      }
    ]);

    const validPayload = Boolean(
      response.result &&
      response.result.smoke === 'ok' &&
      response.result.language === 'en'
    );

    return sendJson(res, validPayload ? 200 : 500, {
      ok: validPayload,
      provider: response.provider,
      model_used: response.modelUsed,
      tokens_input: response.tokensInput,
      tokens_output: response.tokensOutput,
      inference: response.inferenceMetadata
    });
  } catch (error) {
    return sendJson(res, 500, {
      ok: false,
      error: error.code || error.message || 'native smoke failed'
    });
  }
};
