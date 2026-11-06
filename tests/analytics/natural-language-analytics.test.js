const { answerNaturalLanguageAnalytics } = require('../../lib/analytics/natural-language-analytics');

describe('Natural Language Analytics', () => {
  const governance = {
    asOfDate: '2026-11-01',
    metrics: [
      {
        metric_key: 'monthly_revenue',
        display_name_ar: 'الإيراد الشهري',
        display_name_en: 'Monthly revenue',
        unit: 'sar',
        source_key: 'payments',
        version: 1,
        status: 'active',
        actual: 120000
      },
      {
        metric_key: 'pipeline_value',
        display_name_ar: 'قيمة الفرص',
        display_name_en: 'Pipeline value',
        unit: 'sar',
        source_key: 'crm',
        version: 1,
        status: 'active',
        actual: 500000
      }
    ],
    targets: [
      {
        metric_key: 'monthly_revenue',
        target_value: 150000,
        comparison: 'gte',
        period_start: '2026-11-01',
        period_end: '2026-11-30',
        scenario: 'base'
      }
    ]
  };

  test('answers current governed value with evidence', () => {
    const result = answerNaturalLanguageAnalytics('ما قيمة الإيراد الشهري؟', governance);
    expect(result.status).toBe('active');
    expect(result.intent).toBe('actual');
    expect(result.value).toBe(120000);
    expect(result.matchedMetric.metric_key).toBe('monthly_revenue');
    expect(result.evidence.some(x => x.type === 'current_value')).toBe(true);
    expect(result.semantics).toBe('governed_metric_lookup_no_freeform_generation');
  });

  test('answers target and variance only from active base target', () => {
    const target = answerNaturalLanguageAnalytics('ما الهدف للإيراد الشهري؟', governance);
    expect(target.status).toBe('active');
    expect(target.intent).toBe('target');
    expect(target.value).toBe(150000);

    const variance = answerNaturalLanguageAnalytics('ما الفرق عن الهدف للإيراد الشهري؟', governance);
    expect(variance.status).toBe('active');
    expect(variance.intent).toBe('variance');
    expect(variance.value).toBe(-30000);
    expect(variance.evidence.some(x => x.type === 'base_target')).toBe(true);
  });

  test('answers governed source and unit metadata', () => {
    const source = answerNaturalLanguageAnalytics('ما مصدر الإيراد الشهري؟', governance);
    expect(source.intent).toBe('source');
    expect(source.value).toBe('payments');

    const unit = answerNaturalLanguageAnalytics('ما وحدة الإيراد الشهري؟', governance);
    expect(unit.intent).toBe('unit');
    expect(unit.value).toBe('sar');
  });

  test('fails honest when target or metric is unavailable', () => {
    const missingTarget = answerNaturalLanguageAnalytics('ما هدف قيمة الفرص؟', governance);
    expect(missingTarget.status).toBe('unknown');
    expect(missingTarget.answer).toBe('UNKNOWN');
    expect(missingTarget.reason).toMatch(/No active governed base target/);

    const unknownMetric = answerNaturalLanguageAnalytics('كم عدد الموظفين؟', governance);
    expect(unknownMetric.status).toBe('unknown');
    expect(unknownMetric.answer).toBe('UNKNOWN');
    expect(unknownMetric.evidence).toEqual([]);
  });

  test('does not use freeform generation and rejects empty or oversized questions', () => {
    expect(answerNaturalLanguageAnalytics('', governance).status).toBe('unknown');
    expect(answerNaturalLanguageAnalytics('x'.repeat(501), governance).reason).toBe('question too long');
  });
});
