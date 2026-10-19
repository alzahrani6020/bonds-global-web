const fs = require('fs');
const path = require('path');
const { normalizeText, normalizeKey, haversineMeters, scoreCandidate } = require('../../lib/geo/normalization');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Governed geo ingestion architecture', () => {
  test('separates raw staging from canonical geography', () => {
    const migration = read('supabase/migrations/20261020031000_geo_ingestion_architecture.sql');
    const stage = read('scripts/stage-local-geo-dataset.js');
    const promote = read('scripts/promote-local-geo-run.js');
    const legacy = read('scripts/load-local-geo-dataset.js');

    expect(migration).toContain('create schema if not exists geo_ingest');
    expect(migration).toContain('geo_ingest.raw_places');
    expect(migration).toContain('geo_ingest.match_candidates');
    expect(migration).toContain('geo_ingest.quality_results');
    expect(migration).toContain('public.geo_place_source_links');
    expect(stage).toContain('geo_ingest.raw_places');
    expect(stage).not.toContain('insert into public.geo_places');
    expect(promote).toContain('insert into public.geo_places');
    expect(promote).toContain('geo_place_source_links');
    expect(legacy).toContain('ingest-local-geo-dataset.js');
    expect(legacy).not.toContain('insert into public.geo_places');
  });

  test('requires quality gates before promotion', () => {
    const migration = read('supabase/migrations/20261020031000_geo_ingestion_architecture.sql');
    const promote = read('scripts/promote-local-geo-run.js');
    expect(migration).toContain('coordinate_coverage');
    expect(migration).toContain('unique_source_identity');
    expect(migration).toContain('non_empty_dataset');
    expect(promote).toContain('Promotion blocked by quality gates');
    expect(promote).toContain("decision in ('auto_match','new_canonical')");
    expect(promote).not.toContain("decision in ('auto_match','new_canonical','review')");
  });

  test('normalization and candidate scoring are deterministic', () => {
    expect(normalizeText('  مَكّة   المكرمة  ')).toBe('مكه المكرمه');
    expect(normalizeKey('جدة')).toBe('جده');
    expect(Math.round(haversineMeters(24.7136, 46.6753, 24.7136, 46.6753))).toBe(0);

    const raw = {
      source_code: 'geonames_dump',
      source_id: '1',
      name_ar: 'الرياض',
      lat: 24.7136,
      lng: 46.6753
    };
    const exactSource = scoreCandidate(raw, {
      source_code: 'geonames_dump',
      source_id: '1',
      name_ar: 'Riyadh',
      lat: 0,
      lng: 0
    });
    expect(exactSource).toEqual(expect.objectContaining({
      matchType: 'source_identity',
      score: 100,
      decision: 'auto_match'
    }));

    const spatialName = scoreCandidate(raw, {
      source_code: 'bonds_legacy',
      source_id: 'x',
      name_ar: 'الرياض',
      lat: 24.7137,
      lng: 46.6754
    });
    expect(spatialName.decision).toBe('auto_match');
    expect(spatialName.matchType).toBe('name_and_distance');
  });
});
