'use strict';

const fs=require('fs');
const os=require('os');
const path=require('path');

const { createCandidate }=require('../../lib/evolution/candidate-manager');
const {
  applyUnifiedDiff,
  applyPatchProposal
}=require('../../lib/evolution/patch-engine');

const SHA='9fcfa4fc71b1b673509ce82fdb5061ca90d27f2b';

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
  const parent=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-patch-'));
  const root=path.join(parent,c.candidate_id);
  fs.mkdirSync(root);
  return {parent,root};
}

function result(c,patches){
  return {
    provider:'BondsNativeProvider',
    candidate_id:c.candidate_id,
    proposal:{
      summary:'test proposal',
      patches,
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

describe('Phase 3 deterministic Patch Engine',()=>{
  test('applies deterministic unified diff in memory',()=>{
    const diff=[
      '--- a/lib/a.js',
      '+++ b/lib/a.js',
      '@@ -1,1 +1,1 @@',
      '-const value=1;',
      '+const value=2;'
    ].join('\n');
    expect(applyUnifiedDiff('const value=1;\n',diff)).toBe('const value=2;\n');
  });

  test('modifies a file only inside the isolated candidate workspace',()=>{
    const c=candidate();
    const w=workspace(c);
    fs.mkdirSync(path.join(w.root,'lib'));
    fs.writeFileSync(path.join(w.root,'lib','a.js'),'const value=1;\n');

    const receipt=applyPatchProposal({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:w.root,
      codeProviderResult:result(c,[{
        path:'lib/a.js',
        operation:'modify',
        unified_diff:[
          '--- a/lib/a.js',
          '+++ b/lib/a.js',
          '@@ -1,1 +1,1 @@',
          '-const value=1;',
          '+const value=2;'
        ].join('\n')
      }])
    });

    expect(fs.readFileSync(path.join(w.root,'lib','a.js'),'utf8')).toBe('const value=2;\n');
    expect(receipt.changed_files).toEqual(['lib/a.js']);
    expect(receipt.policy).toEqual(expect.objectContaining({
      isolated_workspace_only:true,
      main_write:false,
      production_write:false,
      shell_execution:false,
      free_text_execution:false,
      auto_merge:false,
      auto_deploy:false
    }));
  });

  test('supports create and delete without shell execution',()=>{
    const c=candidate();
    const w=workspace(c);
    fs.mkdirSync(path.join(w.root,'lib'));
    fs.writeFileSync(path.join(w.root,'lib','old.js'),'old\n');

    applyPatchProposal({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:w.root,
      codeProviderResult:result(c,[
        {
          path:'lib/new.js',
          operation:'create',
          unified_diff:[
            '--- /dev/null',
            '+++ b/lib/new.js',
            '@@ -0,0 +1,1 @@',
            '+new'
          ].join('\n')
        },
        {
          path:'lib/old.js',
          operation:'delete',
          unified_diff:''
        }
      ])
    });

    expect(fs.readFileSync(path.join(w.root,'lib','new.js'),'utf8')).toBe('new\n');
    expect(fs.existsSync(path.join(w.root,'lib','old.js'))).toBe(false);
  });

  test('rejects stale candidates before workspace mutation',()=>{
    const c=candidate();
    const w=workspace(c);
    fs.mkdirSync(path.join(w.root,'lib'));
    fs.writeFileSync(path.join(w.root,'lib','a.js'),'before\n');

    expect(()=>applyPatchProposal({
      candidate:c,
      currentMainSha:'b'.repeat(40),
      workspaceRoot:w.root,
      codeProviderResult:result(c,[{
        path:'lib/a.js',
        operation:'modify',
        unified_diff:[
          '--- a/lib/a.js',
          '+++ b/lib/a.js',
          '@@ -1,1 +1,1 @@',
          '-before',
          '+after'
        ].join('\n')
      }])
    })).toThrow('PATCH_ENGINE_CANDIDATE_STALE');

    expect(fs.readFileSync(path.join(w.root,'lib','a.js'),'utf8')).toBe('before\n');
  });

  test('preflights the full patch set before mutating any file',()=>{
    const c=candidate();
    const w=workspace(c);
    fs.mkdirSync(path.join(w.root,'lib'));
    fs.writeFileSync(path.join(w.root,'lib','a.js'),'one\n');
    fs.writeFileSync(path.join(w.root,'lib','b.js'),'two\n');

    expect(()=>applyPatchProposal({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:w.root,
      codeProviderResult:result(c,[
        {
          path:'lib/a.js',
          operation:'modify',
          unified_diff:[
            '--- a/lib/a.js',
            '+++ b/lib/a.js',
            '@@ -1,1 +1,1 @@',
            '-one',
            '+changed'
          ].join('\n')
        },
        {
          path:'lib/b.js',
          operation:'modify',
          unified_diff:[
            '--- a/lib/b.js',
            '+++ b/lib/b.js',
            '@@ -1,1 +1,1 @@',
            '-WRONG',
            '+changed'
          ].join('\n')
        }
      ])
    })).toThrow('PATCH_ENGINE_REMOVE_MISMATCH');

    expect(fs.readFileSync(path.join(w.root,'lib','a.js'),'utf8')).toBe('one\n');
    expect(fs.readFileSync(path.join(w.root,'lib','b.js'),'utf8')).toBe('two\n');
  });

  test('rejects symlink targets and repository metadata paths',()=>{
    const c=candidate();
    const w=workspace(c);
    fs.mkdirSync(path.join(w.root,'lib'));
    const outside=path.join(w.parent,'outside.txt');
    fs.writeFileSync(outside,'outside\n');

    let symlinkCreated=true;
    try{
      fs.symlinkSync(outside,path.join(w.root,'lib','link.txt'));
    }catch(_err){
      symlinkCreated=false;
    }

    if(symlinkCreated){
      expect(()=>applyPatchProposal({
        candidate:c,
        currentMainSha:SHA,
        workspaceRoot:w.root,
        codeProviderResult:result(c,[{
          path:'lib/link.txt',
          operation:'delete',
          unified_diff:''
        }])
      })).toThrow('PATCH_ENGINE_SYMLINK_FORBIDDEN');
      expect(fs.readFileSync(outside,'utf8')).toBe('outside\n');
    }

    expect(()=>applyPatchProposal({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:w.root,
      codeProviderResult:result(c,[{
        path:'.git/config',
        operation:'create',
        unified_diff:[
          '--- /dev/null',
          '+++ b/.git/config',
          '@@ -0,0 +1,1 @@',
          '+unsafe'
        ].join('\n')
      }])
    })).toThrow('CODE_PROVIDER_PATCH_PATH_FORBIDDEN');
  });

  test('requires workspace root to belong to the candidate id',()=>{
    const c=candidate();
    const other=fs.mkdtempSync(path.join(os.tmpdir(),'wrong-workspace-'));
    expect(()=>applyPatchProposal({
      candidate:c,
      currentMainSha:SHA,
      workspaceRoot:other,
      codeProviderResult:result(c,[{
        path:'a.js',
        operation:'create',
        unified_diff:[
          '--- /dev/null',
          '+++ b/a.js',
          '@@ -0,0 +1,1 @@',
          '+x'
        ].join('\n')
      }])
    })).toThrow('PATCH_ENGINE_WORKSPACE_CANDIDATE_MISMATCH');
  });
});
