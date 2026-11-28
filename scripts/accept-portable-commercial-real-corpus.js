'use strict';
// Strict, opt-in acceptance gate for a customer-supplied, consented real corpus.
// Never prints raw entity names, contact fields, document contents, or secrets.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {analyzeFile}=require('../lib/portable-intelligence/file-adapters');
const {createLocalOcr}=require('../lib/portable-intelligence/local-ocr');

const REQUIRED=['pdf_text','pdf_scanned','xlsx','docx','business_card_image','html_directory'];
const EXTENSIONS={
 pdf_text:['.pdf'],pdf_scanned:['.pdf'],xlsx:['.xlsx','.xls'],
 docx:['.docx'],business_card_image:['.png','.jpg','.jpeg','.webp'],html_directory:['.html','.htm']
};
const WID='12345678-1234-4123-8123-1234567890ab';
function fail(code){throw Error(code)}
function resolveCorpusFile(root,name){
 if(typeof name!=='string'||name.length<1||name.length>180||name==='.'||name==='..'||/[\/\\]/.test(name))fail('INVALID_CORPUS_FILENAME');
 const full=path.resolve(root,name);
 if(path.dirname(full)!==path.resolve(root))fail('CORPUS_PATH_ESCAPE');
 const realRoot=fs.realpathSync(root),realFile=fs.realpathSync(full);
 if(path.dirname(realFile)!==realRoot)fail('CORPUS_SYMLINK_ESCAPE');
 return realFile;
}
async function main(){
 const rootArg=process.env.BONDS_PORTABLE_CORPUS_DIR;
 if(!rootArg)fail('REAL_CORPUS_NOT_PROVIDED');
 const root=path.resolve(rootArg);
 const manifestFile=resolveCorpusFile(root,'manifest.json');
 const manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));
 if(!manifest||!Array.isArray(manifest.cases)||manifest.cases.length<REQUIRED.length||manifest.cases.length>30)fail('INVALID_CORPUS_MANIFEST');
 const seen=new Set(),evidence=[];
 for(const entry of manifest.cases){
  if(!entry||!REQUIRED.includes(entry.kind)||seen.has(entry.kind))fail('INVALID_OR_DUPLICATE_CORPUS_KIND');
  seen.add(entry.kind);
  const full=resolveCorpusFile(root,entry.file);
  if(!EXTENSIONS[entry.kind].includes(path.extname(full).toLowerCase()))fail('CORPUS_EXTENSION_MISMATCH');
  if(typeof entry.sha256!=='string'||!/^[0-9a-f]{64}$/i.test(entry.sha256))fail('CORPUS_HASH_REQUIRED');
  if(!Array.isArray(entry.expected_entities)||!entry.expected_entities.length||entry.expected_entities.some(x=>!x||!['organization','contact'].includes(x.type)||typeof x.name!=='string'||!x.name.trim()))fail('CORPUS_GROUND_TRUTH_REQUIRED');
  const data=fs.readFileSync(full);
  const hash=crypto.createHash('sha256').update(data).digest('hex');
  if(hash!==entry.sha256.toLowerCase())fail('CORPUS_HASH_MISMATCH');
  const ocr=entry.kind==='pdf_scanned'||entry.kind==='business_card_image'?createLocalOcr():null;
  const result=await analyzeFile({file:{filename:entry.file,buffer:data},workspaceId:WID,ocr});
  if(result.auto_saved!==false||result.requires_manual_approval!==true)fail('UNREVIEWED_AUTO_SAVE');
  if(entry.kind==='pdf_scanned'&&result.source?.extraction?.mode!=='local-ocr')fail('SCANNED_PDF_NOT_OCR_VERIFIED');
  const entities=[
   ...(result.items||[]).map(x=>x.record),
   ...(result.entity_suggestions?.items||[])
  ].filter(x=>x&&typeof x.name==='string'&&['organization','contact'].includes(x.type));
  const missing=entry.expected_entities.filter(e=>!entities.some(x=>x.type===e.type&&x.name.trim()===e.name.trim()));
  if(missing.length)fail('CORPUS_ENTITY_RECALL_FAILED');
  evidence.push({kind:entry.kind,sha256:hash,recognized_entities:entities.length,expected_entities:entry.expected_entities.length,review_only:true,ocr_mode:result.source?.extraction?.mode||null});
 }
 if(REQUIRED.some(k=>!seen.has(k)))fail('CORPUS_FORMAT_COVERAGE_INCOMPLETE');
 process.stdout.write(JSON.stringify({status:'PASS',scope:'real-file extraction and pending-review only',cases:evidence,limits:['manual correction and database readback not tested here','no SaaS destination readback','no installer signature verification']})+'\n');
}
main().catch(err=>{process.stderr.write('STATUS: FAIL; CODE: '+String(err?.message||'CORPUS_GATE_FAILED').replace(/[^A-Z0-9_]/g,'').slice(0,70)+'\n');process.exitCode=1});
