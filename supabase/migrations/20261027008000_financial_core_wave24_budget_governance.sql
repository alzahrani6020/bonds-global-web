begin;

-- Financial Core Wave 24: governed budget and forecast baselines.
-- Reuses the canonical accounting entity, periods, accounts, dimensions,
-- ledger actuals, service execution boundary, and FIN-043 planning engine.
-- Approved versions are immutable; revisions create a new draft version.

create table if not exists public.accounting_budget_plans (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  code text not null,
  name text not null,
  plan_type text not null
    check (plan_type in ('budget','forecast')),
  fiscal_year_start date not null,
  fiscal_year_end date not null,
  currency text not null
    check (currency ~ '^[A-Z]{3}$'),
  status text not null default 'active'
    check (status in ('active','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fiscal_year_start <= fiscal_year_end),
  unique(accounting_entity_id, code),
  unique(accounting_entity_id, id)
);

create table if not exists public.accounting_budget_versions (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  budget_plan_id uuid not null,
  version_no integer not null check (version_no > 0),
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','rejected','superseded')),
  parent_version_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  superseded_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(budget_plan_id, version_no),
  unique(accounting_entity_id, id),
  foreign key (accounting_entity_id, budget_plan_id)
    references public.accounting_budget_plans(accounting_entity_id, id)
    on delete cascade,
  foreign key (accounting_entity_id, parent_version_id)
    references public.accounting_budget_versions(accounting_entity_id, id)
    on delete restrict
);

create unique index if not exists uq_accounting_budget_approved_version
  on public.accounting_budget_versions(budget_plan_id)
  where status = 'approved';

create index if not exists idx_accounting_budget_versions_plan_status
  on public.accounting_budget_versions(budget_plan_id, status, version_no desc);

create table if not exists public.accounting_budget_lines (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  budget_version_id uuid not null,
  period_id uuid not null,
  account_id uuid not null,
  amount numeric(20,2) not null,
  dimensions jsonb not null default '{}'::jsonb,
  dimensions_key text generated always as (md5(dimensions::text)) stored,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (accounting_entity_id, budget_version_id)
    references public.accounting_budget_versions(accounting_entity_id, id)
    on delete cascade,
  foreign key (accounting_entity_id, period_id)
    references public.accounting_periods(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict,
  unique(budget_version_id, period_id, account_id, dimensions_key)
);

create index if not exists idx_accounting_budget_lines_version
  on public.accounting_budget_lines(budget_version_id, period_id, account_id);

create index if not exists idx_accounting_budget_lines_entity_period
  on public.accounting_budget_lines(accounting_entity_id, period_id);

create table if not exists public.accounting_budget_events (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  budget_plan_id uuid not null,
  budget_version_id uuid,
  action text not null
    check (action in ('created','saved','submitted','approved','rejected','revision_created','superseded')),
  from_status text,
  to_status text,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  actor_role text not null
    check (actor_role in ('owner','admin','accountant','viewer')),
  reason text,
  request_key text,
  request_fingerprint text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  foreign key (accounting_entity_id, budget_plan_id)
    references public.accounting_budget_plans(accounting_entity_id, id)
    on delete cascade,
  foreign key (accounting_entity_id, budget_version_id)
    references public.accounting_budget_versions(accounting_entity_id, id)
    on delete cascade
);

create unique index if not exists uq_accounting_budget_event_request
  on public.accounting_budget_events(accounting_entity_id, request_key)
  where request_key is not null;

create index if not exists idx_accounting_budget_events_version_created
  on public.accounting_budget_events(budget_version_id, created_at desc);

alter table public.accounting_budget_plans enable row level security;
alter table public.accounting_budget_versions enable row level security;
alter table public.accounting_budget_lines enable row level security;
alter table public.accounting_budget_events enable row level security;

revoke all on public.accounting_budget_plans from anon, authenticated;
revoke all on public.accounting_budget_versions from anon, authenticated;
revoke all on public.accounting_budget_lines from anon, authenticated;
revoke all on public.accounting_budget_events from anon, authenticated;

grant select, insert, update, delete on public.accounting_budget_plans to service_role;
grant select, insert, update, delete on public.accounting_budget_versions to service_role;
grant select, insert, update, delete on public.accounting_budget_lines to service_role;
grant select, insert on public.accounting_budget_events to service_role;

create or replace function public.accounting_budget_plan_create(
  p_accounting_entity_id uuid,
  p_code text,
  p_name text,
  p_plan_type text,
  p_fiscal_year_start date,
  p_fiscal_year_end date,
  p_currency text,
  p_request_key text,
  p_actor_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
  v_base_currency text;
  v_currency text;
  v_code text := upper(btrim(coalesce(p_code,'')));
  v_name text := btrim(coalesce(p_name,''));
  v_type text := lower(btrim(coalesce(p_plan_type,'')));
  v_request_key text := btrim(coalesce(p_request_key,''));
  v_fingerprint text;
  v_event public.accounting_budget_events%rowtype;
  v_plan_id uuid;
  v_version_id uuid;
begin
  if p_accounting_entity_id is null or p_actor_id is null then
    raise exception 'ACCOUNTING_BUDGET_IDENTIFIERS_REQUIRED';
  end if;
  if v_code = '' or length(v_code) > 64 then
    raise exception 'ACCOUNTING_BUDGET_PLAN_CODE_INVALID';
  end if;
  if v_name = '' or length(v_name) > 200 then
    raise exception 'ACCOUNTING_BUDGET_PLAN_NAME_INVALID';
  end if;
  if v_type not in ('budget','forecast') then
    raise exception 'ACCOUNTING_BUDGET_PLAN_TYPE_INVALID';
  end if;
  if p_fiscal_year_start is null or p_fiscal_year_end is null
     or p_fiscal_year_start > p_fiscal_year_end then
    raise exception 'ACCOUNTING_BUDGET_FISCAL_RANGE_INVALID';
  end if;
  if v_request_key = '' or length(v_request_key) > 128
     or v_request_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'ACCOUNTING_BUDGET_REQUEST_KEY_INVALID';
  end if;

  select e.base_currency, m.role
    into v_base_currency, v_role
  from public.accounting_entities e
  join public.accounting_entity_members m
    on m.accounting_entity_id = e.id
   and m.user_id = p_actor_id
   and m.status = 'active'
  where e.id = p_accounting_entity_id
    and e.status = 'active'
  limit 1;

  if v_role not in ('owner','admin','accountant') then
    raise exception 'ACCOUNTING_BUDGET_WRITE_FORBIDDEN';
  end if;

  v_currency := upper(btrim(coalesce(nullif(p_currency,''),v_base_currency)));
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'ACCOUNTING_BUDGET_CURRENCY_INVALID';
  end if;
  if v_currency <> v_base_currency then
    raise exception 'ACCOUNTING_BUDGET_CURRENCY_MUST_MATCH_ENTITY';
  end if;

  if not exists (
    select 1 from public.accounting_periods p
    where p.accounting_entity_id = p_accounting_entity_id
      and p.starts_on = p_fiscal_year_start
  ) or not exists (
    select 1 from public.accounting_periods p
    where p.accounting_entity_id = p_accounting_entity_id
      and p.ends_on = p_fiscal_year_end
  ) then
    raise exception 'ACCOUNTING_BUDGET_PERIOD_BOUNDARY_MISMATCH';
  end if;

  if exists (
    with ordered_periods as (
      select
        p.starts_on,
        p.ends_on,
        lag(p.ends_on) over(order by p.starts_on,p.ends_on,p.id) as previous_end
      from public.accounting_periods p
      where p.accounting_entity_id = p_accounting_entity_id
        and p.starts_on >= p_fiscal_year_start
        and p.ends_on <= p_fiscal_year_end
    )
    select 1 from ordered_periods
    where previous_end is not null
      and starts_on <> previous_end + 1
  ) then
    raise exception 'ACCOUNTING_BUDGET_PERIODS_NOT_CONTIGUOUS';
  end if;

  if (
    select coalesce(sum((p.ends_on-p.starts_on)+1),0)
    from public.accounting_periods p
    where p.accounting_entity_id = p_accounting_entity_id
      and p.starts_on >= p_fiscal_year_start
      and p.ends_on <= p_fiscal_year_end
  ) <> ((p_fiscal_year_end-p_fiscal_year_start)+1) then
    raise exception 'ACCOUNTING_BUDGET_PERIOD_COVERAGE_INVALID';
  end if;

  v_fingerprint := md5(jsonb_build_object(
    'operation','create',
    'accounting_entity_id',p_accounting_entity_id,
    'code',v_code,
    'name',v_name,
    'plan_type',v_type,
    'fiscal_year_start',p_fiscal_year_start,
    'fiscal_year_end',p_fiscal_year_end,
    'currency',v_currency
  )::text);

  select * into v_event
  from public.accounting_budget_events e
  where e.accounting_entity_id = p_accounting_entity_id
    and e.request_key = v_request_key
  limit 1;

  if v_event.id is not null then
    if v_event.request_fingerprint <> v_fingerprint then
      raise exception 'ACCOUNTING_BUDGET_REQUEST_KEY_REUSED';
    end if;
    return jsonb_build_object(
      'ok',true,'state','replayed',
      'budget_plan_id',v_event.budget_plan_id,
      'budget_version_id',v_event.budget_version_id
    );
  end if;

  insert into public.accounting_budget_plans(
    accounting_entity_id,code,name,plan_type,
    fiscal_year_start,fiscal_year_end,currency,
    metadata,created_by
  )
  values(
    p_accounting_entity_id,v_code,v_name,v_type,
    p_fiscal_year_start,p_fiscal_year_end,v_currency,
    coalesce(p_metadata,'{}'::jsonb),p_actor_id
  )
  returning id into v_plan_id;

  insert into public.accounting_budget_versions(
    accounting_entity_id,budget_plan_id,version_no,status,
    created_by,metadata
  )
  values(
    p_accounting_entity_id,v_plan_id,1,'draft',
    p_actor_id,jsonb_build_object('source','wave24_initial_version')
  )
  returning id into v_version_id;

  insert into public.accounting_budget_events(
    accounting_entity_id,budget_plan_id,budget_version_id,
    action,from_status,to_status,actor_user_id,actor_role,
    request_key,request_fingerprint,metadata
  )
  values(
    p_accounting_entity_id,v_plan_id,v_version_id,
    'created',null,'draft',p_actor_id,v_role,
    v_request_key,v_fingerprint,coalesce(p_metadata,'{}'::jsonb)
  );

  return jsonb_build_object(
    'ok',true,'state','created',
    'budget_plan_id',v_plan_id,
    'budget_version_id',v_version_id,
    'version_no',1,
    'status','draft'
  );
end;
$$;

revoke all on function public.accounting_budget_plan_create(
  uuid,text,text,text,date,date,text,text,uuid,jsonb
) from public, anon, authenticated;
grant execute on function public.accounting_budget_plan_create(
  uuid,text,text,text,date,date,text,text,uuid,jsonb
) to service_role;

create or replace function public.accounting_budget_draft_save(
  p_accounting_entity_id uuid,
  p_budget_version_id uuid,
  p_lines jsonb,
  p_request_key text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
  v_status text;
  v_plan_id uuid;
  v_start date;
  v_end date;
  v_request_key text := btrim(coalesce(p_request_key,''));
  v_fingerprint text;
  v_event public.accounting_budget_events%rowtype;
  v_row jsonb;
  v_period_id uuid;
  v_account_id uuid;
  v_amount numeric(20,2);
  v_dimensions jsonb;
  v_count integer := 0;
begin
  if p_accounting_entity_id is null
     or p_budget_version_id is null
     or p_actor_id is null then
    raise exception 'ACCOUNTING_BUDGET_IDENTIFIERS_REQUIRED';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'ACCOUNTING_BUDGET_LINES_REQUIRED';
  end if;
  if v_request_key = '' or length(v_request_key) > 128
     or v_request_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'ACCOUNTING_BUDGET_REQUEST_KEY_INVALID';
  end if;

  select m.role into v_role
  from public.accounting_entity_members m
  where m.accounting_entity_id = p_accounting_entity_id
    and m.user_id = p_actor_id
    and m.status = 'active'
  limit 1;

  if v_role not in ('owner','admin','accountant') then
    raise exception 'ACCOUNTING_BUDGET_WRITE_FORBIDDEN';
  end if;

  select v.status,v.budget_plan_id,p.fiscal_year_start,p.fiscal_year_end
    into v_status,v_plan_id,v_start,v_end
  from public.accounting_budget_versions v
  join public.accounting_budget_plans p
    on p.accounting_entity_id=v.accounting_entity_id
   and p.id=v.budget_plan_id
  where v.accounting_entity_id=p_accounting_entity_id
    and v.id=p_budget_version_id
  for update of v;

  if v_status is null then
    raise exception 'ACCOUNTING_BUDGET_VERSION_NOT_FOUND';
  end if;
  if v_status <> 'draft' then
    raise exception 'ACCOUNTING_BUDGET_VERSION_IMMUTABLE';
  end if;

  v_fingerprint := md5(jsonb_build_object(
    'operation','save',
    'budget_version_id',p_budget_version_id,
    'lines',p_lines
  )::text);

  select * into v_event
  from public.accounting_budget_events e
  where e.accounting_entity_id=p_accounting_entity_id
    and e.request_key=v_request_key
  limit 1;

  if v_event.id is not null then
    if v_event.request_fingerprint <> v_fingerprint then
      raise exception 'ACCOUNTING_BUDGET_REQUEST_KEY_REUSED';
    end if;
    return jsonb_build_object(
      'ok',true,'state','replayed',
      'budget_plan_id',v_event.budget_plan_id,
      'budget_version_id',v_event.budget_version_id
    );
  end if;

  delete from public.accounting_budget_lines
  where accounting_entity_id=p_accounting_entity_id
    and budget_version_id=p_budget_version_id;

  for v_row in select value from jsonb_array_elements(p_lines)
  loop
    if jsonb_typeof(v_row) <> 'object'
       or jsonb_typeof(v_row->'period_id') <> 'string'
       or jsonb_typeof(v_row->'account_id') <> 'string'
       or jsonb_typeof(v_row->'amount') <> 'number' then
      raise exception 'ACCOUNTING_BUDGET_LINE_INVALID';
    end if;

    v_period_id := (v_row->>'period_id')::uuid;
    v_account_id := (v_row->>'account_id')::uuid;
    v_amount := (v_row->>'amount')::numeric(20,2);
    v_dimensions := coalesce(v_row->'dimensions','{}'::jsonb);

    if jsonb_typeof(v_dimensions) <> 'object' then
      raise exception 'ACCOUNTING_BUDGET_DIMENSIONS_OBJECT_REQUIRED';
    end if;

    if not exists (
      select 1 from public.accounting_periods p
      where p.accounting_entity_id=p_accounting_entity_id
        and p.id=v_period_id
        and p.starts_on >= v_start
        and p.ends_on <= v_end
    ) then
      raise exception 'ACCOUNTING_BUDGET_PERIOD_INVALID';
    end if;

    if not exists (
      select 1 from public.accounting_accounts a
      where a.accounting_entity_id=p_accounting_entity_id
        and a.id=v_account_id
        and a.is_active=true
        and a.is_postable=true
    ) then
      raise exception 'ACCOUNTING_BUDGET_ACCOUNT_INVALID';
    end if;

    perform public.accounting_assert_account_dimensions(
      p_accounting_entity_id,
      v_account_id,
      v_dimensions
    );

    insert into public.accounting_budget_lines(
      accounting_entity_id,budget_version_id,period_id,
      account_id,amount,dimensions,metadata
    )
    values(
      p_accounting_entity_id,p_budget_version_id,v_period_id,
      v_account_id,v_amount,v_dimensions,
      case
        when jsonb_typeof(v_row->'metadata')='object' then v_row->'metadata'
        else '{}'::jsonb
      end
    );

    v_count := v_count + 1;
  end loop;

  insert into public.accounting_budget_events(
    accounting_entity_id,budget_plan_id,budget_version_id,
    action,from_status,to_status,actor_user_id,actor_role,
    request_key,request_fingerprint,metadata
  )
  values(
    p_accounting_entity_id,v_plan_id,p_budget_version_id,
    'saved','draft','draft',p_actor_id,v_role,
    v_request_key,v_fingerprint,jsonb_build_object('line_count',v_count)
  );

  return jsonb_build_object(
    'ok',true,'state','saved',
    'budget_plan_id',v_plan_id,
    'budget_version_id',p_budget_version_id,
    'line_count',v_count
  );
end;
$$;

revoke all on function public.accounting_budget_draft_save(
  uuid,uuid,jsonb,text,uuid
) from public, anon, authenticated;
grant execute on function public.accounting_budget_draft_save(
  uuid,uuid,jsonb,text,uuid
) to service_role;

create or replace function public.accounting_budget_transition(
  p_accounting_entity_id uuid,
  p_budget_version_id uuid,
  p_action text,
  p_request_key text,
  p_actor_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_role text;
  v_plan_id uuid;
  v_status text;
  v_action text := lower(btrim(coalesce(p_action,'')));
  v_request_key text := btrim(coalesce(p_request_key,''));
  v_reason text := nullif(btrim(coalesce(p_reason,'')),'');
  v_fingerprint text;
  v_event public.accounting_budget_events%rowtype;
  v_new_version_id uuid;
  v_new_version_no integer;
  v_old_approved_id uuid;
begin
  if p_accounting_entity_id is null
     or p_budget_version_id is null
     or p_actor_id is null then
    raise exception 'ACCOUNTING_BUDGET_IDENTIFIERS_REQUIRED';
  end if;
  if v_action not in ('submit','approve','reject','revise') then
    raise exception 'ACCOUNTING_BUDGET_TRANSITION_UNSUPPORTED';
  end if;
  if v_request_key = '' or length(v_request_key) > 128
     or v_request_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'ACCOUNTING_BUDGET_REQUEST_KEY_INVALID';
  end if;

  select m.role into v_role
  from public.accounting_entity_members m
  where m.accounting_entity_id=p_accounting_entity_id
    and m.user_id=p_actor_id
    and m.status='active'
  limit 1;

  if v_role not in ('owner','admin','accountant') then
    raise exception 'ACCOUNTING_BUDGET_WRITE_FORBIDDEN';
  end if;

  select v.budget_plan_id,v.status
    into v_plan_id,v_status
  from public.accounting_budget_versions v
  where v.accounting_entity_id=p_accounting_entity_id
    and v.id=p_budget_version_id
  for update;

  if v_status is null then
    raise exception 'ACCOUNTING_BUDGET_VERSION_NOT_FOUND';
  end if;

  perform 1
  from public.accounting_budget_plans p
  where p.accounting_entity_id=p_accounting_entity_id
    and p.id=v_plan_id
    and p.status='active'
  for update;

  if not found then
    raise exception 'ACCOUNTING_BUDGET_PLAN_NOT_ACTIVE';
  end if;

  v_fingerprint := md5(jsonb_build_object(
    'operation','transition',
    'budget_version_id',p_budget_version_id,
    'action',v_action,
    'reason',v_reason
  )::text);

  select * into v_event
  from public.accounting_budget_events e
  where e.accounting_entity_id=p_accounting_entity_id
    and e.request_key=v_request_key
  limit 1;

  if v_event.id is not null then
    if v_event.request_fingerprint <> v_fingerprint then
      raise exception 'ACCOUNTING_BUDGET_REQUEST_KEY_REUSED';
    end if;
    return jsonb_build_object(
      'ok',true,'state','replayed',
      'budget_plan_id',v_event.budget_plan_id,
      'budget_version_id',v_event.budget_version_id,
      'status',v_event.to_status
    );
  end if;

  if v_action='submit' then
    if v_status <> 'draft' then
      raise exception 'ACCOUNTING_BUDGET_SUBMIT_INVALID_TRANSITION';
    end if;
    if not exists (
      select 1 from public.accounting_budget_lines l
      where l.accounting_entity_id=p_accounting_entity_id
        and l.budget_version_id=p_budget_version_id
    ) then
      raise exception 'ACCOUNTING_BUDGET_LINES_REQUIRED';
    end if;

    update public.accounting_budget_versions
    set status='submitted',
        submitted_by=p_actor_id,
        submitted_at=now(),
        updated_at=now()
    where accounting_entity_id=p_accounting_entity_id
      and id=p_budget_version_id;

    insert into public.accounting_budget_events(
      accounting_entity_id,budget_plan_id,budget_version_id,
      action,from_status,to_status,actor_user_id,actor_role,
      request_key,request_fingerprint
    ) values (
      p_accounting_entity_id,v_plan_id,p_budget_version_id,
      'submitted','draft','submitted',p_actor_id,v_role,
      v_request_key,v_fingerprint
    );

    return jsonb_build_object(
      'ok',true,'state','transitioned',
      'budget_plan_id',v_plan_id,
      'budget_version_id',p_budget_version_id,
      'status','submitted'
    );
  end if;

  if v_action='approve' then
    if v_role not in ('owner','admin') then
      raise exception 'ACCOUNTING_BUDGET_APPROVE_FORBIDDEN';
    end if;
    if v_status <> 'submitted' then
      raise exception 'ACCOUNTING_BUDGET_APPROVE_INVALID_TRANSITION';
    end if;
    if not exists (
      select 1 from public.accounting_budget_lines l
      where l.accounting_entity_id=p_accounting_entity_id
        and l.budget_version_id=p_budget_version_id
    ) then
      raise exception 'ACCOUNTING_BUDGET_LINES_REQUIRED';
    end if;

    select id into v_old_approved_id
    from public.accounting_budget_versions
    where accounting_entity_id=p_accounting_entity_id
      and budget_plan_id=v_plan_id
      and status='approved'
      and id<>p_budget_version_id
    for update;

    if v_old_approved_id is not null then
      update public.accounting_budget_versions
      set status='superseded',
          superseded_at=now(),
          updated_at=now()
      where id=v_old_approved_id
        and accounting_entity_id=p_accounting_entity_id;

      insert into public.accounting_budget_events(
        accounting_entity_id,budget_plan_id,budget_version_id,
        action,from_status,to_status,actor_user_id,actor_role,
        reason,metadata
      ) values (
        p_accounting_entity_id,v_plan_id,v_old_approved_id,
        'superseded','approved','superseded',p_actor_id,v_role,
        'new_approved_version',
        jsonb_build_object('replacement_version_id',p_budget_version_id)
      );
    end if;

    update public.accounting_budget_versions
    set status='approved',
        approved_by=p_actor_id,
        approved_at=now(),
        rejected_by=null,
        rejected_at=null,
        rejection_reason=null,
        updated_at=now()
    where accounting_entity_id=p_accounting_entity_id
      and id=p_budget_version_id;

    insert into public.accounting_budget_events(
      accounting_entity_id,budget_plan_id,budget_version_id,
      action,from_status,to_status,actor_user_id,actor_role,
      request_key,request_fingerprint
    ) values (
      p_accounting_entity_id,v_plan_id,p_budget_version_id,
      'approved','submitted','approved',p_actor_id,v_role,
      v_request_key,v_fingerprint
    );

    return jsonb_build_object(
      'ok',true,'state','transitioned',
      'budget_plan_id',v_plan_id,
      'budget_version_id',p_budget_version_id,
      'status','approved',
      'superseded_version_id',v_old_approved_id
    );
  end if;

  if v_action='reject' then
    if v_role not in ('owner','admin') then
      raise exception 'ACCOUNTING_BUDGET_REJECT_FORBIDDEN';
    end if;
    if v_status <> 'submitted' then
      raise exception 'ACCOUNTING_BUDGET_REJECT_INVALID_TRANSITION';
    end if;
    if v_reason is null then
      raise exception 'ACCOUNTING_BUDGET_REJECTION_REASON_REQUIRED';
    end if;

    update public.accounting_budget_versions
    set status='rejected',
        rejected_by=p_actor_id,
        rejected_at=now(),
        rejection_reason=v_reason,
        updated_at=now()
    where accounting_entity_id=p_accounting_entity_id
      and id=p_budget_version_id;

    insert into public.accounting_budget_events(
      accounting_entity_id,budget_plan_id,budget_version_id,
      action,from_status,to_status,actor_user_id,actor_role,
      reason,request_key,request_fingerprint
    ) values (
      p_accounting_entity_id,v_plan_id,p_budget_version_id,
      'rejected','submitted','rejected',p_actor_id,v_role,
      v_reason,v_request_key,v_fingerprint
    );

    return jsonb_build_object(
      'ok',true,'state','transitioned',
      'budget_plan_id',v_plan_id,
      'budget_version_id',p_budget_version_id,
      'status','rejected'
    );
  end if;

  if v_status not in ('approved','rejected') then
    raise exception 'ACCOUNTING_BUDGET_REVISE_INVALID_TRANSITION';
  end if;

  select coalesce(max(v.version_no),0)+1
    into v_new_version_no
  from public.accounting_budget_versions v
  where v.budget_plan_id=v_plan_id;

  insert into public.accounting_budget_versions(
    accounting_entity_id,budget_plan_id,version_no,status,
    parent_version_id,created_by,metadata
  )
  select
    accounting_entity_id,budget_plan_id,v_new_version_no,'draft',
    id,p_actor_id,jsonb_build_object('source','wave24_revision')
  from public.accounting_budget_versions
  where accounting_entity_id=p_accounting_entity_id
    and id=p_budget_version_id
  returning id into v_new_version_id;

  insert into public.accounting_budget_lines(
    accounting_entity_id,budget_version_id,period_id,
    account_id,amount,dimensions,metadata
  )
  select
    accounting_entity_id,v_new_version_id,period_id,
    account_id,amount,dimensions,metadata
  from public.accounting_budget_lines
  where accounting_entity_id=p_accounting_entity_id
    and budget_version_id=p_budget_version_id;

  insert into public.accounting_budget_events(
    accounting_entity_id,budget_plan_id,budget_version_id,
    action,from_status,to_status,actor_user_id,actor_role,
    reason,request_key,request_fingerprint,metadata
  ) values (
    p_accounting_entity_id,v_plan_id,v_new_version_id,
    'revision_created',v_status,'draft',p_actor_id,v_role,
    v_reason,v_request_key,v_fingerprint,
    jsonb_build_object('parent_version_id',p_budget_version_id)
  );

  return jsonb_build_object(
    'ok',true,'state','revision_created',
    'budget_plan_id',v_plan_id,
    'budget_version_id',v_new_version_id,
    'parent_version_id',p_budget_version_id,
    'version_no',v_new_version_no,
    'status','draft'
  );
end;
$$;

revoke all on function public.accounting_budget_transition(
  uuid,uuid,text,text,uuid,text
) from public, anon, authenticated;
grant execute on function public.accounting_budget_transition(
  uuid,uuid,text,text,uuid,text
) to service_role;

create or replace function public.accounting_budget_analysis_snapshot(
  p_accounting_entity_id uuid,
  p_budget_plan_id uuid,
  p_forecast_plan_id uuid,
  p_actor_id uuid
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_role text;
  v_budget public.accounting_budget_plans%rowtype;
  v_forecast public.accounting_budget_plans%rowtype;
  v_budget_version_id uuid;
  v_forecast_version_id uuid;
  v_periods jsonb;
  v_budget_lines jsonb;
  v_forecast_lines jsonb;
  v_actual_lines jsonb;
begin
  if p_accounting_entity_id is null
     or p_budget_plan_id is null
     or p_actor_id is null then
    raise exception 'ACCOUNTING_BUDGET_ANALYSIS_IDENTIFIERS_REQUIRED';
  end if;

  select m.role into v_role
  from public.accounting_entity_members m
  where m.accounting_entity_id=p_accounting_entity_id
    and m.user_id=p_actor_id
    and m.status='active'
  limit 1;

  if v_role is null then
    raise exception 'ACCOUNTING_BUDGET_READ_FORBIDDEN';
  end if;

  select * into v_budget
  from public.accounting_budget_plans p
  where p.accounting_entity_id=p_accounting_entity_id
    and p.id=p_budget_plan_id
    and p.status='active'
    and p.plan_type='budget';

  if v_budget.id is null then
    raise exception 'ACCOUNTING_BUDGET_PLAN_NOT_FOUND';
  end if;

  select v.id into v_budget_version_id
  from public.accounting_budget_versions v
  where v.accounting_entity_id=p_accounting_entity_id
    and v.budget_plan_id=p_budget_plan_id
    and v.status='approved'
  limit 1;

  if v_budget_version_id is null then
    raise exception 'ACCOUNTING_BUDGET_APPROVED_VERSION_REQUIRED';
  end if;

  if p_forecast_plan_id is not null then
    select * into v_forecast
    from public.accounting_budget_plans p
    where p.accounting_entity_id=p_accounting_entity_id
      and p.id=p_forecast_plan_id
      and p.status='active'
      and p.plan_type='forecast';

    if v_forecast.id is null then
      raise exception 'ACCOUNTING_FORECAST_PLAN_NOT_FOUND';
    end if;

    if v_forecast.fiscal_year_start<>v_budget.fiscal_year_start
       or v_forecast.fiscal_year_end<>v_budget.fiscal_year_end
       or v_forecast.currency<>v_budget.currency then
      raise exception 'ACCOUNTING_FORECAST_PLAN_NOT_COMPARABLE';
    end if;

    select v.id into v_forecast_version_id
    from public.accounting_budget_versions v
    where v.accounting_entity_id=p_accounting_entity_id
      and v.budget_plan_id=p_forecast_plan_id
      and v.status='approved'
    limit 1;

    if v_forecast_version_id is null then
      raise exception 'ACCOUNTING_FORECAST_APPROVED_VERSION_REQUIRED';
    end if;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'period_id',p.id,
    'period',p.period_code,
    'starts_on',p.starts_on,
    'ends_on',p.ends_on,
    'accounting_status',p.status
  ) order by p.starts_on,p.ends_on,p.id),'[]'::jsonb)
  into v_periods
  from public.accounting_periods p
  where p.accounting_entity_id=p_accounting_entity_id
    and p.starts_on>=v_budget.fiscal_year_start
    and p.ends_on<=v_budget.fiscal_year_end;

  select coalesce(jsonb_agg(jsonb_build_object(
    'period_id',l.period_id,
    'period',p.period_code,
    'account_id',l.account_id,
    'account_code',a.code,
    'account_name',a.name,
    'account_type',a.account_type,
    'amount',l.amount,
    'dimensions',l.dimensions
  ) order by p.starts_on,a.code,l.dimensions::text),'[]'::jsonb)
  into v_budget_lines
  from public.accounting_budget_lines l
  join public.accounting_periods p
    on p.accounting_entity_id=l.accounting_entity_id
   and p.id=l.period_id
  join public.accounting_accounts a
    on a.accounting_entity_id=l.accounting_entity_id
   and a.id=l.account_id
  where l.accounting_entity_id=p_accounting_entity_id
    and l.budget_version_id=v_budget_version_id;

  if v_forecast_version_id is null then
    v_forecast_lines := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(jsonb_build_object(
      'period_id',l.period_id,
      'period',p.period_code,
      'account_id',l.account_id,
      'account_code',a.code,
      'account_name',a.name,
      'account_type',a.account_type,
      'amount',l.amount,
      'dimensions',l.dimensions
    ) order by p.starts_on,a.code,l.dimensions::text),'[]'::jsonb)
    into v_forecast_lines
    from public.accounting_budget_lines l
    join public.accounting_periods p
      on p.accounting_entity_id=l.accounting_entity_id
     and p.id=l.period_id
    join public.accounting_accounts a
      on a.accounting_entity_id=l.accounting_entity_id
     and a.id=l.account_id
    where l.accounting_entity_id=p_accounting_entity_id
      and l.budget_version_id=v_forecast_version_id;
  end if;

  with target_keys as (
    select distinct l.account_id,l.dimensions
    from public.accounting_budget_lines l
    where l.accounting_entity_id=p_accounting_entity_id
      and l.budget_version_id in (
        v_budget_version_id,
        coalesce(v_forecast_version_id,v_budget_version_id)
      )
  ),
  actual as (
    select
      j.period_id,
      l.account_id,
      l.dimensions,
      sum(l.debit)::numeric(20,2) as debit,
      sum(l.credit)::numeric(20,2) as credit
    from public.accounting_journal_entries j
    join public.accounting_journal_lines l
      on l.accounting_entity_id=j.accounting_entity_id
     and l.journal_entry_id=j.id
    join target_keys t
      on t.account_id=l.account_id
     and t.dimensions=l.dimensions
    where j.accounting_entity_id=p_accounting_entity_id
      and j.status='posted'
      and j.effective_at::date between
          v_budget.fiscal_year_start and v_budget.fiscal_year_end
    group by j.period_id,l.account_id,l.dimensions
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'period_id',x.period_id,
    'period',p.period_code,
    'account_id',x.account_id,
    'account_code',a.code,
    'account_name',a.name,
    'account_type',a.account_type,
    'debit',x.debit,
    'credit',x.credit,
    'dimensions',x.dimensions
  ) order by p.starts_on,a.code,x.dimensions::text),'[]'::jsonb)
  into v_actual_lines
  from actual x
  join public.accounting_periods p
    on p.accounting_entity_id=p_accounting_entity_id
   and p.id=x.period_id
  join public.accounting_accounts a
    on a.accounting_entity_id=p_accounting_entity_id
   and a.id=x.account_id;

  return jsonb_build_object(
    'ok',true,
    'accounting_entity_id',p_accounting_entity_id,
    'currency',v_budget.currency,
    'fiscal_year_start',v_budget.fiscal_year_start,
    'fiscal_year_end',v_budget.fiscal_year_end,
    'budget_plan_id',p_budget_plan_id,
    'budget_version_id',v_budget_version_id,
    'forecast_plan_id',p_forecast_plan_id,
    'forecast_version_id',v_forecast_version_id,
    'periods',v_periods,
    'budget_lines',v_budget_lines,
    'forecast_lines',v_forecast_lines,
    'actual_lines',v_actual_lines
  );
end;
$$;

revoke all on function public.accounting_budget_analysis_snapshot(
  uuid,uuid,uuid,uuid
) from public, anon, authenticated;
grant execute on function public.accounting_budget_analysis_snapshot(
  uuid,uuid,uuid,uuid
) to service_role;

do $$
declare
  service_count integer;
  existing_count integer;
begin
  select count(*) into service_count
  from public.service_catalog s
  join public.service_execution_profiles p on p.service_id=s.id
  where s.code='planning_budgeting_forecasting'
    and s.status='published'
    and s.is_active=true
    and p.is_active=true
    and p.primary_action='planning_budgeting_run';

  if service_count <> 1 then
    raise exception 'WAVE24_PLANNING_SERVICE_STATE_CHANGED';
  end if;

  select count(*) into existing_count
  from public.service_capability_map m
  join public.service_catalog s on s.id=m.service_id
  where s.code='planning_budgeting_forecasting'
    and m.capability_code in (
      'accounting_budget_plan_create',
      'accounting_budget_draft_save',
      'accounting_budget_version_transition',
      'accounting_budget_analysis'
    );

  if existing_count <> 0 then
    raise exception 'WAVE24_BUDGET_CAPABILITIES_ALREADY_MAPPED';
  end if;
end
$$;

update public.service_catalog
set metadata=metadata || '{
  "source":"financial_core_wave24",
  "governed_budget_baselines":true,
  "approved_versions_immutable":true,
  "canonical_ledger_actuals":true,
  "no_parallel_ledger":true,
  "no_ai_budget_values":true
}'::jsonb,
updated_at=now()
where code='planning_budgeting_forecasting';

update public.service_execution_profiles p
set version=p.version+1,
    metadata=p.metadata || '{
      "source":"financial_core_wave24",
      "budget_versioning":true,
      "fail_closed":true,
      "canonical_ledger_actuals":true
    }'::jsonb,
    updated_at=now()
from public.service_catalog s
where p.service_id=s.id
  and s.code='planning_budgeting_forecasting';

insert into public.service_capability_map(
  service_id,capability_code,run_order,is_required,metadata
)
select s.id,v.capability_code,v.run_order,false,
       jsonb_build_object('wave',24,'governed_budget',true)
from public.service_catalog s
cross join (
  values
    ('accounting_budget_plan_create',20),
    ('accounting_budget_draft_save',30),
    ('accounting_budget_version_transition',40),
    ('accounting_budget_analysis',50)
) as v(capability_code,run_order)
where s.code='planning_budgeting_forecasting';

commit;
