const { buildBoardPack } = require('../../lib/analytics/board-pack');

describe('Board Pack composer', () => {
  test('builds deterministic board pack from governed metrics and base targets', () => {
    const result = buildBoardPack({
      asOfDate: '2026-11-01',
      metrics: [
        { metric_key: 'monthly_revenue', display_name_ar: 'الإيراد الشهري', actual: 120000 },
        { metric_key: 'pipeline_value', display_name_ar: 'قيمة الفرص', actual: 500000 }
      ],
      targets: [
        { metric_key: 'monthly_revenue', target_value: 100000, scenario: 'base' },
        { metric_key: 'pipeline_value', target_value: 600000, scenario: 'upside' }
      ],
      alertEvaluations: [
        { id: 'a1', name: 'Revenue alert', metricKey: 'monthly_revenue', severity: 'high', triggered: true }
      ],
      businessHealth: { score: 78, label: 'healthy' }
    }, {
      actions: [{ id: 'x1', title: 'Follow up', status: 'open', due_at: '2026-11-10' }],
      decisions: [{ id: 'd1', title: 'Invest', status: 'approved', confidence: 'high' }],
      scenarios: [{ id: 's1', name: 'Base 2027', scenario_type: 'forecast', confidence: 'medium', outputs: {} }]
    });

    expect(result.generated).toBe(true);
    expect(result.status).toBe('active');
    expect(result.engine).toBe('management_reporting');
    expect(result.methodology).toBe('deterministic_governed_board_pack_no_ai');
    expect(result.pack.kpis).toHaveLength(2);
    expect(result.pack.kpis.find(x => x.code === 'monthly_revenue').target).toBe(100000);
    expect(result.pack.kpis.find(x => x.code === 'pipeline_value').target).toBeNull();
    expect(result.pack.risks).toHaveLength(1);
    expect(result.pack.actions_required).toHaveLength(1);
    expect(result.pack.decisions).toHaveLength(1);
    expect(result.pack.scenarios).toHaveLength(1);
  });

  test('fails honest when no governed actual metric is available', () => {
    const result = buildBoardPack({
      metrics: [{ metric_key: 'monthly_revenue', display_name_ar: 'الإيراد', actual: null }],
      targets: []
    }, {});

    expect(result.generated).toBe(false);
    expect(result.status).toBe('unknown');
    expect(result.engine).toBe('management_reporting');
    expect(result.requiredInputs).toContain('actual');
  });

  test('only triggered evaluated alerts become board risks', () => {
    const result = buildBoardPack({
      metrics: [{ metric_key: 'monthly_revenue', display_name_ar: 'الإيراد', actual: 100 }],
      targets: [],
      alertEvaluations: [
        { id: 'a1', name: 'Triggered', triggered: true, severity: 'critical' },
        { id: 'a2', name: 'Not triggered', triggered: false, severity: 'warning' },
        { id: 'a3', name: 'Unknown', triggered: null, severity: 'warning' }
      ]
    }, {});

    expect(result.pack.risks.map(r => r.title)).toEqual(['Triggered']);
  });
});
