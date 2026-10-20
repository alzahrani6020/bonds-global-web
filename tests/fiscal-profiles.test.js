const Fiscal = require('../calculators/fiscal-profiles.js');

describe('BondsFiscal Saudi Arabia', () => {
  test('100% Saudi company: Zakat only, no income tax on Saudi ownership', () => {
    const r = Fiscal.calculate({
      countryCode: 'SA',
      companyType: 'saudi_100',
      financialYearDays: 354,
      annualTaxableIncome: 1000000,
      annualZakatBase: 500000,
      adjustedNetProfit: 100000
    });
    expect(r.saudiOwnershipPct).toBe(100);
    expect(r.foreignOwnershipPct).toBe(0);
    expect(r.annualIncomeTaxAmount).toBe(0);
    expect(r.dayBasedZakatRate).toBeCloseTo(2.5, 8);
    expect(r.annualZakatAmount).toBeCloseTo(12500, 5);
  });

  test('365-day year uses day-based rate for base components but 2.5% for adjusted net profit', () => {
    const r = Fiscal.calculate({
      countryCode: 'SA',
      companyType: 'saudi_100',
      financialYearDays: 365,
      annualZakatBase: 2500000,
      adjustedNetProfit: 900000
    });
    expect(r.dayBasedZakatRate).toBeCloseTo(2.5 * 365 / 354, 8);
    expect(r.zakatOnBaseComponents).toBeCloseTo(1600000 * (2.5 * 365 / 354) / 100, 5);
    expect(r.zakatOnAdjustedNetProfit).toBeCloseTo(900000 * 0.025, 5);
    expect(r.annualZakatAmount).toBeCloseTo(
      1600000 * (2.5 * 365 / 354) / 100 + 900000 * 0.025,
      5
    );
  });

  test('mixed Saudi/foreign company splits Zakat and income tax by ownership', () => {
    const r = Fiscal.calculate({
      countryCode: 'SA',
      companyType: 'mixed',
      foreignOwnershipPct: 40,
      financialYearDays: 354,
      annualTaxableIncome: 1000000,
      annualZakatBase: 500000,
      adjustedNetProfit: 100000
    });
    expect(r.saudiOwnershipPct).toBe(60);
    expect(r.foreignOwnershipPct).toBe(40);
    expect(r.foreignTaxableIncome).toBeCloseTo(400000, 5);
    expect(r.corporateIncomeTaxRate).toBe(20);
    expect(r.annualIncomeTaxAmount).toBeCloseTo(80000, 5);
    expect(r.zakatEligibleBase).toBeCloseTo(300000, 5);
    expect(r.annualZakatAmount).toBeCloseTo(7500, 5);
  });

  test('100% foreign company: standard activity is 20% income tax and no Zakat', () => {
    const r = Fiscal.calculate({
      countryCode: 'SA',
      companyType: 'foreign_100',
      annualTaxableIncome: 1000000,
      annualZakatBase: 500000
    });
    expect(r.annualIncomeTaxAmount).toBeCloseTo(200000, 5);
    expect(r.annualZakatAmount).toBe(0);
  });

  test('Saudi oil/hydrocarbon production rate follows capital-investment bands', () => {
    expect(Fiscal.saudiCorporateIncomeTaxRate('oil_hydrocarbon', 400000000000)).toBe(50);
    expect(Fiscal.saudiCorporateIncomeTaxRate('oil_hydrocarbon', 350000000000)).toBe(65);
    expect(Fiscal.saudiCorporateIncomeTaxRate('oil_hydrocarbon', 250000000000)).toBe(75);
    expect(Fiscal.saudiCorporateIncomeTaxRate('oil_hydrocarbon', 200000000000)).toBe(85);
    expect(Fiscal.saudiCorporateIncomeTaxRate('natural_gas', 1)).toBe(20);
  });

  test('unverified country uses manual corporate-tax rate and does not invent Zakat', () => {
    const r = Fiscal.calculate({
      countryCode: 'AE',
      companyType: 'foreign_100',
      annualTaxableIncome: 1000000,
      corporateIncomeTaxRate: 9
    });
    expect(r.mode).toBe('manual');
    expect(r.annualIncomeTaxAmount).toBeCloseTo(90000, 5);
    expect(r.annualZakatAmount).toBe(0);
  });
});


describe('BondsFiscal verified GCC profiles', () => {
  test('UAE applies 0% up to AED 375,000 and 9% above', () => {
    const r = Fiscal.calculate({
      countryCode: 'AE',
      companyType: 'foreign_100',
      annualTaxableIncome: 1000000
    });
    expect(r.mode).toBe('automatic');
    expect(r.zeroRateThreshold).toBe(375000);
    expect(r.taxableIncomeAtZeroRate).toBe(375000);
    expect(r.taxableIncomeAtStandardRate).toBe(625000);
    expect(r.annualIncomeTaxAmount).toBeCloseTo(56250, 5);
    expect(r.annualZakatAmount).toBe(0);
  });

  test('Qatar mixed ownership taxes only the non-Qatari share at 10%', () => {
    const r = Fiscal.calculate({
      countryCode: 'QA',
      companyType: 'mixed',
      foreignOwnershipPct: 40,
      annualTaxableIncome: 1000000
    });
    expect(r.mode).toBe('automatic');
    expect(r.localOwnershipPct).toBe(60);
    expect(r.foreignOwnershipPct).toBe(40);
    expect(r.taxableForeignShare).toBeCloseTo(400000, 5);
    expect(r.corporateIncomeTaxRate).toBe(10);
    expect(r.annualIncomeTaxAmount).toBeCloseTo(40000, 5);
  });

  test('Qatar 100% local ownership is exempt in the simplified ownership model', () => {
    const r = Fiscal.calculate({
      countryCode: 'QA',
      companyType: 'local_100',
      annualTaxableIncome: 1000000
    });
    expect(r.annualIncomeTaxAmount).toBe(0);
  });

  test('Oman applies 15% standard corporate income tax', () => {
    const r = Fiscal.calculate({
      countryCode: 'OM',
      companyType: 'local_100',
      annualTaxableIncome: 1000000
    });
    expect(r.mode).toBe('automatic');
    expect(r.corporateIncomeTaxRate).toBe(15);
    expect(r.annualIncomeTaxAmount).toBeCloseTo(150000, 5);
  });

  test('Oman applies 3% only when small-enterprise eligibility is explicitly selected', () => {
    const r = Fiscal.calculate({
      countryCode: 'OM',
      companyType: 'local_100',
      annualTaxableIncome: 100000,
      smallEnterprise: true
    });
    expect(r.corporateIncomeTaxRate).toBe(3);
    expect(r.annualIncomeTaxAmount).toBeCloseTo(3000, 5);
  });

  test('Oman oil or gas exploration profile uses 55%', () => {
    const r = Fiscal.calculate({
      countryCode: 'OM',
      companyType: 'foreign_100',
      annualTaxableIncome: 1000000,
      activityType: 'oil_hydrocarbon'
    });
    expect(r.corporateIncomeTaxRate).toBe(55);
    expect(r.annualIncomeTaxAmount).toBeCloseTo(550000, 5);
  });

  test('profiles expose verified VAT metadata where confirmed', () => {
    expect(Fiscal.getProfile('AE').standardVatRate).toBe(5);
    expect(Fiscal.getProfile('OM').standardVatRate).toBe(5);
    expect(Fiscal.getProfile('QA').standardVatRate).toBeNull();
  });
});
