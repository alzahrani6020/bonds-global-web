'use strict';

jest.mock('../../lib/assistant/agent-inbox-queue',()=>({
  enqueueAgentInboxItem:jest.fn(async({item})=>({queued:true,skipped:false,item}))
}));

const { enqueueAgentInboxItem }=require('../../lib/assistant/agent-inbox-queue');
const {
  deriveEvolutionInboxItem,
  enqueueEvolutionProposalForReview
}=require('../../lib/learning/evolution-agent-inbox');

function proposal(overrides={}){
  return {
    id:'11111111-1111-1111-1111-111111111111',
    fingerprint:'a'.repeat(64),
    event_type:'capability.failed',
    severity:'high',
    status:'proposed',
    occurrence_count:2,
    threshold:2,
    metadata:{service_code:'svc-1',error_code:'CAP_FAILED'},
    ...overrides
  };
}

describe('evolution proposal Agent Inbox adapter',()=>{
  beforeEach(()=>enqueueAgentInboxItem.mockClear());

  test('queues only high/critical proposed items',()=>{
    expect(deriveEvolutionInboxItem({proposal:proposal()})).toEqual(expect.objectContaining({
      source_type:'system',
      priority:'high',
      reason_code:'evolution_proposal_review_required'
    }));
    expect(deriveEvolutionInboxItem({proposal:proposal({severity:'critical'})})).toEqual(expect.objectContaining({
      priority:'critical'
    }));
    expect(deriveEvolutionInboxItem({proposal:proposal({severity:'medium'})})).toBeNull();
    expect(deriveEvolutionInboxItem({proposal:proposal({status:'observing'})})).toBeNull();
  });

  test('uses deterministic fingerprint key for deduplication',()=>{
    const item=deriveEvolutionInboxItem({proposal:proposal()});
    expect(item.item_key).toBe('evolution:'+('a'.repeat(64)));
    expect(item.user_id).toBeNull();
    expect(item.metadata.execution_authorized).toBe(false);
    expect(item.metadata.auto_execute).toBe(false);
  });

  test('does not expose arbitrary proposal metadata',()=>{
    const item=deriveEvolutionInboxItem({proposal:proposal({
      metadata:{service_code:'svc-1',secret:'no',raw_prompt:'no'}
    })});
    const json=JSON.stringify(item);
    expect(json).not.toContain('secret');
    expect(json).not.toContain('raw_prompt');
  });

  test('delegates persistence to the existing Agent Inbox queue',async()=>{
    const result=await enqueueEvolutionProposalForReview({
      supabase:{},
      proposal:proposal(),
      eventId:'evt-1'
    });
    expect(result.queued).toBe(true);
    expect(enqueueAgentInboxItem).toHaveBeenCalledTimes(1);
  });
});
