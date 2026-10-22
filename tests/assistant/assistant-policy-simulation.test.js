/** @jest-environment node */

const {
  MAX_SIMULATIONS,
  simulateOne,
  simulateAssistantPolicy
}=require('../../lib/assistant/policy-simulation');

describe('Assistant Policy Simulation',()=>{
  test('simulates an allowed action without side effects',()=>{
    const out=simulateAssistantPolicy({
      scenario_id:'basic-allow',
      action:{type:'site_navigate',risk:'low'}
    });
    expect(out.summary).toEqual({
      allow:1,deny:0,requires_confirmation:0
    });
    expect(out.results[0].simulation).toEqual({
      dry_run:true,
      writes_performed:false,
      tools_invoked:false,
      authorization_checked:false,
      authorization_granted:false,
      execution_authorized:false,
      auto_execute:false
    });
  });

  test('simulates deny and confirmation outcomes deterministically',()=>{
    const out=simulateAssistantPolicy({
      actions:[
        {type:'not_registered',risk:'low'},
        {type:'form_submit',risk:'high'}
      ]
    });
    expect(out.summary).toEqual({
      allow:1,deny:1,requires_confirmation:1
    });
    expect(out.results[0].decision).toEqual(expect.objectContaining({
      decision:'deny',
      code:'UNSUPPORTED_ACTION_TYPE'
    }));
    expect(out.results[1].decision).toEqual(expect.objectContaining({
      decision:'allow',
      requires_confirmation:true
    }));
  });

  test('does not echo arbitrary input payloads',()=>{
    const out=simulateAssistantPolicy({
      action:{
        type:'site_navigate',
        risk:'low',
        input:{account_number:'secret-value',notes:'private'}
      }
    });
    const serialized=JSON.stringify(out);
    expect(serialized).not.toContain('secret-value');
    expect(serialized).not.toContain('private');
    expect(out.results[0].action).toEqual({
      type:'site_navigate',
      capability:'site_navigate',
      risk:'low'
    });
  });

  test('requires at least one action and bounds batch size',()=>{
    expect(()=>simulateAssistantPolicy({})).toThrow('POLICY_SIMULATION_ACTION_REQUIRED');
    expect(()=>simulateAssistantPolicy({
      actions:Array.from({length:MAX_SIMULATIONS+1},()=>({type:'site_navigate',risk:'low'}))
    })).toThrow('POLICY_SIMULATION_LIMIT_EXCEEDED');
  });

  test('single simulation never grants authorization',()=>{
    const out=simulateOne({type:'payment_action',risk:'critical'});
    expect(out.decision.requires_confirmation).toBe(true);
    expect(out.simulation.authorization_granted).toBe(false);
    expect(out.simulation.execution_authorized).toBe(false);
  });
});
