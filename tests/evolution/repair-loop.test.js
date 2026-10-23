'use strict';

const fs=require('fs');
const os=require('os');
const path=require('path');

const { createCandidate }=require('../../lib/evolution/candidate-manager');
const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const {
  normalizeValidationResult,
  deterministicFailureSignature,
  StuckLoopDetector,
  runRepairLoop
}=require('../../lib/evolution/repair-loop');

const SHA='3272dee7364f9cb4ba08feedd0aade8bcf340ac4';

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
  return createCandidate({
    baseSha:SHA,
    observedMainSha:SHA,
    target:target()
  });
}

function workspace(c){
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-repair-'));
  const root=path.join(parent,c.candidate_id);
  fs.mkdirSync(root);
  fs.mkdirSync(path.join(root,'lib'));
  fs.writeFileSync(path.join(root,'lib','a.js'),'const value=1;\n');
  return {parent,root};
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
    policy:{
      proposal_only:true,
      patch_applied:false
    }
  };
}

function pass(){
  return {
    passed:true,
    checks:[{id:'unit:repair',status:'passed',code:'OK'}]
  };
}

function fail(code='ASSERTION_FAILED'){
  return {
    passed:false,
    checks:[
      {id:'unit:repair',status:'failed',code},
      {id:'security:guard',status:'passed',code:'OK'}
    ]
  };
}

