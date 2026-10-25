begin;

-- Wave 12 recovery: Supabase installs pgcrypto digest() in the extensions
-- schema while the allocation RPC intentionally uses search_path=public.
-- Qualify digest explicitly without broadening the function search_path.

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
    extensions.digest(
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

commit;
