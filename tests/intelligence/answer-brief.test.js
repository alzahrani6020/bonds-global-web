'use strict';

const { researchTopic, chooseLead } = require('../../lib/intelligence/answer-brief');

describe('bonds answer brief', () => {
  test('leads with the current dated sentence and keeps the source', () => {
    const report = researchTopic('وزير الطاقة', [{
      id: 'wiki',
      title: 'عبد العزيز بن سلمان آل سعود',
      publisher: 'ar.wikipedia.org',
      kind: 'reference',
      text: 'وزارة الطاقة جهة حكومية. الأمير عبد العزيز بن سلمان هو وزير الطاقة السعودي منذ سبتمبر 2019.'
    }]);

    expect(report.sources).toHaveLength(1);
    expect(report.facts.length).toBeGreaterThan(0);
    const lead = chooseLead(report.facts.map(fact => fact.claim));
    expect(lead).toContain('منذ');
    expect(lead).toContain('2019');
    expect(report.open_questions).not.toContain('لا توجد صفحة ذات صلة بهذا السؤال.');
  });

  test('records an open question when the page has no extractable sentence and no topic overlap', () => {
    const report = researchTopic('طلال حسن الزهراني', []);
    expect(report.facts).toEqual([]);
    expect(report.open_questions).toContain('لا توجد صفحة ذات صلة بهذا السؤال.');
  });

  test('prefers a current sentence over an earlier definition', () => {
    const lead = chooseLead([
      'وزارة الطاقة هي الجهة المختصة بقطاع الطاقة.',
      'الأمير عبد العزيز بن سلمان هو وزير الطاقة منذ سبتمبر 2019.'
    ]);
    expect(lead).toContain('منذ سبتمبر 2019');
  });
});
