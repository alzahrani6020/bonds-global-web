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
      countryCode: 'XX',
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


  test('Bahrain applies 0% outside oil and gas and 46% to oil/gas activity', () => {
    const standard = Fiscal.calculate({
      countryCode: 'BH',
      companyType: 'foreign_100',
      annualTaxableIncome: 1000000,
      activityType: 'standard'
    });
    expect(standard.mode).toBe('automatic');
    expect(standard.corporateIncomeTaxRate).toBe(0);
    expect(standard.annualIncomeTaxAmount).toBe(0);

    const oilGas = Fiscal.calculate({
      countryCode: 'BH',
      companyType: 'foreign_100',
      annualTaxableIncome: 1000000,
      activityType: 'oil_hydrocarbon'
    });
    expect(oilGas.corporateIncomeTaxRate).toBe(46);
    expect(oilGas.annualIncomeTaxAmount).toBeCloseTo(460000, 5);
  });

  test('Kuwait applies 15% only to the taxable foreign corporate share in the simplified profile', () => {
    const mixed = Fiscal.calculate({
      countryCode: 'KW',
      companyType: 'mixed',
      foreignOwnershipPct: 40,
      annualTaxableIncome: 1000000
    });
    expect(mixed.mode).toBe('automatic');
    expect(mixed.localOwnershipPct).toBe(60);
    expect(mixed.taxableForeignShare).toBeCloseTo(400000, 5);
    expect(mixed.corporateIncomeTaxRate).toBe(15);
    expect(mixed.annualIncomeTaxAmount).toBeCloseTo(60000, 5);

    const local = Fiscal.calculate({
      countryCode: 'KW',
      companyType: 'local_100',
      annualTaxableIncome: 1000000
    });
    expect(local.annualIncomeTaxAmount).toBe(0);
  });


  test('Egypt applies the 22.5% standard legal-person income-tax rate', () => {
    const r = Fiscal.calculate({
      countryCode: 'EG',
      companyType: 'local_100',
      annualTaxableIncome: 1000000
    });
    expect(r.mode).toBe('automatic');
    expect(r.corporateIncomeTaxRate).toBe(22.5);
    expect(r.annualIncomeTaxAmount).toBeCloseTo(225000, 5);
    expect(r.annualZakatAmount).toBe(0);
  });

  test('Türkiye applies 25% standard and 30% only to the explicit special-sector profile', () => {
    const standard = Fiscal.calculate({
      countryCode: 'TR',
      companyType: 'local_100',
      annualTaxableIncome: 1000000,
      activityType: 'standard'
    });
    expect(standard.mode).toBe('automatic');
    expect(standard.corporateIncomeTaxRate).toBe(25);
    expect(standard.annualIncomeTaxAmount).toBeCloseTo(250000, 5);

    const special = Fiscal.calculate({
      countryCode: 'TR',
      companyType: 'local_100',
      annualTaxableIncome: 1000000,
      activityType: 'financial_special'
    });
    expect(special.corporateIncomeTaxRate).toBe(30);
    expect(special.annualIncomeTaxAmount).toBeCloseTo(300000, 5);
  });


  test('Jordan applies verified sector-specific legal-person income-tax rates', () => {
    expect(Fiscal.calculate({ countryCode: 'JO', annualTaxableIncome: 1000000, activityType: 'standard' }).corporateIncomeTaxRate).toBe(20);
    expect(Fiscal.calculate({ countryCode: 'JO', annualTaxableIncome: 1000000, activityType: 'industrial' }).corporateIncomeTaxRate).toBe(14);
    expect(Fiscal.calculate({ countryCode: 'JO', annualTaxableIncome: 1000000, activityType: 'regulated_special' }).corporateIncomeTaxRate).toBe(24);
    expect(Fiscal.calculate({ countryCode: 'JO', annualTaxableIncome: 1000000, activityType: 'bank' }).corporateIncomeTaxRate).toBe(35);
  });

  test('Morocco 2026 applies 20%, 35% threshold and 40% financial-special profiles', () => {
    const standard = Fiscal.calculate({ countryCode: 'MA', annualTaxableIncome: 50000000, activityType: 'standard' });
    expect(standard.mode).toBe('automatic');
    expect(standard.corporateIncomeTaxRate).toBe(20);
    expect(standard.annualIncomeTaxAmount).toBeCloseTo(10000000, 5);

    const highProfit = Fiscal.calculate({ countryCode: 'MA', annualTaxableIncome: 100000000, activityType: 'standard' });
    expect(highProfit.corporateIncomeTaxRate).toBe(35);

    const financial = Fiscal.calculate({ countryCode: 'MA', annualTaxableIncome: 1000000, activityType: 'financial_special' });
    expect(financial.corporateIncomeTaxRate).toBe(40);
  });


  test('Iraq applies 15% standard and 35% only to the foreign-oil-contract profile', () => {
    const standard = Fiscal.calculate({ countryCode: 'IQ', annualTaxableIncome: 1000000, activityType: 'standard' });
    expect(standard.corporateIncomeTaxRate).toBe(15);
    expect(standard.annualIncomeTaxAmount).toBeCloseTo(150000, 5);
    const oil = Fiscal.calculate({ countryCode: 'IQ', annualTaxableIncome: 1000000, activityType: 'foreign_oil_contract' });
    expect(oil.corporateIncomeTaxRate).toBe(35);
  });

  test('Algeria applies 19%, 23%, and 26% IBS activity profiles', () => {
    expect(Fiscal.calculate({ countryCode: 'DZ', annualTaxableIncome: 1000000, activityType: 'production_goods' }).corporateIncomeTaxRate).toBe(19);
    expect(Fiscal.calculate({ countryCode: 'DZ', annualTaxableIncome: 1000000, activityType: 'construction_tourism' }).corporateIncomeTaxRate).toBe(23);
    expect(Fiscal.calculate({ countryCode: 'DZ', annualTaxableIncome: 1000000, activityType: 'other' }).corporateIncomeTaxRate).toBe(26);
  });


  test('Lebanon applies the 15% capital-company income-tax profile', () => {
    const r = Fiscal.calculate({ countryCode: 'LB', annualTaxableIncome: 1000000 });
    expect(r.mode).toBe('automatic');
    expect(r.corporateIncomeTaxRate).toBe(15);
    expect(r.annualIncomeTaxAmount).toBeCloseTo(150000, 5);
  });

  test('Palestine applies 15% standard and 20% telecom/monopoly profiles', () => {
    const standard = Fiscal.calculate({ countryCode: 'PS', annualTaxableIncome: 1000000, activityType: 'standard' });
    expect(standard.corporateIncomeTaxRate).toBe(15);
    expect(standard.annualIncomeTaxAmount).toBeCloseTo(150000, 5);
    const special = Fiscal.calculate({ countryCode: 'PS', annualTaxableIncome: 1000000, activityType: 'telecom_monopoly' });
    expect(special.corporateIncomeTaxRate).toBe(20);
  });


  test('Tunisia applies 25% only to the standard automatic profile', () => {
    const standard = Fiscal.calculate({ countryCode: 'TN', annualTaxableIncome: 1000000, activityType: 'standard' });
    expect(standard.mode).toBe('automatic');
    expect(standard.corporateIncomeTaxRate).toBe(25);
    expect(standard.annualIncomeTaxAmount).toBeCloseTo(250000, 5);

    const special = Fiscal.calculate({ countryCode: 'TN', annualTaxableIncome: 1000000, activityType: 'special_review', corporateIncomeTaxRate: 35 });
    expect(special.mode).toBe('manual');
    expect(special.corporateIncomeTaxRate).toBe(35);
  });


  test('Sudan applies sector rates and communications uses gross income', () => {
    expect(Fiscal.calculate({ countryCode: 'SD', annualTaxableIncome: 1000000, activityType: 'standard_company' }).corporateIncomeTaxRate).toBe(15);
    expect(Fiscal.calculate({ countryCode: 'SD', annualTaxableIncome: 1000000, activityType: 'industrial' }).corporateIncomeTaxRate).toBe(10);
    expect(Fiscal.calculate({ countryCode: 'SD', annualTaxableIncome: 1000000, activityType: 'agriculture' }).corporateIncomeTaxRate).toBe(0);
    expect(Fiscal.calculate({ countryCode: 'SD', annualTaxableIncome: 1000000, activityType: 'oil_gas' }).corporateIncomeTaxRate).toBe(35);
    const telecom = Fiscal.calculate({ countryCode: 'SD', annualTaxableIncome: 1000000, annualRevenue: 2000000, activityType: 'communications' });
    expect(telecom.taxBaseType).toBe('gross_income');
    expect(telecom.annualIncomeTaxAmount).toBeCloseTo(100000, 5);
  });

  test('Yemen applies verified standard and special-sector rates', () => {
    expect(Fiscal.calculate({ countryCode: 'YE', annualTaxableIncome: 1000000, activityType: 'standard' }).corporateIncomeTaxRate).toBe(20);
    expect(Fiscal.calculate({ countryCode: 'YE', annualTaxableIncome: 1000000, activityType: 'oil_mining_concession' }).corporateIncomeTaxRate).toBe(35);
    expect(Fiscal.calculate({ countryCode: 'YE', annualTaxableIncome: 1000000, activityType: 'mobile' }).corporateIncomeTaxRate).toBe(50);
    expect(Fiscal.calculate({ countryCode: 'YE', annualTaxableIncome: 1000000, activityType: 'international_telecom_tobacco' }).corporateIncomeTaxRate).toBe(35);
    expect(Fiscal.calculate({ countryCode: 'YE', annualTaxableIncome: 1000000, activityType: 'special_review', corporateIncomeTaxRate: 12 }).mode).toBe('manual');
  });

  test('Djibouti applies 25% profit tax subject to turnover minimum', () => {
    const profitDriven = Fiscal.calculate({ countryCode: 'DJ', annualTaxableIncome: 1000000, annualRevenue: 5000000 });
    expect(profitDriven.corporateIncomeTaxRate).toBe(25);
    expect(profitDriven.annualIncomeTaxAmount).toBeCloseTo(250000, 5);
    const minimumDriven = Fiscal.calculate({ countryCode: 'DJ', annualTaxableIncome: 100000, annualRevenue: 20000000 });
    expect(minimumDriven.annualIncomeTaxAmount).toBeCloseTo(200000, 5);
  });

  test('Somalia automates only the verified large-business profile', () => {
    const large = Fiscal.calculate({ countryCode: 'SO', annualTaxableIncome: 1000000, activityType: 'large_business' });
    expect(large.mode).toBe('automatic');
    expect(large.corporateIncomeTaxRate).toBe(15);
    const other = Fiscal.calculate({ countryCode: 'SO', annualTaxableIncome: 1000000, activityType: 'special_review', corporateIncomeTaxRate: 7 });
    expect(other.mode).toBe('manual');
    expect(other.corporateIncomeTaxRate).toBe(7);
  });

  test('Mauritania applies profit tax against regime turnover minimum', () => {
    const normal = Fiscal.calculate({ countryCode: 'MR', annualTaxableIncome: 1000000, annualRevenue: 5000000, activityType: 'normal' });
    expect(normal.corporateIncomeTaxRate).toBe(25);
    expect(normal.annualIncomeTaxAmount).toBeCloseTo(250000, 5);
    const intermediate = Fiscal.calculate({ countryCode: 'MR', annualTaxableIncome: 100000, annualRevenue: 10000000, activityType: 'intermediate' });
    expect(intermediate.annualIncomeTaxAmount).toBeCloseTo(250000, 5);
  });

  test('Comoros applies 35% profit tax subject to 1.5% turnover minimum', () => {
    const r = Fiscal.calculate({ countryCode: 'KM', annualTaxableIncome: 100000, annualRevenue: 5000000, activityType: 'standard_private' });
    expect(r.corporateIncomeTaxRate).toBe(35);
    expect(r.annualIncomeTaxAmount).toBeCloseTo(75000, 5);
  });

  test('Syria and Libya remain explicit manual profiles rather than inferred rates', () => {
    expect(Fiscal.getProfile('SY').automatic).toBe(false);
    expect(Fiscal.getProfile('LY').automatic).toBe(false);
    expect(Fiscal.calculate({ countryCode: 'SY', annualTaxableIncome: 1000000, corporateIncomeTaxRate: 18 }).mode).toBe('manual');
    expect(Fiscal.calculate({ countryCode: 'LY', annualTaxableIncome: 1000000, corporateIncomeTaxRate: 20 }).mode).toBe('manual');
  });

  test('profiles expose verified VAT metadata where confirmed', () => {
    expect(Fiscal.getProfile('AE').standardVatRate).toBe(5);
    expect(Fiscal.getProfile('OM').standardVatRate).toBe(5);
    expect(Fiscal.getProfile('BH').standardVatRate).toBe(10);
    expect(Fiscal.getProfile('EG').standardVatRate).toBe(14);
    expect(Fiscal.getProfile('TR').standardVatRate).toBe(20);
    expect(Fiscal.getProfile('JO').standardVatRate).toBe(16);
    expect(Fiscal.getProfile('MA').standardVatRate).toBe(20);
    expect(Fiscal.getProfile('DZ').standardVatRate).toBe(19);
    expect(Fiscal.getProfile('IQ').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('LB').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('PS').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('TN').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('SD').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('YE').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('DJ').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('SO').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('MR').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('KM').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('SY').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('LY').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('KW').standardVatRate).toBeNull();
    expect(Fiscal.getProfile('QA').standardVatRate).toBeNull();
  });
});
