const {
  buildMonthlyAccountingPeriods
} = require('../../lib/finance/accounting/accounting-period-onboarding');

describe('accounting period onboarding',()=>{
  test('builds contiguous calendar-month periods from explicit boundaries',()=>{
    const rows=buildMonthlyAccountingPeriods('2026-01-01','2026-12-31');
    expect(rows).toHaveLength(12);
    expect(rows[0]).toEqual({
      period_code:'2026-01',
      starts_on:'2026-01-01',
      ends_on:'2026-01-31',
      status:'open'
    });
    expect(rows[11]).toEqual({
      period_code:'2026-12',
      starts_on:'2026-12-01',
      ends_on:'2026-12-31',
      status:'open'
    });
  });

  test('supports non-January fiscal years while preserving monthly contiguity',()=>{
    const rows=buildMonthlyAccountingPeriods('2026-04-01','2027-03-31');
    expect(rows).toHaveLength(12);
    expect(rows[0].period_code).toBe('2026-04');
    expect(rows[11].period_code).toBe('2027-03');
  });

  test('rejects non-month-boundary ranges',()=>{
    expect(()=>buildMonthlyAccountingPeriods('2026-01-02','2026-12-31'))
      .toThrow('ACCOUNTING_PERIOD_START_NOT_MONTH_BOUNDARY');
    expect(()=>buildMonthlyAccountingPeriods('2026-01-01','2026-12-30'))
      .toThrow('ACCOUNTING_PERIOD_END_NOT_MONTH_BOUNDARY');
  });

  test('rejects excessive ranges',()=>{
    expect(()=>buildMonthlyAccountingPeriods('2026-01-01','2028-12-31'))
      .toThrow('ACCOUNTING_PERIOD_RANGE_TOO_LARGE');
  });
});
