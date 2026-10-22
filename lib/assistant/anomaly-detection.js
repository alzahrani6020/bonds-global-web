'use strict';

const crypto = require('crypto');

const FAILURE_EVENTS = new Set(['failed','execution_failed','execution_denied','denied']);
const REPLAY_EVENTS = new Set(['replayed','event_replayed']);
const WRITE_EVENTS = new Set(['write_succeeded','execution_started','execution_succeeded']);

function boundedInteger(value,{min,max,fallback}){
  const n=Number.parseInt(String(value??''),10);
  if(!Number.isFinite(n))return fallback;
  return Math.min(max,Math.max(min,n));
}

function opaque(value){
  return crypto.createHash('sha256').update(String(value||'unknown')).digest('hex').slice(0,24);
}

function subjectKey(row){
  return [row?.user_id||'unknown',row?.session_id||'no-session'].join(':');
}

function publicSubjectRef(row){
  return opaque(subjectKey(row));
}

function anomalyEntityId(rule,row,bucket){
  return `assistant-anomaly:${rule}:${publicSubjectRef(row)}:${bucket}`;
}

function makeFinding({rule,severity,row,count,windowMinutes,bucket,title,message}){
  return {
    rule,
    severity,
    count,
    window_minutes:windowMinutes,
    subject_ref:publicSubjectRef(row),
    entity_type:'assistant_anomaly',
    entity_id:anomalyEntityId(rule,row,bucket),
    title,
    message,
    execution_authorized:false,
    auto_block:false
  };
}

function detectAssistantAnomalies(rows,{windowMinutes=15,nowMs=Date.now()}={}){
  const safeRows=Array.isArray(rows)?rows:[];
  const windowMs=windowMinutes*60*1000;
  const bucket=Math.floor(nowMs/windowMs);
  const bySubject=new Map();

  for(const row of safeRows){
    const key=subjectKey(row);
    if(!bySubject.has(key))bySubject.set(key,[]);
    bySubject.get(key).push(row);
  }

  const findings=[];

  for(const group of bySubject.values()){
    const sample=group[0]||{};
    const failureCount=group.filter(row=>FAILURE_EVENTS.has(row.event_type)).length;
    const replayCount=group.filter(row=>REPLAY_EVENTS.has(row.event_type)).length;
    const uncertainCount=group.filter(row=>row.event_type==='write_uncertain').length;
    const highRiskWithoutConfirmation=group.filter(row=>
      WRITE_EVENTS.has(row.event_type) &&
      ['high','critical'].includes(String(row.risk||'').toLowerCase()) &&
      row.requires_confirmation!==true
    ).length;

    if(highRiskWithoutConfirmation>0){
      findings.push(makeFinding({
        rule:'high_risk_without_confirmation',
        severity:'critical',
        row:sample,
        count:highRiskWithoutConfirmation,
        windowMinutes,
        bucket,
        title:'Assistant high-risk execution without confirmation',
        message:`${highRiskWithoutConfirmation} high/critical write lifecycle event(s) lacked confirmation evidence in the detection window.`
      }));
    }

    if(failureCount>=3){
      findings.push(makeFinding({
        rule:'failure_burst',
        severity:'high',
        row:sample,
        count:failureCount,
        windowMinutes,
        bucket,
        title:'Assistant failure/denial burst',
        message:`${failureCount} failure or denial event(s) were observed for one assistant subject in ${windowMinutes} minutes.`
      }));
    }

    if(uncertainCount>=2){
      findings.push(makeFinding({
        rule:'uncertain_write_burst',
        severity:'high',
        row:sample,
        count:uncertainCount,
        windowMinutes,
        bucket,
        title:'Assistant uncertain-write burst',
        message:`${uncertainCount} uncertain write outcome(s) were observed for one assistant subject in ${windowMinutes} minutes.`
      }));
    }

    if(replayCount>=4){
      findings.push(makeFinding({
        rule:'replay_burst',
        severity:'warning',
        row:sample,
        count:replayCount,
        windowMinutes,
        bucket,
        title:'Assistant replay burst',
        message:`${replayCount} replay event(s) were observed for one assistant subject in ${windowMinutes} minutes.`
      }));
    }
  }

  return findings.sort((a,b)=>{
    const rank={critical:4,high:3,warning:2,info:1};
    return (rank[b.severity]||0)-(rank[a.severity]||0) || a.rule.localeCompare(b.rule);
  });
}

async function persistAssistantAnomalyAlerts({supabase,findings}){
  if(!supabase||typeof supabase.from!=='function')throw new Error('ANOMALY_DATABASE_REQUIRED');
  if(!Array.isArray(findings)||findings.length===0)return {inserted:0,existing:0};

  const ids=findings.map(item=>item.entity_id);
  const existingRes=await supabase
    .from('admin_alerts')
    .select('entity_id')
    .eq('category','assistant_anomaly')
    .in('entity_id',ids)
    .in('status',['open','acknowledged']);

  if(existingRes.error)throw new Error('ANOMALY_ALERT_LOOKUP_FAILED');
  const existingIds=new Set((existingRes.data||[]).map(row=>row.entity_id));
  const missing=findings.filter(item=>!existingIds.has(item.entity_id));

  if(missing.length===0)return {inserted:0,existing:findings.length};

  const rows=missing.map(item=>({
    category:'assistant_anomaly',
    title:item.title,
    message:item.message,
    severity:item.severity,
    entity_type:item.entity_type,
    entity_id:item.entity_id,
    status:'open'
  }));

  const inserted=await supabase.from('admin_alerts').insert(rows).select('id,entity_id');
  if(inserted.error)throw new Error('ANOMALY_ALERT_INSERT_FAILED');

  return {
    inserted:(inserted.data||[]).length,
    existing:findings.length-missing.length
  };
}

async function scanAssistantAnomalies({
  supabase,
  lookbackMinutes=15,
  persist=false,
  nowMs=Date.now(),
  limit=1000
}={}){
  if(!supabase||typeof supabase.from!=='function')throw new Error('ANOMALY_DATABASE_REQUIRED');
  const minutes=boundedInteger(lookbackMinutes,{min:5,max:1440,fallback:15});
  const rowLimit=boundedInteger(limit,{min:50,max:1000,fallback:1000});
  const cutoff=new Date(nowMs-minutes*60*1000).toISOString();

  const result=await supabase
    .from('assistant_action_audit')
    .select('created_at,user_id,session_id,event_type,risk,requires_confirmation')
    .gte('created_at',cutoff)
    .order('created_at',{ascending:false})
    .limit(rowLimit);

  if(result.error)throw new Error('ANOMALY_AUDIT_READ_FAILED');

  const findings=detectAssistantAnomalies(result.data||[],{
    windowMinutes:minutes,
    nowMs
  });

  const persistence=persist
    ?await persistAssistantAnomalyAlerts({supabase,findings})
    :{inserted:0,existing:0};

  return {
    version:1,
    lookback_minutes:minutes,
    rows_examined:(result.data||[]).length,
    findings,
    persistence,
    policy:{
      deterministic_rules:true,
      auto_block:false,
      execution_authorized:false,
      ai_scoring:false
    }
  };
}

module.exports={
  FAILURE_EVENTS,
  REPLAY_EVENTS,
  WRITE_EVENTS,
  boundedInteger,
  publicSubjectRef,
  detectAssistantAnomalies,
  persistAssistantAnomalyAlerts,
  scanAssistantAnomalies
};
