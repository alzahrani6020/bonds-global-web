'use strict';
const core=require('./core');
const MAX_BYTES=5*1024*1024;
function validateFile(file){if(!file||!Buffer.isBuffer(file.buffer)||file.buffer.length===0||file.buffer.length>MAX_BYTES)throw Error('INVALID_FILE_SIZE');if(!file.filename||/[\\\/]/.test(file.filename))throw Error('INVALID_FILENAME');return file.filename.toLowerCase();}
async function analyzeFile({file,workspaceId,defaultType=null,ocr=null}={}){
 const filename=validateFile(file),buffer=file.buffer;
 if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId||''))throw Error('WORKSPACE_ID_REQUIRED');
 if(/\.(xlsx|xls)$/.test(filename)){
  const XLSX=require('xlsx');
  const book=XLSX.read(buffer,{type:'buffer',cellDates:false,cellFormula:false,cellHTML:false});
  const rows=[];for(const sheet of book.SheetNames.slice(0,20)){const matrix=XLSX.utils.sheet_to_json(book.Sheets[sheet],{header:1,raw:false,defval:''});rows.push(...core.rowsFromMatrix(matrix));if(rows.length>1000)throw Error('TOO_MANY_ROWS');}
  return core.normalizeRows({rows,source:{filename:file.filename,kind:'spreadsheet'},workspaceId,defaultType});
 }
 if(/\.csv$/.test(filename)){
  // Use SheetJS parser for quoted CSV and UTF-8 BOM; no split(',') corruption.
  const XLSX=require('xlsx');const book=XLSX.read(buffer,{type:'buffer',raw:true});const first=book.Sheets[book.SheetNames[0]];
  return core.normalizeRows({rows:core.rowsFromMatrix(XLSX.utils.sheet_to_json(first,{header:1,raw:false,defval:''})),source:{filename:file.filename,kind:'csv'},workspaceId,defaultType});
 }
 if(/\.docx$/.test(filename)){
  const result=await require('mammoth').extractRawText({buffer});
  return {schema_version:1,workspace_id:workspaceId.toLowerCase(),source:{filename:file.filename,kind:'docx'},proposal:core.proposeFromText(result.value,{kind:'docx'}),requires_manual_approval:true,auto_saved:false};
 }
 if(/\.pdf$/.test(filename)){
  const extracted=await require('../intelligence/content-extraction').extractContent(buffer,'application/pdf');
  if(extracted.extraction_error)throw Error('PDF_EXTRACTION_FAILED');
  return {schema_version:1,workspace_id:workspaceId.toLowerCase(),source:{filename:file.filename,kind:'pdf'},proposal:core.proposeFromText(extracted.text,{kind:'pdf'}),requires_manual_approval:true,auto_saved:false};
 }
 if(/\.(png|jpe?g|webp)$/.test(filename)){
  if(typeof ocr!=='function')throw Error('OCR_ADAPTER_REQUIRED');
  const text=await ocr(buffer,{filename:file.filename});
  if(typeof text!=='string')throw Error('INVALID_OCR_RESULT');
  return {schema_version:1,workspace_id:workspaceId.toLowerCase(),source:{filename:file.filename,kind:'image'},proposal:core.proposeFromText(text,{kind:'image'}),requires_manual_approval:true,auto_saved:false};
 }
 throw Error('UNSUPPORTED_FORMAT');
}
module.exports={analyzeFile,MAX_BYTES};
