/**
 * @jest-environment node
 */

const { EventEmitter } = require('events');

jest.mock('../../lib/assistant/emergency-kill-switch',()=>({
  featureForAssistantMutation:()=>null,
  assertAssistantMutationEnabled:jest.fn()
}));

const mockRpc = jest.fn();
jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc: mockRpc })
}));

const { assistantRouter } = require('../../v3/api/assistant');

function makeReq(method, body) {
  const req = new EventEmitter();
  req.method = method;
  process.nextTick(() => {
    if (body !== undefined) req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
  });
  return req;
}

function makeRes(resolve) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    end(value) {
      let body = null;
      try { body = value ? JSON.parse(value) : null; }
      catch (_) { body = value; }
      resolve({ statusCode:this.statusCode, headers:this.headers, body });
    }
  };
}

function callAssistant({ method='POST', path, body, user={ id:'user-e2e-1' } }) {
  return new Promise(resolve => {
    assistantRouter(makeReq(method, body), makeRes(resolve), path, user);
  });
}

describe('BONDS Assistant V1 end-to-end governed journeys', () => {
  const ledger = new Map();
  const auditEvents = [];

  beforeEach(() => {
    ledger.clear();
    auditEvents.length = 0;
    mockRpc.mockReset();
    mockRpc.mockImplementation(async (name, payload) => {
      if (name === 'assistant_append_action_audit') {
        auditEvents.push(payload);
        return { data:`audit-${auditEvents.length}`, error:null };
      }

      if (name === 'assistant_claim_idempotency') {
        const existing = ledger.get(payload.p_idempotency_key);
        if (!existing) {
          ledger.set(payload.p_idempotency_key, {
            fingerprint:payload.p_action_fingerprint,
            status:'in_progress',
            result:null
          });
          return { data:{ state:'claimed', status:'in_progress', result:null }, error:null };
        }
        if (existing.fingerprint !== payload.p_action_fingerprint) {
          return { data:{ state:'key_conflict', status:existing.status, result:null }, error:null };
        }
        if (existing.status === 'succeeded') {
          return { data:{ state:'replay_succeeded', status:'succeeded', result:existing.result }, error:null };
        }
        return { data:{ state:'in_progress', status:existing.status, result:null }, error:null };
      }

      if (name === 'assistant_resolve_idempotency') {
        const existing = ledger.get(payload.p_idempotency_key);
        if (!existing) {
          return { data:{ state:'missing', status:null, result:null }, error:null };
        }
        if (existing.fingerprint !== payload.p_action_fingerprint) {
          return { data:{ state:'key_conflict', status:existing.status, result:null }, error:null };
        }
        existing.status = payload.p_status;
        existing.result = payload.p_result || null;
        return {
          data:{
            state:payload.p_status === 'succeeded' ? 'succeeded' : 'uncertain',
            status:payload.p_status,
            result:existing.result
          },
          error:null
        };
      }

      throw new Error('UNEXPECTED_RPC:' + name);
    });
  });

  test('registered draft journey plans, claims, resolves and safely replays one persisted result', async () => {
    const plan = await callAssistant({
      path:'/assistant/plan',
      body:{ type:'form_save_draft', form:'kyc', language:'en', session_id:'sess-e2e' }
    });

    expect(plan.statusCode).toBe(200);
    expect(plan.body.status).toBe('ready');
    expect(plan.body.actions).toHaveLength(1);

    const action = plan.body.actions[0];
    expect(action).toMatchObject({
      type:'form_save_draft',
      capability:'form_save_draft',
      target:'kyc',
      risk:'medium',
      requires_confirmation:false
    });

    const idempotencyKey = 'a'.repeat(64);

    const claim = await callAssistant({
      path:'/assistant/idempotency/claim',
      body:{ action, idempotency_key:idempotencyKey, session_id:'sess-e2e' }
    });
    expect(claim.statusCode).toBe(200);
    expect(claim.body.idempotency.state).toBe('claimed');

    const persisted = {
      ok:true,
      code:'DRAFT_SAVED',
      record_id:'draft-e2e-001',
      status:'draft'
    };

    const resolve = await callAssistant({
      path:'/assistant/idempotency/resolve',
      body:{
        action,
        idempotency_key:idempotencyKey,
        status:'succeeded',
        result:persisted,
        session_id:'sess-e2e'
      }
    });
    expect(resolve.statusCode).toBe(200);
    expect(resolve.body.status).toBe('completed');
    expect(resolve.body.idempotency.result).toEqual(persisted);

    const replay = await callAssistant({
      path:'/assistant/idempotency/claim',
      body:{ action, idempotency_key:idempotencyKey, session_id:'sess-e2e' }
    });
    expect(replay.statusCode).toBe(200);
    expect(replay.body.idempotency.state).toBe('replay_succeeded');
    expect(replay.body.idempotency.result).toEqual(persisted);

    expect(auditEvents.map(event => event.p_event_type)).toEqual(
      expect.arrayContaining(['planned','idempotency_claimed','write_succeeded','replayed'])
    );
  });

  test('same idempotency key cannot be reused for a changed action payload', async () => {
    const key = 'b'.repeat(64);
    const baseAction = {
      id:'action-e2e',
      type:'form_save_draft',
      capability:'form_save_draft',
      target:'kyc',
      input:{ navigation_target:'client_kyc' },
      risk:'medium',
      requires_confirmation:false,
      status:'ready'
    };

    const first = await callAssistant({
      path:'/assistant/idempotency/claim',
      body:{ action:baseAction, idempotency_key:key }
    });
    expect(first.statusCode).toBe(200);
    expect(first.body.idempotency.state).toBe('claimed');

    const changed = await callAssistant({
      path:'/assistant/idempotency/claim',
      body:{
        action:{ ...baseAction, input:{ navigation_target:'different_target' } },
        idempotency_key:key
      }
    });
    expect(changed.statusCode).toBe(409);
    expect(changed.body.status).toBe('denied');
    expect(changed.body.idempotency.state).toBe('key_conflict');
  });

  test('exact-action confirmation records intent but never grants authorization', async () => {
    const action = {
      id:'action-confirm-e2e',
      type:'form_save_draft',
      capability:'form_save_draft',
      target:'kyc',
      input:{ field:'value' },
      risk:'high',
      requires_confirmation:true,
      status:'ready'
    };

    const prepared = await callAssistant({
      path:'/assistant/confirmation/prepare',
      body:{ action, language:'en', session_id:'sess-confirm' }
    });
    expect(prepared.statusCode).toBe(200);
    expect(prepared.body.status).toBe('needs_confirmation');
    expect(prepared.body.confirmation).toMatchObject({
      required:true,
      status:'pending',
      execution_authorized:false
    });

    const confirmed = await callAssistant({
      path:'/assistant/confirmation/resolve',
      body:{
        action,
        confirmation:prepared.body.confirmation,
        decision:'confirm',
        session_id:'sess-confirm'
      }
    });
    expect(confirmed.statusCode).toBe(200);
    expect(confirmed.body.status).toBe('completed');
    expect(confirmed.body.confirmation.status).toBe('confirmed');
    expect(confirmed.body.confirmation.execution_authorized).toBe(false);
  });

  test('confirmation fails closed if the payload changes after preparation', async () => {
    const action = {
      id:'action-confirm-change',
      type:'form_save_draft',
      capability:'form_save_draft',
      target:'kyc',
      input:{ amount:100 },
      risk:'high',
      requires_confirmation:true,
      status:'ready'
    };

    const prepared = await callAssistant({
      path:'/assistant/confirmation/prepare',
      body:{ action }
    });
    expect(prepared.statusCode).toBe(200);

    const changed = await callAssistant({
      path:'/assistant/confirmation/resolve',
      body:{
        action:{ ...action, input:{ amount:101 } },
        confirmation:prepared.body.confirmation,
        decision:'confirm'
      }
    });

    expect(changed.statusCode).toBe(409);
    expect(changed.body.status).toBe('denied');
    expect(changed.body.error).toBe('CONFIRMATION_PAYLOAD_CHANGED');
  });

  test('assistant endpoints fail closed when no authenticated user is present', async () => {
    const response = await callAssistant({
      method:'GET',
      path:'/assistant',
      user:null
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error:'Unauthorized' });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  test('planner denies unregistered forms without attempting execution', async () => {
    const response = await callAssistant({
      path:'/assistant/plan',
      body:{ type:'form_save_draft', form:'not_registered' }
    });

    expect(response.statusCode).toBe(422);
    expect(response.body.status).toBe('denied');
    expect(response.body.context.code).toBe('FORM_NOT_REGISTERED');
    expect(response.body.actions).toHaveLength(0);
  });
});


describe('End-to-End CI journeys — explicit release gate', () => {
  const {
    prepareConfirmation,
    resolveConfirmation,
    actionFingerprint
  } = require('../../lib/assistant/confirmation-engine');
  const { verifySensitiveAction } = require('../../lib/assistant/sensitive-action-verifier');
  const { normalizeAssistantAuditEvent } = require('../../lib/assistant/audit-trail');

  test('safe write journey preserves evidence from plan through persisted replay', async () => {
    const plan = await callAssistant({
      path:'/assistant/plan',
      body:{ type:'form_save_draft', form:'kyc', language:'ar', session_id:'ci-safe-journey' }
    });

    expect(plan.statusCode).toBe(200);
    expect(plan.body.status).toBe('ready');
    const action = plan.body.actions[0];
    expect(action).toMatchObject({
      type:'form_save_draft',
      risk:'medium',
      requires_confirmation:false
    });

    const key='ci-safe-'+ '1'.repeat(56);
    const claim=await callAssistant({
      path:'/assistant/idempotency/claim',
      body:{ action, idempotency_key:key, session_id:'ci-safe-journey', boundary:'ci:safe' }
    });
    expect(claim.statusCode).toBe(200);
    expect(claim.body.idempotency.state).toBe('claimed');

    const executionEvidence={
      ok:true,
      executed:true,
      code:'DRAFT_SAVED',
      record_id:'ci-draft-001',
      evidence_id:'ci-evidence-001'
    };
    const resolved=await callAssistant({
      path:'/assistant/idempotency/resolve',
      body:{
        action,
        idempotency_key:key,
        status:'succeeded',
        result:executionEvidence,
        session_id:'ci-safe-journey',
        boundary:'ci:safe'
      }
    });
    expect(resolved.statusCode).toBe(200);
    expect(resolved.body.idempotency.result).toEqual(executionEvidence);

    const replay=await callAssistant({
      path:'/assistant/idempotency/claim',
      body:{ action, idempotency_key:key, session_id:'ci-safe-journey', boundary:'ci:safe' }
    });
    expect(replay.body.idempotency.state).toBe('replay_succeeded');
    expect(replay.body.idempotency.result).toEqual(executionEvidence);

    const lifecycle=auditEvents.map(event=>event.p_event_type);
    expect(lifecycle).toEqual(expect.arrayContaining([
      'planned','idempotency_claimed','write_succeeded','replayed'
    ]));
    expect(auditEvents.every(event=>event.p_user_id==='user-e2e-1')).toBe(true);
  });

  test('sensitive journey requires confirmation and human-review evidence but never self-authorizes execution', () => {
    const action={
      id:'ci-sensitive-action',
      type:'form_submit',
      capability:'form_submit',
      target:'funding',
      input:{ application_id:'ci-app-1', amount:125000 },
      risk:'high',
      requires_confirmation:true,
      status:'ready'
    };

    const prepared=prepareConfirmation(action,{language:'ar'});
    expect(prepared).toMatchObject({
      required:true,
      status:'pending',
      execution_authorized:false
    });

    const confirmed=resolveConfirmation(action,prepared,'confirm');
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.execution_authorized).toBe(false);

    const approval={
      status:'approved',
      action_fingerprint:actionFingerprint(action),
      risk:'high'
    };
    const verification=verifySensitiveAction({
      action,
      confirmation:confirmed,
      approval
    });

    expect(verification.verdict).toBe('verified_for_review');
    expect(verification.confirmation_status).toBe('confirmed');
    expect(verification.approval_status).toBe('approved');
    expect(verification.execution_authorized).toBe(false);
    expect(verification.auto_execute).toBe(false);
    expect(verification.authorization_source).toBe(false);

    const audit=normalizeAssistantAuditEvent({
      userId:'ci-user',
      sessionId:'ci-sensitive-journey',
      boundary:'ci:sensitive',
      action,
      eventType:'confirmation_resolved',
      outcome:'confirmed',
      metadata:{
        human_approval_status:'approved',
        verifier_verdict:verification.verdict
      }
    });
    expect(audit.p_event_type).toBe('confirmation_resolved');
    expect(audit.p_requires_confirmation).toBe(true);
    expect(audit.p_metadata).toMatchObject({
      human_approval_status:'approved',
      verifier_verdict:'verified_for_review'
    });
  });

  test('sensitive journey fails closed on payload drift and reused idempotency keys', async () => {
    const key='ci-deny-'+ '2'.repeat(56);
    const action={
      id:'ci-deny-action',
      type:'form_save_draft',
      capability:'form_save_draft',
      target:'kyc',
      input:{ amount:100 },
      risk:'high',
      requires_confirmation:true,
      status:'ready'
    };

    const prepared=prepareConfirmation(action);
    expect(() => resolveConfirmation(
      { ...action, input:{ amount:101 } },
      prepared,
      'confirm'
    )).toThrow('CONFIRMATION_PAYLOAD_CHANGED');

    const first=await callAssistant({
      path:'/assistant/idempotency/claim',
      body:{ action, idempotency_key:key, session_id:'ci-deny-journey' }
    });
    expect(first.statusCode).toBe(200);
    expect(first.body.idempotency.state).toBe('claimed');

    const conflict=await callAssistant({
      path:'/assistant/idempotency/claim',
      body:{
        action:{ ...action, input:{ amount:102 } },
        idempotency_key:key,
        session_id:'ci-deny-journey'
      }
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.body.status).toBe('denied');
    expect(conflict.body.idempotency.state).toBe('key_conflict');
  });
});