describe('Phase 3 autonomous Repair Loop',()=>{
  test('accepts only structured deterministic validation results',()=>{
    expect(normalizeValidationResult(pass())).toEqual(pass());
    expect(()=>normalizeValidationResult({
      passed:false,
      checks:[{id:'x',status:'failed',code:'FAIL'}],
      shell_output:'npm test'
    })).toThrow('REPAIR_LOOP_VALIDATION_FIELD_FORBIDDEN');
    expect(()=>normalizeValidationResult({
      passed:true,
      checks:[{id:'x',status:'failed',code:'FAIL'}]
    })).toThrow('REPAIR_LOOP_VALIDATION_CONTRADICTION');
  });

  test('creates stable failure signatures independent of check order',()=>{
    const a={
      passed:false,
      checks:[
        {id:'b',status:'failed',code:'B'},
        {id:'a',status:'failed',code:'A'}
      ]
    };
    const b={
      passed:false,
      checks:[
        {id:'a',status:'failed',code:'A'},
        {id:'b',status:'failed',code:'B'}
      ]
    };
    expect(deterministicFailureSignature(a)).toBe(deterministicFailureSignature(b));
  });

  test('detects repeated identical failure/proposal pairs as stuck',()=>{
    const detector=new StuckLoopDetector({threshold:3});
    expect(detector.observe({failureSignature:'a'.repeat(64),proposalHash:'b'.repeat(64)}).stuck).toBe(false);
    expect(detector.observe({failureSignature:'a'.repeat(64),proposalHash:'b'.repeat(64)}).stuck).toBe(true);
  });

  test('returns validated after the initial patch passes deterministic validation',async()=>{
    const c=candidate();
    const w=workspace(c);
    const codeProvider={propose:jest.fn()};

    const result=await runRepairLoop({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:w.root,
      initialCodeProviderResult:proposal(c,1,2),
      codeProvider,
      validationRunner:jest.fn().mockResolvedValue(pass())
    });

    expect(fs.readFileSync(path.join(w.root,'lib','a.js'),'utf8')).toBe('const value=2;\n');
    expect(result.status).toBe('validated');
    expect(result.candidate.state).toBe(STATES.VALIDATING);
    expect(result.attempts).toHaveLength(1);
    expect(codeProvider.propose).not.toHaveBeenCalled();
    expect(result.policy).toEqual(expect.objectContaining({
      shell_execution:false,
      free_text_execution:false,
      direct_main_write:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('repairs after failure using CodeProvider and Patch Engine only',async()=>{
    const c=candidate();
    const w=workspace(c);
    const validationRunner=jest.fn()
      .mockResolvedValueOnce(fail('VALUE_STILL_WRONG'))
      .mockResolvedValueOnce(pass());
    const codeProvider={
      propose:jest.fn().mockImplementation(async({candidate:repairCandidate,currentMainSha,sourceFiles})=>{
        expect(repairCandidate.state).toBe(STATES.REPAIRING);
        expect(currentMainSha).toBe(SHA);
        expect(sourceFiles).toEqual([]);
        return proposal(repairCandidate,2,3);
      })
    };

    const result=await runRepairLoop({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:w.root,
      initialCodeProviderResult:proposal(c,1,2),
      codeProvider,
      validationRunner
    });

    expect(result.status).toBe('validated');
    expect(result.attempts).toHaveLength(2);
    expect(codeProvider.propose).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(path.join(w.root,'lib','a.js'),'utf8')).toBe('const value=3;\n');
  });

  test('stops deterministically when the same failure and patch repeat',async()=>{
    const c=candidate();
    const w=workspace(c);
    const validationRunner=jest.fn().mockResolvedValue(fail('SAME_FAILURE'));
    const codeProvider={
      propose:jest.fn().mockImplementation(async({candidate:repairCandidate})=>{
        const current=fs.readFileSync(path.join(w.root,'lib','a.js'),'utf8');
        if(current.includes('value=2'))return proposal(repairCandidate,2,3);
        return proposal(repairCandidate,3,2);
      })
    };

    const result=await runRepairLoop({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:w.root,
      initialCodeProviderResult:proposal(c,1,2),
      codeProvider,
      validationRunner,
      maxAttempts:6,
      stuckThreshold:3
    });

    expect(result.status).toBe('blocked');
    expect(result.blocked_reason).toBe('REPAIR_LOOP_STUCK');
    expect(result.candidate.state).toBe(STATES.BLOCKED);
    expect(result.attempts.length).toBeLessThanOrEqual(3);
    expect(result.policy.auto_merge).toBe(false);
    expect(result.policy.auto_deploy).toBe(false);
  });

  test('stops when bounded attempts are exhausted',async()=>{
    const c=candidate();
    const w=workspace(c);
    const validationRunner=jest.fn()
      .mockResolvedValueOnce(fail('FAIL_1'))
      .mockResolvedValueOnce(fail('FAIL_2'));
    const codeProvider={
      propose:jest.fn().mockImplementation(async({candidate:repairCandidate})=>proposal(repairCandidate,2,3))
    };

    const result=await runRepairLoop({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:w.root,
      initialCodeProviderResult:proposal(c,1,2),
      codeProvider,
      validationRunner,
      maxAttempts:2,
      stuckThreshold:5
    });

    expect(result.status).toBe('blocked');
    expect(result.blocked_reason).toBe('REPAIR_LOOP_ATTEMPTS_EXHAUSTED');
    expect(result.attempts).toHaveLength(2);
    expect(codeProvider.propose).toHaveBeenCalledTimes(1);
  });

  test('uses an optional structured source loader and never accepts a source command surface',async()=>{
    const c=candidate();
    const w=workspace(c);
    const validationRunner=jest.fn()
      .mockResolvedValueOnce(fail('NEEDS_CONTEXT'))
      .mockResolvedValueOnce(pass());
    const sourceLoader=jest.fn().mockResolvedValue([
      {path:'lib/a.js',content:'const value=2;\n'}
    ]);
    const codeProvider={
      propose:jest.fn().mockImplementation(async({candidate:repairCandidate,sourceFiles})=>{
        expect(sourceFiles).toEqual([{path:'lib/a.js',content:'const value=2;\n'}]);
        return proposal(repairCandidate,2,3);
      })
    };

    const result=await runRepairLoop({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:w.root,
      initialCodeProviderResult:proposal(c,1,2),
      codeProvider,
      validationRunner,
      sourceLoader
    });

    expect(result.status).toBe('validated');
    expect(sourceLoader).toHaveBeenCalledTimes(1);
    expect(codeProvider.propose).toHaveBeenCalledTimes(1);
  });
});
