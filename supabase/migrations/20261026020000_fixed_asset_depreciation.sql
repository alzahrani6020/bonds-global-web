begin;

-- Wave 7: governed fixed-asset accounting depreciation.
-- Reuses canonical bonds_assets, accounting periods, accounts and atomic posting RPC.
-- Analytical valuation depreciation remains separate and is not used as an accounting posting amount.

alter table public.bonds_assets
  drop constraint if exists bonds_assets_residual_not_above_cost,
  add constraint bonds_assets_residual_not_above_cost
    check (
      acquisition_cost is null
      or residual_value is null
      or residual_value <= acquisition_cost
    );

create table if not exists public.accounting_asset_depreciation_policies (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  asset_id uuid not null,
  depreciation_method text not null default 'straight_line'
    check (depreciation_method in ('straight_line')),
  proration_method text not null default 'daily_actual'
    check (proration_method in ('daily_actual','full_month')),
  in_service_date date not null,
  depreciation_expense_account_id uuid not null,
  accumulated_depreciation_account_id uuid not null,
  status text not null default 'active'
    check (status in ('active','inactive')),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(accounting_entity_id, asset_id),
  foreign key (accounting_entity_id, asset_id)
    references public.bonds_assets(accounting_entity_id, id)
    on delete cascade,
  foreign key (accounting_entity_id, depreciation_expense_account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, accumulated_depreciation_account_id)
    references public.accounting_accounts(accounting_entity_id, id)
    on delete restrict,
  check (depreciation_expense_account_id <> accumulated_depreciation_account_id)
);

create index if not exists idx_asset_depreciation_policies_expense_account
  on public.accounting_asset_depreciation_policies(
    accounting_entity_id, depreciation_expense_account_id
  );

create index if not exists idx_asset_depreciation_policies_accum_account
  on public.accounting_asset_depreciation_policies(
    accounting_entity_id, accumulated_depreciation_account_id
  );

create index if not exists idx_asset_depreciation_policies_created_by
  on public.accounting_asset_depreciation_policies(created_by)
  where created_by is not null;

create table if not exists public.accounting_fixed_asset_depreciation_runs (
  id uuid primary key default gen_random_uuid(),
  accounting_entity_id uuid not null
    references public.accounting_entities(id) on delete cascade,
  asset_id uuid not null,
  period_id uuid not null,
  depreciation_method text not null,
  proration_method text not null,
  depreciable_base numeric(20,2) not null check (depreciable_base >= 0),
  depreciation_amount numeric(20,2) not null check (depreciation_amount > 0),
  accumulated_after numeric(20,2) not null check (accumulated_after >= 0),
  financial_event_id uuid not null,
  journal_entry_id uuid not null,
  created_at timestamptz not null default now(),
  unique(accounting_entity_id, asset_id, period_id),
  foreign key (accounting_entity_id, asset_id)
    references public.bonds_assets(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, period_id)
    references public.accounting_periods(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, financial_event_id)
    references public.financial_events(accounting_entity_id, id)
    on delete restrict,
  foreign key (accounting_entity_id, journal_entry_id)
    references public.accounting_journal_entries(accounting_entity_id, id)
    on delete restrict
);

create index if not exists idx_fixed_asset_depreciation_runs_asset
  on public.accounting_fixed_asset_depreciation_runs(
    accounting_entity_id, asset_id, created_at desc
  );

create index if not exists idx_fixed_asset_depreciation_runs_period
  on public.accounting_fixed_asset_depreciation_runs(
    accounting_entity_id, period_id
  );

create or replace function public.accounting_validate_asset_depreciation_policy()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cost numeric;
  v_residual numeric;
  v_life integer;
  v_lifecycle text;
  v_expense_type text;
  v_expense_postable boolean;
  v_accum_type text;
  v_accum_postable boolean;
