'use strict';
// Local-only OCR adapter for installed Tesseract CLI. No cloud fallback.
const {spawn}=require('node:child_process');
const MAX_OUTPUT=200000;
function createLocalOcr({executable='tesseract',language='ara+eng',timeoutMs=30000,spawnProcess=spawn}={}){
 if(typeof executable!=='string'||!executable.trim()||/[\r\n\0]/.test(executable))throw Error('INVALID_OCR_EXECUTABLE');
 if(typeof language!=='string'||!/^[a-z]{3}(?:\+[a-z]{3})*$/.test(language))throw Error('INVALID_OCR_LANGUAGE');
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1000||timeoutMs>120000)throw Error('INVALID_OCR_TIMEOUT');
 return function ocr(buffer){
  if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>5*1024*1024)return Promise.reject(Error('INVALID_OCR_INPUT'));
  return new Promise((resolve,reject)=>{
   let settled=false,total=0,out='',err='';
   let child;
   const fail=e=>{if(settled)return;settled=true;clearTimeout(timer);try{child?.kill('SIGKILL')}catch{}reject(e)};
   const done=text=>{if(settled)return;settled=true;clearTimeout(timer);resolve(text)};
   const timer=setTimeout(()=>fail(Error('OCR_TIMEOUT')),timeoutMs);
   try{child=spawnProcess(executable,['stdin','stdout','-l',language],{shell:false,windowsHide:true,stdio:['pipe','pipe','pipe'],env:{...process.env,OMP_THREAD_LIMIT:'1'}})}
   catch(e){return fail(Error('OCR_START_FAILED'))}
   child.once('error',()=>fail(Error('OCR_START_FAILED')));
   child.stdout.on('data',chunk=>{total+=chunk.length;if(total>MAX_OUTPUT)return fail(Error('OCR_OUTPUT_LIMIT'));out+=chunk.toString('utf8')});
   child.stderr.on('data',chunk=>{if(err.length<4096)err+=chunk.toString('utf8').slice(0,4096-err.length)});
   child.once('close',code=>{if(code!==0)return fail(Error('OCR_PROCESS_FAILED'));done(out)});
   child.stdin.on('error',()=>fail(Error('OCR_PROCESS_FAILED')));
   child.stdin.end(buffer);
  });
 };
}
module.exports={createLocalOcr};
