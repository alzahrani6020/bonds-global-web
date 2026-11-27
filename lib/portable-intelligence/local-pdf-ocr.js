'use strict';
// Bounded local PDF -> PNG -> OCR. No network, shell, production storage, or implicit save.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawn}=require('node:child_process');
const {createLocalOcr}=require('./local-ocr');
const MAX_PAGES=12;
function run(binary,args,{timeoutMs=45000,maxOutput=200000}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(binary,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let output='',errors='',total=0,finished=false;
  const stop=(err)=>{if(finished)return;finished=true;clearTimeout(timer);try{child.kill('SIGKILL')}catch{}reject(err)};
  const timer=setTimeout(()=>stop(Error('PDF_TOOL_TIMEOUT')),timeoutMs);
  child.once('error',()=>stop(Error('PDF_TOOL_NOT_FOUND')));
  child.stdout.on('data',chunk=>{total+=chunk.length;if(total>maxOutput)return stop(Error('PDF_TOOL_OUTPUT_LIMIT'));output+=chunk.toString('utf8')});
  child.stderr.on('data',chunk=>{if(errors.length<2048)errors+=chunk.toString('utf8').slice(0,2048-errors.length)});
  child.once('close',code=>{if(finished)return;finished=true;clearTimeout(timer);if(code!==0)return reject(Error('PDF_TOOL_FAILED'));resolve(output)});
 });
}
function pageCount(info){
 const m=info.match(/^Pages:\s*(\d+)/mi);
 if(!m)throw Error('PDF_PAGE_COUNT_UNKNOWN');
 const n=Number(m[1]);
 if(!Number.isSafeInteger(n)||n<1)throw Error('INVALID_PDF_PAGE_COUNT');
 if(n>MAX_PAGES)throw Error('PDF_OCR_PAGE_LIMIT');
 return n;
}
async function ocrScannedPdf(buffer,{ocr=createLocalOcr(),pdfinfo='pdfinfo',pdftoppm='pdftoppm'}={}){
 if(!Buffer.isBuffer(buffer)||!buffer.length||buffer.length>5*1024*1024)throw Error('INVALID_OCR_INPUT');
 if(typeof ocr!=='function')throw Error('OCR_ADAPTER_REQUIRED');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bonds-pdf-ocr-'));
 try{
  const input=path.join(dir,'input.pdf');
  fs.writeFileSync(input,buffer,{flag:'wx',mode:0o600});
  const info=await run(pdfinfo,[input]);
  const pages=pageCount(info);
  const text=[];
  for(let page=1;page<=pages;page++){
   const image=path.join(dir,'page.png');
   await run(pdftoppm,['-f',String(page),'-l',String(page),'-singlefile','-r','200','-png',input,path.join(dir,'page')],{timeoutMs:60000});
   const data=fs.readFileSync(image);
   if(data.length>5*1024*1024)throw Error('PDF_RENDER_TOO_LARGE');
   const result=await ocr(data,{page});
   if(typeof result!=='string')throw Error('INVALID_OCR_RESULT');
   text.push({page,text:result});
   fs.unlinkSync(image);
  }
  return {pages,processed_pages:pages,page_text:text,text:text.map(p=>p.text).join('\n'),review_required:true};
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
}
module.exports={ocrScannedPdf,pageCount,MAX_PAGES};
