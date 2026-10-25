begin;

-- Wave 8: governed accounting period close / reopen workflow.
-- Reuses accounting_periods and existing posting guard; no parallel period system.

create table if not exists public.accounting_period_close_events (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null,
  period_id uuid not null,
  action text not null
    check (action in ('soft_close','close','reopen')),
  from_status text not null
    check (from_status in ('open','soft_closed','closed')),
  to_status text not null
    check (to_status in ('open','soft_closed','closed')),
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role text not null
    check (actor_role in ('owner','admin','accountant')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (accounting_entity_id, period_id)
    references public.accounting_periods(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_period_close_events_period
  on public.accounting_period_close_events(
    accounting_entity_id, period_id, created_at desc
  );

create index if not exists idx_period_close_events_actor
  on public.accounting_period_close_events(actor_user_id, created_at desc);

alter table public.accounting_period_close_events enable row level security;

revoke all on public.accounting_period_close_events from anon, authenticated;
grant select, insert on public.accounting_period_close_events to service_role;

create or replace function public.accounting_transition_period(
  p_accounting_entity_id uuid,
  p_period_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_reason text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_current_status text;
  v_target_status text;
  v_period_code text;
  v_starts_on date;
  v_ends_on date;
  v_actor_role text;
  v_event_id uuid;
  v_reason text;
begin
  if p_accounting_entity_id is null then
    raise exception 'ACCOUNTING_ENTITY_REQUIRED';
  end if;
  if p_period_id is null then
    raise exception 'ACCOUNTING_PERIOD_REQUIRED';
  end if;
  if p_actor_user_id is null then
    raise exception 'ACCOUNTING_PERIOD_ACTOR_REQUIRED';
  end if;

  if p_action is null or p_action not in ('soft_close','close','reopen') then
    raise exception 'ACCOUNTING_PERIOD_ACTION_UNSUPPORTED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_accounting_entity_id::text || ':period:' || p_period_id::text,
      0
    )
  );

  select p.status, p.period_code, p.starts_on, p.ends_on
    into v_current_status, v_period_code, v_starts_on, v_ends_on
  from public.accounting_periods p
  join public.accounting_entities e
    on e.id = p.accounting_entity_id
   and e.status = 'active'
  where p.id = p_period_id
    and p.accounting_entity_id = p_accounting_entity_id
  for update of p;

  if v_current_status is null then
    raise exception 'ACCOUNTING_PERIOD_NOT_FOUND_OR_ENTITY_INACTIVE';
  end if;

  select m.role
    into v_actor_role
  from public.accounting_entity_members m
  where m.accounting_entity_id = p_accounting_entity_id
    and m.user_id = p_actor_user_id
    and m.status = 'active'
  limit 1;

  if v_actor_role is null then
    raise exception 'ACCOUNTING_PERIOD_ACTOR_ACCESS_DENIED';
  end if;

  if p_action = 'soft_close' then
    if v_actor_role not in ('owner','admin','accountant') then
      raise exception 'ACCOUNTING_PERIOD_SOFT_CLOSE_FORBIDDEN';
    end if;
    v_target_status := 'soft_closed';
  elsif p_action = 'close' then
    if v_actor_role not in ('owner','admin') then
      raise exception 'ACCOUNTING_PERIOD_CLOSE_FORBIDDEN';
    end if;
    v_target_status := 'closed';
  else
    if v_actor_role not in ('owner','admin') then
      raise exception 'ACCOUNTING_PERIOD_REOPEN_FORBIDDEN';
    end if;
    v_target_status := 'open';
  end if;

  v_reason := nullif(btrim(coalesce(p_reason,'')),'');

  if p_action = 'reopen' and v_reason is null then
    raise exception 'ACCOUNTING_PERIOD_REOPEN_REASON_REQUIRED';
  end if;

  if v_current_status = v_target_status then
    return jsonb_build_object(
      'ok', true,
      'state', 'replayed',
      'accounting_entity_id', p_accounting_entity_id,
      'period_id', p_period_id,
      'period_code', v_period_code,
      'status', v_current_status
    );
  end if;

  if p_action = 'soft_close' and v_current_status <> 'open' then
    raise exception 'ACCOUNTING_PERIOD_SOFT_CLOSE_INVALID_TRANSITION';
  end if;

  if p_action = 'close' and v_current_status not in ('open','soft_closed') then
    raise exception 'ACCOUNTING_PERIOD_CLOSE_INVALID_TRANSITION';
  end if;

  if p_action = 'reopen' and v_current_status not in ('soft_closed','closed') then
    raise exception 'ACCOUNTING_PERIOD_REOPEN_INVALID_TRANSITION';
  end if;

  if p_action in ('soft_close','close') then
    if exists (
      select 1
      from public.accounting_journal_entries j
      where j.accounting_entity_id = p_accounting_entity_id
        and j.period_id = p_period_id
        and j.status = 'draft'
    ) then
      raise exception 'ACCOUNTING_PERIOD_HAS_DRAFT_JOURNALS';
    end if;

    if exists (
      select 1
      from public.accounting_journal_entries j
      where j.accounting_entity_id = p_accounting_entity_id
        and j.period_id = p_period_id
        and j.effective_at::date not between v_starts_on and v_ends_on
    ) then
      raise exception 'ACCOUNTING_PERIOD_JOURNAL_DATE_MISMATCH';
    end if;

    if exists (
      select 1
      from public.financial_events f
      where f.accounting_entity_id = p_accounting_entity_id
        and f.effective_at::date between v_starts_on and v_ends_on
        and f.status = 'accepted'
    ) then
      raise exception 'ACCOUNTING_PERIOD_HAS_UNPOSTED_EVENTS';
    end if;

    if exists (
      select 1
      from public.accounting_subledger_entries s
      join public.financial_events f
        on f.accounting_entity_id = s.accounting_entity_id
       and f.id = s.financial_event_id
      where s.accounting_entity_id = p_accounting_entity_id
        and f.effective_at::date between v_starts_on and v_ends_on
        and s.status = 'pending'
    ) then
      raise exception 'ACCOUNTING_PERIOD_HAS_PENDING_SUBLEDGER';
    end if;
  end if;

  update public.accounting_periods
  set
    status = v_target_status,
    closed_at = case when v_target_status = 'closed' then now() else null end,
    closed_by = case when v_target_status = 'closed' then p_actor_user_id else null end,
    updated_at = now()
  where id = p_period_id
    and accounting_entity_id = p_accounting_entity_id;

  insert into public.accounting_period_close_events(
    accounting_entity_id,
    period_id,
    action,
    from_status,
    to_status,
    actor_user_id,
    actor_role,
    reason,
    metadata
  ) values (
    p_accounting_entity_id,
    p_period_id,
    p_action,
    v_current_status,
    v_target_status,
    p_actor_user_id,
    v_actor_role,
    v_reason,
    coalesce(p_metadata,'{}'::jsonb)
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'ok', true,
    'state', 'transitioned',
    'event_id', v_event_id,
    'accounting_entity_id', p_accounting_entity_id,
    'period_id', p_period_id,
    'period_code', v_period_code,
    'from_status', v_current_status,
    'to_status', v_target_status,
    'actor_role', v_actor_role
  );
end;
$$;

revoke all on function public.accounting_transition_period(
  uuid,uuid,text,uuid,text,jsonb
) from public, anon, authenticated;

grant execute on function public.accounting_transition_period(
  uuid,uuid,text,uuid,text,jsonb
) to service_role;

comment on table public.accounting_period_close_events is
  'Audit trail for governed accounting period soft-close, close and reopen transitions.';

commit;
