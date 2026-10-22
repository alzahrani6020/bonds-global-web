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
const { appendAssistantAuditBestEffort } = require('../../lib/assistant/audit-trail');
const { saveWorkflowState, loadWorkflowState, setWorkflowStatus } = require('../../lib/assistant/workflow-state');

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
      await appendAssistantAuditBestEffort({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        eventType:'confirmation_prepared',
        outcome:confirmation.status,
        sessionId:body.session_id,
        boundary:body.boundary,
        metadata:{ confirmation_status:confirmation.status }
      });
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
      await appendAssistantAuditBestEffort({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        eventType:'confirmation_resolved',
        outcome:confirmation.status,
        sessionId:body.session_id,
        boundary:body.boundary,
        metadata:{ decision:body.decision, confirmation_status:confirmation.status }
      });
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
      await appendAssistantAuditBestEffort({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        eventType:idempotency.state === 'replay_succeeded' ? 'replayed' : 'idempotency_claimed',
        outcome:idempotency.state,
        idempotencyKey:body.idempotency_key,
        sessionId:body.session_id,
        boundary:body.boundary
      });
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
      const auditEvent = body.status === 'succeeded'
        ? 'write_succeeded'
        : 'write_uncertain';
      await appendAssistantAuditBestEffort({
        supabase:getSupabaseClient(),
        userId:user.id,
        action:body.action,
        eventType:auditEvent,
        outcome:idempotency.state,
        idempotencyKey:body.idempotency_key,
        resourceId:body.result?.record_id,
        sessionId:body.session_id,
        boundary:body.boundary,
        metadata:{ requested_status:body.status }
      });
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

  if (path === '/assistant/workflows/save' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const workflow = await saveWorkflowState({
        supabase:getSupabaseClient(),
        userId:user.id,
        workflowKey:body.workflow_key,
        boundary:body.boundary,
        state:body.state,
        status:body.status,
        expectedVersion:body.expected_version
      });
      return sendJson(res, 200, { protocol:PROTOCOL, status:'completed', workflow });
    } catch (err) {
      const conflict = ['WORKFLOW_VERSION_CONFLICT','WORKFLOW_BOUNDARY_CONFLICT'].includes(err.message);
      const clientError = [
        'INVALID_WORKFLOW_KEY','INVALID_WORKFLOW_STATUS','INVALID_WORKFLOW_VERSION',
        'WORKFLOW_BOUNDARY_REQUIRED','WORKFLOW_STATE_INVALID'
      ].includes(err.message);
      return sendJson(res, conflict ? 409 : clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/workflows/load' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const workflow = await loadWorkflowState({
        supabase:getSupabaseClient(),
        userId:user.id,
        workflowKey:body.workflow_key
      });
      return sendJson(res, 200, {
        protocol:PROTOCOL,
        status:workflow ? 'completed' : 'not_found',
        workflow
      });
    } catch (err) {
      const clientError = err.message === 'INVALID_WORKFLOW_KEY';
      return sendJson(res, clientError ? 422 : 503, {
        protocol:PROTOCOL,
        status:'denied',
        error:err.message
      });
    }
  }

  if (path === '/assistant/workflows/status' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error:'Invalid JSON body', detail:err.message }); }

    try {
      const workflow = await setWorkflowStatus({
        supabase:getSupabaseClient(),
        userId:user.id,
        workflowKey:body.workflow_key,
        status:body.status,
        expectedVersion:body.expected_version
      });
      return sendJson(res, 200, { protocol:PROTOCOL, status:'completed', workflow });
    } catch (err) {
      const conflict = err.message === 'WORKFLOW_VERSION_CONFLICT';
      const notFound = err.message === 'WORKFLOW_NOT_FOUND';
      const clientError = [
        'INVALID_WORKFLOW_KEY','INVALID_WORKFLOW_STATUS','INVALID_WORKFLOW_VERSION',
        'WORKFLOW_VERSION_REQUIRED'
      ].includes(err.message);
      return sendJson(res, conflict ? 409 : notFound ? 404 : clientError ? 422 : 503, {
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
    const plannedAction = Array.isArray(result.actions) ? result.actions[0] : {
      id:null,
      type:body.type || 'unknown',
      target:body.target || body.form || null,
      risk:null,
      requires_confirmation:false
    };
    await appendAssistantAuditBestEffort({
      supabase:getSupabaseClient(),
      userId:user.id,
      action:plannedAction,
      eventType:result.status === 'denied' ? 'denied' : 'planned',
      outcome:result.status,
      sessionId:body.session_id,
      boundary:body.boundary,
      metadata:{ code:result.context?.code || null }
    });
    return sendJson(res, result.status === 'denied' ? 422 : 200, result);
  }

  return sendJson(res, 404, { error:'Assistant route not found' });
}

module.exports = { assistantRouter };
