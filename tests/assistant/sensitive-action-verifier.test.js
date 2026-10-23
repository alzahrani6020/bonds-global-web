/** @jest-environment node */

const { EventEmitter } = require('events');

const {
  verifySensitiveAction
} = require('../../lib/assistant/sensitive-action-verifier');
const {
  actionFingerprint,
  prepareConfirmation
} = require('../../lib/assistant/confirmation-engine');

describe('Sensitive action verifier', () => {
  const action = {
    id:'act-sensitive-1',
    type:'form_submit',
    capability:'form_submit',
    target:'funding',
    input:{ application_id:'app-1' },
    risk:'high',
    requires_confirmation:true,
    status:'ready'
  };

  test('deterministically verifies a sensitive structured action for human review only', () => {
    const verification=verifySensitiveAction({ action });

    expect(verification.verdict).toBe('verified_for_review');
    expect(verification.sensitive).toBe(true);
    expect(verification.risk).toBe('high');
    expect(verification.action_fingerprint).toBe(actionFingerprint(action));
    expect(verification.execution_authorized).toBe(false);
    expect(verification.auto_execute).toBe(false);
    expect(verification.authorization_source).toBe(false);
    expect(verification.model_used).toBe(false);
    expect(verification.multi_agent).toBe(false);
  });

  test('rejects a non-sensitive action', () => {
    const verification=verifySensitiveAction({
      action:{ ...action, risk:'medium' }
    });

    expect(verification.verdict).toBe('rejected');
    expect(verification.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id:'sensitive_risk',
        status:'fail',
        code:'SENSITIVE_ACTION_RISK_NOT_ELIGIBLE'
      })
    ]));
    expect(verification.execution_authorized).toBe(false);
  });

  test('rejects actions with forbidden executable payload fields through existing policy', () => {
    const verification=verifySensitiveAction({
      action:{
        ...action,
        input:{ script:'rm -rf /' }
      }
    });

    expect(verification.verdict).toBe('rejected');
    expect(verification.checks[0]).toEqual(expect.objectContaining({
      id:'structured_action',
      status:'fail',
      code:'FORBIDDEN_EXECUTION_FIELD'
    }));
  });

  test('rejects confirmation evidence for a changed payload fingerprint', () => {
    const confirmation=prepareConfirmation(action);
    const changed={
      ...action,
      input:{ application_id:'app-2' }
    };
    const verification=verifySensitiveAction({
      action:changed,
      confirmation
    });

    expect(verification.verdict).toBe('rejected');
    expect(verification.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id:'confirmation_fingerprint_match',
        status:'fail',
        code:'SENSITIVE_ACTION_CONFIRMATION_FINGERPRINT_MISMATCH'
      })
    ]));
  });

  test('rejects explicit rejected approval evidence', () => {
    const verification=verifySensitiveAction({
      action,
      approval:{
        status:'rejected',
        action_fingerprint:actionFingerprint(action),
        risk:'high'
      }
    });

    expect(verification.verdict).toBe('rejected');
    expect(verification.approval_status).toBe('rejected');
    expect(verification.execution_authorized).toBe(false);
  });

  test('approved evidence never grants execution authority', () => {
    const verification=verifySensitiveAction({
      action,
      approval:{
        status:'approved',
        action_fingerprint:actionFingerprint(action),
        risk:'high'
      }
    });

    expect(verification.verdict).toBe('verified_for_review');
    expect(verification.approval_status).toBe('approved');
    expect(verification.execution_authorized).toBe(false);
    expect(verification.authorization_source).toBe(false);
  });
});

describe('Sensitive action verifier API', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('exposes deterministic verification without a database write or authorization grant', async () => {
    jest.doMock('../../v3/lib/supabase',()=>({
      getSupabaseClient:()=>({ from:jest.fn() })
    }));
    jest.doMock('../../lib/assistant/emergency-kill-switch',()=>({
      featureForAssistantMutation:()=>null,
      assertAssistantMutationEnabled:jest.fn(),
      getAssistantEmergencyModeState:jest.fn()
    }));

    const { assistantRouter }=require('../../v3/api/assistant');
    const request=new EventEmitter();
    request.method='POST';
    request.url='/api/v3/assistant/sensitive-actions/verify';

    const action={
      id:'api-sensitive-1',
      type:'form_submit',
      capability:'form_submit',
      target:'funding',
      input:{ application_id:'app-1' },
      risk:'critical',
      requires_confirmation:true,
      status:'ready'
    };

    const response=await new Promise(resolve=>{
      const res={
        statusCode:200,
        headers:{},
        setHeader(k,v){ this.headers[String(k).toLowerCase()]=v; },
        end(value){ resolve({
          statusCode:this.statusCode,
          body:value ? JSON.parse(value) : null
        }); }
      };
      assistantRouter(
        request,
        res,
        '/assistant/sensitive-actions/verify',
        { id:'user-1' }
      );
      process.nextTick(()=>{
        request.emit('data',Buffer.from(JSON.stringify({ action })));
        request.emit('end');
      });
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe('completed');
    expect(response.body.verification.verdict).toBe('verified_for_review');
    expect(response.body.verification.execution_authorized).toBe(false);
    expect(response.body.verification.model_used).toBe(false);
    expect(response.body.verification.multi_agent).toBe(false);
  });
});
