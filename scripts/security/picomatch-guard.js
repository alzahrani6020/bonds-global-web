'use strict';

// Local fail-closed mitigation for GHSA-fc5q-39xc-vjpf. Bound to reviewed
// upstream source hashes; unknown package revisions require a new review.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '../..');
const TARGETS = [
  {path:'node_modules/picomatch', version:'4.0.7', sha:'4e1e05447668aa1e94366c5516a2bcd8f5fff800cc92b1d0cd7d77703b8618c4'},
  {path:'node_modules/anymatch/node_modules/picomatch', version:'2.3.2', sha:'3a91656f440069aa8f8e15c9d695b9f6b2209df1eab2be8127c72cbcca45ff5f'},
  {path:'node_modules/micromatch/node_modules/picomatch', version:'2.3.2', sha:'3a91656f440069aa8f8e15c9d695b9f6b2209df1eab2be8127c72cbcca45ff5f'}
];

const {assertSafeRepeatedExtglob}=require('./picomatch-extglob-guard');

const guardSource=fs.readFileSync(path.join(__dirname,'picomatch-extglob-guard.js'),'utf8').replace(/\r\n/g,'\n').split('\nmodule.exports=')[0].trim();
const GUARD = '\n// BONDS reviewed repeated-extglob guard\n' + guardSource + '\n';
const ANCHORS = ['const parse = (input, options) => {','parse.fastpaths = (input, options) => {'];
const CALL = '\n  assertSafeRepeatedExtglob(input);';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

function canonicalPatched(source) {
  let patched=source.replace("'use strict';", "'use strict';"+GUARD);
  for(const anchor of ANCHORS) {
    if(!patched.includes(anchor)) throw new Error('PICOMATCH_PATCH_ANCHOR_MISSING');
    patched=patched.replace(anchor,anchor+CALL);
  }
  return patched;
}

function applyOrVerify({root=ROOT, verify=false, requireInstalled=false}={}) {
  const results=[];
  for(const target of TARGETS) {
    const dir=path.join(root,target.path);
    if(!fs.existsSync(dir)) {
      if(requireInstalled) throw new Error('PICOMATCH_GUARD_PACKAGE_MISSING:'+target.path);
      continue; // npm --omit=dev has no affected packages.
    }
    const version=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8')).version;
    if(version!==target.version) throw new Error('PICOMATCH_GUARD_VERSION_CHANGED:'+target.path);
    const file=path.join(dir,'lib/parse.js');
    const current=fs.readFileSync(file,'utf8');
    let original=current.replace(GUARD,'');
    for(const anchor of ANCHORS) original=original.replace(anchor+CALL,anchor);
    if(hash(original)!==target.sha) throw new Error('PICOMATCH_GUARD_SOURCE_CHANGED:'+target.path);
    const expected=canonicalPatched(original);
    if(verify && current!==expected) throw new Error('PICOMATCH_GUARD_NOT_APPLIED:'+target.path);
    if(!verify && current!==expected) fs.writeFileSync(file,expected);
    results.push({path:target.path,version,sha256:hash(expected)});
  }
  return results;
}

if(require.main===module) {
  const results=applyOrVerify({verify:process.argv.includes('--verify'),requireInstalled:process.argv.includes('--require-installed')});
  console.log('PICOMATCH_LOCAL_GUARD '+JSON.stringify(results));
}
function isLocallyMitigated(advisory, verified) {
  return advisory.id==='GHSA-FC5Q-39XC-VJPF' && advisory.package==='picomatch' && advisory.scope==='dev' &&
    verified.some(row=>row.path===advisory.dependencyPath && row.version===advisory.resolvedVersion);
}
module.exports={TARGETS,assertSafeRepeatedExtglob,canonicalPatched,applyOrVerify,isLocallyMitigated};
