'use strict';

const { EVENT_TYPES } = require('../../lib/dual-core/event-taxonomy');
const {
  thresholdFor,
  proposalSeverity,
  fingerprintEvent,
  aggregateEvolutionSignal
} = require('../../lib/dual-core/evolution-proposal-aggregator');

describe('evolution proposal aggregator',()=>{
  test('uses stricter thresholds for lower-severity noise',()=>{
    expect(thresholdFor(EVENT_TYPES.PRODUCTION_REGRESSION)).toBe(1);
    expect(thresholdFor(EVENT_TYPES.CAPABILITY_FAILED)).toBe(2);
    expect(thresholdFor(EVENT_TYPES.CAPABILITY_MISSING)).toBe(3);
    expect(thresholdFor(EVENT_TYPES.ASSISTANT_LOW_CONFIDENCE)).toBe(5);
  });

  test('derives severity deterministically',()=>{
    expect(proposalSeverity(EVENT_TYPES.CALCULATION_MISMATCH)).toBe('critical');
    expect(proposalSeverity(EVENT_TYPES.CAPABILITY_FAILED)).toBe('high');
    expect(proposalSeverity(EVENT_TYPES.CAPABILITY_MISSING)).toBe('medium');
  });

  test('fingerprint excludes arbitrary payload and uses approved metadata keys',()=>{
    const a={type:EVENT_TYPES.CAPABILITY_FAILED,metadata:{service_code:'svc',error_code:'X'},payload:{raw:'one'}};
    const b={type:EVENT_TYPES.CAPABILITY_FAILED,metadata:{service_code:'svc',error_code:'X'},payload:{raw:'two'}};
    expect(fingerprintEvent(a)).toBe(fingerprintEvent(b));
  });

  test('calls server-side aggregation RPC',async()=>{
    const rpc=jest.fn().mockResolvedValue({data:{status:'proposed'},error:null});
    const supabase={rpc};
    const event={
      type:EVENT_TYPES.CAPABILITY_FAILED,
      occurred_at:'2026-10-23T00:00:00Z',
      metadata:{service_code:'svc',error_code:'X'}
    };
    const result=await aggregateEvolutionSignal({supabase,event});
    expect(result.status).toBe('proposed');
    expect(rpc).toHaveBeenCalledWith('evolution_aggregate_signal',expect.objectContaining({
      p_event_type:EVENT_TYPES.CAPABILITY_FAILED,
      p_threshold:2,
      p_severity:'high'
    }));
  });
});
