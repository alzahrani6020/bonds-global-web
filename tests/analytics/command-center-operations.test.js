'use strict';

const {
  evaluateExpectation,
  validateDecisionInput,
  validateActionInput,
  validateSavedView,
  validateWatchlist
} = require('../../lib/analytics/command-center-operations');

describe('command center operations wave 2', () => {
  test('decision baseline is captured from actual metric without fabricating a result', () => {
    const row=validateDecisionInput({
      title:'رفع التحويل',
      metric_key:'conversion_rate',
      expected_value:5,
      comparison:'gte',
      confidence:'medium',
      review_at:'2026-11-30'
    },{conversion_rate:3.2});
    expect(row.baseline).toEqual(expect.objectContaining({metric_key:'conversion_rate',actual_value:3.2}));
    expect(row.expected_outcome).toEqual({metric_key:'conversion_rate',target_value:5,comparison:'gte'});
    expect(row.measured_outcome).toEqual({});
    expect(row.status).toBe('open');
  });

  test('decision measurement is deterministic', () => {
    expect(evaluateExpectation(6,5,'gte')).toBe(true);
    expect(evaluateExpectation(4,5,'gte')).toBe(false);
    expect(evaluateExpectation(null,5,'gte')).toBeNull();
  });

  test('action input is bounded and validated', () => {
    expect(validateActionInput({title:'Follow up',priority:'high'})).toEqual(expect.objectContaining({
      title:'Follow up',priority:'high',status:'open'
    }));
    expect(()=>validateActionInput({title:''})).toThrow('title required');
  });

  test('saved views keep structured definition only', () => {
    expect(validateSavedView({
      name:'Finance view',
      scope:'private',
      definition:{period:'30d',sections:['revenue','pipeline']}
    })).toEqual({
      name:'Finance view',
      scope:'private',
      role_name:null,
      definition:{period:'30d',sections:['revenue','pipeline']}
    });
  });

  test('watchlists require supported entity type and references', () => {
    expect(validateWatchlist({
      name:'Key metrics',
      entity_type:'metric',
      entity_refs:['monthly_revenue','conversion_rate']
    })).toEqual({
      name:'Key metrics',
      entity_type:'metric',
      entity_refs:['monthly_revenue','conversion_rate']
    });
    expect(()=>validateWatchlist({name:'Bad',entity_type:'user',entity_refs:['x']})).toThrow('invalid entity_type');
  });
});
