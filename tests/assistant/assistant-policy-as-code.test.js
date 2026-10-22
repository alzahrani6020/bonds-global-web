/** @jest-environment node */

const {
  policy,
  evaluateAssistantActionPolicy,
  publicAssistantPolicyDescriptor
}=require('../../lib/assistant/policy-engine');
const { normalizeAction }=require('../../lib/assistant/protocol');

describe('Assistant Policy as Code',()=>{
  test('policy is versioned and deterministic',()=>{
    expect(policy).toEqual(expect.objectContaining({
      schema_version:1,
      policy_id:'bonds-assistant-action-policy',
      policy_version:1
    }));
    expect(policy.invariants).toEqual(expect.objectContaining({
      deterministic:true,
      execution_authorized:false,
      authorization_source:false
    }));
  });

  test('allows registered low-risk action without confirmation',()=>{
    const decision=evaluateAssistantActionPolicy({
      type:'site_navigate',
      risk:'low'
    });
    expect(decision).toEqual(expect.objectContaining({
      decision:'allow',
      requires_confirmation:false,
      execution_authorized:false
    }));
  });

  test('requires confirmation for high and critical risk',()=>{
    for(const risk of ['high','critical']){
      const decision=evaluateAssistantActionPolicy({
        type:'form_submit',
        risk
      });
      expect(decision.decision).toBe('allow');
      expect(decision.requires_confirmation).toBe(true);
      expect(decision.matched_rules).toContain('high_risk_requires_confirmation');
    }
  });

  test('preserves explicit confirmation requirement',()=>{
    const decision=evaluateAssistantActionPolicy({
      type:'form_save_draft',
      risk:'medium',
      requires_confirmation:true
    });
    expect(decision.requires_confirmation).toBe(true);
    expect(decision.matched_rules).toContain('explicit_confirmation_is_preserved');
  });

  test('denies unsupported action types, risks and executable fields',()=>{
    expect(evaluateAssistantActionPolicy({
      type:'not_registered',risk:'low'
    })).toEqual(expect.objectContaining({
      decision:'deny',code:'UNSUPPORTED_ACTION_TYPE'
    }));

    expect(evaluateAssistantActionPolicy({
      type:'site_navigate',risk:'extreme'
    })).toEqual(expect.objectContaining({
      decision:'deny',code:'INVALID_ACTION_RISK'
    }));

    expect(evaluateAssistantActionPolicy({
      type:'site_navigate',
      risk:'low',
      input:{url:'https://example.com'}
    })).toEqual(expect.objectContaining({
      decision:'deny',code:'FORBIDDEN_EXECUTION_FIELD'
    }));
  });

  test('protocol normalization is governed by policy without behavior drift',()=>{
    expect(()=>normalizeAction({
      type:'site_navigate',
      risk:'low',
      input:{selector:'#root'}
    })).toThrow('FORBIDDEN_EXECUTION_FIELD');

    expect(normalizeAction({
      type:'form_submit',
      capability:'form_submit',
      target:'cash_flow',
      risk:'high'
    }).requires_confirmation).toBe(true);
  });

  test('public descriptor omits executable conditions and grants no authority',()=>{
    const descriptor=publicAssistantPolicyDescriptor();
    expect(descriptor.rules.length).toBeGreaterThan(0);
    expect(descriptor.invariants).toEqual(expect.objectContaining({
      execution_authorized:false,
      auto_execute:false,
      authorization_source:false,
      model_generated_policy:false
    }));
    expect(JSON.stringify(descriptor)).not.toContain('when');
  });
});
