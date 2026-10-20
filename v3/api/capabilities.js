'use strict';

const { listCapabilities, validateCapabilityInput, getService } = require('../../lib/capabilities/bonds-capability-registry');
const { executeCapability } = require('../../lib/capabilities/governed-executor');
const { planCapabilities } = require('../../lib/capabilities/capability-planner');
const { resolveUserGovernanceContext } = require('../../lib/capabilities/user-governance-context');

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
    const { supabase, ...executionOptions } = options;
    const authorization = await resolveUserGovernanceContext({
      user,
      service: getService(validation.spec.serviceCode),
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

    // A user Bearer token is not a service token. Only the dedicated credential
    // is passed to the existing governed verifier (which fails closed).
    const serviceTokenHeader = req.headers['x-bonds-service-token'];
    const serviceToken = typeof serviceTokenHeader === 'string' && serviceTokenHeader.trim()
      ? serviceTokenHeader.trim()
      : null;
    const result = await executeCapability(action, input, {
      ...executionOptions,
      ...authorization.context,
      requestId: req.headers['x-request-id'] || null,
      auth: {
        ...(executionOptions.auth || {}),
        serviceToken: serviceToken || executionOptions.auth?.serviceToken || null
      }
    });
    const status = result.ok ? 200 : (result.httpStatus || (result.executed ? 422 : 503));
    return sendJson(res, status, result);
  }

  return sendJson(res, 404, { error: 'Capability route not found' });
}

module.exports = { capabilitiesRouter };
