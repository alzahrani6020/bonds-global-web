/** @jest-environment node */
const {spawnSync}=require('child_process');
const fs=require('fs');
const os=require('os');
const path=require('path');
const {TARGETS,assertSafeRepeatedExtglob,applyOrVerify,isLocallyMitigated}=require('../../scripts/security/picomatch-guard');
const crypto=require('crypto');

describe('local repeated-extglob mitigation',()=>{
  test('the audit mitigation cannot waive production scope, other advisories, versions or paths',()=>{
    const verified=applyOrVerify({verify:true,requireInstalled:true});
    const base={id:'GHSA-FC5Q-39XC-VJPF',package:'picomatch',scope:'dev',dependencyPath:TARGETS[0].path,resolvedVersion:TARGETS[0].version};
    expect(isLocallyMitigated(base,verified)).toBe(true);
    for(const delta of [{scope:'prod'},{id:'OTHER-HIGH'},{package:'other'},{resolvedVersion:'4.0.8'},{dependencyPath:'node_modules/other'}]){
      expect(isLocallyMitigated({...base,...delta},verified)).toBe(false);
    }
    expect(isLocallyMitigated(base,[])).toBe(false);
  });
  test.each(['+(*)','+(*a)','*(*a)','+(+(a))','@(+(*a))','+([*a)'])('rejects dangerous compilation: %s', pattern=>{
    expect(()=>assertSafeRepeatedExtglob(pattern)).toThrow('BONDS_UNSAFE_REPEATED_EXTGLOB');
  });
  test.each(['**/*.js','**/?(*.)+(spec|test).[jt]s?(x)','+(abc)','+(a|b)','+(\\*)','+([*])'])('preserves ordinary globs: %s',pattern=>{
    expect(()=>assertSafeRepeatedExtglob(pattern)).not.toThrow();
  });
  test('all installed parser and fastpath entry points reject exploit patterns within a child-process deadline',()=>{
    applyOrVerify({requireInstalled:true});
    for(const target of TARGETS){
      const pkg=path.resolve(target.path);
      const result=spawnSync(process.execPath,['-e',`
        const pm=require(${JSON.stringify(pkg)});
        const parse=require(${JSON.stringify(pkg+'/lib/parse.js')});
        for(const pattern of ['+(*)','+(*a)','*(*a)','+(+(a))']){
          for(const compile of [()=>pm.makeRe(pattern),()=>pm(pattern),()=>parse(pattern),()=>parse.fastpaths(pattern,{})]){
            try{ compile(); process.exit(2); }catch(e){ if(e.message!=='BONDS_UNSAFE_REPEATED_EXTGLOB') process.exit(3); }
          }
        }
        if(!pm('**/*.js')('lib/file.js')) process.exit(4);
        if(!pm('**/?(*.)+(spec|test).[jt]s?(x)')('tests/example.test.js')) process.exit(5);
      `],{timeout:2000,encoding:'utf8'});
      expect({status:result.status,error:result.error?.code,stderr:result.stderr}).toEqual({status:0,error:undefined,stderr:''});
    }
    expect(applyOrVerify({verify:true,requireInstalled:true})).toHaveLength(3);
  });
  test('unknown or tampered revisions cannot be treated as patched',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-guard-'));
    try{
      const dir=path.join(root,TARGETS[0].path); fs.mkdirSync(path.join(dir,'lib'),{recursive:true});
      fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({version:'4.0.7'}));
      fs.writeFileSync(path.join(dir,'lib/parse.js'),'unexpected code');
      expect(()=>applyOrVerify({root,verify:true})).toThrow('PICOMATCH_GUARD_SOURCE_CHANGED');
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
  test('reproduces the upstream denial of service only in a time-bounded isolated copy',()=>{
    const root=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-picomatch-poc-'));
    try{
      fs.cpSync(path.resolve(TARGETS[0].path),root,{recursive:true});
      const file=path.join(root,'lib/parse.js');
      const guard=fs.readFileSync('scripts/security/picomatch-extglob-guard.js','utf8').replace(/\r\n/g,'\n').split('\nmodule.exports=')[0].trim();
      let original=fs.readFileSync(file,'utf8').replace('\n// BONDS reviewed repeated-extglob guard\n'+guard+'\n','');
      for(const a of ['const parse = (input, options) => {','parse.fastpaths = (input, options) => {']) original=original.replace(a+'\n  assertSafeRepeatedExtglob(input);',a);
      expect(crypto.createHash('sha256').update(original).digest('hex')).toBe(TARGETS[0].sha);
      fs.writeFileSync(file,original);
      const result=spawnSync(process.execPath,['-e',`const re=require(${JSON.stringify(root)}).makeRe('+(*a)'); process.stdout.write('compiled\\n'); re.test('a'.repeat(48)+'!');`],{timeout:500,encoding:'utf8'});
      expect(result.stdout).toContain('compiled');
      expect(result.error?.code).toBe('ETIMEDOUT');
    }finally{fs.rmSync(root,{recursive:true,force:true});}
  });
});