begin
  select acquisition_cost, coalesce(residual_value,0), useful_life_months, lifecycle_status
    into v_cost, v_residual, v_life, v_lifecycle
  from public.bonds_assets
  where id = new.asset_id
    and accounting_entity_id = new.accounting_entity_id;

  if v_cost is null then
    raise exception 'FIXED_ASSET_ACQUISITION_COST_REQUIRED';
  end if;
  if v_cost <= 0 then
    raise exception 'FIXED_ASSET_ACQUISITION_COST_INVALID';
  end if;
  if v_residual < 0 or v_residual > v_cost then
    raise exception 'FIXED_ASSET_RESIDUAL_VALUE_INVALID';
  end if;
  if v_life is null or v_life <= 0 then
    raise exception 'FIXED_ASSET_USEFUL_LIFE_REQUIRED';
  end if;
  if v_lifecycle <> 'active' then
    raise exception 'FIXED_ASSET_NOT_ACTIVE';
  end if;

  select account_type, (is_active and is_postable)
    into v_expense_type, v_expense_postable
  from public.accounting_accounts
  where id = new.depreciation_expense_account_id
    and accounting_entity_id = new.accounting_entity_id;

  if v_expense_type <> 'expense' or coalesce(v_expense_postable,false) <> true then
    raise exception 'DEPRECIATION_EXPENSE_ACCOUNT_INVALID';
  end if;

  select account_type, (is_active and is_postable)
    into v_accum_type, v_accum_postable
  from public.accounting_accounts
  where id = new.accumulated_depreciation_account_id
    and accounting_entity_id = new.accounting_entity_id;

  if v_accum_type <> 'contra_asset' or coalesce(v_accum_postable,false) <> true then
    raise exception 'ACCUMULATED_DEPRECIATION_ACCOUNT_INVALID';
  end if;

  return new;
end;
$$;

revoke all on function public.accounting_validate_asset_depreciation_policy()
  from public, anon, authenticated;
grant execute on function public.accounting_validate_asset_depreciation_policy()
  to service_role;

drop trigger if exists trg_accounting_validate_asset_depreciation_policy
  on public.accounting_asset_depreciation_policies;

create trigger trg_accounting_validate_asset_depreciation_policy
before insert or update
on public.accounting_asset_depreciation_policies
for each row execute function public.accounting_validate_asset_depreciation_policy();

alter table public.accounting_asset_depreciation_policies enable row level security;
alter table public.accounting_fixed_asset_depreciation_runs enable row level security;

revoke all on public.accounting_asset_depreciation_policies from anon, authenticated;
revoke all on public.accounting_fixed_asset_depreciation_runs from anon, authenticated;

grant select, insert, update, delete
  on public.accounting_asset_depreciation_policies to service_role;
grant select, insert, update, delete
  on public.accounting_fixed_asset_depreciation_runs to service_role;

