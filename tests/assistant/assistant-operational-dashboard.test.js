/** @jest-environment node */

const {
  boundedWindowHours,
  auditSummary,
  outcomeAnalytics,
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


  test('derives action-level outcome analytics from latest terminal immutable evidence',()=>{
    const rows=[
      {action_id:'a1',action_type:'form_submit',event_type:'planned',created_at:'2026-11-01T10:00:00Z'},
      {action_id:'a1',action_type:'form_submit',event_type:'execution_started',created_at:'2026-11-01T10:01:00Z'},
      {action_id:'a1',action_type:'form_submit',event_type:'execution_succeeded',created_at:'2026-11-01T10:02:00Z'},
      {action_id:'a2',action_type:'form_submit',event_type:'execution_failed',created_at:'2026-11-01T10:03:00Z'},
      {action_id:'a3',action_type:'form_save_draft',event_type:'replayed',created_at:'2026-11-01T10:04:00Z'},
      {action_id:'a4',action_type:'form_save_draft',event_type:'planned',created_at:'2026-11-01T10:05:00Z'}
    ];
    const out=outcomeAnalytics(rows,1000);
    expect(out).toEqual(expect.objectContaining({
      status:'measured',
      distinct_actions:4,
      measured_actions:3,
      unmeasured_actions:1,
      succeeded:1,
      failed:1,
      denied:0,
      uncertain:0,
      replayed:1,
      outcome_coverage:0.75,
      success_rate:0.3333,
      methodology:'latest_terminal_audit_event_per_action'
    }));
    expect(out.by_action_type.find(x=>x.action_type==='form_submit')).toEqual(expect.objectContaining({
      measured_actions:2,succeeded:1,failed:1,success_rate:0.5
    }));
  });

  test('reports UNKNOWN when no terminal action outcome exists',()=>{
    const out=outcomeAnalytics([
      {action_id:'a1',action_type:'site_navigate',event_type:'planned',created_at:'2026-11-01T10:00:00Z'}
    ],1000);
    expect(out.status).toBe('unknown');
    expect(out.measured_actions).toBe(0);
    expect(out.success_rate).toBeNull();
    expect(out.note).toMatch(/^UNKNOWN:/);
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
        {action_id:'a1',action_type:'form_submit',event_type:'execution_succeeded',created_at:'2026-10-23T00:20:00Z'},
        {action_id:'a2',action_type:'form_submit',event_type:'execution_denied',created_at:'2026-10-23T00:10:00Z'}
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
    expect(out.outcomes).toEqual(expect.objectContaining({
      status:'measured',distinct_actions:2,measured_actions:2,succeeded:1,denied:1,success_rate:0.5
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
