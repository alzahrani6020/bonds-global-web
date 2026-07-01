const rules = require('../../lib/rules/business-rules-engine');

describe('Business Rules Engine', () => {
  describe('evaluate', () => {
    it('evaluates sector rule for real estate', () => {
      const res = rules.evaluate('BR-SECTOR-001', { asset_class: 'realEstate' });
      expect(res.passed).toBe(true);
      expect(res.effect).toBe('hide_vehicle_fields');
    });

    it('evaluates data quality rule', () => {
      const res = rules.evaluate('BR-VAL-002', { data_quality_score: 75 });
      expect(res.passed).toBe(false);
      expect(res.message).toMatch(/below 80/);
    });

    it('approves certificate when thresholds met', () => {
      const res = rules.evaluate('BR-CRT-001', { confidence_score: 90, data_quality_score: 85, reportApproved: true });
      expect(res.passed).toBe(true);
    });

    it('rejects certificate when confidence too low', () => {
      const res = rules.evaluate('BR-CRT-001', { confidence_score: 80, data_quality_score: 85, reportApproved: true });
      expect(res.passed).toBe(false);
    });

    it('warns on low DSCR', () => {
      const res = rules.evaluate('BR-FIN-001', { dscr: 1.1 });
      expect(res.passed).toBe(true);
      expect(res.warning).toBeTruthy();
    });

    it('rejects high LTV', () => {
      const res = rules.evaluate('BR-FIN-002', { ltv: 0.85 });
      expect(res.passed).toBe(false);
    });

    it('blocks low-confidence data without manual confirmation', () => {
      const res = rules.evaluate('BR-DATA-001', { source_confidence: 'D' });
      expect(res.passed).toBe(false);
    });

    it('allows low-confidence data when manually confirmed', () => {
      const res = rules.evaluate('BR-DATA-001', { source_confidence: 'D', manualConfirmed: true });
      expect(res.passed).toBe(true);
    });

    it('returns unknown rules as passed', () => {
      const res = rules.evaluate('BR-UNKNOWN-999', {});
      expect(res.passed).toBe(true);
    });
  });

  describe('evaluateAll', () => {
    it('returns passed when all rules pass', () => {
      const res = rules.evaluateAll(['BR-VAL-002', 'BR-FIN-002'], { data_quality_score: 90, ltv: 0.7 });
      expect(res.passed).toBe(true);
      expect(res.results).toHaveLength(2);
    });

    it('collects failures', () => {
      const res = rules.evaluateAll(['BR-VAL-002', 'BR-FIN-002'], { data_quality_score: 70, ltv: 0.9 });
      expect(res.passed).toBe(false);
      expect(res.failures).toHaveLength(2);
    });
  });

  describe('workflow', () => {
    beforeAll(() => {
      rules.defineWorkflow('test_entity', ['draft', 'review', 'approved'], [
        { from: 'draft', to: 'review' },
        { from: 'review', to: 'approved', requiresApproval: true }
      ]);
    });

    it('allows valid transition', () => {
      const res = rules.canTransition('test_entity', 'draft', 'review');
      expect(res.allowed).toBe(true);
    });

    it('blocks disallowed transition', () => {
      const res = rules.canTransition('test_entity', 'approved', 'draft');
      expect(res.allowed).toBe(false);
    });

    it('requires approval', () => {
      const res = rules.canTransition('test_entity', 'review', 'approved');
      expect(res.allowed).toBe(false);
      expect(res.reason).toMatch(/Approval required/);
    });
  });

  describe('listRules', () => {
    it('filters by category', () => {
      const sectorRules = rules.listRules({ category: 'Sector' });
      expect(sectorRules.length).toBeGreaterThan(0);
      expect(sectorRules.every(r => r.category === 'Sector')).toBe(true);
    });
  });
});
