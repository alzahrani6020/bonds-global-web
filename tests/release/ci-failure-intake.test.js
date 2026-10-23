'use strict';

const { DynamicIntelligenceBus }=require('../../lib/dual-core/intelligence-bus');
const { EVENT_TYPES }=require('../../lib/dual-core/event-taxonomy');
const {
  normalizeGithubCiFailure,
  ingestGithubCiFailure
}=require('../../lib/release/ci-failure-intake');

const SHA='a'.repeat(40);

function run(overrides={}){
  return {
    id:12345,
    name:'CI — Tests, Audit & Visual Regression',
    head_sha:SHA,
    status:'completed',
    conclusion:'failure',
    event:'pull_request',
    html_url:'https://github.com/example/repo/actions/runs/12345',
    updated_at:'2026-10-23T05:00:00Z',
    ...overrides
  };
}

describe('Phase 5 GitHub CI failure intake',()=>{
  test('normalizes completed failed workflow into deterministic ci.failed event',()=>{
    const result=normalizeGithubCiFailure({
      repository:'alzahrani6020/bonds-global-web',
      workflowRun:run(),
      jobs:[
        {id:1,name:'test-and-audit',conclusion:'failure'},
        {id:2,name:'windows-acceptance',conclusion:'success'}
      ]
    });

    expect(result.status).toBe('accepted');
    expect(result.event.type).toBe(EVENT_TYPES.CI_FAILED);
    expect(result.event.payload.head_sha).toBe(SHA);
    expect(result.event.payload.failed_jobs).toEqual([
      {id:'1',name:'test-and-audit',conclusion:'failure'}
    ]);
    expect(result.event.payload.failure_signature).toMatch(/^[0-9a-f]{64}$/);
    expect(result.policy).toEqual(expect.objectContaining({
      deterministic:true,
      ai_inference:false,
      execution_authorized:false,
      repair_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('same failure yields same event id and signature',()=>{
    const args={
      repository:'alzahrani6020/bonds-global-web',
      workflowRun:run(),
      jobs:[{id:1,name:'test-and-audit',conclusion:'failure'}]
    };
    const a=normalizeGithubCiFailure(args);
    const b=normalizeGithubCiFailure(args);
    expect(a.event.id).toBe(b.event.id);
    expect(a.event.payload.failure_signature).toBe(b.event.payload.failure_signature);
  });

  test('rejects successful workflow',()=>{
    expect(()=>normalizeGithubCiFailure({
      repository:'alzahrani6020/bonds-global-web',
      workflowRun:run({conclusion:'success'}),
      jobs:[]
    })).toThrow('CI_FAILURE_WORKFLOW_NOT_FAILED');
  });

  test('rejects workflow that is not completed',()=>{
    expect(()=>normalizeGithubCiFailure({
      repository:'alzahrani6020/bonds-global-web',
      workflowRun:run({status:'in_progress',conclusion:null}),
      jobs:[]
    })).toThrow('CI_FAILURE_WORKFLOW_NOT_COMPLETED');
  });

  test('publishes normalized event to Dynamic Intelligence Bus only',async()=>{
    const bus=new DynamicIntelligenceBus();
    const handler=jest.fn().mockResolvedValue({ok:true});
    bus.subscribe(EVENT_TYPES.CI_FAILED,handler);

    const result=await ingestGithubCiFailure({
      bus,
      repository:'alzahrani6020/bonds-global-web',
      workflowRun:run(),
      jobs:[{id:1,name:'test-and-audit',conclusion:'failure'}]
    });

    expect(result.delivered).toBe(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].type).toBe(EVENT_TYPES.CI_FAILED);
  });
});
