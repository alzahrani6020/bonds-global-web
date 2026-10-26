begin;

-- Bank Reconciliation V1
-- Extends the existing reconciliation surface; no parallel ledger or bank-transaction table.

do $$
declare
  candidate_count integer;
  mapped_count integer;
begin
  select count(*) into candidate_count
  from public.service_catalog s
  join public.service_execution_profiles p on p.service_id=s.id
  where s.code='bank_reconciliation'
    and s.status='published'
    and s.is_active=true
    and p.is_active=true
    and p.execution_status='request_only'
    and p.execution_mode='request_only'
    and p.primary_action is null;

  if candidate_count <> 1 then
    raise exception 'BANK_RECONCILIATION_CANDIDATE_STATE_CHANGED';
  end if;

  select count(*) into mapped_count
  from public.service_capability_map m
  join public.service_catalog s on s.id=m.service_id
  where s.code='bank_reconciliation';

  if mapped_count <> 0 then
    raise exception 'BANK_RECONCILIATION_ALREADY_MAPPED';
  end if;
end
$$;

alter table public.finance_reconciliation_items
  add column if not exists bank_date date,
  add column if not exists bank_reference text,
  add column if not exists bank_description text,
  add column if not exists source_fingerprint text,
  add column if not exists match_method text,
  add column if not exists match_confidence numeric(5,4),
  add column if not exists journal_entry_id uuid,
  add column if not exists journal_line_id uuid;

alter table public.finance_reconciliation_items
  drop constraint if exists finance_reconciliation_items_source_type_check;

alter table public.finance_reconciliation_items
  add constraint finance_reconciliation_items_source_type_check
  check (source_type = any(array[
    'invoice'::text,
    'bank_transfer'::text,
    'subscription'::text,
    'manual'::text,
    'bank_statement'::text
  ]));

alter table public.finance_reconciliation_items
  add constraint finance_reconciliation_source_fingerprint_check
  check (source_fingerprint is null or source_fingerprint ~ '^[0-9a-f]{64}$');

alter table public.finance_reconciliation_items
  add constraint finance_reconciliation_match_confidence_check
  check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1));

alter table public.finance_reconciliation_items
  add constraint finance_reconciliation_match_method_check
  check (
    match_method is null or
    match_method = any(array[
      'exact_reference_amount'::text,
      'exact_amount_date'::text,
      'exact_reference_amount_variance'::text,
      'probable_amount_date_window'::text,
      'ambiguous'::text,
      'none'::text
    ])
  );

alter table public.finance_reconciliation_items
  add constraint finance_reconciliation_matched_evidence_check
  check (
    status <> 'matched' or
    (
      journal_entry_id is not null and
      journal_line_id is not null and
      match_confidence >= 0.98
    )
  );

create unique index if not exists uq_accounting_journal_lines_entity_id
on public.accounting_journal_lines(accounting_entity_id,id);

alter table public.finance_reconciliation_items
  add constraint finance_reconciliation_journal_entry_fk
  foreign key(accounting_entity_id,journal_entry_id)
  references public.accounting_journal_entries(accounting_entity_id,id)
  on delete restrict;

alter table public.finance_reconciliation_items
  add constraint finance_reconciliation_journal_line_fk
  foreign key(accounting_entity_id,journal_line_id)
  references public.accounting_journal_lines(accounting_entity_id,id)
  on delete restrict;

create unique index if not exists uq_finance_reconciliation_matched_ledger_line
on public.finance_reconciliation_items(accounting_entity_id,journal_line_id)
where status='matched' and journal_line_id is not null;

create index if not exists idx_finance_reconciliation_bank_date
on public.finance_reconciliation_items(accounting_entity_id,bank_date)
where source_type='bank_statement';

update public.service_catalog
set delivery_type='partially_automated',
    metadata=metadata || '{"source":"bank_reconciliation_v1","deterministic_matching":true,"bank_feed":"file_import","ai_matching":false,"auto_match_policy":"exact_only","no_parallel_ledger":true}'::jsonb,
    updated_at=now()
where code='bank_reconciliation';

update public.service_execution_profiles p
set execution_status='partially_automated',
    execution_mode='capability_plan',
    primary_action='accounting_bank_reconciliation_run',
    orchestrator_intent=null,
    tool_id=null,
    ai_mode='none',
    research_mode='none',
    token_mode='as_required',
    assistant_enabled=true,
    version=p.version+1,
    metadata=p.metadata || '{"source":"bank_reconciliation_v1","fail_closed":true,"deterministic_matching":true,"human_review_for_non_exact":true}'::jsonb,
    updated_at=now()
from public.service_catalog s
where p.service_id=s.id
  and s.code='bank_reconciliation';

insert into public.service_capability_map(
  service_id,capability_code,run_order,is_required,metadata
)
select
  s.id,
  'accounting_bank_reconciliation_run',
  10,
  true,
  '{"wave":"bank_reconciliation_v1","auto_match_policy":"exact_only","no_parallel_ledger":true}'::jsonb
from public.service_catalog s
where s.code='bank_reconciliation';

commit;
