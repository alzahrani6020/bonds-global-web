'use strict';

const { resolveOpportunityYear } = require('../../v3/lib/opportunity-query');

describe('opportunity query year resolution', () => {
  test('uses current year for year=latest instead of NaN', () => {
    expect(resolveOpportunityYear('latest', 2026)).toBe(2026);
  });

  test('uses current year when year is omitted or invalid', () => {
    expect(resolveOpportunityYear(null, 2026)).toBe(2026);
    expect(resolveOpportunityYear('not-a-year', 2026)).toBe(2026);
  });

  test('preserves an explicit numeric year', () => {
    expect(resolveOpportunityYear('2024', 2026)).toBe(2024);
  });
});
