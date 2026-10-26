begin;

-- Financial Core Wave 17: group consolidation + intercompany foundation.
-- Canonical entity ledgers remain authoritative. No parallel ledger is created.

create table if not exists public.accounting_groups (
  id uuid primary key default gen_random_uuid(),
  parent_accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete restrict,
  code text not null,
  name text not null,
  presentation_currency text not null
    check (presentation_currency ~ '^[A-Z]{3}$'),
  status text not null default 'active'
    check (status in ('active','inactive','archived')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(parent_accounting_entity_id,code)
);

create table if not exists public.accounting_group_members (
  group_id uuid not null
    references public.accounting_groups(id) on delete cascade,
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete restrict,
  role text not null
    check (role in ('parent','subsidiary')),
  ownership_pct numeric(7,4) not null
    check (ownership_pct > 0 and ownership_pct <= 100),
  consolidation_method text not null default 'full'
    check (consolidation_method in ('full')),
  effective_from date,
  effective_to date,
  status text not null default 'active'
    check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(group_id,accounting_entity_id),
  check (effective_to is null or effective_from is null or effective_from <= effective_to),
  check (role <> 'parent' or ownership_pct = 100)
);

create unique index if not exists uq_accounting_group_parent_member
  on public.accounting_group_members(group_id)
  where role='parent' and status='active';

create index if not exists idx_accounting_group_members_entity
  on public.accounting_group_members(accounting_entity_id,status);

create table if not exists public.accounting_intercompany_links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null
    references public.accounting_groups(id) on delete cascade,
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete restrict,
  journal_line_id uuid not null
    references public.accounting_journal_lines(id) on delete restrict,
  counterparty_accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete restrict,
  pair_key text not null,
  intercompany_class text not null
    check (intercompany_class in ('balance','income','loan')),
  status text not null default 'open'
    check (status in ('open','matched','disputed','eliminated')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(group_id,journal_line_id),
  check (accounting_entity_id <> counterparty_accounting_entity_id)
);

create index if not exists idx_intercompany_group_pair
  on public.accounting_intercompany_links(group_id,pair_key);
create index if not exists idx_intercompany_counterparty
  on public.accounting_intercompany_links(
    group_id,counterparty_accounting_entity_id,status
  );

alter table public.accounting_groups enable row level security;
alter table public.accounting_group_members enable row level security;
alter table public.accounting_intercompany_links enable row level security;

revoke all on public.accounting_groups from public,anon,authenticated;
revoke all on public.accounting_group_members from public,anon,authenticated;
revoke all on public.accounting_intercompany_links from public,anon,authenticated;

grant select,insert,update,delete on public.accounting_groups to service_role;
grant select,insert,update,delete on public.accounting_group_members to service_role;
grant select,insert,update,delete on public.accounting_intercompany_links to service_role;

create or replace function public.accounting_configure_group(
  p_parent_accounting_entity_id uuid,
  p_code text,
  p_name text,
  p_presentation_currency text,
  p_members jsonb default '[]'::jsonb,
  p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_group_id uuid;
  v_code text := nullif(btrim(coalesce(p_code,'')),'');
  v_name text := nullif(btrim(coalesce(p_name,'')),'');
  v_currency text := upper(nullif(btrim(coalesce(p_presentation_currency,'')),''));
  v_member jsonb;
  v_entity_id uuid;
  v_ownership numeric;
begin
  if p_parent_accounting_entity_id is null then
    raise exception 'ACCOUNTING_GROUP_PARENT_REQUIRED';
  end if;
  if v_code is null or length(v_code) > 64 then
    raise exception 'ACCOUNTING_GROUP_CODE_INVALID';
  end if;
  if v_name is null or length(v_name) > 160 then
    raise exception 'ACCOUNTING_GROUP_NAME_INVALID';
  end if;
  if v_currency is null or v_currency !~ '^[A-Z]{3}$' then
    raise exception 'ACCOUNTING_GROUP_CURRENCY_INVALID';
  end if;
  if jsonb_typeof(coalesce(p_members,'[]'::jsonb)) <> 'array' then
    raise exception 'ACCOUNTING_GROUP_MEMBERS_ARRAY_REQUIRED';
  end if;
  if not exists(
    select 1 from public.accounting_entities e
    where e.id=p_parent_accounting_entity_id and e.status='active'
  ) then
    raise exception 'ACCOUNTING_GROUP_PARENT_NOT_ACTIVE';
  end if;

  insert into public.accounting_groups(
    parent_accounting_entity_id,code,name,presentation_currency,
    status,metadata,created_by
  ) values(
    p_parent_accounting_entity_id,v_code,v_name,v_currency,
    'active',coalesce(p_metadata,'{}'::jsonb),p_actor_id
  )
  on conflict(parent_accounting_entity_id,code) do update set
    name=excluded.name,
    presentation_currency=excluded.presentation_currency,
    status='active',
    metadata=public.accounting_groups.metadata || excluded.metadata,
    updated_at=now()
  returning id into v_group_id;

  insert into public.accounting_group_members(
    group_id,accounting_entity_id,role,ownership_pct,
    consolidation_method,status,metadata
  ) values(
    v_group_id,p_parent_accounting_entity_id,'parent',100,
    'full','active','{}'::jsonb
  )
  on conflict(group_id,accounting_entity_id) do update set
    role='parent',
    ownership_pct=100,
    consolidation_method='full',
    status='active',
    updated_at=now();

  for v_member in
    select value from jsonb_array_elements(coalesce(p_members,'[]'::jsonb))
  loop
    begin
      v_entity_id := (v_member->>'accounting_entity_id')::uuid;
    exception when others then
      raise exception 'ACCOUNTING_GROUP_MEMBER_ID_INVALID';
    end;
    v_ownership := nullif(v_member->>'ownership_pct','')::numeric;

    if v_entity_id=p_parent_accounting_entity_id then
      raise exception 'ACCOUNTING_GROUP_PARENT_DUPLICATED_AS_SUBSIDIARY';
    end if;
    if v_ownership is null or v_ownership <= 0 or v_ownership > 100 then
      raise exception 'ACCOUNTING_GROUP_OWNERSHIP_INVALID';
    end if;
    if not exists(
      select 1 from public.accounting_entities e
      where e.id=v_entity_id and e.status='active'
    ) then
      raise exception 'ACCOUNTING_GROUP_MEMBER_NOT_ACTIVE';
    end if;

    insert into public.accounting_group_members(
      group_id,accounting_entity_id,role,ownership_pct,
      consolidation_method,effective_from,effective_to,status,metadata
    ) values(
      v_group_id,v_entity_id,'subsidiary',v_ownership,
      'full',
      nullif(v_member->>'effective_from','')::date,
      nullif(v_member->>'effective_to','')::date,
      coalesce(nullif(v_member->>'status',''),'active'),
      coalesce(v_member->'metadata','{}'::jsonb)
    )
    on conflict(group_id,accounting_entity_id) do update set
      role='subsidiary',
      ownership_pct=excluded.ownership_pct,
      consolidation_method='full',
      effective_from=excluded.effective_from,
      effective_to=excluded.effective_to,
      status=excluded.status,
      metadata=public.accounting_group_members.metadata || excluded.metadata,
      updated_at=now();
  end loop;

  return jsonb_build_object(
    'ok',true,
    'group_id',v_group_id,
    'parent_accounting_entity_id',p_parent_accounting_entity_id
  );
end;
$$;

revoke all on function public.accounting_configure_group(
  uuid,text,text,text,jsonb,uuid,jsonb
) from public,anon,authenticated;
grant execute on function public.accounting_configure_group(
  uuid,text,text,text,jsonb,uuid,jsonb
) to service_role;

create or replace function public.accounting_link_intercompany(
  p_group_id uuid,
  p_accounting_entity_id uuid,
  p_journal_line_id uuid,
  p_counterparty_accounting_entity_id uuid,
  p_pair_key text,
  p_intercompany_class text,
  p_actor_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_pair_key text := nullif(btrim(coalesce(p_pair_key,'')),'');
  v_class text := lower(nullif(btrim(coalesce(p_intercompany_class,'')),''));
  v_id uuid;
  v_count integer;
  v_reciprocal integer;
begin
  if p_group_id is null then raise exception 'ACCOUNTING_GROUP_REQUIRED'; end if;
  if p_accounting_entity_id is null then raise exception 'ACCOUNTING_ENTITY_REQUIRED'; end if;
  if p_journal_line_id is null then raise exception 'ACCOUNTING_JOURNAL_LINE_REQUIRED'; end if;
  if p_counterparty_accounting_entity_id is null then
    raise exception 'INTERCOMPANY_COUNTERPARTY_REQUIRED';
  end if;
  if p_accounting_entity_id=p_counterparty_accounting_entity_id then
    raise exception 'INTERCOMPANY_COUNTERPARTY_SAME_ENTITY';
  end if;
  if v_pair_key is null or length(v_pair_key)>128 then
    raise exception 'INTERCOMPANY_PAIR_KEY_INVALID';
  end if;
  if v_class not in ('balance','income','loan') then
    raise exception 'INTERCOMPANY_CLASS_UNSUPPORTED';
  end if;
  if not exists(
    select 1 from public.accounting_groups g
    where g.id=p_group_id and g.status='active'
  ) then
    raise exception 'ACCOUNTING_GROUP_NOT_ACTIVE';
  end if;
  if not exists(
    select 1 from public.accounting_group_members m
    where m.group_id=p_group_id
      and m.accounting_entity_id=p_accounting_entity_id
      and m.status='active'
  ) or not exists(
    select 1 from public.accounting_group_members m
    where m.group_id=p_group_id
      and m.accounting_entity_id=p_counterparty_accounting_entity_id
      and m.status='active'
  ) then
    raise exception 'INTERCOMPANY_ENTITY_NOT_IN_GROUP';
  end if;
  if not exists(
    select 1
    from public.accounting_journal_lines l
    join public.accounting_journal_entries j
      on j.id=l.journal_entry_id
     and j.accounting_entity_id=l.accounting_entity_id
    where l.id=p_journal_line_id
      and l.accounting_entity_id=p_accounting_entity_id
      and j.status='posted'
  ) then
    raise exception 'INTERCOMPANY_POSTED_JOURNAL_LINE_NOT_FOUND';
  end if;

  insert into public.accounting_intercompany_links(
    group_id,accounting_entity_id,journal_line_id,
    counterparty_accounting_entity_id,pair_key,
    intercompany_class,status,metadata,created_by
  ) values(
    p_group_id,p_accounting_entity_id,p_journal_line_id,
    p_counterparty_accounting_entity_id,v_pair_key,
    v_class,'open',coalesce(p_metadata,'{}'::jsonb),p_actor_id
  )
  on conflict(group_id,journal_line_id) do update set
    counterparty_accounting_entity_id=excluded.counterparty_accounting_entity_id,
    pair_key=excluded.pair_key,
    intercompany_class=excluded.intercompany_class,
    status='open',
    metadata=public.accounting_intercompany_links.metadata || excluded.metadata,
    updated_at=now()
  returning id into v_id;

  select count(*) into v_count
  from public.accounting_intercompany_links l
  where l.group_id=p_group_id and l.pair_key=v_pair_key;

  if v_count=2 then
    select count(*) into v_reciprocal
    from public.accounting_intercompany_links a
    join public.accounting_intercompany_links b
      on b.group_id=a.group_id
     and b.pair_key=a.pair_key
     and b.id<>a.id
     and b.accounting_entity_id=a.counterparty_accounting_entity_id
     and b.counterparty_accounting_entity_id=a.accounting_entity_id
    where a.group_id=p_group_id and a.pair_key=v_pair_key;

    if v_reciprocal=2 then
      update public.accounting_intercompany_links
      set status='matched',updated_at=now()
      where group_id=p_group_id and pair_key=v_pair_key;
    end if;
  end if;

  return jsonb_build_object(
    'ok',true,
    'link_id',v_id,
    'pair_key',v_pair_key,
    'pair_count',v_count
  );
end;
$$;

revoke all on function public.accounting_link_intercompany(
  uuid,uuid,uuid,uuid,text,text,uuid,jsonb
) from public,anon,authenticated;
grant execute on function public.accounting_link_intercompany(
  uuid,uuid,uuid,uuid,text,text,uuid,jsonb
) to service_role;

create or replace function public.accounting_group_consolidation_source(
  p_group_id uuid,
  p_from date default null,
  p_to date default null
)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public
as $$
declare
  v_group jsonb;
  v_members jsonb;
  v_balance jsonb;
  v_period jsonb;
  v_links jsonb;
begin
  if p_group_id is null then raise exception 'ACCOUNTING_GROUP_REQUIRED'; end if;
  if p_from is not null and p_to is not null and p_from>p_to then
    raise exception 'ACCOUNTING_REPORT_DATE_RANGE_INVALID';
  end if;

  select jsonb_build_object(
    'id',g.id,
    'parent_accounting_entity_id',g.parent_accounting_entity_id,
    'code',g.code,
    'name',g.name,
    'presentation_currency',g.presentation_currency
  )
  into v_group
  from public.accounting_groups g
  where g.id=p_group_id and g.status='active';

  if v_group is null then raise exception 'ACCOUNTING_GROUP_NOT_ACTIVE'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'entity_id',m.accounting_entity_id,
    'role',m.role,
    'ownership_pct',m.ownership_pct,
    'effective_from',m.effective_from,
    'effective_to',m.effective_to
  ) order by case when m.role='parent' then 0 else 1 end,m.accounting_entity_id),'[]'::jsonb)
  into v_members
  from public.accounting_group_members m
  where m.group_id=p_group_id and m.status='active'
    and (p_to is null or m.effective_from is null or m.effective_from<=p_to)
    and (p_from is null or m.effective_to is null or m.effective_to>=p_from);

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
  into v_balance
  from (
    select
      m.accounting_entity_id as entity_id,
      m.role,
      m.ownership_pct,
      a.code as account_code,
      a.name as account_name,
      a.account_type,
      sum(l.debit)::numeric as debit,
      sum(l.credit)::numeric as credit
    from public.accounting_group_members m
    join public.accounting_journal_entries j
      on j.accounting_entity_id=m.accounting_entity_id
     and j.status='posted'
    join public.accounting_journal_lines l
      on l.journal_entry_id=j.id
     and l.accounting_entity_id=j.accounting_entity_id
    join public.accounting_accounts a
      on a.id=l.account_id
     and a.accounting_entity_id=l.accounting_entity_id
    where m.group_id=p_group_id and m.status='active'
      and (p_to is null or j.effective_at::date<=p_to)
      and (p_to is null or m.effective_from is null or m.effective_from<=p_to)
      and (p_from is null or m.effective_to is null or m.effective_to>=p_from)
    group by m.accounting_entity_id,m.role,m.ownership_pct,
             a.code,a.name,a.account_type
    order by m.accounting_entity_id,a.code
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
  into v_period
  from (
    select
      m.accounting_entity_id as entity_id,
      m.role,
      m.ownership_pct,
      a.code as account_code,
      a.name as account_name,
      a.account_type,
      sum(l.debit)::numeric as debit,
      sum(l.credit)::numeric as credit
    from public.accounting_group_members m
    join public.accounting_journal_entries j
      on j.accounting_entity_id=m.accounting_entity_id
     and j.status='posted'
    join public.accounting_journal_lines l
      on l.journal_entry_id=j.id
     and l.accounting_entity_id=j.accounting_entity_id
    join public.accounting_accounts a
      on a.id=l.account_id
     and a.accounting_entity_id=l.accounting_entity_id
    where m.group_id=p_group_id and m.status='active'
      and (p_from is null or j.effective_at::date>=p_from)
      and (p_to is null or j.effective_at::date<=p_to)
      and a.account_type in (
        'revenue','contra_revenue','expense','contra_expense'
      )
      and (p_to is null or m.effective_from is null or m.effective_from<=p_to)
      and (p_from is null or m.effective_to is null or m.effective_to>=p_from)
    group by m.accounting_entity_id,m.role,m.ownership_pct,
             a.code,a.name,a.account_type
    order by m.accounting_entity_id,a.code
  ) x;

  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb)
  into v_links
  from (
    select
      ic.id,
      ic.pair_key,
      ic.intercompany_class,
      ic.status,
      ic.accounting_entity_id,
      ic.counterparty_accounting_entity_id,
      l.id as journal_line_id,
      l.account_code,
      l.account_name,
      a.account_type,
      l.debit,
      l.credit,
      j.effective_at
    from public.accounting_intercompany_links ic
    join public.accounting_journal_lines l on l.id=ic.journal_line_id
    join public.accounting_journal_entries j
      on j.id=l.journal_entry_id and j.status='posted'
    join public.accounting_accounts a
      on a.id=l.account_id
     and a.accounting_entity_id=l.accounting_entity_id
    where ic.group_id=p_group_id
      and ic.status in ('open','matched','disputed')
      and (p_to is null or j.effective_at::date<=p_to)
      and (
        ic.intercompany_class in ('balance','loan')
        or p_from is null
        or j.effective_at::date>=p_from
      )
    order by ic.pair_key,ic.accounting_entity_id
  ) x;

  return jsonb_build_object(
    'group',v_group,
    'members',v_members,
    'balance_rows',v_balance,
    'period_rows',v_period,
    'intercompany_links',v_links
  );
end;
$$;

revoke all on function public.accounting_group_consolidation_source(
  uuid,date,date
) from public,anon,authenticated;
grant execute on function public.accounting_group_consolidation_source(
  uuid,date,date
) to service_role;

commit;