create or replace function public.accounting_post_asset_depreciation(
  p_accounting_entity_id uuid,
  p_asset_id uuid,
  p_period_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_asset_number text;
  v_cost numeric(20,2);
  v_residual numeric(20,2);
  v_life_months integer;
  v_currency text;
  v_lifecycle text;

  v_method text;
  v_proration text;
  v_in_service date;
  v_expense_account_id uuid;
  v_accum_account_id uuid;
  v_expense_code text;
  v_expense_name text;
  v_accum_code text;
  v_accum_name text;

  v_period_code text;
  v_period_start date;
  v_period_end date;
  v_period_status text;

  v_life_end_exclusive date;
  v_overlap_start date;
  v_overlap_end_exclusive date;
  v_service_days integer;
  v_overlap_days integer;

  v_base numeric(20,2);
  v_prior numeric(20,2);
  v_amount numeric(20,2);
  v_event_key text;
  v_idempotency text;
  v_event jsonb;
  v_posting jsonb;
  v_result jsonb;
  v_event_id uuid;
  v_journal_id uuid;
  v_run_id uuid;
  v_existing public.accounting_fixed_asset_depreciation_runs%rowtype;
begin
  if p_accounting_entity_id is null then
    raise exception 'ACCOUNTING_ENTITY_REQUIRED';
  end if;
  if p_asset_id is null then
    raise exception 'FIXED_ASSET_REQUIRED';
  end if;
  if p_period_id is null then
    raise exception 'ACCOUNTING_PERIOD_REQUIRED';
  end if;

  select *
    into v_existing
  from public.accounting_fixed_asset_depreciation_runs
  where accounting_entity_id = p_accounting_entity_id
    and asset_id = p_asset_id
    and period_id = p_period_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'state', 'replayed',
      'run_id', v_existing.id,
      'event_id', v_existing.financial_event_id,
      'posting_id', v_existing.journal_entry_id,
      'amount', v_existing.depreciation_amount,
      'accumulated_after', v_existing.accumulated_after
    );
  end if;

  select
    a.asset_number,
    a.acquisition_cost,
    coalesce(a.residual_value,0),
    a.useful_life_months,
    a.currency,
    a.lifecycle_status,
    p.depreciation_method,
    p.proration_method,
    p.in_service_date,
    p.depreciation_expense_account_id,
    p.accumulated_depreciation_account_id
  into
    v_asset_number,
    v_cost,
    v_residual,
    v_life_months,
    v_currency,
    v_lifecycle,
    v_method,
    v_proration,
    v_in_service,
    v_expense_account_id,
    v_accum_account_id
  from public.bonds_assets a
  join public.accounting_asset_depreciation_policies p
    on p.accounting_entity_id = a.accounting_entity_id
   and p.asset_id = a.id
   and p.status = 'active'
  where a.id = p_asset_id
    and a.accounting_entity_id = p_accounting_entity_id;

  if not found then
    raise exception 'FIXED_ASSET_DEPRECIATION_POLICY_REQUIRED';
  end if;
  if v_lifecycle <> 'active' then
    raise exception 'FIXED_ASSET_NOT_ACTIVE';
  end if;
  if v_cost is null or v_cost <= 0 then
    raise exception 'FIXED_ASSET_ACQUISITION_COST_INVALID';
  end if;
  if v_life_months is null or v_life_months <= 0 then
    raise exception 'FIXED_ASSET_USEFUL_LIFE_REQUIRED';
  end if;
  if v_residual < 0 or v_residual > v_cost then
    raise exception 'FIXED_ASSET_RESIDUAL_VALUE_INVALID';
  end if;
  if v_method <> 'straight_line' then
    raise exception 'DEPRECIATION_METHOD_UNSUPPORTED';
  end if;

  select period_code, starts_on, ends_on, status
    into v_period_code, v_period_start, v_period_end, v_period_status
  from public.accounting_periods
  where id = p_period_id
    and accounting_entity_id = p_accounting_entity_id;

  if not found then
    raise exception 'ACCOUNTING_PERIOD_ENTITY_MISMATCH';
  end if;
  if v_period_status <> 'open' then
    raise exception 'ACCOUNTING_PERIOD_NOT_OPEN';
  end if;

  select code, name
    into v_expense_code, v_expense_name
  from public.accounting_accounts
  where id = v_expense_account_id
    and accounting_entity_id = p_accounting_entity_id
    and account_type = 'expense'
    and is_active = true
    and is_postable = true;

  if not found then
    raise exception 'DEPRECIATION_EXPENSE_ACCOUNT_INVALID';
  end if;

  select code, name
    into v_accum_code, v_accum_name
  from public.accounting_accounts
  where id = v_accum_account_id
    and accounting_entity_id = p_accounting_entity_id
    and account_type = 'contra_asset'
    and is_active = true
    and is_postable = true;

  if not found then
    raise exception 'ACCUMULATED_DEPRECIATION_ACCOUNT_INVALID';
  end if;

  v_base := round(v_cost - v_residual,2);
  if v_base <= 0 then
    raise exception 'FIXED_ASSET_NO_DEPRECIABLE_BASE';
  end if;

  v_life_end_exclusive := (v_in_service + make_interval(months => v_life_months))::date;

  if v_proration = 'full_month' then
    if v_period_start <> date_trunc('month', v_period_start)::date
       or v_period_end <> (date_trunc('month', v_period_start) + interval '1 month - 1 day')::date then
      raise exception 'DEPRECIATION_FULL_MONTH_PERIOD_REQUIRED';
    end if;
    if v_in_service > v_period_end or v_period_start >= v_life_end_exclusive then
      raise exception 'DEPRECIATION_PERIOD_OUTSIDE_SERVICE_LIFE';
    end if;
    v_amount := round(v_base / v_life_months,2);
  elsif v_proration = 'daily_actual' then
    v_overlap_start := greatest(v_period_start, v_in_service);
    v_overlap_end_exclusive := least(v_period_end + 1, v_life_end_exclusive);
    if v_overlap_start >= v_overlap_end_exclusive then
      raise exception 'DEPRECIATION_PERIOD_OUTSIDE_SERVICE_LIFE';
    end if;
    v_service_days := v_life_end_exclusive - v_in_service;
    v_overlap_days := v_overlap_end_exclusive - v_overlap_start;
    if v_service_days <= 0 or v_overlap_days <= 0 then
      raise exception 'DEPRECIATION_PRORATION_INVALID';
    end if;
    v_amount := round(v_base * v_overlap_days::numeric / v_service_days::numeric,2);
  else
    raise exception 'DEPRECIATION_PRORATION_UNSUPPORTED';
  end if;

  select coalesce(sum(depreciation_amount),0)
    into v_prior
  from public.accounting_fixed_asset_depreciation_runs
  where accounting_entity_id = p_accounting_entity_id
    and asset_id = p_asset_id;

  if v_prior >= v_base then
    raise exception 'FIXED_ASSET_FULLY_DEPRECIATED';
  end if;

  v_amount := least(v_amount, round(v_base - v_prior,2));
  if v_amount <= 0 then
    raise exception 'DEPRECIATION_AMOUNT_NOT_POSITIVE';
  end if;

  v_event_key := 'asset-depreciation:' || p_asset_id::text || ':' || p_period_id::text;
  v_idempotency := md5(v_event_key) || md5(v_event_key || ':bonds');

  v_event := jsonb_build_object(
    'id', v_event_key,
    'type', 'asset.depreciation',
    'accounting_entity_id', p_accounting_entity_id,
    'occurred_at', now(),
    'effective_date', v_period_end::text,
    'amount', v_amount,
    'currency', v_currency,
    'source', jsonb_build_object(
      'system', 'fixed_asset_depreciation',
      'record_id', p_asset_id::text || ':' || p_period_id::text
    ),
    'idempotency_key', v_idempotency,
    'payload', jsonb_build_object(
      'asset_id', p_asset_id,
      'asset_number', v_asset_number,
      'period_id', p_period_id,
      'period_code', v_period_code,
      'depreciation_method', v_method,
      'proration_method', v_proration,
      'depreciable_base', v_base,
      'prior_accumulated', v_prior
    ),
    'evidence', '[]'::jsonb
  );

  v_posting := jsonb_build_object(
    'description', 'Fixed asset depreciation ' || v_asset_number || ' ' || v_period_code,
    'subledger', jsonb_build_object(
      'code', 'asset.depreciation',
      'source_record_id', p_asset_id::text || ':' || p_period_id::text
    ),
    'journal', jsonb_build_object(
      'status', 'ready_to_post',
      'total_debit', v_amount,
      'total_credit', v_amount,
      'lines', jsonb_build_array(
        jsonb_build_object(
          'line_no', 1,
          'account_code', v_expense_code,
          'account_name', v_expense_name,
          'debit', v_amount,
          'credit', 0,
          'dimensions', jsonb_build_object('asset_id', p_asset_id)
        ),
        jsonb_build_object(
          'line_no', 2,
          'account_code', v_accum_code,
          'account_name', v_accum_name,
          'debit', 0,
          'credit', v_amount,
          'dimensions', jsonb_build_object('asset_id', p_asset_id)
        )
      )
    )
  );

  v_result := public.accounting_commit_posting(v_event, v_posting);

  if coalesce((v_result->>'ok')::boolean,false) <> true then
    raise exception 'FIXED_ASSET_DEPRECIATION_POSTING_FAILED';
  end if;

  v_event_id := nullif(v_result->>'event_id','')::uuid;
  v_journal_id := nullif(v_result->>'posting_id','')::uuid;
  if v_event_id is null or v_journal_id is null then
    raise exception 'FIXED_ASSET_DEPRECIATION_POSTING_RESULT_INVALID';
  end if;

  insert into public.accounting_fixed_asset_depreciation_runs(
    accounting_entity_id,
    asset_id,
    period_id,
    depreciation_method,
    proration_method,
    depreciable_base,
    depreciation_amount,
    accumulated_after,
    financial_event_id,
    journal_entry_id
  ) values (
    p_accounting_entity_id,
    p_asset_id,
    p_period_id,
    v_method,
    v_proration,
    v_base,
    v_amount,
    round(v_prior + v_amount,2),
    v_event_id,
    v_journal_id
  )
  returning id into v_run_id;

  return jsonb_build_object(
    'ok', true,
    'state', coalesce(v_result->>'state','claimed'),
    'run_id', v_run_id,
    'event_id', v_event_id,
    'posting_id', v_journal_id,
    'amount', v_amount,
    'accumulated_after', round(v_prior + v_amount,2),
    'depreciable_base', v_base
  );
end;
$$;

revoke all on function public.accounting_post_asset_depreciation(uuid,uuid,uuid)
  from public, anon, authenticated;
grant execute on function public.accounting_post_asset_depreciation(uuid,uuid,uuid)
  to service_role;

comment on table public.accounting_asset_depreciation_policies is
  'Explicit governed accounting depreciation policy for canonical bonds_assets.';
comment on table public.accounting_fixed_asset_depreciation_runs is
  'Posted fixed-asset accounting depreciation by accounting period; one run per asset/period.';

commit;
