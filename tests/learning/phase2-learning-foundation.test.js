'use strict';

const { EVENT_TYPES }=require('../../lib/dual-core/event-taxonomy');
const { detectGapOrDefect }=require('../../lib/learning/gap-defect-detector');
const { aggregateEvidence,eventMatchesProposal }=require('../../lib/learning/evidence-aggregator');
const { classifyProposalRisk }=require('../../lib/learning/proposal-risk-classifier');
const { analyzeProposal }=require('../../lib/learning/learning-proposal-engine');

function proposal(overrides={}){
  return {
    id:'p1',
    fingerprint:'a'.repeat(64),
    event_type:EVENT_TYPES.CAPABILITY_MISSING,
    status:'proposed',
    occurrence_count:3,
    threshold:3,
    first_seen_at:'2026-10-23T00:00:00Z',
    last_seen_at:'2026-10-23T00:10:00Z',
    metadata:{service_code:'svc-1'},
    execution_authorized:false,
    auto_execute:false,
    ...overrides
  };
}

describe('Phase 2 learning foundation',()=>{
  test('routes capability gaps to capability development',()=>{
    expect(detectGapOrDefect(EVENT_TYPES.CAPABILITY_MISSING)).toEqual(expect.objectContaining({
      problem_class:'capability_gap',
      recommended_path:'capability_development'
    }));
  });

  test('routes calculation mismatches to deterministic engine review',()=>{
    expect(detectGapOrDefect(EVENT_TYPES.CALCULATION_MISMATCH)).toEqual(expect.objectContaining({
      problem_class:'calculation_defect',
      recommended_path:'deterministic_engine_review'
    }));
  });

  test('matches evidence by event type and safe metadata',()=>{
    const p=proposal();
    expect(eventMatchesProposal({
      event_type:EVENT_TYPES.CAPABILITY_MISSING,
      metadata:{service_code:'svc-1',secret:'ignored'}
    },p)).toBe(true);
    expect(eventMatchesProposal({
      event_type:EVENT_TYPES.CAPABILITY_MISSING,
      metadata:{service_code:'svc-2'}
    },p)).toBe(false);
  });

  test('aggregates evidence without user content',()=>{
    const p=proposal();
    const result=aggregateEvidence({
      proposal:p,
      events:[
        {event_type:p.event_type,metadata:{service_code:'svc-1',error_code:'X'},created_at:'2026-10-23T00:01:00Z'},
        {event_type:p.event_type,metadata:{service_code:'svc-1',error_code:'X'},created_at:'2026-10-23T00:02:00Z'}
      ]
    });
    expect(result.evidence_count).toBe(2);
    expect(result.threshold_reached).toBe(true);
    expect(JSON.stringify(result)).not.toContain('user_id');
  });

  test('classifies protected financial mismatch as critical and non-executable',()=>{
    const risk=classifyProposalRisk({eventType:EVENT_TYPES.CALCULATION_MISMATCH,diagnosis:{}});
    expect(risk).toEqual(expect.objectContaining({
      risk_class:'critical',
      protected_surface:true,
      requires_human_approval:true,
      auto_execute:false,
      execution_authorized:false
    }));
  });

  test('analysis never authorizes execution or changes status',()=>{
    const result=analyzeProposal({proposal:proposal(),learningEvents:[]});
    expect(result.policy.execution_authorized).toBe(false);
    expect(result.policy.auto_execute).toBe(false);
    expect(result.policy.status_change).toBe(false);
    expect(result.status).toBe('proposed');
  });
});
