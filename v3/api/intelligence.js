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
const { DecisionMemoryEngine, CalibrationEngine } = require('../../lib/decision-os');

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

async function intelligenceRouter(req, res, path, supabase, user = null) {
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
        userId: user?.id || body.userId || null,
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

    if (path === '/intelligence/outcomes' && req.method === 'POST') {
      if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

      const body = await parseBody(req);
      const { decisionId, actualOutcome, notes } = body;
      if (!decisionId || !actualOutcome || typeof actualOutcome !== 'object') {
        return sendJson(res, 400, { error: 'decisionId and actualOutcome are required' });
      }

      const { data: decision, error: decisionError } = await supabase
        .from('decision_memory')
        .select('id, entity_id, created_by, expected_outcome, decision')
        .eq('id', decisionId)
        .single();

      if (decisionError || !decision || (decision.created_by && decision.created_by !== user.id)) {
        return sendJson(res, 404, { error: 'Decision not found' });
      }

      const memory = new DecisionMemoryEngine({ supabase });
      const result = await memory.recordOutcome({
        decisionId,
        actualOutcome,
        userId: user.id,
        notes: notes || null
      });

      let calibration = null;
      if (result.status === 'persisted') {
        calibration = await new CalibrationEngine({ supabase }).analyze({
          entityId: decision.entity_id || null,
          limit: 500
        });
      }

      const status = result.status === 'persisted' ? 201 : 400;
      return sendJson(res, status, { ...result, calibration });
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
