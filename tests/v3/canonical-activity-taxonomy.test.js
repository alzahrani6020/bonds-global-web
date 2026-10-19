const fs = require('fs');
const path = require('path');
const { canonicalizeActivities } = require('../../lib/catalog/canonical-registry');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('V3 canonical activity taxonomy', () => {
  test('canonical registry collapses generated semantic duplicates and preserves aliases', () => {
    const rows = [
      { code: 'aviation_security_activity', name_ar: 'نشاط الأمن والحراسة', name_en: 'Security Activity', sector_code: 'aviation', is_active: true },
      { code: 'mining_security_activity', name_ar: 'نشاط الأمن والحراسة', name_en: 'Security Activity', sector_code: 'mining', is_active: true },
      { code: 'retail_activity', name_ar: 'نشاط التجزئة', name_en: 'Retail Activity', sector_code: 'commerce', is_active: true }
    ];

    const result = canonicalizeActivities(rows);
    expect(result).toHaveLength(2);

    const security = result.find(row =>
      (row.aliases || []).includes('aviation_security_activity') &&
      (row.aliases || []).includes('mining_security_activity')
    );
    expect(security).toBeTruthy();
    expect(new Set(security.aliases)).toEqual(new Set([
      'aviation_security_activity',
      'mining_security_activity'
    ]));
    expect(new Set(security.sector_codes)).toEqual(new Set(['aviation', 'mining']));
  });

  test('database migration is additive and persists canonical identity, aliases and applicability', () => {
    const migration = read('v3/supabase/migrations/20261019020000_v3_canonical_activity_taxonomy.sql');

    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.canonical_activities');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.canonical_activity_legacy_aliases');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.canonical_activity_sub_sector_map');
    expect(migration).toContain('CREATE OR REPLACE VIEW public.canonical_activity_catalog');
    expect(migration).toContain('CREATE TRIGGER trg_sync_canonical_activity_from_legacy');

    expect(migration).not.toMatch(/DROP TABLE\s+public\.economic_activities/i);
    expect(migration).not.toMatch(/DELETE\s+FROM\s+public\.economic_activities/i);
    expect(migration).not.toMatch(/UPDATE\s+public\.project_models\s+SET\s+activity_id/i);
  });

  test('all general activity dropdowns use the canonical catalog', () => {
    const opportunityBank = read('v3/opportunity-bank.html');
    const alerts = read('v3/alerts.html');
    const comparison = read('v3/city-comparison.html');
    const intelligence = read('v3/city-intelligence.html');
    const investmentMap = read('v3/investment-map.html');

    expect(opportunityBank).toContain('/investment-taxonomy');
    expect(opportunityBank).toContain("include: 'activities'");

    for (const source of [alerts, comparison, intelligence, investmentMap]) {
      expect(source).toContain('/catalog/activities');
    }

    expect(opportunityBank).not.toContain("fetchJson(API_URL + '/sectors')");
    expect(alerts).not.toContain("fetchJson(API_URL + '/sectors')");
    expect(comparison).not.toContain(".filter(activity => activity.recordStatus === 'complete')");
  });

  test('API resolves canonical codes to every legacy alias for dependent data', () => {
    const api = read('v3/api/index.js');

    expect(api).toContain('async function resolveActivitySelection');
    expect(api).toContain(".from('canonical_activity_catalog')");
    expect(api).toContain(".from('canonical_activity_legacy_aliases')");
    expect(api).toContain("query = query.in('activity_id', activitySelection.ids)");
    expect(api).toContain("marketQuery = marketQuery.in('activity_id', activityIds)");
    expect(api).toContain(".in('activity_id', activitySelection.ids)");
    expect(api).toContain("if (!activityIds.length)");
    expect(api).toContain("activityCodes.map(code => resolveActivitySelection(supabase, code))");
  });

  test('heuristic sector-template taxonomy generation cannot regenerate duplicates', () => {
    const generator = read('v3/scripts/generate-master-data.js');

    expect(generator).toContain('Taxonomy generation skipped');
    expect(generator).not.toContain('const sectorsWithData = new Set');
    expect(generator).not.toContain('const activityCode = `${subCode}_activity`');
    expect(generator).not.toContain('generatedModelCodes');
  });

  test('canonical taxonomy security hardening remains in migration history', () => {
    const hardening = read('v3/supabase/migrations/20261019021000_v3_canonical_activity_taxonomy_hardening.sql');

    expect(hardening).toContain('security_invoker = true');
    expect(hardening).toContain('REVOKE ALL ON FUNCTION public.sync_canonical_activity_from_legacy() FROM PUBLIC');
    expect(hardening).toContain('idx_canonical_activity_sub_sector_source_legacy');
  });
});
