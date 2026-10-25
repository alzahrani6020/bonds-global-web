begin;

-- Wave 7 advisor follow-up: cover composite foreign keys used by depreciation run provenance.

create index if not exists idx_fixed_asset_depreciation_runs_event
  on public.accounting_fixed_asset_depreciation_runs(
    accounting_entity_id, financial_event_id
  );

create index if not exists idx_fixed_asset_depreciation_runs_journal
  on public.accounting_fixed_asset_depreciation_runs(
    accounting_entity_id, journal_entry_id
  );

commit;
