'use strict';

const fs=require('fs');
const os=require('os');
const path=require('path');

const { createCandidate }=require('../../lib/evolution/candidate-manager');
const {
  buildEngineeringMemoryRecord,
  validateEngineeringMemoryContext,
  EngineeringMemoryStore,
  buildEngineeringMemoryContext
}=require('../../lib/evolution/engineering-memory');
const { runRepairLoop }=require('../../lib/evolution/repair-loop');

const SHA='3b54078ec0074c49fa69783baf3df8aebed4ecdb';

function target(){
  return {
    proposal_id:'11111111-1111-1111-1111-111111111111',
    fingerprint:'a'.repeat(64),
    problem_class:'execution_defect',
    target_component:'capability_execution',
    recommended_path:'development_candidate'
  };
}

function candidate(){
  return createCandidate({baseSha:SHA,observedMainSha:SHA,target:target()});
}

function repairResult(status='validated'){
  return {
    version:1,
    status,
    blocked_reason:status==='blocked'?'REPAIR_LOOP_STUCK':null,
    attempts:[
      {
        attempt:1,
        proposal_digest:'a'.repeat(64),
        failure_signature:'b'.repeat(64),
        changed_files:['lib/a.js'],
        impact:{
          impacted_surfaces:['evolution-learning'],
          protected_surfaces:['evolution-governance']
        },
        validation:{
          passed:false,
          checks:[{id:'unit:a',status:'failed',code:'ASSERTION_FAILED'}]
        }
      },
      {
        attempt:2,
        proposal_digest:'c'.repeat(64),
        changed_files:['lib/a.js'],
        impact:{
          impacted_surfaces:['evolution-learning'],
          protected_surfaces:['evolution-governance']
        },
        validation:{
          passed:status==='validated',
          checks:[{
            id:'unit:a',
            status:status==='validated'?'passed':'failed',
            code:status==='validated'?'OK':'ASSERTION_FAILED'
          }]
        }
      }
    ]
  };
}

function workspace(c){
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-engmem-'));
  const root=path.join(parent,c.candidate_id);
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(root,'lib'));
  fs.writeFileSync(path.join(root,'lib','a.js'),'const value=1;\n');
  return root;
}

function proposal(c,fromValue,toValue){
  return {
    provider:'BondsNativeProvider',
    candidate_id:c.candidate_id,
    proposal:{
      summary:'repair value',
      patches:[{
        path:'lib/a.js',
        operation:'modify',
        unified_diff:[
          '--- a/lib/a.js',
          '+++ b/lib/a.js',
          '@@ -1,1 +1,1 @@',
          '-const value='+fromValue+';',
          '+const value='+toValue+';'
        ].join('\n')
      }],
      tests:[],
      assumptions:[],
      risk_notes:[]
    },
    policy:{proposal_only:true,patch_applied:false}
  };
}

describe('Phase 3 Engineering Memory',()=>{
  test('stores only structured engineering metadata, never raw source or diffs',()=>{
    const c=candidate();
    const record=buildEngineeringMemoryRecord({candidate:c,repairResult:repairResult()});
    const encoded=JSON.stringify(record);
    expect(record.policy).toEqual(expect.objectContaining({
      advisory_only:true,
      raw_source_stored:false,
      raw_diff_stored:false,
      secrets_stored:false,
      shell_commands_stored:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }));
    expect(encoded).not.toContain('unified_diff');
    expect(encoded).not.toContain('const value=');
    expect(record.proposal_digests).toContain('a'.repeat(64));
    expect(record.failure_signatures).toContain('b'.repeat(64));
  });

  test('deduplicates identical engineering memories by deterministic memory id',()=>{
    const c=candidate();
    const store=new EngineeringMemoryStore();
    const a=buildEngineeringMemoryRecord({candidate:c,repairResult:repairResult()});
    const b=buildEngineeringMemoryRecord({candidate:c,repairResult:repairResult()});
    expect(a.memory_id).toBe(b.memory_id);
    store.put(a);
    store.put(b);
    expect(store.size()).toBe(1);
  });

  test('queries relevant memories deterministically',()=>{
    const c=candidate();
    const store=new EngineeringMemoryStore();
    const record=buildEngineeringMemoryRecord({candidate:c,repairResult:repairResult()});
    store.put(record);
    const found=store.query({
      problem_class:'execution_defect',
      target_component:'capability_execution',
      failure_signature:'b'.repeat(64),
      impacted_surfaces:['evolution-learning']
    });
    expect(found).toHaveLength(1);
    expect(found[0].memory_id).toBe(record.memory_id);
  });

  test('builds advisory-only context that cannot authorize execution',()=>{
    const c=candidate();
    const record=buildEngineeringMemoryRecord({candidate:c,repairResult:repairResult()});
    const context=buildEngineeringMemoryContext([record]);
    expect(validateEngineeringMemoryContext(context)).toEqual(context);
    expect(context.policy).toEqual({
      execute_from_memory:false,
      trust_as_verified_code:false,
      bypass_validation:false,
      execution_authorized:false
    });
  });

  test('rejects an engineering context that tries to bypass validation',()=>{
    const c=candidate();
    const record=buildEngineeringMemoryRecord({candidate:c,repairResult:repairResult()});
    const context=buildEngineeringMemoryContext([record]);
    context.policy.bypass_validation=true;
    expect(()=>validateEngineeringMemoryContext(context))
      .toThrow('ENGINEERING_MEMORY_CONTEXT_POLICY_INVALID');
  });

  test('repair loop persists validated outcome and reuses prior memory only as advisory context',async()=>{
    const c=candidate();
    const root=workspace(c);
    const memory=new EngineeringMemoryStore();

    const previous=buildEngineeringMemoryRecord({
      candidate:c,
      repairResult:repairResult()
    });
    memory.put(previous);

    const validationRunner=jest.fn()
      .mockResolvedValueOnce({
        passed:false,
        checks:[{id:'unit:a',status:'failed',code:'ASSERTION_FAILED'}]
      })
      .mockResolvedValueOnce({
        passed:true,
        checks:[{id:'unit:a',status:'passed',code:'OK'}]
      });

    const codeProvider={
      propose:jest.fn().mockImplementation(async({
        candidate:repairCandidate,
        engineeringMemoryContext
      })=>{
        expect(engineeringMemoryContext.advisory_only).toBe(true);
        expect(engineeringMemoryContext.policy.execution_authorized).toBe(false);
        expect(engineeringMemoryContext.records.length).toBeGreaterThan(0);
        return proposal(repairCandidate,2,3);
      })
    };

    const result=await runRepairLoop({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:root,
      initialCodeProviderResult:proposal(c,1,2),
      codeProvider,
      validationRunner,
      engineeringMemory:memory
    });

    expect(result.status).toBe('validated');
    expect(result.engineering_memory_id).toMatch(/^engmem-/);
    expect(codeProvider.propose).toHaveBeenCalledTimes(1);
    expect(memory.size()).toBeGreaterThanOrEqual(1);
  });
});
