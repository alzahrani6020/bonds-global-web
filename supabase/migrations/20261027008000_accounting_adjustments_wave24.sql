begin;

-- Accounting Operations Wave 24: governed accounting adjustments.
-- Reuses the canonical accounting posting RPC and existing ledger.
-- No parallel ledger, posting RPC, or accounting tables are introduced.

do $$
declare
  candidate_count integer;
  mapped_count integer;
begin
  select count(*) into candidate_count
  from public.service_catalog s
  join public.service_execution_profiles p on p.service_id = s.id
  where s.code = 'accounting_adjustments'
    and s.status = 'published'
    and s.is_active = true
    and p.is_active = true
    and p.execution_status = 'request_only'
    and p.execution_mode = 'request_only'
    and p.primary_action is null;

  if candidate_count <> 1 then
    raise exception 'WAVE24_ACCOUNTING_ADJUSTMENT_CANDIDATE_STATE_CHANGED';
  end if;

  select count(*) into mapped_count
  from public.service_capability_map m
  join public.service_catalog s on s.id = m.service_id
  where s.code = 'accounting_adjustments';

  if mapped_count <> 0 then
    raise exception 'WAVE24_ACCOUNTING_ADJUSTMENT_ALREADY_MAPPED';
  end if;
end
$$;

-- A posted source journal may be reversed only once per Accounting Entity.
-- The reference is stored in the canonical financial-event payload.
create unique index if not exists uq_financial_events_adjustment_reversal_source
on public.financial_events(
  accounting_entity_id,
  ((payload->>'source_journal_id'))
)
where event_type = 'accounting_adjustment_reversal'
  and nullif(payload->>'source_journal_id','') is not null;

update public.service_catalog
set delivery_type = 'automated',
    metadata = metadata || '{"source":"accounting_operations_wave24","canonical_posting_rpc":true,"no_parallel_ledger":true}'::jsonb,
    updated_at = now()
where code = 'accounting_adjustments';

update public.service_execution_profiles p
set execution_status = 'automated',
    execution_mode = 'capability_plan',
    primary_action = 'accounting_adjustment_post',
    orchestrator_intent = null,
    tool_id = null,
    ai_mode = 'none',
    research_mode = 'none',
    token_mode = 'as_required',
    assistant_enabled = true,
    version = p.version + 1,
    is_active = true,
    metadata = p.metadata || '{"source":"accounting_operations_wave24","fail_closed":true,"canonical_posting_rpc":true}'::jsonb,
    updated_at = now()
from public.service_catalog s
where p.service_id = s.id
  and s.code = 'accounting_adjustments';

insert into public.service_capability_map(
  service_id, capability_code, run_order, is_required, metadata
)
select
  s.id,
  'accounting_adjustment_post',
  10,
  true,
  '{"wave":24,"canonical_posting_rpc":true,"no_parallel_ledger":true}'::jsonb
from public.service_catalog s
where s.code = 'accounting_adjustments';

commit;
