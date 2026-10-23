(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.BondsUnifiedControlCenter=api;
})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';

  const DOMAINS=Object.freeze([
    {id:'assistant',label:'Assistant',href:'/admin/assistant-control-center.html'},
    {id:'learning',label:'Learning',href:'/admin/assistant-control-center.html#learning'},
    {id:'training',label:'Training',href:'/admin/control-center.html#training'},
    {id:'evolution',label:'Evolution',href:'/admin/assistant-control-center.html#evolution'},
    {id:'capabilities',label:'Capabilities',href:'/admin/platform-center.html'},
    {id:'models',label:'Models',href:'/admin/control-center.html#models'},
    {id:'approvals',label:'Approvals',href:'/admin/human-approvals/'},
    {id:'releases',label:'Releases',href:'/admin/control-center.html#releases'},
    {id:'health',label:'Health',href:'/admin/platform-operations.html'},
    {id:'audit',label:'Audit',href:'/admin/audit-log.html'}
  ]);

  function status(value){
    const v=String(value||'unknown').toLowerCase();
    if(['healthy','normal','verified','completed','ready','ok','success'].includes(v))return 'healthy';
    if(['degraded','warning','paused','waiting_for_capacity','pending','in_progress'].includes(v))return 'warning';
    if(['blocked','failed','critical','full_stop','error'].includes(v))return 'critical';
    return 'unknown';
  }

  function summarize({control={},operations={},health={},evolution={},training={},releases={}}={}){
    const cards={
      assistant:{status:status(operations.mode||operations.status||'unknown'),metric:operations.mode||'unknown'},
      learning:{status:status(evolution.status||'unknown'),metric:Number(evolution.count||0)},
      training:{status:status(training.status||'unknown'),metric:Number(training.queued||training.count||0)},
      evolution:{status:status(evolution.status||'unknown'),metric:Number(evolution.count||0)},
      capabilities:{status:status(control.capabilities_status||'unknown'),metric:control.capabilities_count??'—'},
      models:{status:status(training.model_status||'unknown'),metric:Number(training.models||0)},
      approvals:{status:status(control.approvals_status||'unknown'),metric:Array.isArray(control.approvals)?control.approvals.length:Number(control.approvals_count||0)},
      releases:{status:status(releases.status||'unknown'),metric:releases.latest||'—'},
      health:{status:status(health.overall||health.status||'unknown'),metric:health.overall||health.status||'unknown'},
      audit:{status:status(control.audit_status||'unknown'),metric:Number(control.audit_count||0)}
    };
    const critical=Object.values(cards).filter(c=>c.status==='critical').length;
    const warning=Object.values(cards).filter(c=>c.status==='warning').length;
    return {cards,critical,warning,overall:critical?'critical':warning?'warning':'healthy'};
  }

  return {DOMAINS,status,summarize};
});