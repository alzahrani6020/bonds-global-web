'use strict';

const {
  PROTOCOL,
  createEnvelope,
  planRegisteredAction
} = require('../../lib/assistant/protocol');
const contract = require('../../lib/assistant/assistant-protocol.contract.json');
const navigation = require('../../lib/assistant/navigation-registry.json');
const forms = require('../../lib/assistant/form-registry.json');
const { prepareConfirmation, resolveConfirmation } = require('../../lib/assistant/confirmation-engine');
const { claimAssistantAction, resolveAssistantAction } = require('../../lib/assistant/idempotency');
const { getSupabaseClient } = require('../lib/supabase');

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 262144) {
        reject(new Error('request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}

async function assistantRouter(req, res, path, user) {
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  if (path === '/assistant/contract' && req.method === 'GET') {
    return sendJson(res, 200, contract);
  }
  if (path === '/assistant/navigation' && req.method === 'GET') {
    return sendJson(res, 200, navigation);
  }
  if (path === '/assistant/forms' && req.method === 'GET') {
    return sendJson(res, 200, forms);
  }
  if (path === '/assistant' && req.method === 'GET') {
    return sendJson(res, 200, createEnvelope({
      status:'ready',
      reply:'مساعد بوندز جاهز.',
      context:{ protocol:PROTOCOL, execution:'plan_only' }
    }));
  }
  if (path === '/assistant/confirmation/prepare' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const confirmation = prepareConfirmation(body.action, { language:body.language });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:confirmation.required ? 'needs_confirmation' : 'ready',
        confirmation
      });
    } catch (err) {
      return sendJson(res, 422, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/confirmation/resolve' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const confirmation = resolveConfirmation(body.action, body.confirmation, body.decision);
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:confirmation.status === 'confirmed' ? 'completed' : 'denied',
        confirmation
      });
    } catch (err) {
      return sendJson(res, 409, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/idempotency/claim' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const idempotency = await claimAssistantAction({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        idempotencyKey:body.idempotency_key
      });
      const conflict = ['in_progress', 'uncertain', 'key_conflict'].includes(idempotency.state);
      return sendJson(res, conflict ? 409 : 200, {
        protocol:PROTOCOL,
        status: conflict ? 'denied' : 'ready',
        idempotency
      });
    } catch (err) {
      const clientError = [
        'INVALID_IDEMPOTENCY_KEY',
        'IDEMPOTENCY_USER_REQUIRED',
        'IDEMPOTENCY_ACTION_NOT_SUPPORTED'
      ].includes(err.message);
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/idempotency/resolve' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const idempotency = await resolveAssistantAction({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        idempotencyKey:body.idempotency_key,
        status:body.status,
        result:body.result
      });
      const conflict = ['missing', 'key_conflict', 'uncertain'].includes(idempotency.state);
      return sendJson(res, conflict ? 409 : 200, {
        protocol:PROTOCOL,
        status: conflict ? 'denied' : 'completed',
        idempotency
      });
    } catch (err) {
      const clientError = [
        'INVALID_IDEMPOTENCY_KEY',
        'IDEMPOTENCY_USER_REQUIRED',
        'INVALID_IDEMPOTENCY_STATUS'
      ].includes(err.message);
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/plan' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    const result = planRegisteredAction({
      type:body.type,
      target:body.target,
      form:body.form,
      language:body.language
    });
    return sendJson(res, result.status === 'denied' ? 422 : 200, result);
  }

  return sendJson(res, 404, { error:'Assistant route not found' });
}

module.exports = { assistantRouter };
