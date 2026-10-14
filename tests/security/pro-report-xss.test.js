const { buildHTMLReport } = require('../../pro/pro-engine');

describe('Bonds Pro report HTML safety', () => {
  test('escapes user-controlled activity text', () => {
    const html = buildHTMLReport({
      sectorLabel: 'تقنية',
      activity: '<img src=x onerror=alert(1)>',
      score: 80,
      capital: 100000,
      revenue: 20000,
      monthlyProfit: 5000,
      roiMonths: 20,
      annualProfit: 60000,
      sectorRisk: 'متوسط'
    }, {
      verdict: 'جيد',
      summary: 'ملخص',
      recommendations: ['توصية']
    });

    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('escapes recommendation and narrative HTML', () => {
    const html = buildHTMLReport({
      sectorLabel: '<b>قطاع</b>',
      activity: 'نشاط',
      score: 50,
      capital: 1,
      revenue: 1,
      monthlyProfit: -1,
      roiMonths: 0,
      annualProfit: -12,
      sectorRisk: '<script>risk()</script>'
    }, {
      verdict: '<b>حكم</b>',
      summary: '<iframe>summary</iframe>',
      recommendations: ['<svg onload=alert(1)>']
    });

    expect(html).not.toContain('<script>risk()</script>');
    expect(html).not.toContain('<iframe>summary</iframe>');
    expect(html).not.toContain('<svg onload=alert(1)>');
    expect(html).toContain('&lt;b&gt;قطاع&lt;/b&gt;');
  });
});
