/** @jest-environment node */
const {
  featureForAssistantMutation,
  switchIsActive,
  getAssistantKillSwitchState,
  assertAssistantMutationEnabled
}=require('../../lib/assistant/emergency-kill-switch');

function query(result){
  const state={features:null};
  const q={
    select:jest.fn().mockReturnThis(),
    in(_column,features){state.features=features;return Promise.resolve(result);}
  };
  return {q,state};
}

describe('Assistant Emergency Kill Switch',()=>{
  test('maps only state-changing routes to bounded feature keys',()=>{
    expect(featureForAssistantMutation('/assistant/workflows/transition','POST')).toBe('assistant.workflows.transition');
    expect(featureForAssistantMutation('/assistant/approvals','POST')).toBe('assistant.approvals.request');
    expect(featureForAssistantMutation('/assistant/approvals','GET')).toBeNull();
    expect(featureForAssistantMutation('/assistant/documents/read','POST')).toBeNull();
    expect(featureForAssistantMutation('/assistant/plan','POST')).toBeNull();
  });

  test('expired switches do not block and invalid expiries fail safe',()=>{
    expect(switchIsActive({disabled:true,expires_at:'2026-01-01T00:00:00Z'},Date.parse('2026-10-22T00:00:00Z'))).toBe(false);
    expect(switchIsActive({disabled:true,expires_at:'not-a-date'},Date.parse('2026-10-22T00:00:00Z'))).toBe(true);
    expect(switchIsActive({disabled:false})).toBe(false);
  });

  test('global assistant switch takes precedence over feature switch',async()=>{
    const q0=query({data:[
      {feature:'assistant.workflows.transition',disabled:false,expires_at:null},
      {feature:'assistant',disabled:true,reason:'internal reason',expires_at:null}
    ],error:null});
    const state=await getAssistantKillSwitchState({
      supabase:{from:jest.fn(()=>q0.q)},
      feature:'assistant.workflows.transition'
    });
    expect(q0.state.features).toEqual(['assistant','assistant.workflows.transition']);
    expect(state).toEqual(expect.objectContaining({blocked:true,feature:'assistant',execution_authorized:false}));
    expect(state).not.toHaveProperty('reason');
  });

  test('feature switch blocks only while active',async()=>{
    const q0=query({data:[
      {feature:'assistant.events.apply',disabled:true,expires_at:'2099-01-01T00:00:00Z'}
    ],error:null});
    await expect(assertAssistantMutationEnabled({
      supabase:{from:jest.fn(()=>q0.q)},
      feature:'assistant.events.apply',
      nowMs:Date.parse('2026-10-22T00:00:00Z')
    })).rejects.toMatchObject({
      code:'ASSISTANT_FEATURE_DISABLED',
      feature:'assistant.events.apply'
    });
  });

  test('control-plane lookup failure fails closed for mutations',async()=>{
    const q0=query({data:null,error:{message:'db unavailable'}});
    await expect(getAssistantKillSwitchState({
      supabase:{from:jest.fn(()=>q0.q)},
      feature:'assistant.events.apply'
    })).rejects.toThrow('ASSISTANT_KILL_SWITCH_LOOKUP_FAILED');
  });
});
