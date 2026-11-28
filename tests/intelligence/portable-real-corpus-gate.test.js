'use strict';
const path=require('node:path');
const {spawnSync}=require('node:child_process');
test('real-file acceptance fails closed rather than passing with no customer corpus',()=>{
 const env={...process.env};
 delete env.BONDS_PORTABLE_CORPUS_DIR;
 const processResult=spawnSync(process.execPath,[path.join(__dirname,'../../scripts/accept-portable-commercial-real-corpus.js')],{env,encoding:'utf8',timeout:12000});
 expect(processResult.status).toBe(1);
 expect(processResult.stderr).toContain('REAL_CORPUS_NOT_PROVIDED');
 expect(processResult.stdout).not.toContain('"status":"PASS"');
});
