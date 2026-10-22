'use strict';

const { listCapabilities, validateCapabilityInput, getService } = require('../../lib/capabilities/bonds-capability-registry');
const { executeCapability } = require('../../lib/capabilities/governed-executor');
const { planCapabilities } = require('../../lib/capabilities/capability-planner');
const { resolveUserGovernanceContext } = require('../../lib/capabilities/user-governance-context');
const {
  issueBrokerServiceToken,
  revokeBrokerServiceToken
} = require('../../lib/security/service-token-broker');
const { appendAssistantAuditBestEffort } = require('../../lib/assistant/audit-trail');

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
      if (raw.length > 1_048_576) {
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

async function capabilitiesRouter(req, res, path, user, options = {}) {
  if (!user) return sendJson(res, 401, { error: 'Unauthorized' });

  if (path === '/capabilities' && req.method === 'GET') {
    return sendJson(res, 200, {
      capabilities: listCapabilities(),
      execution: {
        governed: true,
        automatic_service_tokens: true,
        native_inference_modes: ['LOCAL_NATIVE', 'REMOTE_BONDS_NATIVE'],
        external_llm_provider_required: false
      }
    });
  }

  if (path === '/capabilities/plan' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error: 'Invalid JSON body', detail: err.message }); }
    return sendJson(res, 200, planCapabilities(body));
  }

  if (path === '/capabilities/execute' && req.method === 'POST') {
    let body;
    try { body = await parseBody(req); }
    catch (err) { return sendJson(res, 400, { error: 'Invalid JSON body', detail: err.message }); }

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendJson(res, 400, { error: 'Invalid request body' });
    }
    const action = String(body.action || '').trim();
    if (!action) return sendJson(res, 400, { error: 'action is required' });

    const input = body.input || {};
    const validation = validateCapabilityInput(action, input);
    if (!validation.valid) {
      const result = await executeCapability(action, input);
      return sendJson(res, result.httpStatus, result);
    }

    const service = getService(validation.spec.serviceCode);
    const { supabase, ...executionOptions } = options;
    const authorization = await resolveUserGovernanceContext({
      user,
      service,
      supabase
    });
    if (!authorization.ok) {
      return sendJson(res, authorization.httpStatus, {
        ok: false,
        executed: false,
        action,
        error: { code: authorization.code },
        httpStatus: authorization.httpStatus
      });
    }

    const serviceTokenHeader = req.headers['x-bonds-service-token'];
    let serviceToken = typeof serviceTokenHeader === 'string' && serviceTokenHeader.trim()
      ? serviceTokenHeader.trim()
      : null;
    let brokerIssued = false;

    if (service?.security?.serviceTokenRequired === true && !serviceToken) {
      const issued = await issueBrokerServiceToken({
        audience: validation.spec.serviceCode,
        fetchImpl: executionOptions.fetchImpl || global.fetch
      });
      if (!issued.ok) {
        return sendJson(res, issued.httpStatus || 503, {
          ok: false,
          executed: false,
          action,
          error: { code: issued.code || 'TOKEN_BROKER_FAILED' },
          httpStatus: issued.httpStatus || 503
        });
      }
      serviceToken = issued.token;
      brokerIssued = true;
    }

    const requestId = req.headers['x-request-id'] || null;
    const auditDb = supabase || require('../lib/supabase').getSupabaseClient();
    const auditStatusMap = {
      started: 'execution_started',
      succeeded: 'execution_succeeded',
      failed: 'execution_failed',
      denied: 'execution_denied'
    };
    const existingAudit = authorization.context.governance?.audit;
    const persistentAssistantAudit = service?.serviceCode === 'assistant'
      ? async event => {
          if (typeof existingAudit === 'function') {
            await existingAudit(event);
          }
          const eventType = auditStatusMap[event?.status];
          if (!eventType) return;
          await appendAssistantAuditBestEffort({
            supabase:auditDb,
            userId:user.id,
            action:{
              id:validation.spec.id || null,
              type:action,
              target:null,
              risk:null,
              requires_confirmation:false
            },
            eventType,
            outcome:event?.status || null,
            sessionId:null,
            boundary:null,
            metadata:{
              service:event?.service || service.serviceCode,
              capability:event?.capability || action,
              request_id:event?.requestId || requestId,
              code:event?.detail?.code || null
            }
          });
        }
      : existingAudit;

    let result;
    try {
      result = await executeCapability(action, input, {
        ...executionOptions,
        ...authorization.context,
        requestId,
        governance:{
          ...authorization.context.governance,
          audit:persistentAssistantAudit
        },
        auth: {
          ...(executionOptions.auth || {}),
          serviceToken: serviceToken || executionOptions.auth?.serviceToken || null
        }
      });
    } finally {
      if (brokerIssued && serviceToken) {
        // Successful verification consumes broker-issued tokens atomically.
        // This best-effort revoke covers failures that occur before introspection.
        await revokeBrokerServiceToken({
          token: serviceToken,
          fetchImpl: executionOptions.fetchImpl || global.fetch
        }).catch(() => null);
        serviceToken = null;
      }
    }

    const status = result.ok ? 200 : (result.httpStatus || (result.executed ? 422 : 503));
    return sendJson(res, status, result);
  }

  return sendJson(res, 404, { error: 'Capability route not found' });
}

module.exports = { capabilitiesRouter };
