/** @jest-environment node */

const { EventEmitter } = require('events');

const mockRpc = jest.fn();
const mockEntitled = jest.fn();

jest.mock('../../lib/assistant/emergency-kill-switch', () => ({
  featureForAssistantMutation: () => null,
  assertAssistantMutationEnabled: jest.fn()
}));

jest.mock('../../lib/assistant/execute-entitlement', () => ({
  isExecuteEntitled: (...args) => mockEntitled(...args)
}));

jest.mock('../../v3/lib/supabase', () => ({
  getSupabaseClient: () => ({ rpc:mockRpc })
}));

const { assistantRouter } = require('../../v3/api/assistant');

function request(body) {
  const req = new EventEmitter();
  req.method = 'POST';
  process.nextTick(() => {
    req.emit('data', Buffer.from(JSON.stringify(body)));
    req.emit('end');
  });
  return req;
}

function call(body) {
  return new Promise(resolve => {
    const res = {
      statusCode:200,
      headers:{},
      setHeader(name,value){ this.headers[name]=value; },
      end(value){ resolve({ status:this.statusCode, body:value ? JSON.parse(value) : null }); }
    };
    assistantRouter(request(body), res, '/assistant/plan', { id:'user-1' });
  });
}

describe('assistant plan entitlement for form_prefill', () => {
  beforeEach(() => {
    mockRpc.mockReset();
    mockEntitled.mockReset();
    mockRpc.mockResolvedValue({ data:'audit-1', error:null });
  });

  test('does not evaluate entitlement for existing form_save_draft plans', async () => {
    const result = await call({ type:'form_save_draft', form:'kyc' });
    expect(result.status).toBe(200);
    expect(mockEntitled).not.toHaveBeenCalled();
  });

  test('denies form_prefill when entitlement is absent', async () => {
    mockEntitled.mockResolvedValue(false);
    const result = await call({
      type:'form_prefill',
      form:'kyc',
      fields:{ legalName:'Example Co' }
    });
    expect(result.status).toBe(422);
    expect(result.body.status).toBe('denied');
    expect(result.body.context.code).toBe('ENTITLEMENT_REQUIRED');
  });

  test('plans entitled KYC form_prefill and forwards fields to the protocol planner', async () => {
    mockEntitled.mockResolvedValue(true);
    const result = await call({
      type:'form_prefill',
      form:'kyc',
      fields:{ legalName:' Example Co ', selector:'#ignored' }
    });
    expect(result.status).toBe(200);
    expect(result.body.actions[0].type).toBe('form_prefill');
    expect(result.body.actions[0].input.fields).toEqual({ legalName:'Example Co' });
  });
});
