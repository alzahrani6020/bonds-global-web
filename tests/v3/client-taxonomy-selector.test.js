const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8');

describe('Client taxonomy selectors and proposal queue', () => {
  test('Arabic and English business activity forms use country-aware searchable selects', () => {
    for (const file of ['client/business-activity.html','en/client/business-activity.html']) {
      const page = read(file);
      expect(page).toContain('id="country"');
      expect(page).toContain('id="sector"');
      expect(page).toContain('id="primaryActivity"');
      expect(page).toContain('/components/universal-dropdown.js');
      expect(page).toContain('/components/taxonomy-selector.js');
      expect(page).toContain('canonical_activity_code');
      expect(page).toContain('sector_code');
      expect(page).toContain('country_code');
    }
  });

  test('selector loads canonical taxonomy by country and sector and exposes proposal actions', () => {
    const component = read('components/taxonomy-selector.js');
    expect(component).toContain('/api/v3/catalog/countries');
    expect(component).toContain('/api/v3/investment-taxonomy?country=');
    expect(component).toContain('&sector=');
    expect(component).toContain('__propose_sector__');
    expect(component).toContain('__propose_activity__');
    expect(component).toContain("status:'pending'");
    expect(component).toContain(".from('taxonomy_proposals').insert");
  });

  test('user proposals are isolated from canonical taxonomy and protected by RLS', () => {
    const migration = read('supabase/migrations/20261019190000_taxonomy_proposals.sql');
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.taxonomy_proposals');
    expect(migration).toContain("proposal_type IN ('sector','activity')");
    expect(migration).toContain("status IN ('pending','approved','mapped','rejected')");
    expect(migration).toContain('ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('auth.uid() = user_id');
    expect(migration).toContain("status = 'pending'");
  });
});
