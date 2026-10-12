'use strict';

const {
  canonicalizeCities,
  canonicalizeActivities,
  buildCountryCatalog
} = require('../../lib/catalog/canonical-registry');

describe('canonical catalog registry', () => {
  test('merges duplicate city aliases within the same country and keeps the strongest record', () => {
    const cities = canonicalizeCities([
      {
        id: 'legacy',
        code: 'AE-98-001',
        country_code: 'AE',
        name_ar: 'أبو ظبي',
        name_en: 'Abu Dhabi',
        region: 'الإمارات',
        population: 1483000,
        purchasing_power_index: null,
        lat: null,
        lng: null
      },
      {
        id: 'modern',
        code: 'AE-02-001',
        country_code: 'AE',
        name_ar: 'أبوظبي',
        name_en: 'Abu Dhabi',
        region: 'إمارة أبوظبي',
        population: 1600000,
        purchasing_power_index: 100,
        lat: null,
        lng: null
      }
    ]);

    expect(cities).toHaveLength(1);
    expect(cities[0].canonical_code).toBe('AE-02-001');
    expect(cities[0].alias_codes).toContain('AE-98-001');
    expect(cities[0].warnings).toContain('duplicate_city_aliases');
  });

  test('does not merge same city name across different countries', () => {
    const cities = canonicalizeCities([
      { id: '1', code: 'AA-01-001', country_code: 'AA', name_ar: 'السلام', name_en: 'Salam' },
      { id: '2', code: 'BB-01-001', country_code: 'BB', name_ar: 'السلام', name_en: 'Salam' }
    ]);
    expect(cities).toHaveLength(2);
  });

  test('collapses repeated generic activity names and preserves all activity aliases', () => {
    const activities = canonicalizeActivities([
      {
        code: 'sector_a_software_activity',
        name_ar: 'نشاط البرمجيات',
        name_en: 'Software Activity',
        is_active: true,
        sector_code: 'sector_a',
        sub_sector_code: 'software'
      },
      {
        code: 'sector_b_software_activity',
        name_ar: 'نشاط البرمجيات',
        name_en: 'Software Activity',
        is_active: true,
        sector_code: 'sector_b',
        sub_sector_code: 'software'
      }
    ]);

    expect(activities).toHaveLength(1);
    expect(activities[0].name_ar).toBe('البرمجيات');
    expect(activities[0].aliases).toEqual(
      expect.arrayContaining(['sector_a_software_activity', 'sector_b_software_activity'])
    );
    expect(activities[0].alias_count).toBe(1);
  });

  test('country catalog remains independent of current city filtering', () => {
    const countries = buildCountryCatalog([
      { id: '1', code: 'SA-01-001', country_code: 'SA', name_ar: 'الرياض', name_en: 'Riyadh' }
    ]);
    expect(countries.find(c => c.code === 'SA').recordStatus).toBe('available');
    expect(countries.find(c => c.code === 'QA').recordStatus).toBe('no_cities');
    expect(countries.length).toBeGreaterThan(20);
  });
});
