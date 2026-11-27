(function () {
  'use strict';
  // Directory import is an explicit user action. CRM's existing RLS policies
  // authorize inserts; CSV values NEVER select the target workspace.
  const MAX_ROWS=100,MAX_BYTES=100000;
  const SECTORS=['business','government','factory','school','university','hospital','clinic','nonprofit','other'];
  const $=id=>document.getElementById(id);
  const english=document.documentElement.lang==='en';
  const tr=(ar,en)=>english?en:ar;
  const state={pending:[],workspaceId:null,busy:false};
  const status=$('institutional-entry-status'),workspace=$('workspace-select'),file=$('institutional-csv');
  if(!status||!workspace||!file||!window.BondsAuth)return;

  const message=s=>{status.textContent=s;};
  const trim=(v,max=240)=>String(v==null?'':v).trim().slice(0,max);
  function clearPending(){
    state.pending=[];state.workspaceId=null;
    $('institutional-apply').disabled=true;
    $('institutional-preview').replaceChildren();
  }
  workspace.addEventListener('change',()=>{clearPending();message(tr('اختر نوع السجل وأدخل البيانات.','Select a record type and enter details.'));});
  function parseCsv(raw){
    if(typeof raw!=='string'||raw.length>MAX_BYTES)throw Error('FILE_TOO_LARGE');
    if(raw.charCodeAt(0)===0xfeff)raw=raw.slice(1);
    const rows=[];let record=[],cell='',quoted=false;
    for(let i=0;i<raw.length;i++){
      const c=raw[i];
      if(quoted){
        if(c==='"'&&raw[i+1]==='"'){cell+='"';i++;}
        else if(c==='"')quoted=false;
        else cell+=c;
      }else if(c==='"'){
        if(cell)throw Error('INVALID_CSV');quoted=true;
      }else if(c===','){record.push(cell);cell='';}
      else if(c==='\n'){record.push(cell.replace(/\r$/,''));cell='';if(record.some(x=>x.trim()))rows.push(record);record=[];}
      else cell+=c;
      if(rows.length>MAX_ROWS+1)throw Error('TOO_MANY_ROWS');
    }
    if(quoted)throw Error('INVALID_CSV');
    if(cell.length||record.length){record.push(cell.replace(/\r$/,''));if(record.some(x=>x.trim()))rows.push(record);}
    if(rows.length<2)throw Error('EMPTY_CSV');
    const headers=rows.shift().map(x=>x.trim().toLowerCase());
    if(new Set(headers).size!==headers.length||!headers.includes('type')||!headers.includes('name'))throw Error('INVALID_HEADERS');
    const permitted=new Set(['type','name','sector','legal_name','city','country','email','phone','role']);
    if(headers.some(h=>!permitted.has(h)))throw Error('INVALID_HEADERS');
    if(rows.length>MAX_ROWS)throw Error('TOO_MANY_ROWS');
    return rows.map((cols,i)=>{
      if(cols.length!==headers.length)throw Error('INVALID_ROW_'+(i+2));
      const obj={};headers.forEach((h,j)=>{obj[h]=cols[j].trim();});return obj;
    });
  }
  function validate(record) {
    const type=trim(record.type,30).toLowerCase();
    if(type!=='organization'&&type!=='contact')throw Error('INVALID_TYPE');
    if(typeof record.name!=='string'||record.name.trim().length<1||record.name.trim().length>240)throw Error('INVALID_NAME');
    const name=trim(record.name,240);
    const email=trim(record.email,254).toLowerCase();
    if(record.email&&(!/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)||/[\r\n]/.test(email)))throw Error('INVALID_EMAIL');
    const phone=trim(record.phone,40);
    if(record.phone&&(!/^[+()0-9 .-]{3,40}$/.test(phone)))throw Error('INVALID_PHONE');
    if(type==='organization'){
      const sector=trim(record.sector||'other',30).toLowerCase();
      if(!SECTORS.includes(sector))throw Error('INVALID_SECTOR');
      return {type, row:{name,sector,legal_name:trim(record.legal_name,240)||null,
        city:trim(record.city,100)||null,country:trim(record.country,100)||null,email:email||null,phone:phone||null,status:'prospect'}};
    }
    return {type,row:{name,email:email||null,phone:phone||null,role:trim(record.role,120)||null,status:'lead'}};
  }
  function addPreview(list){
    const output=$('institutional-preview');
    output.replaceChildren();
    const ul=document.createElement('ul');
    for(const item of list.slice(0,20)){
      const li=document.createElement('li');
      li.textContent=(item.type==='organization'?tr('جهة: ','Organization: '):tr('شخص: ','Contact: '))+item.row.name;
      ul.append(li);
    }
    output.append(ul);
    if(list.length>20){const p=document.createElement('p');p.textContent=tr('وبقية السجلات: ','Additional records: ')+(list.length-20);output.append(p);}
  }
  function prepare(input){
    const seen=new Set();
    const pending=input.map(validate);
    for(const item of pending){
      const key=item.type+':'+item.row.name.toLocaleLowerCase();
      if(seen.has(key))throw Error('DUPLICATE_IN_FILE');
      seen.add(key);
    }
    state.workspaceId=workspace.value;
    state.pending=pending;addPreview(pending);
    $('institutional-apply').disabled=!pending.length;
    message(tr('معاينة جاهزة. لن يتم حفظ أي سجل إلا بعد تأكيد الاستيراد.','Preview ready. No records are written until you confirm import.'));
  }
  $('institutional-entry-form').addEventListener('submit',e=>{
    e.preventDefault();clearPending();
    if(!workspace.value){message(tr('اختر مساحة الشركة أولًا.','Choose a company workspace first.'));return;}
    const raw={type:$('institutional-entry-type').value,name:$('institutional-entry-name').value,
      sector:$('institutional-entry-sector').value,email:$('institutional-entry-email').value,
      city:$('institutional-entry-city').value,country:$('institutional-entry-country').value,
      phone:$('institutional-entry-phone').value};
    try{prepare([raw]);}catch(err){message(tr('بيانات الإدخال غير صالحة: ','Invalid entry: ')+err.message);}
  });
  $('institutional-preview-csv').addEventListener('click',async()=>{
    clearPending();
    if(!workspace.value){message(tr('اختر مساحة الشركة أولًا.','Choose a company workspace first.'));return;}
    const selected=file.files?.[0];
    if(!selected){message(tr('اختر ملف CSV.','Select a CSV file.'));return;}
    if(selected.size>MAX_BYTES){message('FILE_TOO_LARGE');return;}
    try{prepare(parseCsv(await selected.text()));}
    catch(err){message(tr('فشل فحص CSV: ','CSV validation failed: ')+err.message);}
  });
  $('institutional-entry-type').addEventListener('change',()=>{
    const isOrg=$('institutional-entry-type').value==='organization';
    $('institutional-sector-wrap').hidden=!isOrg;
    $('institutional-city-wrap').hidden=!isOrg;
    $('institutional-country-wrap').hidden=!isOrg;
  });
  async function authenticatedClient(){
    const sb=window.BondsAuth.getSupabase();
    const {data,error}=await sb.auth.getUser();
    if(error||!data?.user||data.user.is_anonymous)throw Error('AUTH_REQUIRED');
    return sb;
  }
  async function getAllKeys(sb,table,workspaceId){
    // Compare duplicates inside this workspace only. No cross-tenant lookup.
    const keys=new Set();
    for(let offset=0;offset<10000;offset+=500){
      const {data,error}=await sb.from(table).select('name').eq('workspace_id',workspaceId)
        .order('name',{ascending:true}).range(offset,offset+499);
      if(error)throw error;
      for(const row of data||[])keys.add(String(row.name||'').toLocaleLowerCase());
      if(!data||data.length<500)return keys;
    }
    throw Error('DIRECTORY_TOO_LARGE');
  }
  $('institutional-apply').addEventListener('click',async()=>{
    if(state.busy||!state.pending.length)return;
    if(!workspace.value||state.workspaceId!==workspace.value){
      clearPending();message(tr('تغيرت مساحة الشركة، أعد المعاينة.','Workspace changed. Preview again.'));return;
    }
    state.busy=true;$('institutional-apply').disabled=true;
    let created=0,skipped=0;
    try{
      const sb=await authenticatedClient();
      const workspaceId=state.workspaceId;
      const {data:space,error:spaceError}=await sb.from('crm_app_workspaces').select('id').eq('id',workspaceId).maybeSingle();
      if(spaceError||!space)throw Error('WORKSPACE_NOT_AVAILABLE');
      const orgKeys=await getAllKeys(sb,'crm_app_companies',workspaceId);
      const contactKeys=await getAllKeys(sb,'crm_app_contacts',workspaceId);
      for(const item of state.pending){
        if(workspace.value!==workspaceId)throw Error('WORKSPACE_CHANGED');
        const keys=item.type==='organization'?orgKeys:contactKeys;
        const key=item.row.name.toLocaleLowerCase();
        if(keys.has(key)){skipped++;continue;}
        const table=item.type==='organization'?'crm_app_companies':'crm_app_contacts';
        // RLS is the authorization boundary, not the browser's selected role.
        const {error}=await sb.from(table).insert({...item.row,workspace_id:workspaceId});
        if(error)throw Error('RLS_OR_DATABASE_REJECTED');
        keys.add(key);created++;
      }
      clearPending();
      file.value='';
      message(tr('حُفظت سجلات: ','Created: ')+created+tr('؛ المكررة المتجاوزة: ','; skipped existing: ')+skipped);
      $('directory-form').requestSubmit();
    }catch(err){
      clearPending();
      message(tr('توقف الاستيراد. المحفوظ: ','Import stopped. Created: ')+created+
        tr('؛ المتجاوز: ','; skipped: ')+skipped+
        tr('؛ السبب: ','; reason: ')+err.message+
        tr(' — راجع الدليل قبل إعادة المحاولة.',' — check the directory before retrying.'));
    }finally{state.busy=false;$('institutional-apply').disabled=true;}
  });
  window.BONDS_INSTITUTIONAL_IMPORT_TEST={parseCsv,validate};
})();