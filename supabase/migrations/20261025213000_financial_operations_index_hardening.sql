begin;

-- Advisor-driven index hardening for BONDS Financial Operations Core.
-- These indexes cover foreign-key access paths identified after production migration.

create index if not exists idx_accounting_accounts_entity_parent
  on public.accounting_accounts(accounting_entity_id, parent_id)
  where parent_id is not null;

create index if not exists idx_accounting_entities_created_by
  on public.accounting_entities(created_by)
  where created_by is not null;

create index if not exists idx_accounting_journal_entries_entity_period
  on public.accounting_journal_entries(accounting_entity_id, period_id)
  where period_id is not null;

create index if not exists idx_accounting_journal_entries_entity_reversal
  on public.accounting_journal_entries(accounting_entity_id, reversal_of)
  where reversal_of is not null;

create index if not exists idx_accounting_journal_entries_posted_by
  on public.accounting_journal_entries(posted_by)
  where posted_by is not null;

create index if not exists idx_accounting_journal_lines_entity_account_id
  on public.accounting_journal_lines(accounting_entity_id, account_id);

create index if not exists idx_accounting_journal_lines_entity_entry
  on public.accounting_journal_lines(accounting_entity_id, journal_entry_id);

create index if not exists idx_accounting_periods_closed_by
  on public.accounting_periods(closed_by)
  where closed_by is not null;

commit;
