begin;

-- Accounting Operations Wave 22: governed daily journal posting.
-- Reuses the canonical accounting_commit_posting RPC, ledger, periods,
-- accounts, financial events, and service execution architecture.

do $$
declare
  candidate_count integer;
  mapped_count integer;
begin
  select count(*) into candidate_count
  from public.service_catalog s
  join public.service_execution_profiles p on p.service_id = s.id
  where s.code = 'daily_journal_entries'
    and s.status = 'published'
    and s.is_active = true
    and p.is_active = true
    and p.execution_status = 'request_only'
    and p.execution_mode = 'request_only'
    and p.primary_action is null;

  if candidate_count <> 1 then
    raise exception 'WAVE22_DAILY_JOURNAL_CANDIDATE_STATE_CHANGED';
  end if;

  select count(*) into mapped_count
  from public.service_capability_map m
  join public.service_catalog s on s.id = m.service_id
  where s.code = 'daily_journal_entries';

  if mapped_count <> 0 then
    raise exception 'WAVE22_DAILY_JOURNAL_ALREADY_MAPPED';
  end if;
end
$$;

update public.service_catalog
set delivery_type = 'automated',
    metadata = metadata || '{"source":"accounting_operations_wave22","canonical_posting_rpc":true,"no_parallel_ledger":true}'::jsonb,
    updated_at = now()
where code = 'daily_journal_entries';

update public.service_execution_profiles p
set execution_status = 'automated',
    execution_mode = 'capability_plan',
    primary_action = 'accounting_journal_post',
    orchestrator_intent = null,
    tool_id = null,
    ai_mode = 'none',
    research_mode = 'none',
    token_mode = 'as_required',
    assistant_enabled = true,
    version = p.version + 1,
    is_active = true,
    metadata = p.metadata || '{"source":"accounting_operations_wave22","fail_closed":true,"canonical_posting_rpc":true}'::jsonb,
    updated_at = now()
from public.service_catalog s
where p.service_id = s.id
  and s.code = 'daily_journal_entries';

insert into public.service_capability_map(
  service_id, capability_code, run_order, is_required, metadata
)
select
  s.id,
  'accounting_journal_post',
  10,
  true,
  '{"wave":22,"canonical_posting_rpc":true,"no_parallel_ledger":true}'::jsonb
from public.service_catalog s
where s.code = 'daily_journal_entries';

commit;
