const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const script = path.join(
  root,
  'scripts/filter-geonames-safe-candidates.js'
);

describe('GeoNames safe candidate filter', () => {
  test('keeps only direct one-to-one source/canonical matches', () => {
    const dir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'geo-safe-')
    );

    const cities = path.join(dir, 'cities.json');
    const source = path.join(dir, 'source.ndjson');
    const output = path.join(dir, 'safe.ndjson');
    const report = path.join(dir, 'report.json');

    fs.writeFileSync(
      cities,
      JSON.stringify({
        cities: [
          { code: 'SA-01-001', country_code: 'SA', name_ar: 'الرياض', name_en: 'Riyadh' },
          { code: 'SA-02-001', country_code: 'SA', name_ar: 'جدة', name_en: 'Jeddah' },
          { code: 'EG-01-001', country_code: 'EG', name_ar: 'السلام', name_en: 'Al Salam' },
          { code: 'EG-02-001', country_code: 'EG', name_ar: 'السلام', name_en: 'Peace' }
        ]
      })
    );

    const rows = [
      { source_id: '1', country_code: 'SA', name_ar: 'الرياض', name_en: 'Riyadh', canonical_name: 'Riyadh', lat: 24.7, lng: 46.7 },
      { source_id: '2', country_code: 'SA', name_ar: 'جدة', name_en: 'Jeddah', canonical_name: 'Jeddah', lat: 21.5, lng: 39.2 },
      { source_id: '3', country_code: 'SA', name_ar: 'جدة', name_en: 'Jiddah', canonical_name: 'Jiddah', lat: 21.6, lng: 39.1 },
      { source_id: '4', country_code: 'EG', name_ar: 'السلام', name_en: 'Al Salam', canonical_name: 'Al Salam', lat: 30, lng: 31.3 },
      { source_id: '5', country_code: 'SA', name_ar: 'اسم مختلف', name_en: 'Different', canonical_name: 'Different', aliases: [{ alias: 'Riyadh' }], lat: 24.8, lng: 46.8 }
    ];

    fs.writeFileSync(
      source,
      rows.map(row => JSON.stringify(row)).join('\n') + '\n'
    );

    execFileSync(
      process.execPath,
      [
        script,
        '--cities', cities,
        '--source', source,
        '--output', output,
        '--report', report,
        '--max-rows', '10'
      ],
      { cwd: root }
    );

    const safe = fs
      .readFileSync(output, 'utf8')
      .trim()
      .split('\n')
      .map(JSON.parse);

    const summary = JSON.parse(
      fs.readFileSync(report, 'utf8')
    );

    expect(safe.map(row => row.source_id)).toEqual(['1']);
    expect(summary.safe_rows).toBe(1);
    expect(summary.rejected.ambiguous_source_key).toBe(2);
    expect(summary.rejected.ambiguous_city_key).toBe(1);
    expect(summary.source_rows).toBe(5);
  });
});
