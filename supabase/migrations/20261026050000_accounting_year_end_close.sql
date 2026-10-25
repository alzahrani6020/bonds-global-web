begin;

-- Wave 13: governed year-end close and reopen.
-- Reuses the canonical posting RPC and governed period-transition workflow.
-- No parallel ledger, journal, period system, or HTTP endpoint is introduced.

create table if not exists public.accounting_year_end_policies (
  accounting_entity_id uuid primary key
    references public.accounting_entities(id) on delete cascade,
  retained_earnings_account_id uuid not null,
  retained_dimensions jsonb not null default '{}'::jsonb,
  fiscal_year_end_month smallint not null
    check (fiscal_year_end_month between 1 and 12),
  fiscal_year_end_day smallint not null
    check (fiscal_year_end_day between 1 and 31),
  status text not null default 'active'
    check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  configured_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (accounting_entity_id, retained_earnings_account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_accounting_year_end_policies_retained
  on public.accounting_year_end_policies(
    accounting_entity_id, retained_earnings_account_id
  );

create index if not exists idx_accounting_year_end_policies_configured_by
  on public.accounting_year_end_policies(configured_by)
  where configured_by is not null;

create table if not exists public.accounting_year_end_close_runs (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete restrict,
  fiscal_year_start date not null,
  fiscal_year_end date not null,
  closing_period_id uuid not null,
  cycle_no integer not null check (cycle_no > 0),
  status text not null
    check (status in ('closing','closed','reopening','reopened')),
  closing_event_id uuid,
  closing_journal_id uuid,
  reversal_event_id uuid,
  reversal_journal_id uuid,
  net_income numeric(20,2) not null default 0,
  closed_by uuid not null references auth.users(id) on delete restrict,
  closed_at timestamptz,
  reopened_by uuid references auth.users(id) on delete restrict,
  reopened_at timestamptz,
  reopen_reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fiscal_year_start <= fiscal_year_end),
  unique(accounting_entity_id, fiscal_year_start, fiscal_year_end, cycle_no),
  foreign key (accounting_entity_id, closing_period_id)
    references public.accounting_periods(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, closing_event_id)
    references public.financial_events(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, closing_journal_id)
    references public.accounting_journal_entries(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, reversal_event_id)
    references public.financial_events(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, reversal_journal_id)
    references public.accounting_journal_entries(accounting_entity_id, id)
    on delete restrict
);

create unique index if not exists uq_accounting_year_end_active_close
  on public.accounting_year_end_close_runs(
    accounting_entity_id, fiscal_year_start, fiscal_year_end
  )
  where status in ('closing','closed','reopening');

create index if not exists idx_accounting_year_end_close_period
  on public.accounting_year_end_close_runs(
    accounting_entity_id, closing_period_id, status
  );

create index if not exists idx_accounting_year_end_close_journal
  on public.accounting_year_end_close_runs(
    accounting_entity_id, closing_journal_id
  )
  where closing_journal_id is not null;

create index if not exists idx_accounting_year_end_reversal_journal
  on public.accounting_year_end_close_runs(
    accounting_entity_id, reversal_journal_id
  )
  where reversal_journal_id is not null;

create index if not exists idx_accounting_year_end_closed_by
  on public.accounting_year_end_close_runs(closed_by)
  where closed_by is not null;

create index if not exists idx_accounting_year_end_reopened_by
  on public.accounting_year_end_close_runs(reopened_by)
  where reopened_by is not null;

alter table public.accounting_year_end_policies enable row level security;
alter table public.accounting_year_end_close_runs enable row level security;

revoke all on public.accounting_year_end_policies from anon, authenticated;
revoke all on public.accounting_year_end_close_runs from anon, authenticated;

grant select, insert, update, delete
  on public.accounting_year_end_policies to service_role;
grant select, insert, update
  on public.accounting_year_end_close_runs to service_role;

create or replace function public.accounting_configure_year_end_policy(
  p_accounting_entity_id uuid,
  p_retained_earnings_account_id uuid,
  p_retained_dimensions jsonb,
  p_fiscal_year_end_month integer,
  p_fiscal_year_end_day integer,
  p_status text,
  p_actor_id uuid,
  p_metadata jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_dimensions jsonb := coalesce(p_retained_dimensions,'{}'::jsonb);
begin
  if p_accounting_entity_id is null
     or p_retained_earnings_account_id is null
     or p_actor_id is null then
    raise exception 'ACCOUNTING_YEAR_END_POLICY_IDENTIFIERS_REQUIRED';
  end if;

  if p_fiscal_year_end_month is null
     or p_fiscal_year_end_month < 1
     or p_fiscal_year_end_month > 12
     or p_fiscal_year_end_day is null
     or p_fiscal_year_end_day < 1
     or p_fiscal_year_end_day > 31 then
    raise exception 'ACCOUNTING_YEAR_END_DATE_INVALID';
  end if;

  begin
    perform make_date(2000,p_fiscal_year_end_month,p_fiscal_year_end_day);
  exception
    when others then
      raise exception 'ACCOUNTING_YEAR_END_DATE_INVALID';
  end;

  if coalesce(p_status,'active') not in ('active','inactive') then
    raise exception 'ACCOUNTING_YEAR_END_POLICY_STATUS_INVALID';
  end if;

  if not exists (
    select 1
    from public.accounting_entities e
    where e.id=p_accounting_entity_id
      and e.status='active'
  ) then
    raise exception 'ACCOUNTING_ENTITY_NOT_ACTIVE';
  end if;

  if not exists (
    select 1
    from public.accounting_entity_members m
    where m.accounting_entity_id=p_accounting_entity_id
      and m.user_id=p_actor_id
      and m.status='active'
      and m.role in ('owner','admin')
  ) then
    raise exception 'ACCOUNTING_YEAR_END_POLICY_FORBIDDEN';
  end if;

  if not exists (
    select 1
    from public.accounting_accounts a
    where a.accounting_entity_id=p_accounting_entity_id
      and a.id=p_retained_earnings_account_id
      and a.account_type in ('equity','contra_equity')
      and a.is_active=true
      and a.is_postable=true
  ) then
    raise exception 'ACCOUNTING_RETAINED_EARNINGS_ACCOUNT_REQUIRED';
  end if;

  perform public.accounting_assert_account_dimensions(
    p_accounting_entity_id,
    p_retained_earnings_account_id,
    v_dimensions
  );

  insert into public.accounting_year_end_policies(
    accounting_entity_id,
    retained_earnings_account_id,
    retained_dimensions,
    fiscal_year_end_month,
    fiscal_year_end_day,
    status,
    metadata,
    configured_by,
    updated_at
  )
  values(
    p_accounting_entity_id,
    p_retained_earnings_account_id,
    v_dimensions,
    p_fiscal_year_end_month,
    p_fiscal_year_end_day,
    coalesce(p_status,'active'),
    coalesce(p_metadata,'{}'::jsonb),
    p_actor_id,
    now()
  )
  on conflict(accounting_entity_id) do update
  set
    retained_earnings_account_id=excluded.retained_earnings_account_id,
    retained_dimensions=excluded.retained_dimensions,
    fiscal_year_end_month=excluded.fiscal_year_end_month,
    fiscal_year_end_day=excluded.fiscal_year_end_day,
    status=excluded.status,
    metadata=excluded.metadata,
    configured_by=excluded.configured_by,
    updated_at=now();

  return jsonb_build_object(
    'ok',true,
    'accounting_entity_id',p_accounting_entity_id,
    'retained_earnings_account_id',p_retained_earnings_account_id,
    'fiscal_year_end_month',p_fiscal_year_end_month,
    'fiscal_year_end_day',p_fiscal_year_end_day,
    'status',coalesce(p_status,'active')
  );
end;
$$;

revoke all on function public.accounting_configure_year_end_policy(
  uuid,uuid,jsonb,integer,integer,text,uuid,jsonb
) from public, anon, authenticated;
grant execute on function public.accounting_configure_year_end_policy(
  uuid,uuid,jsonb,integer,integer,text,uuid,jsonb
) to service_role;

-- Harden the canonical period transition:
-- fiscal year-end close/reopen must pass through the dedicated year-end workflows.
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

  if p_action = 'close'
     and exists (
       select 1
       from public.accounting_year_end_policies y
       where y.accounting_entity_id=p_accounting_entity_id
         and y.status='active'
         and extract(month from v_ends_on)::integer=y.fiscal_year_end_month
         and extract(day from v_ends_on)::integer=y.fiscal_year_end_day
     )
     and not exists (
       select 1
       from public.accounting_year_end_close_runs r
       where r.accounting_entity_id=p_accounting_entity_id
         and r.closing_period_id=p_period_id
         and r.status='closing'
     ) then
    raise exception 'ACCOUNTING_YEAR_END_CLOSE_WORKFLOW_REQUIRED';
  end if;

  if p_action = 'reopen'
     and exists (
       select 1
       from public.accounting_year_end_close_runs r
       where r.accounting_entity_id=p_accounting_entity_id
         and r.closing_period_id=p_period_id
         and r.status='closed'
     ) then
    raise exception 'ACCOUNTING_YEAR_END_REOPEN_WORKFLOW_REQUIRED';
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

create or replace function public.accounting_execute_year_end_close(
  p_accounting_entity_id uuid,
  p_fiscal_year_start date,
  p_fiscal_year_end date,
  p_closing_period_id uuid,
  p_request_key text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_policy public.accounting_year_end_policies%rowtype;
  v_actor_role text;
  v_period_start date;
  v_period_end date;
  v_period_status text;
  v_cycle integer;
  v_run_id uuid;
  v_request_key text := btrim(coalesce(p_request_key,''));
  v_idempotency text;
  v_balance record;
  v_balance_amount numeric(20,2);
  v_original_net numeric(20,2) := 0;
  v_net_income numeric(20,2) := 0;
  v_total_debit numeric(20,2) := 0;
  v_total_credit numeric(20,2) := 0;
  v_line_no integer := 0;
  v_lines jsonb := '[]'::jsonb;
  v_retained_code text;
  v_retained_name text;
  v_event jsonb;
  v_posting jsonb;
  v_post_result jsonb;
  v_close_result jsonb;
  v_closing_event_id uuid;
  v_closing_journal_id uuid;
begin
  if p_accounting_entity_id is null
     or p_fiscal_year_start is null
     or p_fiscal_year_end is null
     or p_closing_period_id is null
     or p_actor_id is null then
    raise exception 'ACCOUNTING_YEAR_END_CLOSE_IDENTIFIERS_REQUIRED';
  end if;

  if p_fiscal_year_start > p_fiscal_year_end then
    raise exception 'ACCOUNTING_YEAR_END_RANGE_INVALID';
  end if;

  if v_request_key=''
     or length(v_request_key)>128
     or v_request_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'ACCOUNTING_YEAR_END_REQUEST_KEY_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_accounting_entity_id::text || ':year-end:' ||
      p_fiscal_year_start::text || ':' || p_fiscal_year_end::text,
      0
    )
  );

  select m.role into v_actor_role
  from public.accounting_entity_members m
  where m.accounting_entity_id=p_accounting_entity_id
    and m.user_id=p_actor_id
    and m.status='active'
  limit 1;

  if v_actor_role not in ('owner','admin') then
    raise exception 'ACCOUNTING_YEAR_END_CLOSE_FORBIDDEN';
  end if;

  select * into v_policy
  from public.accounting_year_end_policies y
  where y.accounting_entity_id=p_accounting_entity_id
    and y.status='active'
  for update;

  if v_policy.accounting_entity_id is null then
    raise exception 'ACCOUNTING_YEAR_END_POLICY_REQUIRED';
  end if;

  if extract(month from p_fiscal_year_end)::integer <> v_policy.fiscal_year_end_month
     or extract(day from p_fiscal_year_end)::integer <> v_policy.fiscal_year_end_day then
    raise exception 'ACCOUNTING_YEAR_END_POLICY_DATE_MISMATCH';
  end if;

  if exists (
    select 1
    from public.accounting_year_end_close_runs r
    where r.accounting_entity_id=p_accounting_entity_id
      and r.fiscal_year_start=p_fiscal_year_start
      and r.fiscal_year_end=p_fiscal_year_end
      and r.status='closed'
  ) then
    return (
      select jsonb_build_object(
        'ok',true,
        'state','replayed',
        'close_run_id',r.id,
        'cycle_no',r.cycle_no,
        'closing_event_id',r.closing_event_id,
        'closing_journal_id',r.closing_journal_id,
        'net_income',r.net_income,
        'status',r.status
      )
      from public.accounting_year_end_close_runs r
      where r.accounting_entity_id=p_accounting_entity_id
        and r.fiscal_year_start=p_fiscal_year_start
        and r.fiscal_year_end=p_fiscal_year_end
        and r.status='closed'
      order by r.cycle_no desc
      limit 1
    );
  end if;

  select p.starts_on,p.ends_on,p.status
    into v_period_start,v_period_end,v_period_status
  from public.accounting_periods p
  where p.accounting_entity_id=p_accounting_entity_id
    and p.id=p_closing_period_id
  for update;

  if v_period_start is null then
    raise exception 'ACCOUNTING_YEAR_END_CLOSING_PERIOD_REQUIRED';
  end if;

  if v_period_status <> 'open' then
    raise exception 'ACCOUNTING_YEAR_END_CLOSING_PERIOD_NOT_OPEN';
  end if;

  if v_period_end <> p_fiscal_year_end then
    raise exception 'ACCOUNTING_YEAR_END_CLOSING_PERIOD_END_MISMATCH';
  end if;

  if not exists (
    select 1 from public.accounting_periods p
    where p.accounting_entity_id=p_accounting_entity_id
      and p.starts_on=p_fiscal_year_start
  ) then
    raise exception 'ACCOUNTING_YEAR_END_START_PERIOD_MISSING';
  end if;

  if exists (
    select 1
    from public.accounting_periods p
    where p.accounting_entity_id=p_accounting_entity_id
      and daterange(p.starts_on,p.ends_on,'[]')
          && daterange(p_fiscal_year_start,p_fiscal_year_end,'[]')
      and (
        p.starts_on < p_fiscal_year_start
        or p.ends_on > p_fiscal_year_end
      )
  ) then
    raise exception 'ACCOUNTING_YEAR_END_PERIOD_RANGE_MISALIGNED';
  end if;

  if exists (
    with ordered_periods as (
      select
        p.starts_on,
        p.ends_on,
        lag(p.ends_on) over(order by p.starts_on,p.ends_on,p.id) as previous_end
      from public.accounting_periods p
      where p.accounting_entity_id=p_accounting_entity_id
        and p.starts_on >= p_fiscal_year_start
        and p.ends_on <= p_fiscal_year_end
    )
    select 1
    from ordered_periods
    where previous_end is not null
      and starts_on <> previous_end + 1
  ) then
    raise exception 'ACCOUNTING_YEAR_END_PERIODS_NOT_CONTIGUOUS';
  end if;

  if (
    select coalesce(sum((p.ends_on-p.starts_on)+1),0)
    from public.accounting_periods p
    where p.accounting_entity_id=p_accounting_entity_id
      and p.starts_on >= p_fiscal_year_start
      and p.ends_on <= p_fiscal_year_end
  ) <> ((p_fiscal_year_end-p_fiscal_year_start)+1) then
    raise exception 'ACCOUNTING_YEAR_END_PERIOD_COVERAGE_INVALID';
  end if;

  if exists (
    select 1
    from public.accounting_periods p
    where p.accounting_entity_id=p_accounting_entity_id
      and p.starts_on >= p_fiscal_year_start
      and p.ends_on <= p_fiscal_year_end
      and p.id <> p_closing_period_id
      and p.status <> 'closed'
  ) then
    raise exception 'ACCOUNTING_YEAR_END_PRIOR_PERIODS_NOT_CLOSED';
  end if;

  if not exists (
    select 1
    from public.accounting_accounts a
    where a.accounting_entity_id=p_accounting_entity_id
      and a.id=v_policy.retained_earnings_account_id
      and a.account_type in ('equity','contra_equity')
      and a.is_active=true
      and a.is_postable=true
  ) then
    raise exception 'ACCOUNTING_RETAINED_EARNINGS_ACCOUNT_REQUIRED';
  end if;

  perform public.accounting_assert_account_dimensions(
    p_accounting_entity_id,
    v_policy.retained_earnings_account_id,
    v_policy.retained_dimensions
  );

  select a.code,a.name
    into v_retained_code,v_retained_name
  from public.accounting_accounts a
  where a.accounting_entity_id=p_accounting_entity_id
    and a.id=v_policy.retained_earnings_account_id;

  select coalesce(max(r.cycle_no),0)+1
    into v_cycle
  from public.accounting_year_end_close_runs r
  where r.accounting_entity_id=p_accounting_entity_id
    and r.fiscal_year_start=p_fiscal_year_start
    and r.fiscal_year_end=p_fiscal_year_end;

  insert into public.accounting_year_end_close_runs(
    accounting_entity_id,
    fiscal_year_start,
    fiscal_year_end,
    closing_period_id,
    cycle_no,
    status,
    closed_by,
    metadata
  )
  values(
    p_accounting_entity_id,
    p_fiscal_year_start,
    p_fiscal_year_end,
    p_closing_period_id,
    v_cycle,
    'closing',
    p_actor_id,
    jsonb_build_object(
      'request_key',v_request_key,
      'policy_retained_account_id',v_policy.retained_earnings_account_id
    )
  )
  returning id into v_run_id;

  for v_balance in
    select
      a.id as account_id,
      a.code as account_code,
      a.name as account_name,
      l.dimensions,
      round(sum(l.debit-l.credit),2)::numeric(20,2) as balance
    from public.accounting_journal_entries j
    join public.accounting_journal_lines l
      on l.accounting_entity_id=j.accounting_entity_id
     and l.journal_entry_id=j.id
    join public.accounting_accounts a
      on a.accounting_entity_id=l.accounting_entity_id
     and a.id=l.account_id
    where j.accounting_entity_id=p_accounting_entity_id
      and j.status='posted'
      and j.effective_at::date between p_fiscal_year_start and p_fiscal_year_end
      and a.account_type in (
        'revenue','contra_revenue','expense','contra_expense'
      )
    group by a.id,a.code,a.name,l.dimensions
    having round(sum(l.debit-l.credit),2) <> 0
    order by a.code,l.dimensions::text
  loop
    perform public.accounting_assert_account_dimensions(
      p_accounting_entity_id,
      v_balance.account_id,
      v_balance.dimensions
    );

    v_balance_amount := v_balance.balance;
    v_original_net := v_original_net + v_balance_amount;
    v_line_no := v_line_no + 1;

    if v_balance_amount > 0 then
      v_total_credit := v_total_credit + v_balance_amount;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'line_no',v_line_no,
          'account_code',v_balance.account_code,
          'account_name',v_balance.account_name,
          'debit',0,
          'credit',v_balance_amount,
          'dimensions',v_balance.dimensions
        )
      );
    else
      v_total_debit := v_total_debit + abs(v_balance_amount);
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'line_no',v_line_no,
          'account_code',v_balance.account_code,
          'account_name',v_balance.account_name,
          'debit',abs(v_balance_amount),
          'credit',0,
          'dimensions',v_balance.dimensions
        )
      );
    end if;
  end loop;

  v_net_income := round(-v_original_net,2);

  if v_original_net <> 0 then
    v_line_no := v_line_no + 1;

    if v_original_net > 0 then
      v_total_debit := v_total_debit + v_original_net;
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'line_no',v_line_no,
          'account_code',v_retained_code,
          'account_name',v_retained_name,
          'debit',v_original_net,
          'credit',0,
          'dimensions',v_policy.retained_dimensions
        )
      );
    else
      v_total_credit := v_total_credit + abs(v_original_net);
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'line_no',v_line_no,
          'account_code',v_retained_code,
          'account_name',v_retained_name,
          'debit',0,
          'credit',abs(v_original_net),
          'dimensions',v_policy.retained_dimensions
        )
      );
    end if;
  end if;

  if v_line_no > 0 then
    if v_line_no < 2
       or v_total_debit <= 0
       or v_total_debit <> v_total_credit then
      raise exception 'ACCOUNTING_YEAR_END_CLOSING_ENTRY_UNBALANCED';
    end if;

    v_idempotency := encode(
      extensions.digest(
        p_accounting_entity_id::text || ':year-end-close:' ||
        p_fiscal_year_start::text || ':' ||
        p_fiscal_year_end::text || ':' ||
        v_request_key,
        'sha256'
      ),
      'hex'
    );

    v_event := jsonb_build_object(
      'accounting_entity_id',p_accounting_entity_id,
      'id','year_end.close:' || v_idempotency,
      'type','year_end.close',
      'idempotency_key',v_idempotency,
      'occurred_at',now(),
      'effective_date',(p_fiscal_year_end::text || 'T12:00:00Z')::timestamptz,
      'amount',v_total_debit,
      'currency',coalesce(
        (
          select e.base_currency
          from public.accounting_entities e
          where e.id=p_accounting_entity_id
        ),
        'SAR'
      ),
      'source',jsonb_build_object(
        'system','accounting_year_end',
        'record_id',v_run_id::text
      ),
      'service_code','accounting_operations',
      'payload',jsonb_build_object(
        'close_run_id',v_run_id,
        'cycle_no',v_cycle,
        'fiscal_year_start',p_fiscal_year_start,
        'fiscal_year_end',p_fiscal_year_end,
        'net_income',v_net_income,
        'request_key',v_request_key,
        'actor_id',p_actor_id
      ),
      'evidence','[]'::jsonb
    );

    v_posting := jsonb_build_object(
      'description','Year-end close ' ||
        p_fiscal_year_start::text || ' to ' || p_fiscal_year_end::text,
      'subledger',jsonb_build_object(
        'code','year_end_close',
        'source_record_id',v_run_id::text
      ),
      'journal',jsonb_build_object(
        'total_debit',v_total_debit,
        'total_credit',v_total_credit,
        'lines',v_lines
      )
    );

    v_post_result := public.accounting_commit_posting(v_event,v_posting);
    v_closing_event_id := (v_post_result->>'event_id')::uuid;
    v_closing_journal_id := (v_post_result->>'posting_id')::uuid;
  end if;

  v_close_result := public.accounting_transition_period(
    p_accounting_entity_id,
    p_closing_period_id,
    'close',
    p_actor_id,
    'Year-end close ' || p_fiscal_year_end::text,
    jsonb_build_object(
      'year_end_close_run_id',v_run_id,
      'fiscal_year_start',p_fiscal_year_start,
      'fiscal_year_end',p_fiscal_year_end
    )
  );

  update public.accounting_year_end_close_runs
  set
    status='closed',
    closing_event_id=v_closing_event_id,
    closing_journal_id=v_closing_journal_id,
    net_income=v_net_income,
    closed_at=now(),
    updated_at=now(),
    metadata=metadata || jsonb_build_object(
      'period_transition_event_id',v_close_result->>'event_id'
    )
  where id=v_run_id;

  return jsonb_build_object(
    'ok',true,
    'state','closed',
    'close_run_id',v_run_id,
    'cycle_no',v_cycle,
    'closing_event_id',v_closing_event_id,
    'closing_journal_id',v_closing_journal_id,
    'net_income',v_net_income,
    'line_count',v_line_no,
    'period_status','closed'
  );
