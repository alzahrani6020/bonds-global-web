'use strict';

const { createCandidate }=require('../../lib/evolution/candidate-manager');
const { STATES }=require('../../lib/dual-core/evolution-state-machine');
const {
  normalizeSourceFiles,
  validatePatchProposal,
  BondsNativeCodeProvider
}=require('../../lib/evolution/code-provider');

const SHA='8ddb8adbe4e225aa29bfb4d998244846a066ae40';

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
    target:target(),
    proposedChangedFiles:['lib/capabilities/runtime-adapters.js']
  });
}

function nativeResponse(payload){
  return {
    ok:true,
    provider:'BondsNativeProvider',
    external_llm_provider:false,
    mode:'LOCAL_NATIVE',
    result:{text:JSON.stringify(payload)},
    meta:{native_node:null}
  };
}

describe('Phase 3 BondsNative CodeProvider',()=>{
  test('produces a structured proposal without applying or executing it',async()=>{
    const generate=jest.fn().mockResolvedValue(nativeResponse({
      summary:'Repair capability adapter',
      patches:[{
        path:'lib/capabilities/runtime-adapters.js',
        operation:'modify',
        unified_diff:'--- a/lib/capabilities/runtime-adapters.js\n+++ b/lib/capabilities/runtime-adapters.js\n@@\n-old\n+new'
      }],
      tests:['tests/capabilities/capability-governance.test.js'],
      assumptions:[],
      risk_notes:[]
    }));
    const provider=new BondsNativeCodeProvider({router:{generate}});
    const result=await provider.propose({
      candidate:candidate(),
      currentMainSha:SHA,
      sourceFiles:[{path:'lib/capabilities/runtime-adapters.js',content:'module.exports={};'}]
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('BondsNativeProvider');
    expect(result.proposal.patches[0].path).toBe('lib/capabilities/runtime-adapters.js');
    expect(result.policy).toEqual(expect.objectContaining({
      proposal_only:true,
      patch_applied:false,
      shell_execution:false,
      free_text_execution:false,
      direct_file_write:false,
      execution_authorized:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('refuses a stale candidate before inference',async()=>{
    const generate=jest.fn();
    const provider=new BondsNativeCodeProvider({router:{generate}});
    await expect(provider.propose({
      candidate:candidate(),
      currentMainSha:'b'.repeat(40)
    })).rejects.toThrow('CODE_PROVIDER_CANDIDATE_STALE');
    expect(generate).not.toHaveBeenCalled();
  });

  test('refuses forbidden secret source paths',()=>{
    expect(()=>normalizeSourceFiles([
      {path:'.env.production',content:'SECRET=x'}
    ])).toThrow('CODE_PROVIDER_SOURCE_PATH_FORBIDDEN');
    expect(()=>normalizeSourceFiles([
      {path:'certs/private.key',content:'key'}
    ])).toThrow('CODE_PROVIDER_SOURCE_PATH_FORBIDDEN');
  });

  test('rejects operational command fields from model output',()=>{
    expect(()=>validatePatchProposal({
      summary:'x',
      patches:[{path:'lib/a.js',operation:'modify',unified_diff:'diff'}],
      tests:[],
      assumptions:[],
      risk_notes:[],
      shell_commands:['npm test']
    })).toThrow('CODE_PROVIDER_RESPONSE_FIELD_FORBIDDEN');
  });

  test('requires strict JSON from BondsNative',async()=>{
    const fence=String.fromCharCode(96).repeat(3);
    const provider=new BondsNativeCodeProvider({
      router:{generate:jest.fn().mockResolvedValue({
        ok:true,
        provider:'BondsNativeProvider',
        external_llm_provider:false,
        result:{text:fence+'json\n{"summary":"x"}\n'+fence}
      })}
    });
    await expect(provider.propose({
      candidate:candidate(),
      currentMainSha:SHA
    })).rejects.toThrow('CODE_PROVIDER_RESPONSE_NOT_STRICT_JSON');
  });

  test('recomputes protected impact from model-proposed paths',async()=>{
    const provider=new BondsNativeCodeProvider({
      router:{generate:jest.fn().mockResolvedValue(nativeResponse({
        summary:'Protected change proposal',
        patches:[{
          path:'services/bonds_token_runtime/bonds_security/server.py',
          operation:'modify',
          unified_diff:'--- a/server.py\n+++ b/server.py\n@@\n-a\n+b'
        }],
        tests:['tests/security/service-token-authorization.test.js'],
        assumptions:[],
        risk_notes:['Protected surface']
      }))}
    });
    const c=candidate();
    c.state=STATES.REPAIRING;
    const result=await provider.propose({candidate:c,currentMainSha:SHA});
    expect(result.impact.risk).toBe('protected');
    expect(result.impact.required_gates).toContain('token-runtime-windows-acceptance');
    expect(result.policy.deterministic_validation_required).toBe(true);
  });

  test('rejects external provider responses',async()=>{
    const provider=new BondsNativeCodeProvider({
      router:{generate:jest.fn().mockResolvedValue({
        ok:true,
        provider:'openai',
        external_llm_provider:true,
        result:{text:'{}'}
      })}
    });
    await expect(provider.propose({
      candidate:candidate(),
      currentMainSha:SHA
    })).rejects.toThrow('CODE_PROVIDER_EXTERNAL_PROVIDER_FORBIDDEN');
  });
});
