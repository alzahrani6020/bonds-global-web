'use strict';

const crypto = require('crypto');
const contract = require('../lib/assistant/assistant-protocol.contract.json');
const navigation = require('../lib/assistant/navigation-registry.json');
const forms = require('../lib/assistant/form-registry.json');
const { actionFingerprint } = require('../lib/assistant/confirmation-engine');

// Uses the existing smoke user's session. Only a synthetic idempotency ledger
// entry and audit evidence are written; no form or financial record is saved.

// Transport-error classification for smoke diagnostics. Only structural fields
// (name/code) are inspected or reported; raw error messages are never logged,
// so credentials, tokens and response payloads cannot leak through them.
function describeFetchError(error) {
  if (!error || typeof error !== 'object') {
    return { name: 'UnknownError', code: null, causeName: null, causeCode: null, kind: 'other' };
  }
  const name = typeof error.name === 'string' && error.name ? error.name : null;
  const code = typeof error.code === 'string' && error.code ? error.code : null;
  const cause = error.cause && typeof error.cause === 'object' ? error.cause : null;
  const causeName = cause && typeof cause.name === 'string' && cause.name ? cause.name : null;
  const causeCode = cause && typeof cause.code === 'string' && cause.code ? cause.code : null;
  const causeMessage = cause && typeof cause.message === 'string' ? cause.message : '';
  const haystack = `${name || ''} ${code || ''} ${causeName || ''} ${causeCode || ''}`.toUpperCase();
  let kind = 'other';
  if (name === 'TimeoutError' || code === 'ETIMEDOUT' || causeCode === 'ETIMEDOUT' ||
      haystack.includes('UND_ERR_CONNECT_TIMEOUT')) {
    kind = 'timeout';
  } else if (name === 'AbortError' || haystack.includes('ABORT_ERR')) {
    kind = 'abort';
  } else if (haystack.includes('UND_ERR_SOCKET')) {
    kind = 'socket';
  } else if (code === 'ECONNRESET' || causeCode === 'ECONNRESET') {
    kind = 'connreset';
  } else if (haystack.includes('ENOTFOUND') || haystack.includes('EAI_AGAIN') ||
             haystack.includes('DNS')) {
    kind = 'dns';
  } else if (haystack.includes('CERT') || haystack.includes('TLS') || haystack.includes('SSL') ||
             haystack.includes('EPROTO') || haystack.includes('UNABLE_TO_VERIFY')) {
    kind = 'tls';
  } else if (causeMessage.toUpperCase().includes('REDIRECT')) {
    kind = 'redirect';
  }
  return { name: name || 'UnknownError', code, causeName, causeCode, kind };
}

