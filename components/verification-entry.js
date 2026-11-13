/* Public Bonds verification entry. Never infer document identity from a reference number. */
(function(root){
'use strict';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function parse(value){
 const raw=String(value||'').trim();
 if(UUID.test(raw))return raw;
 if(!raw||raw.length>2048)return null;
 try{
  const url=new URL(raw,root.location.origin);
  if(url.protocol!=='https:')return null;
  if(url.hostname!=='bonds-global.com'&&url.hostname!=='www.bonds-global.com')return null;
  if(!/^\/(?:en\/)?verify-document(?:\.html)?\/?$/.test(url.pathname))return null;
  const values=url.searchParams.getAll('token');
  return values.length===1&&UUID.test(values[0])?values[0]:null;
 }catch(_){return null;}
}
function install({input,form,error,language='ar'}){
 form.addEventListener('submit',event=>{
  event.preventDefault();
  const token=parse(input.value);
  if(!token){
   error.textContent=language==='en'?'Paste the original Bonds QR link or its token. A reference number cannot establish authenticity.':'ألصق رابط QR الرسمي أو رمز التحقق. رقم الصادر وحده لا يثبت أصالة المستند.';
   error.hidden=false;return;
  }
  error.hidden=true;
  root.location.assign((language==='en'?'/en/verify-document':'/verify-document')+'?token='+encodeURIComponent(token));
 });
}
root.BondsVerificationEntry=Object.freeze({parse,install});
})(window);
