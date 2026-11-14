/* Read-only byte-faithful rendering of the issued PDF. Does not regenerate official documents. */
(function(root){
'use strict';
const PDFJS_VERSION='4.10.38';
const PDFJS_BASE='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/'+PDFJS_VERSION+'/';
const HEX=/^[a-f0-9]{64}$/i;
function sameOriginOfficialUrl(value){
  if(typeof value!=='string'||!value.startsWith('/api/correspondence?')) return false;
  try {
    const url=new URL(value,root.location.origin);
    return url.origin===root.location.origin && url.pathname==='/api/correspondence' &&
      url.searchParams.get('action')==='official-preview' &&
      /^[0-9a-f-]{36}$/i.test(url.searchParams.get('token')||'');
  }catch(_){return false;}
}
async function sha256(buffer){
 if(!root.crypto?.subtle) throw new Error('Browser SHA-256 unavailable');
 const hash=await root.crypto.subtle.digest('SHA-256',buffer);
 return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
async function render({url,expectedHash,container,feedback,language='ar'}){
 const en=language==='en';
 const say=msg=>{if(feedback) feedback.textContent=msg;};
 const message=en?'Unable to reproduce the verified PDF on this device. Open or download the original file.':'تعذر عرض صفحات PDF الموثقة على هذا الجهاز. افتح النسخة الأصلية أو نزّلها.';
 if(!container||!sameOriginOfficialUrl(url)||!HEX.test(expectedHash||'')){
  say(message);return false;
 }
 container.replaceChildren();
 say(en?'Checking original PDF bytes…':'جارٍ التحقق من بصمة ملف PDF الأصلي…');
 try{
  const response=await fetch(url,{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/pdf'}});
  if(!response.ok||!String(response.headers.get('content-type')||'').toLowerCase().includes('application/pdf')) throw new Error('Official PDF not available');
  const bytes=await response.arrayBuffer();
  if(!bytes.byteLength) throw new Error('Empty PDF');
  const actual=await sha256(bytes);
  if(actual.toLowerCase()!==expectedHash.toLowerCase()) throw new Error('Original PDF SHA-256 mismatch');
  // The worker is version-pinned to the matching renderer. No document is uploaded to this CDN.
  const pdfjs=await import(PDFJS_BASE+'pdf.min.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=PDFJS_BASE+'pdf.worker.min.mjs';
  const task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false});
  const pdf=await task.promise;
  if(!Number.isInteger(pdf.numPages)||pdf.numPages<1||pdf.numPages>100) throw new Error('Unsupported page count');
  say(en?'Original PDF fingerprint matches. Displaying '+pdf.numPages+' page(s).':'بصمة الملف الأصلي مطابقة. عدد الصفحات: '+pdf.numPages);
  // Draw pages from the *same* bytes the original-download link serves.
  for(let index=1;index<=pdf.numPages;index++){
   const page=await pdf.getPage(index);
   const natural=page.getViewport({scale:1});
   const available=Math.max(1,container.clientWidth||document.documentElement.clientWidth-60);
   const scale=Math.min(2,available/natural.width);
   const ratio=Math.min(root.devicePixelRatio||1,2);
   const viewport=page.getViewport({scale:scale*ratio});
   const canvas=document.createElement('canvas');
   canvas.className='verified-pdf-page';
   canvas.dataset.pdfNaturalWidth=String(natural.width);
   canvas.setAttribute('aria-label',(en?'Official PDF page ':'صفحة PDF الرسمية ')+index+'/'+pdf.numPages);
   canvas.style.width=(natural.width*scale)+'px';
   canvas.style.height=(natural.height*scale)+'px';
   canvas.width=Math.ceil(viewport.width);
   canvas.height=Math.ceil(viewport.height);
   const ctx=canvas.getContext('2d',{alpha:false});
   if(!ctx) throw new Error('Canvas unavailable');
   await page.render({canvasContext:ctx,viewport,background:'#ffffff'}).promise;
   container.appendChild(canvas);
   page.cleanup();
  }
  return true;
 }catch(error){
  container.replaceChildren();
  say(message);
  if(root.console?.warn) root.console.warn('[BONDS verified PDF display unavailable]',error?.message);
  return false;
 }
}

function installModal({trigger,container,download,language='ar'}){
  if(!trigger||!container||typeof HTMLDialogElement==='undefined')return false;
  const en=language==='en';
  const dir=en?'ltr':'rtl';
  const dialog=document.createElement('dialog');
  dialog.className='bonds-pdf-dialog';
  dialog.dir=dir;
  dialog.setAttribute('aria-label',en?'Official A4 PDF':'الخطاب الرسمي A4');
  dialog.innerHTML='<div class="bonds-pdf-dialog-toolbar"><strong></strong><div class="bonds-pdf-dialog-actions">'+
    '<button type="button" data-action="zoom-in" aria-label="Zoom in">+</button>'+
    '<button type="button" data-action="fit" aria-label="Fit to width">100%</button>'+
    '<button type="button" data-action="zoom-out" aria-label="Zoom out">−</button>'+
    '<a data-action="download" download></a>'+
    '<button type="button" data-action="close"></button></div></div>'+
    '<div class="bonds-pdf-dialog-scroll"></div>';
  dialog.querySelector('strong').textContent=en?'Official letter — A4':'الخطاب الرسمي — A4';
  dialog.querySelector('[data-action="download"]').textContent=en?'Download original':'تنزيل الأصل';
  dialog.querySelector('[data-action="close"]').textContent=en?'Close':'إغلاق';
  const dl=dialog.querySelector('[data-action="download"]');
  if(download?.href)dl.href=download.href;
  else dl.hidden=true;
  const scroll=dialog.querySelector('.bonds-pdf-dialog-scroll');
  const marker=document.createComment('official PDF viewer original position');
  container.parentNode.insertBefore(marker,container);
  const initialStyle=new Map();
  document.body.appendChild(dialog);
  let zoom=1;
  const pages=()=>Array.from(container.querySelectorAll('.verified-pdf-page'));
  const fit=()=>{
    // A4 pixels are not mirrored by RTL: only navigation and controls are RTL.
    const width=Math.max(200,scroll.clientWidth-32);
    pages().forEach(canvas=>{
      const natural=Number(canvas.dataset.pdfNaturalWidth)||595;
      const a4px=natural*96/72;
      canvas.style.width=Math.round(Math.min(width,a4px)*zoom)+'px';
    });
    dialog.querySelector('[data-action="fit"]').textContent=Math.round(zoom*100)+'%';
  };
  dialog.querySelector('[data-action="zoom-in"]').addEventListener('click',()=>{zoom=Math.min(3,zoom+.25);fit();});
  dialog.querySelector('[data-action="zoom-out"]').addEventListener('click',()=>{zoom=Math.max(.5,zoom-.25);fit();});
  dialog.querySelector('[data-action="fit"]').addEventListener('click',()=>{zoom=1;fit();});
  dialog.querySelector('[data-action="close"]').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{
    marker.parentNode?.insertBefore(container,marker);
    pages().forEach(canvas=>{canvas.style.width=initialStyle.get(canvas)||'';});
    trigger.focus();
  });
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  trigger.addEventListener('click',e=>{
    if(!pages().length)return; // fall back to original PDF in new tab
    e.preventDefault();
    if(dialog.open)return;
    pages().forEach(canvas=>initialStyle.set(canvas,canvas.style.width));
    scroll.appendChild(container);
    zoom=1;
    dialog.showModal();
    fit();
    dialog.querySelector('[data-action="close"]').focus();
  });
  window.addEventListener('resize',()=>{if(dialog.open)fit();});
  return true;
}

root.BondsVerifiedPdfViewer=Object.freeze({render,sameOriginOfficialUrl,installModal});
})(window);
