const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Canonical ADM1 geography bootstrap', () => {
  const migration = () => read('supabase/migrations/20261020041000_geo_admin_hierarchy_bootstrap.sql');

  test('seeds canonical ADM1 for all 22 Arab countries without external runtime APIs', () => {
    const sql = migration();
    const countries = [...sql.matchAll(/'BG-ADM1-([A-Z]{2})-[0-9]{2}'/g)].map(m => m[1]);
    expect(new Set(countries).size).toBe(22);
    expect(countries.length).toBe(319);
    expect(sql).toContain("source_code,source_id,confidence,metadata,is_active");
    expect(sql).not.toMatch(/https?:\/\//i);
  });

  test('uses deterministic legacy code, region and unique-name bridges only', () => {
    const sql = migration();
    expect(sql).toContain("'admin1_resolution','legacy_city_code_index'");
    expect(sql).toContain("'admin1_resolution','normalized_unique_legacy_region'");
    expect(sql).toContain("'admin1_resolution','unique_same_country_place_name'");
    expect(sql).toContain("'admin1_resolution','unique_parent_place_region'");
    expect(sql).toContain('c.adm1_matches=1');
  });

  test('unresolved hierarchy becomes a visible data-quality issue instead of a guessed link', () => {
    const sql = migration();
    expect(sql).toContain('public.dq_find_geo_admin_hierarchy');
    expect(sql).toContain("and gp.admin1_id is null");
    expect(sql).toContain("'geo_admin_hierarchy',v_geo_admin");
    expect(sql).toContain("'geo_integrity'");
  });

  test('data quality constraint explicitly permits geo integrity issues', () => {
    const sql = migration();
    expect(sql).toContain('data_quality_issues_check_type_check');
    expect(sql).toContain("'geo_integrity'");
  });

  test('source identity is unique for canonical admin records', () => {
    const sql = migration();
    expect(sql).toContain('uq_geo_admin_source_identity');
    expect(sql).toContain('on public.geo_admin_areas(source_code,source_id)');
  });
});
