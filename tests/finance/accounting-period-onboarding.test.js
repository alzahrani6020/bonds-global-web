const {
  buildMonthlyAccountingPeriods,
  ensureMonthlyAccountingPeriods
} = require('../../lib/finance/accounting/accounting-period-onboarding');

function fakePeriodDb(existingRows = []) {
  const db = {
    inserted: [],
    from(table) {
      if (table !== 'accounting_periods') throw new Error('unexpected table');
      return {
        select() { return this; },
        eq() { return this; },
        order() { return Promise.resolve({ data: existingRows, error: null }); },
        insert(rows) {
          db.inserted = rows;
          return {
            select: async () => ({
              data: rows.map((row,index)=>({ id:'created-'+index, ...row })),
              error: null
            })
          };
        }
      };
    }
  };
  return db;
}

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

  test('completes a fiscal year when one exact month already exists',async()=>{
    const db=fakePeriodDb([{
      id:'existing-october',
      period_code:'2026-10',
      starts_on:'2026-10-01',
      ends_on:'2026-10-31',
      status:'open'
    }]);

    const result=await ensureMonthlyAccountingPeriods(db,{
      accountingEntityId:'entity-1',
      actorUserId:'user-1',
      startsOn:'2026-01-01',
      endsOn:'2026-12-31'
    });

    expect(result.state).toBe('completed');
    expect(result.period_count).toBe(12);
    expect(result.existing_count).toBe(1);
    expect(result.created_count).toBe(11);
    expect(db.inserted).toHaveLength(11);
    expect(db.inserted.some(row=>row.period_code==='2026-10')).toBe(false);
    expect(result.periods).toHaveLength(12);
  });

  test('replays when every requested period already exists',async()=>{
    const existing=buildMonthlyAccountingPeriods('2026-10-01','2026-11-30')
      .map((row,index)=>({id:'existing-'+index,...row}));
    const db=fakePeriodDb(existing);
    const result=await ensureMonthlyAccountingPeriods(db,{
      accountingEntityId:'entity-1',
      actorUserId:'user-1',
      startsOn:'2026-10-01',
      endsOn:'2026-11-30'
    });

    expect(result.state).toBe('replayed');
    expect(result.created_count).toBe(0);
    expect(result.existing_count).toBe(2);
    expect(db.inserted).toHaveLength(0);
  });

  test('rejects a genuinely conflicting overlapping period',async()=>{
    const db=fakePeriodDb([{
      id:'bad-october',
      period_code:'2026-10',
      starts_on:'2026-10-02',
      ends_on:'2026-10-31',
      status:'open'
    }]);

    await expect(ensureMonthlyAccountingPeriods(db,{
      accountingEntityId:'entity-1',
      actorUserId:'user-1',
      startsOn:'2026-01-01',
      endsOn:'2026-12-31'
    })).rejects.toThrow('ACCOUNTING_PERIOD_RANGE_CONFLICT');
    expect(db.inserted).toHaveLength(0);
  });
});
