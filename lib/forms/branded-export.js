(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  else root.BondsBrandedExport=api;
})(typeof self!=='undefined'?self:this,function(){
  'use strict';
  // Exact logo asset used by the public site header.
  const LOGO='/assets/bonds-logo-2026-v2-sm.webp?v=2026f';
  const EMAIL_GLYPH='✉';

  function esc(v){return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
  function safeName(v){return String(v||'bonds-report').replace(/[\\/:*?"<>|]+/g,'-').replace(/\s+/g,'-');}
  function saveBlob(blob,name){const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);}
  function loadScript(src,test){return new Promise((resolve,reject)=>{if(test&&test())return resolve();const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>reject(new Error('Failed to load '+src));document.head.appendChild(s);});}
  function dateText(lang){return new Date().toLocaleDateString(lang==='en'?'en-GB':'ar-SA',{year:'numeric',month:'long',day:'numeric'});}
  function renderTable(t){
    return '<section class="bonds-export-section">'+(t.title?'<h2>'+esc(t.title)+'</h2>':'')+
      '<table><thead><tr>'+t.headers.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+
      (t.rows||[]).map(r=>'<tr>'+r.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+
      '</tbody></table></section>';
  }
  function buildHtml(doc,logoSrc){
    const lang=doc.lang==='en'?'en':'ar',dir=lang==='en'?'ltr':'rtl';
    const meta=(doc.metadata||[]).map(x=>'<div class="meta"><span>'+esc(x.label)+'</span><strong>'+esc(x.value||'—')+'</strong></div>').join('');
    const tables=(doc.tables||[]).map(renderTable).join('');
    const notes=doc.notes?'<section class="bonds-export-section"><h2>'+(lang==='en'?'Notes':'ملاحظات')+'</h2><p>'+esc(doc.notes)+'</p></section>':'';
    return '<!doctype html><html lang="'+lang+'" dir="'+dir+'"><head><meta charset="utf-8"><style>'+
      '@page{size:A4;margin:16mm}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Arial,Tahoma,sans-serif;color:#0b1f3a;background:#fff;margin:0}.wrap{max-width:1100px;margin:auto}.brand{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #b68a38;padding:0 0 14px;margin-bottom:18px}.brand img{width:112px;height:44px;object-fit:contain}.brand h1{font-size:22px;margin:0}.brand p{margin:4px 0 0;color:#667085;font-size:12px}.meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}.meta{border:1px solid #dde2e8;border-radius:8px;padding:8px}.meta span{display:block;font-size:11px;color:#667085}.meta strong{font-size:13px}.bonds-export-section{margin:20px 0;page-break-inside:auto}.bonds-export-section h2{font-size:15px;color:#8a6a2f;border-bottom:1px solid #d9dee5;padding-bottom:6px}table{width:100%;border-collapse:collapse;font-size:10.5px}th,td{border:1px solid #d9dee5;padding:6px;text-align:'+ (dir==='rtl'?'right':'left') +';vertical-align:top}th{background:#f5f1e8;color:#0b1f3a;font-weight:700}tr{page-break-inside:avoid}.footer{border-top:1px solid #d9dee5;margin-top:18px;padding-top:8px;text-align:center;font-size:10px;color:#667085}@media print{.wrap{max-width:none}.meta-grid{grid-template-columns:repeat(3,1fr)}}'+
      '</style></head><body><div class="wrap"><header class="brand"><div><h1>'+esc(doc.title||'Bonds')+'</h1><p>'+esc(doc.subtitle||'Bonds Global')+' — '+dateText(lang)+'</p></div><img src="'+esc(logoSrc||LOGO)+'" alt="Bonds"></header>'+
      (meta?'<div class="meta-grid">'+meta+'</div>':'')+tables+notes+
      '<div class="footer">Bonds Global · bonds-global.com</div></div></body></html>';
  }
  async function logoPng(){
    const res=await fetch(LOGO,{cache:'no-store'}); if(!res.ok) throw new Error('Logo load failed');
    const blob=await res.blob(); const url=URL.createObjectURL(blob);
    try{
      const img=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=url;});
      const c=document.createElement('canvas'); const maxW=420; const scale=Math.min(1,maxW/img.width);
      c.width=Math.max(1,Math.round(img.width*scale)); c.height=Math.max(1,Math.round(img.height*scale));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      return c.toDataURL('image/png');
    }finally{URL.revokeObjectURL(url);}
  }
  function printDoc(doc){
    const w=window.open('','_blank'); if(!w) throw new Error('Popup blocked');
    w.document.open(); w.document.write(buildHtml(doc,location.origin+LOGO)); w.document.close();
    w.onload=()=>setTimeout(()=>w.print(),250);
  }
  async function pdfDoc(doc){
    await Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',()=>window.html2canvas),
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',()=>window.jspdf)
    ]);
    const holder=document.createElement('div'); holder.style.cssText='position:fixed;left:-100000px;top:0;width:1100px;background:#fff;z-index:-1;';
    const iframe=document.createElement('iframe'); iframe.style.cssText='width:1100px;height:1600px;border:0'; holder.appendChild(iframe); document.body.appendChild(holder);
    const logo=await logoPng().catch(()=>location.origin+LOGO);
    iframe.contentDocument.open(); iframe.contentDocument.write(buildHtml(doc,logo)); iframe.contentDocument.close();
    await new Promise(r=>setTimeout(r,350));
    const body=iframe.contentDocument.body;
    const canvas=await window.html2canvas(body,{scale:1.6,backgroundColor:'#ffffff',useCORS:true});
    holder.remove();
    const {jsPDF}=window.jspdf; const pdf=new jsPDF('p','mm','a4');
    const img=canvas.toDataURL('image/png'), w=210, h=canvas.height*w/canvas.width, ph=297;
    let y=0,left=h; pdf.addImage(img,'PNG',0,y,w,h); left-=ph;
    while(left>0){pdf.addPage(); y=left-h; pdf.addImage(img,'PNG',0,y,w,h); left-=ph;}
    pdf.save(safeName(doc.filenameBase||doc.title)+'.pdf');
  }
  async function wordDoc(doc){
    const logo=await logoPng().catch(()=>location.origin+LOGO);
    const html=buildHtml(doc,logo);
    const blob=new Blob(['\ufeff',html],{type:'application/msword'});
    saveBlob(blob,safeName(doc.filenameBase||doc.title)+'.doc');
  }
  async function excelDoc(doc){
    await loadScript('https://cdn.jsdelivr.net/npm/exceljs@4.4.0/dist/exceljs.min.js',()=>window.ExcelJS);
    const wb=new window.ExcelJS.Workbook(); wb.creator='Bonds Global'; wb.created=new Date();
    const ws=wb.addWorksheet((doc.lang==='en'?'Report':'تقرير').slice(0,31),{views:[{rightToLeft:doc.lang!=='en'}]});
    const logo=await logoPng().catch(()=>null);
    if(logo){const id=wb.addImage({base64:logo,extension:'png'});ws.addImage(id,{tl:{col:0,row:0},ext:{width:150,height:60}});}
    ws.mergeCells('C1','H2'); const title=ws.getCell('C1'); title.value=doc.title||'Bonds'; title.font={bold:true,size:16}; title.alignment={horizontal:doc.lang==='en'?'left':'right',vertical:'middle'};
    let row=4;
    for(const m of (doc.metadata||[])){ws.getCell(row,1).value=m.label;ws.getCell(row,2).value=m.value||'—';ws.getCell(row,1).font={bold:true};row++;}
    row+=1;
    for(const t of (doc.tables||[])){
      ws.getCell(row,1).value=t.title||''; ws.getCell(row,1).font={bold:true,size:13}; row++;
      const header=ws.getRow(row); t.headers.forEach((h,i)=>header.getCell(i+1).value=h); header.font={bold:true}; header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FFF5F1E8'}}; row++;
      for(const rr of (t.rows||[])){const er=ws.getRow(row);rr.forEach((v,i)=>er.getCell(i+1).value=(typeof v==='number'?v:String(v==null?'':v)));row++;}
      row+=2;
    }
    ws.columns.forEach(c=>{c.width=Math.min(30,Math.max(12,...c.values.filter(Boolean).map(v=>String(v).length+2)));});
    const buf=await wb.xlsx.writeBuffer(); saveBlob(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),safeName(doc.filenameBase||doc.title)+'.xlsx');
  }
  async function exportDocument(format,doc){
    if(format==='print')return printDoc(doc);
    if(format==='pdf')return pdfDoc(doc);
    if(format==='word')return wordDoc(doc);
    if(format==='excel')return excelDoc(doc);
    throw new Error('Unsupported export format');
  }
  return {exportDocument,buildHtml,logoPath:LOGO,emailGlyph:EMAIL_GLYPH};
});