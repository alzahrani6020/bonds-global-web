begin;

-- Wave 7 advisor hardening: cover composite foreign keys on posted depreciation runs.

create index if not exists idx_fixed_asset_depr_runs_event_fk
  on public.accounting_fixed_asset_depreciation_runs(
    accounting_entity_id, financial_event_id
  );

create index if not exists idx_fixed_asset_depr_runs_journal_fk
  on public.accounting_fixed_asset_depreciation_runs(
    accounting_entity_id, journal_entry_id
  );

commit;