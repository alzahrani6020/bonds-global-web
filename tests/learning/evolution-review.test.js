'use strict';

const {
  boundedLimit,
  publicEvolutionProposal,
  listEvolutionProposals
}=require('../../lib/learning/evolution-review');

describe('evolution admin review projection',()=>{
  test('bounds list size',()=>{
    expect(boundedLimit(0)).toBe(1);
    expect(boundedLimit(999)).toBe(200);
    expect(boundedLimit('bad')).toBe(50);
  });

  test('does not expose arbitrary proposal metadata',()=>{
    const view=publicEvolutionProposal({
      id:'p1',
      fingerprint:'a'.repeat(64),
      event_type:'capability.failed',
      severity:'high',
      status:'proposed',
      occurrence_count:2,
      threshold:2,
      metadata:{
        service_code:'svc',
        secret:'never',
        raw_prompt:'never',
        learning_analysis:{
          version:1,
          event_type:'capability.failed',
          status:'proposed',
          diagnosis:{proposal_type:'execution_repair',problem_class:'execution_defect',target_component:'capability_execution',recommended_path:'development_candidate'},
          evidence:{evidence_count:2,proposal_occurrence_count:2,threshold:2,threshold_reached:true,evidence_source:'bonds_learning_events'},
          risk:{risk_class:'high',protected_surface:false,requires_human_approval:true,auto_execute:true,execution_authorized:true,approval_scope:'target_only'}
        }
      }
    });
    expect(JSON.stringify(view)).not.toContain('secret');
    expect(JSON.stringify(view)).not.toContain('raw_prompt');
    expect(view.learning_analysis.risk.auto_execute).toBe(false);
    expect(view.learning_analysis.risk.execution_authorized).toBe(false);
  });

  test('lists only non-authorized rows through the review query',async()=>{
    const calls=[];
    const chain={
      select:jest.fn(()=>chain),
      eq:jest.fn((...args)=>{calls.push(args);return chain;}),
      order:jest.fn(()=>chain),
      limit:jest.fn(async()=>({data:[],error:null}))
    };
    const supabase={from:jest.fn(()=>chain)};
    const result=await listEvolutionProposals({supabase,status:'proposed',limit:20});
    expect(result.policy.execution_authorized).toBe(false);
    expect(calls).toContainEqual(['status','proposed']);
    expect(calls).toContainEqual(['execution_authorized',false]);
  });
});
