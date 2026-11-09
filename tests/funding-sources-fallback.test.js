/**
 * @jest-environment node
 */

require('../scripts/funding-sources-fallback.js');

describe('funding sources fallback catalog', () => {
  const rows = global.BONDS_FUNDING_FALLBACK_SOURCES;
  const ARAB_LEAGUE = ['AE', 'BH', 'DJ', 'DZ', 'EG', 'IQ', 'JO', 'KM', 'KW', 'LB', 'LY', 'MA', 'MR', 'OM', 'PS', 'QA', 'SA', 'SD', 'SO', 'SY', 'TN', 'YE'];
  const CURRENCY = {
    SA: 'SAR', AE: 'AED', EG: 'EGP', JO: 'JOD', KW: 'KWD', QA: 'QAR', BH: 'BHD', OM: 'OMR',
    MA: 'MAD', TN: 'TND', DZ: 'DZD', IQ: 'IQD', LB: 'USD', LY: 'LYD', SD: 'SDG', YE: 'YER',
    PS: 'USD', SY: 'SYP', MR: 'MRU', SO: 'USD', DJ: 'DJF', KM: 'KMF'
  };

  test('covers all 22 Arab League countries', () => {
    const countries = [...new Set(rows.map((row) => row.country_code))].filter((code) => code !== 'all').sort();
    expect(countries).toEqual(ARAB_LEAGUE);
    ARAB_LEAGUE.forEach((code) => {
      expect(rows.filter((row) => row.country_code === code).length).toBeGreaterThanOrEqual(1);
    });
  });

  test('includes a substantial verified bank directory', () => {
    const banks = rows.filter((row) => row.type === 'bank');
    expect(banks.length).toBeGreaterThanOrEqual(300);
    expect(rows.length).toBeGreaterThanOrEqual(350);
    expect(rows.filter((row) => row.country_code === 'all').length).toBeGreaterThanOrEqual(14);
    expect(rows.filter((row) => row.country_code === 'AE' && row.type === 'bank').length).toBeGreaterThanOrEqual(60);
    expect(rows.filter((row) => row.country_code === 'EG' && row.type === 'bank').length).toBeGreaterThanOrEqual(36);
    expect(rows.filter((row) => row.country_code === 'SA' && row.type === 'bank').length).toBeGreaterThanOrEqual(38);
  });

  test('Jordan government programmes use JOD not SAR', () => {
    const jordanGov = rows.filter((row) => row.country_code === 'JO' && row.type === 'government_program');
    expect(jordanGov.length).toBeGreaterThanOrEqual(1);
    expect(jordanGov.every((row) => row.currency === 'JOD')).toBe(true);
  });

  test('does not mix UAE sources with SAR', () => {
    const ae = rows.filter((row) => row.country_code === 'AE');
    expect(ae.length).toBeGreaterThan(0);
    expect(ae.every((row) => row.currency === 'AED')).toBe(true);
  });

  test('keeps unique ids, https websites and matching currencies', () => {
    const ids = rows.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    rows.forEach((row) => {
      expect(row.website).toMatch(/^https:\/\//);
      expect(['bank', 'fund', 'investor', 'government_program']).toContain(row.type);
      if (row.country_code === 'all') {
        expect(row.currency).toBe('USD');
        return;
      }
      if (row.type === 'investor' && row.currency === 'USD') return;
      expect(row.currency).toBe(CURRENCY[row.country_code]);
    });
  });

  test('replaces abolished Oman Rafd Fund with Riyada', () => {
    expect(rows.some((row) => /rafd/i.test(row.name_en + row.website))).toBe(false);
    expect(rows.some((row) => row.country_code === 'OM' && /Riyada|SME Development Authority/i.test(row.name_en))).toBe(true);
  });

  test('drops closed or merged banks and keeps successor names', () => {
    const names = rows.map((row) => row.name_en);
    expect(names).not.toContain('Bank Audi Egypt');
    expect(names).not.toContain('Ahli United Bank Egypt');
    expect(names).not.toContain('Egyptian Arab Land Bank Jordan');
    expect(names).not.toContain('HSBC Oman');
    expect(names).toContain('KFH Egypt');
    expect(names).toContain('HSBC Bank Middle East — Oman Branch');
    expect(names).toContain('BANK NXT');
  });

  test('includes active Arab government support programmes', () => {
    const gov = rows.filter((row) => row.type === 'government_program');
    expect(gov.length).toBeGreaterThanOrEqual(30);
    const byCode = {};
    gov.forEach((row) => {
      byCode[row.country_code] = (byCode[row.country_code] || 0) + 1;
    });
    ['SA', 'AE', 'EG', 'JO', 'KW', 'QA', 'BH', 'OM', 'MA', 'TN', 'DZ', 'IQ', 'PS', 'YE'].forEach((code) => {
      expect(byCode[code] || 0).toBeGreaterThanOrEqual(1);
    });
    expect(rows.some((row) => row.name_en === 'ANGEM')).toBe(true);
    expect(rows.some((row) => row.name_en === 'FGAR')).toBe(true);
    expect(rows.some((row) => row.name_en === 'National SME Programme')).toBe(true);
    expect(rows.some((row) => /Kafalah Program/i.test(row.name_en))).toBe(true);
    const kafalat = rows.find((row) => row.name_en === 'Kafalat');
    expect(kafalat).toBeTruthy();
    expect(kafalat.eligibility_en).toMatch(/not currently open/i);
  });

  test('regional DFIs include verified HQ city and office footprint', () => {
    const isdb = rows.find((row) => row.id === 'fs-reg-isdb');
    expect(isdb).toBeTruthy();
    expect(isdb.hq_en).toMatch(/Jeddah/i);
    expect(isdb.offices_en).toMatch(/Cairo/i);
    expect(isdb.offices_en).toMatch(/Rabat/i);
    expect(isdb.presence_ar).toBeTruthy();
    const badea = rows.find((row) => row.id === 'fs-reg-badea');
    expect(badea.hq_en).toMatch(/Khartoum/i);
    expect(badea.offices_en).toMatch(/Riyadh/i);
    const amf = rows.find((row) => row.id === 'fs-reg-amf');
    expect(amf.hq_en).toMatch(/Abu Dhabi/i);
    rows.filter((row) => row.country_code === 'all').forEach((row) => {
      expect(row.hq_ar).toBeTruthy();
      expect(row.hq_en).toBeTruthy();
      expect(row.presence_ar).toBeTruthy();
      expect(row.offices_ar).toBeTruthy();
    });
  });

  test('Arabic search without hamza finds Al Ahli and SNB names', () => {
    function normalizeSearch(value) {
      return String(value || '')
        .toLowerCase()
        .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
        .replace(/[إأآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .replace(/ء/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    }
    const q = normalizeSearch('البنك الاهلي');
    const hits = rows.filter((row) => normalizeSearch([row.name_ar, row.name_en].join(' ')).includes(q));
    expect(hits.length).toBeGreaterThanOrEqual(5);
    expect(hits.some((row) => row.name_en === 'Saudi National Bank (SNB)')).toBe(true);
    expect(hits.some((row) => /Alahli|Al Ahli|National Bank/i.test(row.name_en))).toBe(true);
  });
});
