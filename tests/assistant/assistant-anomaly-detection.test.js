/** @jest-environment node */

const {
  detectAssistantAnomalies,
  scanAssistantAnomalies
}=require('../../lib/assistant/anomaly-detection');

function row(overrides={}){
  return {
    user_id:'11111111-1111-4111-8111-111111111111',
    session_id:'sess-1',
    event_type:'planned',
    risk:'low',
    requires_confirmation:false,
    created_at:'2026-10-22T19:00:00Z',
    ...overrides
  };
}

function auditQuery(data,error=null){
  const q={
    select:jest.fn().mockReturnThis(),
    gte:jest.fn().mockReturnThis(),
    order:jest.fn().mockReturnThis(),
    limit:jest.fn().mockResolvedValue({data,error})
  };
  return q;
}

describe('Assistant anomaly detection',()=>{
  test('normal activity produces no findings',()=>{
    const findings=detectAssistantAnomalies([
      row(),
      row({event_type:'confirmation_prepared',requires_confirmation:true,risk:'high'}),
      row({event_type:'execution_succeeded',requires_confirmation:true,risk:'high'})
    ],{windowMinutes:15,nowMs:Date.parse('2026-10-22T19:10:00Z')});
    expect(findings).toEqual([]);
  });

  test('detects high-risk execution without confirmation as critical',()=>{
    const findings=detectAssistantAnomalies([
      row({event_type:'execution_started',risk:'high',requires_confirmation:false})
    ],{windowMinutes:15,nowMs:Date.parse('2026-10-22T19:10:00Z')});
    expect(findings).toHaveLength(1);
    expect(findings[0]).toEqual(expect.objectContaining({
      rule:'high_risk_without_confirmation',
      severity:'critical',
      auto_block:false,
      execution_authorized:false
    }));
    expect(findings[0]).not.toHaveProperty('user_id');
  });

  test('detects failure, uncertain-write and replay bursts deterministically',()=>{
    const findings=detectAssistantAnomalies([
      row({event_type:'failed'}),row({event_type:'denied'}),row({event_type:'execution_failed'}),
      row({event_type:'write_uncertain'}),row({event_type:'write_uncertain'}),
      row({event_type:'replayed'}),row({event_type:'replayed'}),row({event_type:'event_replayed'}),row({event_type:'event_replayed'})
    ],{windowMinutes:15,nowMs:Date.parse('2026-10-22T19:10:00Z')});
    expect(findings.map(x=>x.rule)).toEqual(expect.arrayContaining([
      'failure_burst','uncertain_write_burst','replay_burst'
    ]));
  });

  test('scan is read-only unless persistence is explicitly requested',async()=>{
    const q=auditQuery([row({event_type:'failed'}),row({event_type:'denied'}),row({event_type:'execution_failed'})]);
    const from=jest.fn(table=>{
      if(table==='assistant_action_audit')return q;
      throw new Error('unexpected table '+table);
    });
    const result=await scanAssistantAnomalies({
      supabase:{from},
      lookbackMinutes:15,
      persist:false,
      nowMs:Date.parse('2026-10-22T19:10:00Z')
    });
    expect(result.findings).toHaveLength(1);
    expect(result.persistence.inserted).toBe(0);
    expect(from).toHaveBeenCalledTimes(1);
  });

  test('persistent scan deduplicates open anomaly alerts',async()=>{
    const q=auditQuery([row({event_type:'failed'}),row({event_type:'denied'}),row({event_type:'execution_failed'})]);
    const existing={
      select:jest.fn().mockReturnThis(),
      eq:jest.fn().mockReturnThis(),
      in:jest.fn()
    };
    existing.in
      .mockReturnValueOnce(existing)
      .mockResolvedValueOnce({data:[],error:null});
    const insertResult={
      select:jest.fn().mockResolvedValue({data:[{id:'a1',entity_id:'x'}],error:null})
    };
    const alerts={
      select:existing.select,
      eq:existing.eq,
      in:existing.in,
      insert:jest.fn(()=>insertResult)
    };
    const from=jest.fn(table=>{
      if(table==='assistant_action_audit')return q;
      if(table==='admin_alerts')return alerts;
      throw new Error('unexpected table '+table);
    });
    const result=await scanAssistantAnomalies({
      supabase:{from},
      persist:true,
      nowMs:Date.parse('2026-10-22T19:10:00Z')
    });
    expect(result.persistence.inserted).toBe(1);
    expect(alerts.insert).toHaveBeenCalledTimes(1);
  });
});