async function assertAssistantProduction({
  baseUrl,
  token,
  expectedSha,
  fetchImpl = global.fetch,
  log = console.log,
  sleepImpl = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  if (!token || !/^[0-9a-f]{40}$/i.test(expectedSha || '')) {
    throw new Error('Assistant smoke requires an authenticated session and exact release SHA');
  }
  const origin = new URL(baseUrl);
  if (!['https:', 'http:'].includes(origin.protocol) || origin.username || origin.password ||
      origin.pathname !== '/' || origin.search || origin.hash) {
    throw new Error('Assistant smoke requires a site origin');
  }
  const marker = `assistant-smoke-${expectedSha.slice(0, 12)}-${crypto.randomUUID()}`;
  let requestCount = 0;
  log(`Assistant API smoke START (marker=${marker})`);

  function check(condition, label) {
    if (!condition) throw new Error(`Assistant smoke failed: ${label} (marker=${marker})`);
  }

  function retryAfterMs(value) {
    const raw = String(value || '').trim();
    if (!raw) return 1000;
    const seconds = Number(raw);
    if (Number.isFinite(seconds)) {
      return Math.max(0, Math.min(65000, Math.ceil(seconds * 1000)));
    }
    const absolute = Date.parse(raw);
    if (Number.isFinite(absolute)) {
      return Math.max(0, Math.min(65000, absolute - Date.now()));
    }
    return 1000;
  }

  async function request(path, { method = 'GET', body, authenticated = true } = {}) {
    const headers = { 'Cache-Control': 'no-cache', 'X-Request-ID': marker };
    if (authenticated) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';

    for (let attempt = 1; attempt <= 2; attempt++) {
      requestCount += 1;
      let response;
      const startedAt = Date.now();
      try {
        response = await fetchImpl(`${origin.origin}/api/v3${path}`, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
          // Never forward the session to a redirect target.
          redirect: 'error',
          signal: AbortSignal.timeout(20000)
        });
      } catch (error) {
        const detail = describeFetchError(error);
        throw new Error(
          `Assistant smoke request failed: ${method} ${path} ` +
          `(attempt=${attempt}, elapsed_ms=${Date.now() - startedAt}, kind=${detail.kind}, ` +
          `error_name=${detail.name}, error_code=${detail.code || 'none'}, ` +
          `cause_name=${detail.causeName || 'none'}, cause_code=${detail.causeCode || 'none'}, ` +
          `marker=${marker})`
        );
      }

      if (response.status === 429 && attempt === 1) {
        const delayMs = retryAfterMs(response.headers.get('retry-after'));
        log(`Assistant smoke transient 429; retrying once after ${delayMs}ms (marker=${marker})`);
        await sleepImpl(delayMs);
        continue;
      }

      check(/^application\/json\b/i.test(response.headers.get('content-type') || ''),
        `${method} ${path} must return JSON`);
      let data;
      try { data = JSON.parse(await response.text()); }
      catch (_) { throw new Error(`Assistant smoke invalid JSON: ${method} ${path} (marker=${marker})`); }
      check(data && typeof data === 'object' && !Array.isArray(data), `${path} object response`);
      return { status: response.status, data };
    }

    throw new Error(`Assistant smoke request exhausted retries: ${method} ${path} (marker=${marker})`);
  }

  function expectStatus(result, status, label) {
    check(result.status === status, `${label}: expected HTTP ${status}, received ${result.status}`);
  }

  function expectEnvelope(result, status, label) {
    check(result.data.protocol === contract.protocol && result.data.status === status, label);
  }

  const post = (path, body, authenticated = true) => request(path, {
    method: 'POST', authenticated,
    body: { ...body, session_id: marker, boundary: 'production_acceptance' }
  });

  for (const [path, method] of [
    ['/assistant', 'GET'],
    ['/assistant/plan', 'POST'],
    ['/assistant/workflows/transition', 'POST'],
    ['/assistant/escalations', 'POST'],
    ['/capabilities/execute', 'POST']
  ]) {
    const denied = await request(path, { method, authenticated: false,
      body: method === 'POST' ? {} : undefined });
    expectStatus(denied, 401, `unauthenticated ${path}`);
  }

  const ready = await request('/assistant');
  expectStatus(ready, 200, 'Assistant ready');
  expectEnvelope(ready, 'ready', 'Assistant ready envelope');
  check(ready.data.context?.execution === 'plan_only' && Array.isArray(ready.data.actions),
    'Assistant planning boundary');

  const liveContract = await request('/assistant/contract');
  expectStatus(liveContract, 200, 'Assistant contract');
  check(liveContract.data.protocol === contract.protocol && liveContract.data.version === contract.version &&
    contract.action.forbidden_fields.every(field => liveContract.data.action?.forbidden_fields?.includes(field)),
  'Assistant protocol and forbidden execution fields');

  const liveNavigation = await request('/assistant/navigation');
  expectStatus(liveNavigation, 200, 'navigation registry');
  check(liveNavigation.data.registry === navigation.registry &&
    ['ar', 'en'].every(language => liveNavigation.data.destinations?.kyc?.routes?.[language] ===
      navigation.destinations.kyc.routes[language]), 'registered bilingual KYC routes');

  const liveForms = await request('/assistant/forms');
  expectStatus(liveForms, 200, 'form registry');
  check(liveForms.data.registry === forms.registry &&
    liveForms.data.forms?.kyc?.navigation_target === forms.forms.kyc.navigation_target,
  'registered KYC form');

  const plan = await post('/assistant/plan', { type: 'site_navigate', target: 'kyc', language: 'ar' });
  expectStatus(plan, 200, 'registered plan');
  expectEnvelope(plan, 'ready', 'registered plan envelope');
  check(plan.data.actions?.length === 1 && plan.data.actions[0].type === 'site_navigate' &&
    plan.data.actions[0].target === 'kyc' &&
    plan.data.context?.navigation?.route === navigation.destinations.kyc.routes.ar,
  'registered plan destination');

  for (const [body, code] of [
    [{ type: 'site_navigate', target: 'https://unregistered.invalid' }, 'NAVIGATION_TARGET_NOT_REGISTERED'],
    [{ type: 'form_load', form: 'assistant_smoke_unregistered' }, 'FORM_NOT_REGISTERED']
  ]) {
    const denied = await post('/assistant/plan', body);
    expectStatus(denied, 422, 'unregistered plan');
    expectEnvelope(denied, 'denied', 'unregistered plan denial');
    check(denied.data.context?.code === code && denied.data.actions?.length === 0,
      'unregistered plan does not expose actions');
  }
  expectStatus(await request('/assistant/production-smoke-unknown'), 404, 'unknown Assistant route');

  const draft = await post('/assistant/plan', { type: 'form_save_draft', form: 'kyc' });
  expectStatus(draft, 200, 'synthetic draft plan');
  expectEnvelope(draft, 'ready', 'synthetic draft plan envelope');
  check(draft.data.actions?.length === 1 && draft.data.actions[0].type === 'form_save_draft' &&
    draft.data.actions[0].target === 'kyc', 'registered draft action');
  const action = {
    ...draft.data.actions[0],
    id: marker,
    input: { ...draft.data.actions[0].input, production_smoke: marker },
    requires_confirmation: true
  };
  const fingerprint = actionFingerprint(action);
  const prepared = await post('/assistant/confirmation/prepare', { action });
  expectStatus(prepared, 200, 'confirmation prepare');
  expectEnvelope(prepared, 'needs_confirmation', 'confirmation prepare envelope');
  const confirmation = prepared.data.confirmation;
  check(confirmation?.required === true && confirmation.status === 'pending' &&
    confirmation.action_id === action.id && confirmation.action_fingerprint === fingerprint &&
    confirmation.execution_authorized === false, 'confirmation binds exact action without authorization');

  const confirmed = await post('/assistant/confirmation/resolve', { action, confirmation, decision: 'confirm' });
  expectStatus(confirmed, 200, 'confirmation resolve');
  expectEnvelope(confirmed, 'completed', 'confirmation resolve envelope');
  check(confirmed.data.confirmation?.status === 'confirmed' &&
    confirmed.data.confirmation.action_fingerprint === fingerprint &&
    confirmed.data.confirmation.execution_authorized === false, 'confirmation remains intent only');

  const changedAction = { ...action, input: { ...action.input, changed: true } };
  const tampered = await post('/assistant/confirmation/resolve', {
    action: changedAction, confirmation, decision: 'confirm'
  });
  expectStatus(tampered, 409, 'changed confirmation payload');
  check(tampered.data.error === 'CONFIRMATION_PAYLOAD_CHANGED', 'payload mutation rejection');

  const governed = await post('/capabilities/execute', {
    action: 'site_navigate', input: { target: 'kyc', language: 'ar' }
  });
  expectStatus(governed, 200, 'governed read');
  check(governed.data.ok === true && governed.data.executed === true &&
    governed.data.action === 'site_navigate' && governed.data.service === 'assistant' &&
    governed.data.governance?.enforced === true && governed.data.result?.target === 'kyc' &&
    governed.data.result?.route === navigation.destinations.kyc.routes.ar, 'governed registered navigation');

  const malformed = await post('/assistant/idempotency/claim', { action, idempotency_key: 'invalid' });
  expectStatus(malformed, 422, 'malformed idempotency key');
  check(malformed.data.error === 'INVALID_IDEMPOTENCY_KEY', 'malformed key rejection');

  const idempotencyKey = crypto.createHash('sha256').update(marker).digest('hex');
  const ledgerInput = { action, idempotency_key: idempotencyKey };
  let pendingClaim = false;
  try {
    const claim = await post('/assistant/idempotency/claim', ledgerInput);
    pendingClaim = claim.data.idempotency?.state === 'claimed';
    expectStatus(claim, 200, 'synthetic idempotency claim');
    expectEnvelope(claim, 'ready', 'idempotency claim envelope');
    check(pendingClaim && claim.data.idempotency.status === 'started' &&
      claim.data.idempotency.action_fingerprint === fingerprint, 'durable idempotency claim');

    // No form save occurred. Never invent a successful write receipt.
    const resolved = await post('/assistant/idempotency/resolve', { ...ledgerInput, status: 'uncertain' });
    expectStatus(resolved, 200, 'synthetic idempotency resolution');
    check(resolved.data.idempotency?.state === 'resolved_uncertain' &&
      resolved.data.idempotency.status === 'uncertain' && resolved.data.idempotency.result === null,
    'synthetic ledger resolves without a saved-record claim');
    pendingClaim = false;

    const replay = await post('/assistant/idempotency/claim', ledgerInput);
    expectStatus(replay, 409, 'uncertain replay');
    expectEnvelope(replay, 'denied', 'uncertain replay envelope');
    check(replay.data.idempotency?.state === 'uncertain' && replay.data.idempotency.result === null,
      'uncertain replay cannot authorize another write');
  } finally {
    if (pendingClaim) {
      // Preserve an honest terminal state if an assertion failed after claiming.
      const cleanup = await post('/assistant/idempotency/resolve', { ...ledgerInput, status: 'uncertain' })
        .catch(() => null);
      if (cleanup?.status !== 200 || cleanup.data.idempotency?.status !== 'uncertain') {
        log(`Assistant synthetic ledger cleanup unverified (marker=${marker})`);
      }
    }
  }

  // Endpoint responses cannot prove best-effort audit writes. Use this marker
  // to verify session_id and governed metadata.request_id directly in the DB.
  log(`Assistant API smoke PASS (marker=${marker}, requests=${requestCount}, synthetic_idempotency=uncertain)`);
  return { marker, requestCount, idempotencyState: 'uncertain',
    expectedAudit: { sessionEvents: 9, governedEvents: 2 } };
}

module.exports = { assertAssistantProduction };
