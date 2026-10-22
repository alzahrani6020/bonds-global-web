/**
 * @jest-environment node
 */
'use strict';

const { EventEmitter } = require('events');

jest.mock('../../lib/assistant/emergency-kill-switch',()=>({
  featureForAssistantMutation:()=>null,
  assertAssistantMutationEnabled:jest.fn()
}));
const {
  normalizeAction,
  planRegisteredAction
} = require('../../lib/assistant/protocol');
const {
  prepareConfirmation,
  resolveConfirmation
} = require('../../lib/assistant/confirmation-engine');
const {
  normalizeIdempotencyKey,
  claimAssistantAction,
  resolveAssistantAction
} = require('../../lib/assistant/idempotency');
const {
  hashOpaque,
  sanitizeMetadata,
  normalizeAssistantAuditEvent
} = require('../../lib/assistant/audit-trail');

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
    statusCode:200,
    headers:{},
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    end(value) {
      resolve({
        statusCode:this.statusCode,
        body:value ? JSON.parse(value) : null
      });
    }
  };
}

function callAssistant({ method='POST', path, body, user={ id:'red-user-1' } }) {
  return new Promise(resolve => {
    assistantRouter(makeReq(method, body), makeRes(resolve), path, user);
  });
}

describe('BONDS Assistant V1 security red-team', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockRpc.mockImplementation(async (name) => {
      if (name === 'assistant_append_action_audit') {
        return { data:'audit-red-1', error:null };
      }
      throw new Error('UNEXPECTED_RPC:' + name);
    });
  });

  describe('structured-action execution boundary', () => {
    test.each([
      ['url', { url:'https://evil.example' }],
      ['href', { input:{ href:'https://evil.example' } }],
      ['javascript', { input:{ javascript:'alert(1)' } }],
      ['script', { input:{ nested:{ script:'steal()' } } }],
      ['selector', { input:{ selector:'#admin-delete' } }],
      ['sql', { input:{ sql:'delete from users' } }],
      ['raw_sql', { input:{ nested:{ raw_sql:'drop table x' } } }],
      ['code', { input:{ nested:{ deeper:{ code:'process.exit()' } } } }]
    ])('rejects forbidden execution field %s even when nested', (_name, attack) => {
      expect(() => normalizeAction({
        id:'red-action',
        type:'site_navigate',
        capability:'site_navigate',
        target:'home',
        risk:'low',
        ...attack
      })).toThrow('FORBIDDEN_EXECUTION_FIELD');
    });

    test('rejects unsupported action types rather than treating model text as a tool', () => {
      expect(() => normalizeAction({
        type:'run_shell_command',
        input:{ command:'whoami' }
      })).toThrow('UNSUPPORTED_ACTION_TYPE');
    });

    test('planner refuses model-invented navigation targets and never echoes executable URL', () => {
      const result = planRegisteredAction({
        type:'site_navigate',
        target:'https://evil.example/phish'
      });
      expect(result.status).toBe('denied');
      expect(result.context.code).toBe('NAVIGATION_TARGET_NOT_REGISTERED');
      expect(result.actions).toHaveLength(0);
      expect(JSON.stringify(result)).not.toContain('https://evil.example/phish');
    });

    test('planner refuses unregistered forms', () => {
      const result = planRegisteredAction({
        type:'form_save_draft',
        form:'../../../admin'
      });
      expect(result.status).toBe('denied');
      expect(result.context.code).toBe('FORM_NOT_REGISTERED');
      expect(result.actions).toHaveLength(0);
    });
  });

  describe('confirmation tamper resistance', () => {
    const highRiskAction = {
      id:'red-confirm-1',
      type:'form_save_draft',
      capability:'form_save_draft',
      target:'kyc',
      input:{ amount:100 },
      risk:'high',
      requires_confirmation:true,
      status:'ready'
    };

    test('confirmation can never self-authorize execution', () => {
      const prepared = prepareConfirmation(highRiskAction, { language:'en' });
      const resolved = resolveConfirmation(highRiskAction, prepared, 'confirm');
      expect(prepared.execution_authorized).toBe(false);
      expect(resolved.execution_authorized).toBe(false);
      expect(resolved.status).toBe('confirmed');
    });

    test('rejects forged action id', () => {
      const prepared = prepareConfirmation(highRiskAction);
      expect(() => resolveConfirmation(
        { ...highRiskAction, id:'other-action' },
        prepared,
        'confirm'
      )).toThrow('CONFIRMATION_ACTION_MISMATCH');
    });

    test('rejects payload mutation after confirmation preparation', () => {
      const prepared = prepareConfirmation(highRiskAction);
      expect(() => resolveConfirmation(
        { ...highRiskAction, input:{ amount:101 } },
        prepared,
        'confirm'
      )).toThrow('CONFIRMATION_PAYLOAD_CHANGED');
    });

    test.each(['yes','approve','1','execute',''])(
      'rejects non-contract confirmation decision %p',
      decision => {
        const prepared = prepareConfirmation(highRiskAction);
        expect(() => resolveConfirmation(highRiskAction, prepared, decision))
          .toThrow('INVALID_CONFIRMATION_DECISION');
      }
    );

    test('API fails closed on forged confirmation payload', async () => {
      const prepared = prepareConfirmation(highRiskAction);
      const response = await callAssistant({
        path:'/assistant/confirmation/resolve',
        body:{
          action:{ ...highRiskAction, input:{ amount:999999 } },
          confirmation:prepared,
          decision:'confirm'
        }
      });
      expect(response.statusCode).toBe(409);
      expect(response.body.status).toBe('denied');
      expect(response.body.error).toBe('CONFIRMATION_PAYLOAD_CHANGED');
    });
  });

  describe('idempotency replay protection', () => {
    test.each(['', 'abc', 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)])(
      'rejects malformed idempotency key %p',
      key => expect(() => normalizeIdempotencyKey(key))
        .toThrow('INVALID_IDEMPOTENCY_KEY')
    );

    test('claim rejects non-write capabilities before touching database', async () => {
      const db = { rpc:jest.fn() };
      await expect(claimAssistantAction({
        supabase:db,
        userId:'user-1',
        action:{
          id:'read-1',
          type:'site_navigate',
          capability:'site_navigate',
          target:'home',
          risk:'low'
        },
        idempotencyKey:'a'.repeat(64)
      })).rejects.toThrow('IDEMPOTENCY_ACTION_NOT_SUPPORTED');
      expect(db.rpc).not.toHaveBeenCalled();
    });

    test('resolve rejects arbitrary terminal statuses', async () => {
      const db = { rpc:jest.fn() };
      await expect(resolveAssistantAction({
        supabase:db,
        userId:'user-1',
        action:{
          id:'write-1',
          type:'form_save_draft',
          capability:'form_save_draft',
          target:'kyc',
          risk:'medium'
        },
        idempotencyKey:'b'.repeat(64),
        status:'force_retry'
      })).rejects.toThrow('INVALID_IDEMPOTENCY_STATUS');
      expect(db.rpc).not.toHaveBeenCalled();
    });

    test('API treats in-progress duplicate as conflict rather than retrying the write', async () => {
      mockRpc.mockImplementation(async (name) => {
        if (name === 'assistant_claim_idempotency') {
          return {
            data:{ state:'in_progress', status:'started', result:null },
            error:null
          };
        }
        if (name === 'assistant_append_action_audit') {
          return { data:'audit-red-2', error:null };
        }
        throw new Error('UNEXPECTED_RPC:' + name);
      });

      const response = await callAssistant({
        path:'/assistant/idempotency/claim',
        body:{
          action:{
            id:'write-replay-1',
            type:'form_save_draft',
            capability:'form_save_draft',
            target:'kyc',
            input:{ navigation_target:'client_kyc' },
            risk:'medium',
            requires_confirmation:false
          },
          idempotency_key:'c'.repeat(64)
        }
      });

      expect(response.statusCode).toBe(409);
      expect(response.body.status).toBe('denied');
      expect(response.body.idempotency.state).toBe('in_progress');
    });

    test('API treats uncertain duplicate as conflict rather than executing again', async () => {
      mockRpc.mockImplementation(async (name) => {
        if (name === 'assistant_claim_idempotency') {
          return {
            data:{ state:'uncertain', status:'uncertain', result:null },
            error:null
          };
        }
        if (name === 'assistant_append_action_audit') {
          return { data:'audit-red-3', error:null };
        }
        throw new Error('UNEXPECTED_RPC:' + name);
      });

      const response = await callAssistant({
        path:'/assistant/idempotency/claim',
        body:{
          action:{
            id:'write-uncertain-1',
            type:'form_save_draft',
            capability:'form_save_draft',
            target:'kyc',
            input:{ navigation_target:'client_kyc' },
            risk:'medium',
            requires_confirmation:false
          },
          idempotency_key:'d'.repeat(64)
        }
      });

      expect(response.statusCode).toBe(409);
      expect(response.body.idempotency.state).toBe('uncertain');
    });
  });

  describe('audit data minimization', () => {
    test('hashes opaque keys instead of retaining raw idempotency material', () => {
      const raw = 'sensitive-idempotency-key';
      const hashed = hashOpaque(raw);
      expect(hashed).toMatch(/^[0-9a-f]{64}$/);
      expect(hashed).not.toContain(raw);
    });

    test('drops nested objects, arrays and unsafe metadata keys', () => {
      const sanitized = sanitizeMetadata({
        safe_code:'OK',
        count:2,
        nested:{ secret:'do-not-store' },
        array:['secret'],
        'unsafe key':'secret',
        huge:'x'.repeat(1000)
      });
      expect(sanitized).toEqual({
        safe_code:'OK',
        count:2,
        huge:'x'.repeat(500)
      });
      expect(JSON.stringify(sanitized)).not.toContain('do-not-store');
      expect(JSON.stringify(sanitized)).not.toContain('secret');
    });

    test('normalization stores hash but never raw idempotency key', () => {
      const raw = 'raw-red-team-key';
      const payload = normalizeAssistantAuditEvent({
        userId:'user-red',
        action:{
          id:'audit-1',
          type:'form_save_draft',
          target:'kyc',
          risk:'medium'
        },
        eventType:'idempotency_claimed',
        idempotencyKey:raw,
        metadata:{
          code:'OK',
          payload:{ password:'never-store' }
        }
      });
      expect(payload.p_idempotency_key_hash).toBe(hashOpaque(raw));
      expect(JSON.stringify(payload)).not.toContain(raw);
      expect(JSON.stringify(payload)).not.toContain('password');
      expect(JSON.stringify(payload)).not.toContain('never-store');
    });
  });

  describe('HTTP fail-closed boundary', () => {
    test('all assistant routes reject unauthenticated callers before database access', async () => {
      for (const path of [
        '/assistant',
        '/assistant/plan',
        '/assistant/confirmation/prepare',
        '/assistant/confirmation/resolve',
        '/assistant/idempotency/claim',
        '/assistant/idempotency/resolve'
      ]) {
        mockRpc.mockClear();
        const response = await callAssistant({
          method:path === '/assistant' ? 'GET' : 'POST',
          path,
          body:{},
          user:null
        });
        expect(response.statusCode).toBe(401);
        expect(mockRpc).not.toHaveBeenCalled();
      }
    });

    test('unknown assistant routes return 404 rather than dynamic dispatch', async () => {
      const response = await callAssistant({
        path:'/assistant/../../admin/delete',
        body:{ action:'delete_all' }
      });
      expect(response.statusCode).toBe(404);
      expect(response.body.error).toBe('Assistant route not found');
    });
  });
});
