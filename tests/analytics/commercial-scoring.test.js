'use strict';

const {
  scoreLead,
  scoreOpportunity,
  buildCommercialScoring
} = require('../../lib/analytics/commercial-scoring');

describe('Commercial scoring v1', () => {
  test('lead scoring is explainable and does not fabricate missing evidence', () => {
    const result = scoreLead({
      id: 'client-1',
      email: 'lead@example.com',
      phone: null,
      company_name: null,
      organization_id: null,
      is_decision_maker: null,
      relationship_role: null,
      source: 'service_request'
    }, []);

    expect(result.methodology).toBe('rule_based_v1');
    expect(result.semantics).toBe('operational_prioritization_not_conversion_probability');
    expect(result.score).not.toBeNull();
    expect(result.confidence).toBe('low');
    expect(result.reasons.some(r => r.key === 'contactability' && r.score === 100)).toBe(true);
    expect(result.missingEvidence.map(x => x.key)).toEqual(
      expect.arrayContaining(['companyContext','decisionRole','relationshipRole'])
    );
  });

  test('opportunity scoring keeps absent value owner close and action as missing evidence', () => {
    const result = scoreOpportunity({
      stage: 'qualified',
      probability: 35,
      value_amount: 0,
      expected_close_date: null,
      owner_user_id: null,
      next_action: null,
      next_action_at: null,
      service_request_id: 'sr-1'
    });

    expect(result.reasons.find(r => r.key === 'probability').score).toBe(35);
    expect(result.reasons.find(r => r.key === 'stageMaturity').score).toBe(40);
    expect(result.score).not.toBe(35);
    expect(result.missingEvidence.map(x => x.key)).toEqual(
      expect.arrayContaining(['valueQualified','closePlan','ownership','actionPlan'])
    );
    expect(result.confidence).toBe('low');
  });

  test('null probability remains unknown instead of becoming zero', () => {
    const result = scoreOpportunity({
      stage: 'lead',
      probability: null,
      value_amount: null,
      service_request_id: null
    });

    expect(result.reasons.some(r => r.key === 'probability')).toBe(false);
    expect(result.missingEvidence.map(x => x.key)).toContain('probability');
  });

  test('complete opportunity evidence yields high confidence', () => {
    const result = scoreOpportunity({
      stage: 'negotiation',
      probability: 80,
      value_amount: 250000,
      expected_close_date: '2026-12-15',
      owner_user_id: 'owner-1',
      next_action: 'Prepare final proposal',
      next_action_at: '2026-11-05T10:00:00Z',
      service_request_id: 'sr-1'
    });

    expect(result.coverage).toBe(100);
    expect(result.confidence).toBe('high');
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  test('overview scoring is derived only and not persisted', () => {
    const result = buildCommercialScoring(
      [{ id:'c1', email:'a@example.com', source:'service_request' }],
      [{ id:'o1', stage:'lead', probability:10, service_request_id:'sr1' }],
      [{ id:'sr1', client_id:'c1', status:'submitted' }]
    );

    expect(result.clients[0].commercial_score).toBeDefined();
    expect(result.opportunities[0].commercial_score).toBeDefined();
    expect(result.summary.persisted).toBe(false);
    expect(result.summary.methodology).toBe('rule_based_v1');
  });
});
