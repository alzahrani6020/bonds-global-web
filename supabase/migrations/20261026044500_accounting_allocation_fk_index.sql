begin;

-- Wave 12 performance hardening: cover the composite source-account foreign key
-- used by accounting_allocation_rules.

create index if not exists idx_accounting_allocation_rules_source_account
  on public.accounting_allocation_rules(accounting_entity_id, source_account_id);

commit;
