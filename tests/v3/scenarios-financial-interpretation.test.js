/**
 * @jest-environment node
 */

const { recommend } = require('../../v3/engine/calculator');

describe('V3 scenario financial interpretation', () => {
  test('explains NPV and IRR against the model discount rate without a fixed profitability threshold', () => {
    const text = recommend({
      assumptions: { discountRate: 0.10 },
      summary: {
        npv: 250000,
        irr: 12.5,
        paybackMonths: 31.4,
        dscr: 1.42
      },
      risk: { score: 37.5, level: 'low' }
    }, {
      market_saturation_score: 52
    });

    expect(text).toContain('القيمة الحالية الصافية (NPV) موجبة');
    expect(text).toContain('معدل العائد الداخلي (IRR) 12.5%');
    expect(text).toContain('يتجاوز معدل الخصم المستخدم 10%');
    expect(text).toContain('فترة استرداد رأس المال المحسوبة 31.4 شهراً');
    expect(text).toContain('نسبة تغطية خدمة الدين (DSCR) المحسوبة 1.42');
    expect(text).toContain('درجة المخاطر المحسوبة 37.5 من 100');
    expect(text).not.toContain('المشروع مربح من الناحية المالية');
  });

  test('reports negative NPV and IRR below the discount rate without claiming the project is unprofitable', () => {
    const text = recommend({
      assumptions: { discountRate: 0.14 },
      summary: {
        npv: -100000,
        irr: 9,
        paybackMonths: 48,
        dscr: 0.93
      },
      risk: { score: 68, level: 'high' }
    });

    expect(text).toContain('القيمة الحالية الصافية (NPV) سالبة');
    expect(text).toContain('أقل من معدل الخصم المستخدم 14%');
    expect(text).not.toContain('المشروع غير مربح');
  });
});
