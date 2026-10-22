/* Human Approval Queue admin UI */
/* global HumanApprovalService */
(function(){
  'use strict';
  const root=document.getElementById('approval-root');
  const role=document.getElementById('approval-role');
  const status=document.getElementById('approval-status');
  const risk=document.getElementById('approval-risk');
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
  function fmt(v){if(!v)return '-';const d=new Date(v);return Number.isNaN(d.getTime())?'-':d.toLocaleString('ar-SA');}
  function card(item){
    const pending=item.status==='pending';
    return '<article class="approval-card" data-id="'+esc(item.id)+'">'+
      '<div class="approval-head"><strong>'+esc(item.action_type||'إجراء حساس')+'</strong><span>'+esc(item.risk)+'</span></div>'+
      '<p>الهدف: '+esc(item.action_target||'-')+'</p>'+
      '<div class="approval-meta"><span>Workflow: '+esc(item.workflow_key)+'</span><span>Version: '+esc(item.workflow_version)+'</span><span>'+esc(fmt(item.requested_at))+'</span></div>'+
      '<code class="approval-fingerprint">'+esc(item.action_fingerprint)+'</code>'+
      (pending?'<div class="approval-actions"><input class="approval-note" type="text" aria-label="ملاحظة قرار الموافقة" placeholder="ملاحظة القرار"><button class="approval-approve" type="button">موافقة</button><button class="approval-reject" type="button">رفض</button></div>':'<p>الحالة: '+esc(item.status)+'</p>')+
      '</article>';
  }
  async function load(){
    root.innerHTML='<div>جارِ تحميل الموافقات...</div>';
    try{
      const data=await HumanApprovalService.list({status:status.value,risk:risk.value});
      if(role)role.textContent='الدور: '+(data.role||'-');
      const items=data.human_approval_queue?.items||[];
      root.innerHTML=items.length?items.map(card).join(''):'<div>لا توجد طلبات في هذه الحالة.</div>';
      bind();
    }catch(err){root.innerHTML='<div class="approval-error">'+esc(err.message)+'</div>';}
  }
  function bind(){
    root.querySelectorAll('.approval-approve,.approval-reject').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const el=btn.closest('.approval-card');
        const decision=btn.classList.contains('approval-approve')?'approved':'rejected';
        btn.disabled=true;
        try{
          await HumanApprovalService.decide(el.dataset.id,decision,el.querySelector('.approval-note').value||null);
          await load();
        }catch(err){alert(err.message);btn.disabled=false;}
      });
    });
  }
  status.addEventListener('change',load);
  risk.addEventListener('change',load);
  document.getElementById('approval-refresh').addEventListener('click',load);
  load();
})();
