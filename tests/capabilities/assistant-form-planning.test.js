/** @jest-environment node */
jest.mock('../../lib/assistant/execute-entitlement', () => ({isExecuteEntitled:jest.fn()}));
jest.mock('../../v3/lib/supabase', () => ({getSupabaseClient:() => ({})}));
const {isExecuteEntitled} = require('../../lib/assistant/execute-entitlement');
const {getRuntimeAdapter} = require('../../lib/capabilities/runtime-adapters');
const {getCapability} = require('../../lib/capabilities/bonds-capability-registry');
const context={userId:'u-1',actor:{id:'u-1'}};

describe('registered form capabilities prepare governed browser plans', () => {
  beforeEach(() => { jest.clearAllMocks(); isExecuteEntitled.mockResolvedValue(false); });
  test('draft planning is registered and cannot claim to have persisted a draft', async () => {
    const spec=getCapability('form_save_draft');
    expect(spec.sideEffect).toBe('none');
    const result=await getRuntimeAdapter(spec.runtime.adapter)({form:'kyc'},context);
    expect(result.result).toMatchObject({planned:true,execution_completed:false});
    expect(result.result.actions[0]).toMatchObject({type:'form_save_draft',target:'kyc'});
    expect(result.result).not.toHaveProperty('record_id');
  });
  test('forged/missing actor binding cannot obtain a draft plan', async () => {
    const adapter=getRuntimeAdapter(getCapability('form_save_draft').runtime.adapter);
    expect((await adapter({form:'kyc'},{userId:'u-1',actor:{id:'other'}})).ok).toBe(false);
  });
  test('prefill checks entitlement and retains the field allowlist', async () => {
    const adapter=getRuntimeAdapter(getCapability('form_prefill').runtime.adapter);
    expect((await adapter({form:'establishment',fields:{legalName:'Test'}},context)).ok).toBe(false);
    isExecuteEntitled.mockResolvedValue(true);
    const good=await adapter({form:'establishment',fields:{legalName:'Test'}},context);
    expect(good.result).toMatchObject({planned:true,execution_completed:false});
    const unsafe=await adapter({form:'establishment',fields:{authorizedEmail:'unsafe'}},context);
    expect(unsafe.ok).toBe(false);
  });
});
