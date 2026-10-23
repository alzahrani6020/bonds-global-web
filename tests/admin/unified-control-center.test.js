'use strict';
const {DOMAINS,status,summarize}=require('../../admin/unified-control-center');

describe('Phase 7 Unified Control Center',()=>{
  test('contains all ten required control domains',()=>{
    expect(DOMAINS.map(x=>x.id)).toEqual([
      'assistant','learning','training','evolution','capabilities',
      'models','approvals','releases','health','audit'
    ]);
  });

  test('normalizes operational states deterministically',()=>{
    expect(status('healthy')).toBe('healthy');
    expect(status('WAITING_FOR_CAPACITY')).toBe('warning');
    expect(status('blocked')).toBe('critical');
    expect(status('something-new')).toBe('unknown');
  });

  test('summarizes without inventing unavailable data',()=>{
    const result=summarize({
      operations:{mode:'normal'},
      health:{overall:'healthy'},
      evolution:{status:'in_progress',count:3},
      training:{status:'WAITING_FOR_CAPACITY',queued:2,models:4,model_status:'ready'},
      control:{approvals:[{},{}]}
    });
    expect(result.cards.assistant.status).toBe('healthy');
    expect(result.cards.training.status).toBe('warning');
    expect(result.cards.approvals.metric).toBe(2);
    expect(result.cards.releases.metric).toBe('—');
    expect(result.overall).toBe('warning');
  });

  test('critical domain makes overall critical',()=>{
    const result=summarize({health:{overall:'critical'}});
    expect(result.overall).toBe('critical');
    expect(result.critical).toBe(1);
  });
});