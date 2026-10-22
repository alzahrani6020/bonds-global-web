'use strict';

const { EVENT_TYPES, validateEvent } = require('../../lib/dual-core/event-taxonomy');
const { DynamicIntelligenceBus } = require('../../lib/dual-core/intelligence-bus');
const { STATES, createEvolutionState, transition } = require('../../lib/dual-core/evolution-state-machine');
const { deriveProfile } = require('../../lib/dual-core/runtime-capability-profiler');
const { schedule } = require('../../lib/dual-core/resource-scheduler');

describe('Phase 1 dual-core foundation', () => {
  test('validates known events and routes them through the bus', async () => {
    const bus = new DynamicIntelligenceBus();
    const seen = [];
    bus.subscribe(EVENT_TYPES.CAPABILITY_MISSING, e => seen.push(e.payload.code));
    const event = bus.createEvent(EVENT_TYPES.CAPABILITY_MISSING, { code: 'x' });
    expect(validateEvent(event)).toBe(true);
    const result = await bus.publish(event);
    expect(result.delivered).toBe(1);
    expect(seen).toEqual(['x']);
  });

  test('rejects unknown event types', () => {
    expect(() => validateEvent({
      id:'1', type:'unknown.event', occurred_at:new Date().toISOString(), payload:{}
    })).toThrow('DUAL_CORE_EVENT_TYPE_UNKNOWN');
  });

  test('keeps approved target alive through repair', () => {
    let state=createEvolutionState('proposal-1');
    state=transition(state,STATES.ENGINEERING);
    state=transition(state,STATES.REPAIRING,{reason:'TEST_FAILED'});
    state=transition(state,STATES.VALIDATING);
    expect(state.current).toBe(STATES.VALIDATING);
    expect(state.target_id).toBe('proposal-1');
  });

  test('models capacity wait as resumable state', () => {
    let state=createEvolutionState('proposal-2');
    state=transition(state,STATES.WAITING_FOR_CAPACITY);
    state=transition(state,STATES.ENGINEERING);
    expect(state.current).toBe(STATES.ENGINEERING);
  });

  test('derives minimal profile on constrained hardware', () => {
    const p=deriveProfile({total_ram_gb:16,free_ram_gb:4,cpu_load:0.4,gpu_available:true,model_healthy:true});
    expect(p.execution_profile).toBe('MINIMAL');
    expect(p.parallel_agents).toBe(1);
  });

  test('production preempts evolution on a single execution slot', () => {
    const profile={
      runnable:true,
      execution_profile:'MINIMAL',
      parallel_agents:1,
      snapshot:{free_ram_gb:4,gpu_available:true}
    };
    const result=schedule([
      {id:'e1',core:'self_evolving',kind:'approved_upgrade'},
      {id:'p1',core:'operational',kind:'production_user_request'}
    ],profile);
    expect(result.runnable.map(x=>x.id)).toEqual(['p1']);
    expect(result.paused.map(x=>x.id)).toContain('e1');
  });

  test('capacity-gates heavy work instead of dropping it', () => {
    const profile={
      runnable:true,
      execution_profile:'MINIMAL',
      parallel_agents:1,
      snapshot:{free_ram_gb:4,gpu_available:false}
    };
    const task={id:'t1',core:'self_evolving',kind:'training',requirements:{min_profile:'HIGH',gpu_required:true}};
    const result=schedule([task],profile);
    expect(result.waiting_for_capacity.map(x=>x.id)).toEqual(['t1']);
  });
});
