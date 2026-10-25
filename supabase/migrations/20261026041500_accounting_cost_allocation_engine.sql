begin;

-- Wave 12: governed cost allocation engine.
-- Reuses the canonical account/dimension masters and the existing atomic
-- accounting_commit_posting() path. No parallel ledger or journal path.

create table if not exists public.accounting_allocation_rules (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  code text not null,
  name text not null,
  source_account_id uuid not null,
  source_dimensions jsonb not null default '{}'::jsonb,
  allocation_method text not null default 'fixed_percentage'
    check (allocation_method in ('fixed_percentage')),
  status text not null default 'active'
    check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  configured_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(accounting_entity_id, code),
  unique(accounting_entity_id, id),
  foreign key (accounting_entity_id, source_account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict
);

create table if not exists public.accounting_allocation_targets (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  rule_id uuid not null,
  line_no integer not null check (line_no > 0),
  target_account_id uuid not null,
  weight_basis_points integer not null
    check (weight_basis_points > 0 and weight_basis_points <= 10000),
  dimensions jsonb not null default '{}'::jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique(accounting_entity_id, rule_id, line_no),
  foreign key (accounting_entity_id, rule_id)
    references public.accounting_allocation_rules(accounting_entity_id, id)
    on delete cascade,
  foreign key (accounting_entity_id, target_account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_accounting_allocation_rules_entity_status
  on public.accounting_allocation_rules(accounting_entity_id, status);

create index if not exists idx_accounting_allocation_rules_configured_by
  on public.accounting_allocation_rules(configured_by)
  where configured_by is not null;

create index if not exists idx_accounting_allocation_targets_rule
  on public.accounting_allocation_targets(accounting_entity_id, rule_id, line_no);

create index if not exists idx_accounting_allocation_targets_account
  on public.accounting_allocation_targets(accounting_entity_id, target_account_id);

alter table public.accounting_allocation_rules enable row level security;
alter table public.accounting_allocation_targets enable row level security;

revoke all on public.accounting_allocation_rules from anon, authenticated;
revoke all on public.accounting_allocation_targets from anon, authenticated;

grant select, insert, update, delete
  on public.accounting_allocation_rules to service_role;
grant select, insert, update, delete
  on public.accounting_allocation_targets to service_role;

create or replace function public.accounting_assert_account_dimensions(
  p_accounting_entity_id uuid,
  p_account_id uuid,
  p_dimensions jsonb
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_dimensions jsonb := coalesce(p_dimensions, '{}'::jsonb);
  v_key text;
  v_value text;
  v_dimension_type text;
begin
  if p_accounting_entity_id is null or p_account_id is null then
    raise exception 'ACCOUNTING_DIMENSION_CONTEXT_REQUIRED';
  end if;

  if jsonb_typeof(v_dimensions) <> 'object' then
    raise exception 'ACCOUNTING_DIMENSIONS_OBJECT_REQUIRED';
  end if;

  for v_key, v_value in
    select key, value #>> '{}'
    from jsonb_each(v_dimensions)
  loop
    if v_key not in ('cost_center','segment') then
      raise exception 'ACCOUNTING_DIMENSION_KEY_UNSUPPORTED';
    end if;

    if jsonb_typeof(v_dimensions -> v_key) <> 'string'
       or nullif(btrim(v_value),'') is null then
      raise exception 'ACCOUNTING_DIMENSION_CODE_INVALID';
    end if;

    v_dimension_type := case
      when v_key = 'cost_center' then 'cost_center'
      when v_key = 'segment' then 'segment'
      else null
    end;

    if not exists (
      select 1
      from public.accounting_dimensions d
      where d.accounting_entity_id = p_accounting_entity_id
        and d.dimension_type = v_dimension_type
        and d.code = v_value
        and d.status = 'active'
    ) then
      raise exception 'ACCOUNTING_DIMENSION_NOT_ACTIVE_OR_NOT_FOUND';
    end if;
  end loop;

  for v_dimension_type in
    select p.dimension_type
    from public.accounting_account_dimension_policies p
    where p.accounting_entity_id = p_accounting_entity_id
      and p.account_id = p_account_id
      and p.required = true
      and p.status = 'active'
  loop
    if not (v_dimensions ? v_dimension_type)
       or jsonb_typeof(v_dimensions -> v_dimension_type) <> 'string'
       or nullif(btrim(v_dimensions ->> v_dimension_type),'') is null then
      raise exception 'ACCOUNTING_REQUIRED_DIMENSION_MISSING';
    end if;
  end loop;
end;
$$;

revoke all on function public.accounting_assert_account_dimensions(uuid,uuid,jsonb)
  from public, anon, authenticated;
grant execute on function public.accounting_assert_account_dimensions(uuid,uuid,jsonb)
  to service_role;

create or replace function public.accounting_validate_journal_dimensions()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.dimensions is null then
    new.dimensions := '{}'::jsonb;
  end if;

  perform public.accounting_assert_account_dimensions(
    new.accounting_entity_id,
    new.account_id,
    new.dimensions
  );

  return new;
end;
$$;

revoke all on function public.accounting_validate_journal_dimensions()
  from public, anon, authenticated;
grant execute on function public.accounting_validate_journal_dimensions()
  to service_role;

create or replace function public.accounting_configure_allocation_rule(
  p_accounting_entity_id uuid,
  p_rule_code text,
  p_name text,
  p_source_account_id uuid,
  p_source_dimensions jsonb,
  p_targets jsonb,
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
  v_rule_id uuid;
  v_source_dimensions jsonb := coalesce(p_source_dimensions, '{}'::jsonb);
  v_target jsonb;
  v_target_dimensions jsonb;
  v_target_account_id uuid;
  v_weight integer;
  v_ordinal bigint;
  v_total_weight integer := 0;
  v_target_count integer := 0;
  v_has_effect boolean := false;
begin
  if p_accounting_entity_id is null or p_source_account_id is null or p_actor_id is null then
    raise exception 'ACCOUNTING_ALLOCATION_IDENTIFIERS_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.accounting_entities e
    where e.id = p_accounting_entity_id
      and e.status = 'active'
  ) then
    raise exception 'ACCOUNTING_ENTITY_NOT_ACTIVE';
  end if;

  if nullif(btrim(p_rule_code),'') is null
     or length(btrim(p_rule_code)) > 64
     or btrim(p_rule_code) !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'ACCOUNTING_ALLOCATION_RULE_CODE_INVALID';
  end if;

  if nullif(btrim(p_name),'') is null or length(btrim(p_name)) > 200 then
    raise exception 'ACCOUNTING_ALLOCATION_RULE_NAME_INVALID';
  end if;

  if coalesce(p_status,'active') not in ('active','inactive') then
    raise exception 'ACCOUNTING_ALLOCATION_RULE_STATUS_INVALID';
  end if;

  if not exists (
    select 1
    from public.accounting_accounts a
    where a.accounting_entity_id = p_accounting_entity_id
      and a.id = p_source_account_id
      and a.account_type = 'expense'
      and a.is_active = true
      and a.is_postable = true
  ) then
    raise exception 'ACCOUNTING_ALLOCATION_SOURCE_EXPENSE_ACCOUNT_REQUIRED';
  end if;

  perform public.accounting_assert_account_dimensions(
    p_accounting_entity_id,
    p_source_account_id,
    v_source_dimensions
  );

  if p_targets is null
     or jsonb_typeof(p_targets) <> 'array'
     or jsonb_array_length(p_targets) < 1
     or jsonb_array_length(p_targets) > 100 then
    raise exception 'ACCOUNTING_ALLOCATION_TARGETS_INVALID';
  end if;

  for v_target, v_ordinal in
    select value, ordinality
    from jsonb_array_elements(p_targets) with ordinality
  loop
    v_target_count := v_target_count + 1;
    v_target_account_id := nullif(v_target->>'account_id','')::uuid;
    v_weight := nullif(v_target->>'weight_basis_points','')::integer;
    v_target_dimensions := coalesce(v_target->'dimensions','{}'::jsonb);

    if v_target_account_id is null or v_weight is null
       or v_weight <= 0 or v_weight > 10000 then
      raise exception 'ACCOUNTING_ALLOCATION_TARGET_INVALID';
    end if;

    if not exists (
      select 1
      from public.accounting_accounts a
      where a.accounting_entity_id = p_accounting_entity_id
        and a.id = v_target_account_id
        and a.account_type = 'expense'
        and a.is_active = true
        and a.is_postable = true
    ) then
      raise exception 'ACCOUNTING_ALLOCATION_TARGET_EXPENSE_ACCOUNT_REQUIRED';
    end if;

    perform public.accounting_assert_account_dimensions(
      p_accounting_entity_id,
      v_target_account_id,
      v_target_dimensions
    );

    v_total_weight := v_total_weight + v_weight;

    if v_target_account_id <> p_source_account_id
       or v_target_dimensions <> v_source_dimensions then
      v_has_effect := true;
    end if;
  end loop;

  if v_total_weight <> 10000 then
    raise exception 'ACCOUNTING_ALLOCATION_WEIGHTS_MUST_EQUAL_10000';
  end if;

  if not v_has_effect then
    raise exception 'ACCOUNTING_ALLOCATION_NO_EFFECT';
  end if;

  insert into public.accounting_allocation_rules(
    accounting_entity_id,
    code,
    name,
    source_account_id,
    source_dimensions,
    allocation_method,
    status,
    metadata,
    configured_by,
    updated_at
  )
  values(
    p_accounting_entity_id,
    btrim(p_rule_code),
    btrim(p_name),
    p_source_account_id,
    v_source_dimensions,
    'fixed_percentage',
    coalesce(p_status,'active'),
    coalesce(p_metadata,'{}'::jsonb),
    p_actor_id,
    now()
  )
  on conflict(accounting_entity_id,code) do update
  set
    name=excluded.name,
    source_account_id=excluded.source_account_id,
    source_dimensions=excluded.source_dimensions,
    allocation_method=excluded.allocation_method,
    status=excluded.status,
    metadata=excluded.metadata,
    configured_by=excluded.configured_by,
    updated_at=now()
  returning id into v_rule_id;

  delete from public.accounting_allocation_targets
  where accounting_entity_id = p_accounting_entity_id
    and rule_id = v_rule_id;

  for v_target, v_ordinal in
    select value, ordinality
    from jsonb_array_elements(p_targets) with ordinality
  loop
    insert into public.accounting_allocation_targets(
      accounting_entity_id,
      rule_id,
      line_no,
      target_account_id,
      weight_basis_points,
      dimensions,
      metadata
    )
    values(
      p_accounting_entity_id,
      v_rule_id,
      v_ordinal::integer,
      (v_target->>'account_id')::uuid,
      (v_target->>'weight_basis_points')::integer,
      coalesce(v_target->'dimensions','{}'::jsonb),
      coalesce(v_target->'metadata','{}'::jsonb)
    );
  end loop;

  return jsonb_build_object(
    'ok',true,
    'rule_id',v_rule_id,
    'rule_code',btrim(p_rule_code),
    'target_count',v_target_count,
    'total_weight_basis_points',v_total_weight,
    'status',coalesce(p_status,'active')
  );
end;
$$;

revoke all on function public.accounting_configure_allocation_rule(
  uuid,text,text,uuid,jsonb,jsonb,text,uuid,jsonb
) from public, anon, authenticated;
grant execute on function public.accounting_configure_allocation_rule(
  uuid,text,text,uuid,jsonb,jsonb,text,uuid,jsonb
) to service_role;

create or replace function public.accounting_execute_allocation(
  p_accounting_entity_id uuid,
  p_rule_id uuid,
  p_amount numeric,
  p_effective_at timestamptz,
  p_request_key text,
  p_actor_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_rule public.accounting_allocation_rules%rowtype;
  v_source_code text;
  v_source_name text;
  v_request_key text := btrim(coalesce(p_request_key,''));
  v_idempotency text;
  v_target_count integer;
  v_total_weight integer;
  v_counter integer := 0;
  v_allocated numeric(20,2) := 0;
  v_target_amount numeric(20,2);
  v_target record;
  v_lines jsonb;
  v_event jsonb;
  v_posting jsonb;
  v_result jsonb;
begin
  if p_accounting_entity_id is null or p_rule_id is null or p_actor_id is null then
    raise exception 'ACCOUNTING_ALLOCATION_IDENTIFIERS_REQUIRED';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'ACCOUNTING_ALLOCATION_AMOUNT_INVALID';
  end if;

  if p_effective_at is null then
    raise exception 'ACCOUNTING_ALLOCATION_EFFECTIVE_AT_REQUIRED';
  end if;

  if v_request_key = ''
     or length(v_request_key) > 128
     or v_request_key !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'ACCOUNTING_ALLOCATION_REQUEST_KEY_INVALID';
  end if;

  select *
  into v_rule
  from public.accounting_allocation_rules r
  where r.accounting_entity_id = p_accounting_entity_id
    and r.id = p_rule_id
    and r.status = 'active'
    and r.allocation_method = 'fixed_percentage';

  if v_rule.id is null then
    raise exception 'ACCOUNTING_ALLOCATION_ACTIVE_RULE_REQUIRED';
  end if;

  select a.code, a.name
  into v_source_code, v_source_name
  from public.accounting_accounts a
  where a.accounting_entity_id = p_accounting_entity_id
    and a.id = v_rule.source_account_id
    and a.account_type = 'expense'
    and a.is_active = true
    and a.is_postable = true;

  if v_source_code is null then
    raise exception 'ACCOUNTING_ALLOCATION_SOURCE_EXPENSE_ACCOUNT_REQUIRED';
  end if;

  perform public.accounting_assert_account_dimensions(
    p_accounting_entity_id,
    v_rule.source_account_id,
    v_rule.source_dimensions
  );

  select count(*)::integer, coalesce(sum(weight_basis_points),0)::integer
  into v_target_count, v_total_weight
  from public.accounting_allocation_targets
  where accounting_entity_id = p_accounting_entity_id
    and rule_id = p_rule_id;

  if v_target_count < 1 or v_total_weight <> 10000 then
    raise exception 'ACCOUNTING_ALLOCATION_RULE_TARGETS_INVALID';
  end if;

  v_lines := jsonb_build_array(
    jsonb_build_object(
      'line_no',1,
      'account_code',v_source_code,
      'account_name',v_source_name,
      'debit',0,
      'credit',round(p_amount,2),
      'dimensions',v_rule.source_dimensions
    )
  );

  for v_target in
    select
      t.line_no,
      t.weight_basis_points,
      t.dimensions,
      a.id as account_id,
      a.code as account_code,
      a.name as account_name,
      a.account_type,
      a.is_active,
      a.is_postable
    from public.accounting_allocation_targets t
    join public.accounting_accounts a
      on a.accounting_entity_id = t.accounting_entity_id
     and a.id = t.target_account_id
    where t.accounting_entity_id = p_accounting_entity_id
      and t.rule_id = p_rule_id
    order by t.line_no
  loop
    if v_target.account_type <> 'expense'
       or v_target.is_active <> true
       or v_target.is_postable <> true then
      raise exception 'ACCOUNTING_ALLOCATION_TARGET_EXPENSE_ACCOUNT_REQUIRED';
    end if;

    perform public.accounting_assert_account_dimensions(
      p_accounting_entity_id,
      v_target.account_id,
      v_target.dimensions
    );

    v_counter := v_counter + 1;

    if v_counter = v_target_count then
      v_target_amount := round(p_amount,2) - v_allocated;
    else
      v_target_amount := round(
        round(p_amount,2) * v_target.weight_basis_points::numeric / 10000,
        2
      );
    end if;

    if v_target_amount <= 0 then
      raise exception 'ACCOUNTING_ALLOCATION_TARGET_AMOUNT_ZERO';
    end if;

    v_allocated := v_allocated + v_target_amount;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'line_no',v_counter + 1,
        'account_code',v_target.account_code,
        'account_name',v_target.account_name,
        'debit',v_target_amount,
        'credit',0,
        'dimensions',v_target.dimensions
      )
    );
  end loop;

  if v_allocated <> round(p_amount,2) then
    raise exception 'ACCOUNTING_ALLOCATION_ROUNDING_MISMATCH';
  end if;

  v_idempotency := encode(
    digest(
      p_accounting_entity_id::text || ':' ||
      p_rule_id::text || ':' ||
      v_request_key,
      'sha256'
    ),
    'hex'
  );

  v_event := jsonb_build_object(
    'accounting_entity_id',p_accounting_entity_id,
    'id','cost.allocation:' || v_idempotency,
    'type','cost.allocation',
    'idempotency_key',v_idempotency,
    'occurred_at',now(),
    'effective_date',p_effective_at,
    'amount',round(p_amount,2),
    'currency',coalesce(
      (
        select e.base_currency
        from public.accounting_entities e
        where e.id = p_accounting_entity_id
      ),
      'SAR'
    ),
    'source',jsonb_build_object(
      'system','accounting_allocation',
      'record_id',p_rule_id::text || ':' || v_request_key
    ),
    'service_code','accounting_operations',
    'payload',jsonb_build_object(
      'rule_id',p_rule_id,
      'rule_code',v_rule.code,
      'request_key',v_request_key,
      'actor_id',p_actor_id
    ),
    'evidence','[]'::jsonb
  );

  v_posting := jsonb_build_object(
    'description','Cost allocation: ' || v_rule.name,
    'subledger',jsonb_build_object(
      'code','cost_allocation',
      'source_record_id',p_rule_id::text || ':' || v_request_key
    ),
    'journal',jsonb_build_object(
      'total_debit',round(p_amount,2),
      'total_credit',round(p_amount,2),
      'lines',v_lines
    )
  );

  v_result := public.accounting_commit_posting(v_event,v_posting);

  return v_result || jsonb_build_object(
    'allocation_rule_id',p_rule_id,
    'allocation_rule_code',v_rule.code,
    'allocated_amount',round(p_amount,2),
    'target_count',v_target_count
  );
end;
$$;

revoke all on function public.accounting_execute_allocation(
  uuid,uuid,numeric,timestamptz,text,uuid
) from public, anon, authenticated;
grant execute on function public.accounting_execute_allocation(
  uuid,uuid,numeric,timestamptz,text,uuid
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
  jsonb_build_object('wave',12,'mapped_action',true)
from public.service_catalog s
cross join (
  values
    ('accounting_allocation_rule_configure',70),
    ('accounting_allocation_execute',80)
) as v(capability_code,run_order)
where s.code='accounting_operations'
on conflict(service_id,capability_code) do update
set
  run_order=excluded.run_order,
  is_required=excluded.is_required,
  metadata=excluded.metadata;

comment on table public.accounting_allocation_rules is
  'Governed deterministic cost-allocation rules that post through accounting_commit_posting().';

comment on table public.accounting_allocation_targets is
  'Normalized weighted targets for governed cost-allocation rules; basis points must total 10000 per active executable rule.';

commit;
