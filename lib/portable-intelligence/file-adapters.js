'use strict';
const core=require('./core');
const {analyzeEntities}=require('./entity-intelligence');
const MAX_BYTES=5*1024*1024;
function validateFile(file){if(!file||!Buffer.isBuffer(file.buffer)||file.buffer.length===0||file.buffer.length>MAX_BYTES)throw Error('INVALID_FILE_SIZE');if(!file.filename||/[\\\/]/.test(file.filename))throw Error('INVALID_FILENAME');return file.filename.toLowerCase();}
async function analyzeFile({file,workspaceId,defaultType=null,ocr=null}={}){
 const filename=validateFile(file),buffer=file.buffer;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId||''))throw Error('WORKSPACE_ID_REQUIRED');
 if(/\.(xlsx|xls)$/.test(filename)){
  const XLSX=require('xlsx');
  const book=XLSX.read(buffer,{type:'buffer',cellDates:false,cellFormula:false,cellHTML:false});
  const rows=[];if(book.SheetNames.length>20)throw Error('TOO_MANY_SHEETS');for(const sheet of book.SheetNames){const matrix=XLSX.utils.sheet_to_json(book.Sheets[sheet],{header:1,raw:false,defval:''});rows.push(...core.rowsFromMatrix(matrix).map(row=>({...row,_sheet:sheet})));if(rows.length>1000)throw Error('TOO_MANY_ROWS');}
  return core.normalizeRows({rows,source:{filename:file.filename,kind:'spreadsheet'},workspaceId,defaultType});
 }
 if(/\.csv$/.test(filename)){
  // Use SheetJS parser for quoted CSV and UTF-8 BOM; no split(',') corruption.
  const XLSX=require('xlsx');const book=XLSX.read(buffer,{type:'buffer',raw:true});const first=book.Sheets[book.SheetNames[0]];
  return core.normalizeRows({rows:core.rowsFromMatrix(XLSX.utils.sheet_to_json(first,{header:1,raw:false,defval:''})),source:{filename:file.filename,kind:'csv'},workspaceId,defaultType});
 }
 if(/\.html?$/.test(filename)){
  const reviewed=require('./html-table-review').htmlTables(buffer.toString('utf8'));
  return {schema_version:1,workspace_id:workspaceId.toLowerCase(),source:{filename:file.filename,kind:'html'},...reviewed,entity_suggestions:analyzeEntities(require('./entity-intelligence').htmlToEvidenceText(buffer.toString('utf8')).slice(0,60000),{filename:file.filename,kind:'html'}),requires_manual_approval:true,auto_saved:false,items:[]};
 }
 if(/\.docx$/.test(filename)){
  const result=await require('mammoth').extractRawText({buffer});
  return {schema_version:1,workspace_id:workspaceId.toLowerCase(),source:{filename:file.filename,kind:'docx'},proposal:core.proposeFromText(result.value,{kind:'docx'}),entity_suggestions:analyzeEntities(result.value,{filename:file.filename,kind:'docx'}),requires_manual_approval:true,auto_saved:false};
 }
 if(/\.pdf$/.test(filename)){
  const pdf=require('pdf-parse');
  const PDFParse=pdf.PDFParse||pdf.default?.PDFParse;
  let text='';
  if(typeof PDFParse==='function'){
   const parser=new PDFParse({data:buffer});
   try{const result=await parser.getText();text=String(result?.text||'');}
   finally{if(typeof parser.destroy==='function')await parser.destroy();}
  }else if(typeof pdf==='function'){
   const result=await pdf(buffer);text=String(result?.text||'');
  }else throw Error('PDF_EXTRACTION_FAILED');
  let provenance=null;
  if(!text.trim()&&typeof ocr==='function'){
   const result=await require('./local-pdf-ocr').ocrScannedPdf(buffer,{ocr});
   text=result.text;
   provenance={pages:result.pages,processed_pages:result.processed_pages,mode:'local-ocr',review_required:true};
  }
  return {schema_version:1,workspace_id:workspaceId.toLowerCase(),source:{filename:file.filename,kind:'pdf',extraction:provenance},proposal:core.proposeFromText(text,{kind:'pdf'}),entity_suggestions:analyzeEntities(text,{filename:file.filename,kind:'pdf'}),requires_manual_approval:true,auto_saved:false};
 }
 if(/\.(png|jpe?g|webp)$/.test(filename)){
  if(typeof ocr!=='function')throw Error('OCR_ADAPTER_REQUIRED');
  const text=await ocr(buffer,{filename:file.filename});
  if(typeof text!=='string')throw Error('INVALID_OCR_RESULT');
  return {schema_version:1,workspace_id:workspaceId.toLowerCase(),source:{filename:file.filename,kind:'image'},proposal:core.proposeFromText(text,{kind:'image'}),entity_suggestions:analyzeEntities(text,{filename:file.filename,kind:'image'}),requires_manual_approval:true,auto_saved:false};
 }
 throw Error('UNSUPPORTED_FORMAT');
}
module.exports={analyzeFile,MAX_BYTES};
