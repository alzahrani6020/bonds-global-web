/**
 * BONDS Enterprise Intelligence API Router
 *
 * Handles /intelligence/* endpoints for the Enterprise Intelligence Layer.
 */

const {
  EnterpriseIntelligenceRegistry,
  createDefaultRegistry,
  run,
  createFabric,
  adapt
} = require('../../lib/enterprise-intelligence');

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

function sendJson(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function intelligenceRouter(req, res, path, supabase) {
  const registry = createDefaultRegistry();

  try {
    if (path === '/intelligence/engines' && req.method === 'GET') {
      return sendJson(res, 200, { engines: registry.listEngines() });
    }

    const engineMetaMatch = path.match(/^\/intelligence\/engines\/([^/]+)$/);
    if (engineMetaMatch && req.method === 'GET') {
      const code = engineMetaMatch[1];
      const meta = registry.getMetadata(code);
      if (!meta) return sendJson(res, 404, { error: 'Engine not found' });
      return sendJson(res, 200, { engine: { code, ...meta } });
    }

    if (path === '/intelligence/run' && req.method === 'POST') {
      const body = await parseBody(req);
      const fabric = createFabric();
      const result = await run({
        ...body,
        fabric,
        supabase: supabase || fabric?.supabase || null,
        persist: body.persist !== false
      });
      return sendJson(res, 200, result);
    }

    if (path === '/intelligence/adapt' && req.method === 'POST') {
      const body = await parseBody(req);
      const { engine, ...context } = body;
      if (!engine) return sendJson(res, 400, { error: 'engine is required' });
      const result = await adapt(engine, context);
      return sendJson(res, 200, result);
    }

    if (path === '/intelligence/synthesize' && req.method === 'POST') {
      const body = await parseBody(req);
      const { RecommendationSynthesizer } = require('../../lib/enterprise-intelligence');
      const synthesizer = new RecommendationSynthesizer(body);
      const result = synthesizer.synthesize();
      return sendJson(res, 200, result);
    }

    return sendJson(res, 404, { error: 'Intelligence endpoint not found' });
  } catch (err) {
    console.error('[intelligence]', err.message);
    sendJson(res, 400, { error: err.message });
  }
}

module.exports = { intelligenceRouter };
