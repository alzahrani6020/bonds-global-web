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
    expect(promote).toContain("alias.language || 'und'");
    expect(legacy).toContain('ingest-local-geo-dataset.js');
    expect(legacy).not.toContain('insert into public.geo_places');
  });

  test('requires explicit write opt-in for staging, reconciliation, ADM1 linking and promotion', () => {
    const linkAdmin1 = read('scripts/link-local-geonames-admin1.js');
    const promote = read('scripts/promote-local-geo-run.js');
    const reconcile = read('scripts/reconcile-local-geo-run.js');
    const ingest = read('scripts/ingest-local-geo-dataset.js');

    const stage = read('scripts/stage-local-geo-dataset.js');
    expect(stage).toContain("process.env.GEO_STAGE_APPLY === '1'");
    expect(stage).toContain("status: 'planned_only'");
    expect(stage).toContain("DATABASE_URL is required when GEO_STAGE_APPLY=1");
    expect(reconcile).toContain("process.env.GEO_RECONCILE_APPLY === '1'");
    expect(reconcile).toContain('Reconciliation requires GEO_RECONCILE_APPLY=1');
    expect(linkAdmin1).toContain("process.env.GEO_ADMIN1_APPLY === '1'");
    expect(linkAdmin1).toContain("status: 'planned_only'");
    expect(linkAdmin1).toContain("blocked_reason: 'unresolved_admin1_rows'");
    expect(linkAdmin1).toContain("nextval('public.geo_admin_area_source_links_id_seq')");
    expect(promote).toContain("process.env.GEO_PROMOTE_APPLY === '1'");
    expect(promote).toContain('Promotion requires GEO_PROMOTE_APPLY=1');
    expect(ingest).toContain('GEO_ADMIN1_APPLY=1, GEO_STAGE_APPLY=1, GEO_RECONCILE_APPLY=1 and GEO_PROMOTE_APPLY=1');
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
  test('exact-name coordinate enrichment requires deterministic provider ADM1 identity', () => {
    const reconcile = read('scripts/reconcile-local-geo-run.js');
    const promote = read('scripts/promote-local-geo-run.js');

    expect(reconcile).toContain('providerAdmin1Code');
    expect(reconcile).toContain('source_admin_code=$3');
    expect(reconcile).toContain("reason: 'exact_name_admin1_identity'");
    expect(reconcile).toContain("decision = 'auto_match'");
    expect(reconcile).toContain('chosen.canonical.admin1_id === mappedAdmin1Id');
    expect(reconcile).toContain('adminScore = 100');

    expect(promote).toContain('admin1MapKey');
    expect(promote).toContain("country + '.' + code");
    expect(promote).not.toContain("row.source_code + ':' + row.country_code + ':' + row.admin1_code");
  });

  test('rollback requires explicit write opt-in and never deletes existing canonical places', () => {
    const rollback = read('scripts/rollback-local-geo-run.js');
    expect(rollback).toContain("process.env.GEO_ROLLBACK_APPLY === '1'");
    expect(rollback).toContain('Rollback requires GEO_ROLLBACK_APPLY=1');
    expect(rollback).toContain("row.action !== 'created_canonical'");
    expect(rollback).toContain('blocked_due_to_later_provenance');
    expect(rollback).toContain('set is_active=false');
    expect(rollback).not.toMatch(/delete from public\.geo_places/i);
  });

});
