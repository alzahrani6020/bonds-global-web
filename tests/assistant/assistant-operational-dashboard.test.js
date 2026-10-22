/** @jest-environment node */

const {
  boundedWindowHours,
  auditSummary,
  agentInboxSummary,
  approvalsSummary,
  anomalyAlertSummary,
  buildAssistantOperationalDashboard
}=require('../../lib/assistant/operational-dashboard');

function query(rows,error=null){
  const q={
    select:()=>q,
    gte:()=>q,
    eq:()=>q,
    in:()=>q,
    order:()=>q,
    limit:()=>q,
    then(resolve){return Promise.resolve({data:rows,error}).then(resolve);}
  };
  return q;
}

describe('Assistant Operational Dashboard',()=>{
  test('bounds time window',()=>{
    expect(boundedWindowHours(undefined)).toBe(24);
    expect(boundedWindowHours(0)).toBe(1);
    expect(boundedWindowHours(999)).toBe(168);
  });

  test('summarizes assistant activity without identifiers',()=>{
    const rows=[
      {event_type:'execution_succeeded',created_at:'2026-10-23T00:00:00Z',user_id:'secret-user'},
      {event_type:'execution_failed',created_at:'2026-10-22T23:00:00Z'},
      {event_type:'execution_denied',created_at:'2026-10-22T22:00:00Z'},
      {event_type:'replayed',created_at:'2026-10-22T21:00:00Z'},
      {event_type:'write_uncertain',created_at:'2026-10-22T20:00:00Z'}
    ];
    const out=auditSummary(rows,1000);
    expect(out.execution_succeeded).toBe(1);
    expect(out.execution_failed).toBe(1);
    expect(out.execution_denied).toBe(1);
    expect(out.replay_total).toBe(1);
    expect(out.write_uncertain).toBe(1);
    expect(out.success_rate).toBe(0.3333);
    expect(JSON.stringify(out)).not.toContain('secret-user');
  });

  test('summarizes human queues and anomaly alerts',()=>{
    expect(agentInboxSummary([
      {status:'open',priority:'critical'},
      {status:'assigned',priority:'high'}
    ],500)).toEqual(expect.objectContaining({
      active_total:2,critical_priority:1,high_priority:1
    }));
    expect(approvalsSummary([
      {status:'pending',risk:'critical'},
      {status:'pending',risk:'high'}
    ],500)).toEqual(expect.objectContaining({
      pending_total:2,critical_risk:1,high_risk:1
    }));
    expect(anomalyAlertSummary([
      {status:'open',severity:'critical'},
      {status:'acknowledged',severity:'high'}
    ],500)).toEqual(expect.objectContaining({active_total:2}));
  });

  test('builds bounded read-only dashboard from existing sources',async()=>{
    const rows={
      assistant_action_audit:[
        {event_type:'execution_succeeded',created_at:'2026-10-23T00:20:00Z'},
        {event_type:'execution_denied',created_at:'2026-10-23T00:10:00Z'}
      ],
      assistant_agent_inbox:[{status:'open',priority:'high',created_at:'2026-10-23T00:00:00Z'}],
      admin_approval_requests:[{status:'pending',risk:'critical',created_at:'2026-10-23T00:00:00Z'}],
      admin_alerts:[{status:'open',severity:'high',created_at:'2026-10-23T00:00:00Z'}],
      admin_ai_kill_switches:[]
    };
    const supabase={from:name=>query(rows[name]||[])};
    const out=await buildAssistantOperationalDashboard({
      supabase,windowHours:24,nowMs:1792700000000
    });
    expect(out.activity).toEqual(expect.objectContaining({
      total_events:2,execution_succeeded:1,execution_denied:1
    }));
    expect(out.queues.agent_inbox.active_total).toBe(1);
    expect(out.queues.human_approvals.pending_total).toBe(1);
    expect(out.safety.anomaly_alerts.active_total).toBe(1);
    expect(out.safety.emergency_mode.mode).toBe('normal');
    expect(out.shadow_authorization).toEqual({
      telemetry_persistence:'response_only',
      drift_metric_available:false,
      note_code:'SHADOW_AUTHORIZATION_TELEMETRY_NOT_PERSISTED'
    });
    expect(out.policy).toEqual(expect.objectContaining({
      read_only:true,
      raw_user_identifiers:false,
      secrets_exposed:false,
      execution_authorized:false,
      auto_execute:false
    }));
  });

  test('fails closed when an operational source cannot be read',async()=>{
    const supabase={
      from:name=>query([],name==='assistant_action_audit'?{message:'db fail'}:null)
    };
    await expect(buildAssistantOperationalDashboard({supabase}))
      .rejects.toThrow('ASSISTANT_OPERATIONAL_AUDIT_READ_FAILED');
  });
});
