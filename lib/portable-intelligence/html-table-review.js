'use strict';
// Review-only extraction. Does not execute HTML or create CRM/financial records.
const {parseAmount,reviewFinancialTables}=require('./table-financial-review');
const decode=s=>String(s).replace(/&#x([0-9a-f]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16))).replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ');
function htmlTables(html){
 const clean=String(html).replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,'');
 const matches=[...clean.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)];
 if(matches.length>20)throw Error('HTML_TABLE_LIMIT');
 const tables=[];
 function span(attr,name){const m=attr.match(new RegExp('\\b'+name+'\\s*=\\s*(?:"(\\d+)"|\\x27(\\d+)\\x27|(\\d+))','i'));const n=m?Number(m[1]||m[2]||m[3]):1;if(n<1||n>30||!Number.isSafeInteger(n))throw Error('HTML_SPAN_LIMIT');return n}
 for(const match of matches){
  if(/<table\b/i.test(match[1]))throw Error('HTML_NESTED_TABLE_REVIEW_REQUIRED');
  const tr=[...match[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)];
  if(tr.length>120)throw Error('HTML_ROW_LIMIT');
  const reserved=new Map(),rows=[];
  for(let i=0;i<tr.length;i++){
   const row=[],origins=[],headers=[];for(const [col,v] of reserved.get(i)||[]){row[col]=v.text;origins[col]=v.origin;headers[col]=v.header}
   let pos=0;
   const cells=[...tr[i][1].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)];
   if(cells.length>30)throw Error('HTML_COLUMN_LIMIT');
   for(const cell of cells){
    while(pos<30&&row[pos]!==undefined)pos++;
    const cs=span(cell[2],'colspan'),rs=span(cell[2],'rowspan');
    if(pos+cs>30||i+rs>120)throw Error('HTML_SPAN_LIMIT');
    const text=decode(cell[3].replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()).slice(0,1500),header=cell[1].toLowerCase()==='th';
    for(let j=0;j<cs;j++){const c=pos+j;if(row[c]!==undefined)throw Error('HTML_SPAN_OVERLAP');row[c]=text;headers[c]=header;origins[c]={row:i+1,column:pos+1,inherited:j>0};for(let k=1;k<rs;k++){const m=reserved.get(i+k)||new Map();if(m.has(c))throw Error('HTML_SPAN_OVERLAP');m.set(c,{text,header,origin:{row:i+1,column:pos+1,inherited:true}});reserved.set(i+k,m)}}
    pos+=cs;
   }
   if(row.length)rows.push({cells:Array.from({length:row.length},(_,x)=>row[x]??''),headers:Array.from({length:row.length},(_,x)=>headers[x]??false),provenance:origins});
  }
  tables.push({index:tables.length+1,rows});
 }
 return {tables,financial_review:reviewFinancialTables(tables),requires_manual_approval:true,auto_saved:false};
}
module.exports={htmlTables};
