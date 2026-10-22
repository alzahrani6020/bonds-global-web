/* Agent Inbox admin UI */
/* global AgentInboxService */
(function () {
  'use strict';

  const root=document.getElementById('agent-inbox-root');
  const roleEl=document.getElementById('agent-inbox-role');
  const filters={ status:'', priority:'', assigned_to:'' };
  let assignees=[];

  function esc(v){
    return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function fmt(v){
    if(!v) return '-';
    const d=new Date(v);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('ar-SA');
  }
  function labelStatus(v){
    const map={open:'مفتوح',assigned:'معيّن',in_review:'قيد المراجعة',waiting_user:'بانتظار المستخدم',resolved:'تم الحل',dismissed:'مستبعد'};
    return map[v]||v;
  }
  function labelPriority(v){
    const map={critical:'حرج',high:'عالٍ',medium:'متوسط',low:'منخفض'};
    return map[v]||v;
  }
  function assigneeOptions(selected){
    const items=['<option value="">غير معيّن</option>'];
    for(const a of assignees){
      items.push('<option value="'+esc(a.user_id)+'" '+(a.user_id===selected?'selected':'')+'>'+esc(a.role)+' · '+esc(a.user_id.slice(0,8))+'</option>');
    }
    return items.join('');
  }
  function card(item){
    return '<article class="agent-card agent-card--'+esc(item.priority)+'" data-id="'+esc(item.id)+'">'+
      '<div class="agent-card__head"><div><strong>'+esc(item.title_ar)+'</strong><small>'+esc(item.reason_code)+'</small></div>'+
      '<div class="agent-badges"><span>'+esc(labelPriority(item.priority))+'</span><span>'+esc(labelStatus(item.status))+'</span></div></div>'+
      '<p>'+esc(item.summary_ar||'لا يوجد وصف إضافي')+'</p>'+
      '<div class="agent-meta"><span>الحدث: '+esc(item.event_type||'-')+'</span><span>المورد: '+esc(item.resource_id||'-')+'</span><span>'+esc(fmt(item.created_at))+'</span></div>'+
      '<div class="agent-actions">'+
        '<select class="agent-assignee">'+assigneeOptions(item.assigned_to)+'</select>'+
        '<select class="agent-status">'+['open','assigned','in_review','waiting_user','resolved','dismissed'].map(s=>'<option value="'+s+'" '+(s===item.status?'selected':'')+'>'+esc(labelStatus(s))+'</option>').join('')+'</select>'+
        '<input class="agent-note" type="text" placeholder="ملاحظة الحل عند الإغلاق">'+
        '<button class="agent-save">حفظ</button>'+
      '</div></article>';
  }

  async function load(){
    root.innerHTML='<div class="agent-loading">جارِ تحميل صندوق العمل...</div>';
    try{
      const [data, people]=await Promise.all([
        AgentInboxService.list(filters),
        AgentInboxService.assignees()
      ]);
      assignees=people.assignees||[];
      if(roleEl) roleEl.textContent='الدور: '+(data.role||'-');
      const items=data.agent_inbox?.items||[];
      root.innerHTML=items.length ? items.map(card).join('') : '<div class="agent-empty">لا توجد حالات تحتاج متابعة حاليًا.</div>';
      bind();
    }catch(err){
      root.innerHTML='<div class="agent-error">'+esc(err.message)+'</div>';
    }
  }

  function bind(){
    root.querySelectorAll('.agent-save').forEach(btn=>{
      btn.addEventListener('click', async ()=>{
        const cardEl=btn.closest('.agent-card');
        btn.disabled=true;
        try{
          await AgentInboxService.update(cardEl.dataset.id,{
            assigned_to:cardEl.querySelector('.agent-assignee').value||null,
            status:cardEl.querySelector('.agent-status').value,
            resolution_note:cardEl.querySelector('.agent-note').value||null
          });
          await load();
        }catch(err){
          alert(err.message);
          btn.disabled=false;
        }
      });
    });
  }

  document.querySelectorAll('[data-agent-filter]').forEach(el=>{
    el.addEventListener('change',()=>{
      filters[el.dataset.agentFilter]=el.value;
      load();
    });
  });

  window.AgentInboxApp={ load };
  load();
})();
