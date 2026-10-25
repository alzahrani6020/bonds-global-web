'use strict';

const fs = require('fs');
const path = require('path');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '../../supabase/migrations/20261026021500_fixed_asset_depreciation_advisor_hardening.sql'),
  'utf8'
);

describe('fixed asset depreciation advisor hardening', () => {
  test('covers financial event composite foreign key', () => {
    expect(MIGRATION).toContain('idx_fixed_asset_depr_runs_event_fk');
    expect(MIGRATION).toContain('accounting_entity_id, financial_event_id');
  });

  test('covers journal entry composite foreign key', () => {
    expect(MIGRATION).toContain('idx_fixed_asset_depr_runs_journal_fk');
    expect(MIGRATION).toContain('accounting_entity_id, journal_entry_id');
  });
});