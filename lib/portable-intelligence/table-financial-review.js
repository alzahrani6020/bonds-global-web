'use strict';
function digits(s){return String(s).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-0x660)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-0x6f0))}
function parseAmount(value){
 let s=digits(value).trim().replace(/[\u200e\u200f\u00a0\s]/g,'').replace(/٬/g,',').replace(/٫/g,'.').replace(/−/g,'-');
 if(!s||s==='-'||s==='—')return null;
 let minus=false;if(/^\(.+\)$/.test(s)){minus=true;s=s.slice(1,-1)}
 if(!/^[+-]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?$/.test(s))return null;
 const n=Number(s.replace(/,/g,''));return Number.isFinite(n)?(minus?-n:n):null;
}
function reviewFinancialTables(tables){return (tables||[]).map(table=>{
 const rows=table.rows||[];let header=-1,yearCols=[];
 for(let i=0;i<Math.min(rows.length,8);i++){
  const found=(rows[i].cells||[]).map((v,column)=>({year:digits(v).trim(),column,inherited:rows[i].provenance?.[column]?.inherited})).filter(x=>!x.inherited&&/^(?:19|20)\d{2}$/.test(x.year));
  if(found.length>=2){header=i;yearCols=found.map(({year,column})=>({year,column}));break}
 }
 const valid=header>=0&&new Set(yearCols.map(c=>c.year)).size===yearCols.length;
 const items=[];
 if(valid)for(let i=header+1;i<rows.length;i++){
  const cells=rows[i].cells||[];
  const labelCells=cells.filter((v,col)=>!yearCols.some(y=>y.column===col)&&/[\p{L}]/u.test(v||''));
  if(labelCells.length!==1)continue;
  const values=yearCols.map(({year,column})=>({year,column,original:cells[column]??'',amount:parseAmount(cells[column])}));
  if(values.every(v=>v.amount!==null))items.push({label:labelCells[0],row:i+1,values,status:'REVIEW_REQUIRED'});
 }
 return {table:table.index,year_mapping_status:valid?'EXPLICIT_HEADER_REVIEW_REQUIRED':'UNDETERMINED',items,verified:false};
})}
module.exports={parseAmount,reviewFinancialTables};
