/* Safe, read-only employee directory export for the current HR owner workspace.
 * Never includes bank details, salary, documents, personal contact details or membership records.
 */
(()=>{'use strict';
 const app=document.getElementById('hr-app'),actions=app?.querySelector('.section-actions');
 if(!app||!actions)return;
 const en=document.documentElement.lang==='en',t=(ar,english)=>en?english:ar;
 const button=document.createElement('button');
 button.type='button';button.id='hr-export-directory';button.className='secondary';
 button.textContent=t('تصدير دليل الموظفين CSV','Export employee directory CSV');
 const notice=document.createElement('p');notice.id='hr-export-directory-status';
 notice.className='muted';notice.setAttribute('role','status');notice.setAttribute('aria-live','polite');
 actions.append(button);actions.insertAdjacentElement('afterend',notice);
 const columns=['employee_number','full_name','employment_status','hire_date','department','job_title'];
 const headers=en?['Employee number','Full name','Employment status','Hire date','Department','Job title']:
  ['الرقم الوظيفي','اسم الموظف','الحالة الوظيفية','تاريخ التعيين','الإدارة','المسمى الوظيفي'];
 const maxRows=10000,batchSize=500;
 // Guard against CSV/Excel formula injection, including invisible leading whitespace.
 const csvCell=value=>{
  let s=String(value??'');
  if(/^[\s\u200b\ufeff]*[=+@-]/u.test(s))s="'"+s;
  return '"'+s.replace(/"/g,'""')+'"';
 };
 async function exportCsv(){
  const ctx=window.BondsHRContext,workspaceId=ctx?.ownerWorkspace?.id;
  if(!ctx?.ownerLicense||!ctx?.user||!ctx?.db||!workspaceId){
   notice.textContent=t('اختر مساحة الشركة المصرح بها أولًا','Select an authorized HR company workspace first');
   return;
  }
  button.disabled=true;
  const rows=[];
  try{
   notice.textContent=t('جارٍ تصدير الموظفين من الشركة الحالية…','Reading employees from the current company…');
   for(let start=0;start<=maxRows;start+=batchSize){
    if(window.BondsHRContext?.ownerWorkspace?.id!==workspaceId)
     throw Error(t('تغيرت الشركة أثناء التصدير؛ أُلغي الملف','Company changed during export; download cancelled'));
    const result=await ctx.db.from('hr_saas_employees')
     .select(columns.join(',')).eq('workspace_id',workspaceId).order('id',{ascending:true})
     .range(start,start+batchSize-1);
    if(result.error)throw result.error;
    const part=result.data;
    if(!Array.isArray(part))throw Error('EMPLOYEE_EXPORT_INVALID_RESPONSE');
    rows.push(...part);
    if(rows.length>maxRows)throw Error(t('عدد الموظفين يتجاوز حد التصدير 10000. لم يُنتج ملف غير مكتمل','Employee count exceeds the 10,000-row export limit; no incomplete file was produced'));
    if(part.length<batchSize)break;
   }
   if(window.BondsHRContext?.ownerWorkspace?.id!==workspaceId)
    throw Error(t('تغيرت الشركة؛ أُلغي الملف','Company changed; download cancelled'));
   const lines=[headers.map(csvCell).join(','),...rows.map(r=>columns.map(k=>csvCell(r[k])).join(','))];
   const blob=new Blob(['\ufeff'+lines.join('\r\n')+'\r\n'],{type:'text/csv;charset=utf-8'});
   const url=URL.createObjectURL(blob);
   try{
    const a=document.createElement('a');a.href=url;
    a.download='bonds-hr-employees-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.append(a);a.click();a.remove();
   }finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
   notice.textContent=t('تم تجهيز تصدير '+rows.length+' موظفًا من الشركة المحددة','Prepared '+rows.length+' employee records for this company');
  }catch(error){
   notice.textContent=t('تعذر تصدير الدليل: ','Directory export failed: ')+(error?.message||String(error));
  }finally{button.disabled=false;}
 }
 button.addEventListener('click',exportCsv);
 document.addEventListener('bonds-hr-owner-workspace',()=>{notice.textContent='';});
})();