end;
$$;

revoke all on function public.accounting_execute_year_end_close(
  uuid,date,date,uuid,text,uuid
) from public, anon, authenticated;
grant execute on function public.accounting_execute_year_end_close(
  uuid,date,date,uuid,text,uuid
) to service_role;

create or replace function public.accounting_reopen_year_end(
  p_accounting_entity_id uuid,
  p_close_run_id uuid,
  p_request_key text,
  p_actor_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_run public.accounting_year_end_close_runs%rowtype;
  v_actor_role text;
  v_request_key text := btrim(coalesce(p_request_key,''));
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_original_journal public.accounting_journal_entries%rowtype;
  v_line record;
  v_lines jsonb := '[]'::jsonb;
  v_idempotency text;
  v_event jsonb;
  v_posting jsonb;
  v_post_result jsonb;
  v_reversal_event_id uuid;
  v_reversal_journal_id uuid;
  v_reopen_result jsonb;
begin
  if p_accounting_entity_id is null
     or p_close_run_id is null
     or p_actor_id is null then
    raise exception 'ACCOUNTING_YEAR_END_REOPEN_IDENTIFIERS_REQUIRED';
  end if;

  if v_request_key=''
     or length(v_request_key)>128
     or v_request_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'ACCOUNTING_YEAR_END_REQUEST_KEY_INVALID';
  end if;

  if v_reason is null then
    raise exception 'ACCOUNTING_YEAR_END_REOPEN_REASON_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_accounting_entity_id::text || ':year-end-reopen:' ||
      p_close_run_id::text,
      0
    )
  );

  select m.role into v_actor_role
  from public.accounting_entity_members m
  where m.accounting_entity_id=p_accounting_entity_id
    and m.user_id=p_actor_id
    and m.status='active'
  limit 1;

  if v_actor_role not in ('owner','admin') then
    raise exception 'ACCOUNTING_YEAR_END_REOPEN_FORBIDDEN';
  end if;

  select * into v_run
  from public.accounting_year_end_close_runs r
  where r.accounting_entity_id=p_accounting_entity_id
    and r.id=p_close_run_id
  for update;

  if v_run.id is null then
    raise exception 'ACCOUNTING_YEAR_END_CLOSE_RUN_NOT_FOUND';
  end if;

  if v_run.status='reopened' then
    return jsonb_build_object(
      'ok',true,
      'state','replayed',
      'close_run_id',v_run.id,
      'reversal_event_id',v_run.reversal_event_id,
      'reversal_journal_id',v_run.reversal_journal_id,
      'period_status','open'
    );
  end if;

  if v_run.status <> 'closed' then
    raise exception 'ACCOUNTING_YEAR_END_REOPEN_STATE_INVALID';
  end if;

  update public.accounting_year_end_close_runs
  set status='reopening',updated_at=now()
  where id=v_run.id;

  v_reopen_result := public.accounting_transition_period(
    p_accounting_entity_id,
    v_run.closing_period_id,
    'reopen',
    p_actor_id,
    v_reason,
    jsonb_build_object(
      'year_end_close_run_id',v_run.id,
      'year_end_reopen',true
    )
  );

  if v_run.closing_journal_id is not null then
    select * into v_original_journal
    from public.accounting_journal_entries j
    where j.accounting_entity_id=p_accounting_entity_id
      and j.id=v_run.closing_journal_id
    for update;

    if v_original_journal.id is null
       or v_original_journal.status <> 'posted' then
      raise exception 'ACCOUNTING_YEAR_END_CLOSING_JOURNAL_NOT_POSTED';
    end if;

    for v_line in
      select
        l.line_no,
        l.account_code,
        l.account_name,
        l.debit,
        l.credit,
        l.dimensions
      from public.accounting_journal_lines l
      where l.accounting_entity_id=p_accounting_entity_id
        and l.journal_entry_id=v_original_journal.id
      order by l.line_no
    loop
      v_lines := v_lines || jsonb_build_array(
        jsonb_build_object(
          'line_no',v_line.line_no,
          'account_code',v_line.account_code,
          'account_name',v_line.account_name,
          'debit',v_line.credit,
          'credit',v_line.debit,
          'dimensions',v_line.dimensions
        )
      );
    end loop;

    v_idempotency := encode(
      extensions.digest(
        p_accounting_entity_id::text || ':year-end-reopen:' ||
        v_run.id::text || ':' || v_request_key,
        'sha256'
      ),
      'hex'
    );

    v_event := jsonb_build_object(
      'accounting_entity_id',p_accounting_entity_id,
      'id','year_end.reopen:' || v_idempotency,
      'type','year_end.reopen',
      'idempotency_key',v_idempotency,
      'occurred_at',now(),
      'effective_date',(v_run.fiscal_year_end::text || 'T12:00:00Z')::timestamptz,
      'amount',v_original_journal.total_debit,
      'currency',v_original_journal.currency,
      'source',jsonb_build_object(
        'system','accounting_year_end',
        'record_id',v_run.id::text || ':reopen'
      ),
      'service_code','accounting_operations',
      'payload',jsonb_build_object(
        'close_run_id',v_run.id,
        'reversal_of',v_original_journal.id,
        'request_key',v_request_key,
        'reason',v_reason,
        'actor_id',p_actor_id
      ),
      'evidence','[]'::jsonb
    );

    v_posting := jsonb_build_object(
      'description','Reverse year-end close ' || v_run.fiscal_year_end::text,
      'subledger',jsonb_build_object(
        'code','year_end_reopen',
        'source_record_id',v_run.id::text || ':reopen'
      ),
      'journal',jsonb_build_object(
        'total_debit',v_original_journal.total_credit,
        'total_credit',v_original_journal.total_debit,
        'lines',v_lines
      )
    );

    v_post_result := public.accounting_commit_posting(v_event,v_posting);
    v_reversal_event_id := (v_post_result->>'event_id')::uuid;
    v_reversal_journal_id := (v_post_result->>'posting_id')::uuid;

    update public.accounting_journal_entries
    set
      reversal_of=v_original_journal.id,
      metadata=metadata || jsonb_build_object(
        'year_end_reversal',true,
        'year_end_close_run_id',v_run.id
      )
    where id=v_reversal_journal_id
      and accounting_entity_id=p_accounting_entity_id;

    update public.accounting_journal_entries
    set
      status='reversed',
      metadata=metadata || jsonb_build_object(
        'reversed_by_journal_id',v_reversal_journal_id,
        'year_end_reopened',true
      )
    where id=v_original_journal.id
      and accounting_entity_id=p_accounting_entity_id;

    update public.financial_events
    set status='reversed'
    where id=v_original_journal.financial_event_id
      and accounting_entity_id=p_accounting_entity_id;

    update public.accounting_subledger_entries
    set status='reversed'
    where financial_event_id=v_original_journal.financial_event_id
      and accounting_entity_id=p_accounting_entity_id;
  end if;

  update public.accounting_year_end_close_runs
  set
    status='reopened',
    reversal_event_id=v_reversal_event_id,
    reversal_journal_id=v_reversal_journal_id,
    reopened_by=p_actor_id,
    reopened_at=now(),
    reopen_reason=v_reason,
    updated_at=now(),
    metadata=metadata || jsonb_build_object(
      'reopen_period_transition_event_id',v_reopen_result->>'event_id'
    )
  where id=v_run.id;

  return jsonb_build_object(
    'ok',true,
    'state','reopened',
    'close_run_id',v_run.id,
    'reversal_event_id',v_reversal_event_id,
    'reversal_journal_id',v_reversal_journal_id,
    'period_status','open'
  );
end;
$$;

revoke all on function public.accounting_reopen_year_end(
  uuid,uuid,text,uuid,text
) from public, anon, authenticated;
grant execute on function public.accounting_reopen_year_end(
  uuid,uuid,text,uuid,text
) to service_role;

insert into public.service_capability_map(
  service_id,
  capability_code,
  run_order,
  is_required,
  metadata
)
select
  s.id,
  v.capability_code,
  v.run_order,
  true,
  jsonb_build_object('wave',13,'mapped_action',true)
from public.service_catalog s
cross join (
  values
    ('accounting_year_end_policy_configure',90),
    ('accounting_year_end_close',100),
    ('accounting_year_end_reopen',110)
) as v(capability_code,run_order)
where s.code='accounting_operations'
on conflict(service_id,capability_code) do update
set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

comment on table public.accounting_year_end_policies is
  'Explicit fiscal year-end policy including retained earnings account and fiscal year-end calendar date.';

comment on table public.accounting_year_end_close_runs is
  'Audited year-end close/reopen cycles linked to canonical financial events and journals.';

commit;
