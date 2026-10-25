begin;

create or replace function public.accounting_commit_posting(
  p_event jsonb,
  p_posting jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_entity uuid;
  v_event_key text;
  v_event_type text;
  v_idempotency text;
  v_existing_event uuid;
  v_existing_event_key text;
  v_existing_journal uuid;
  v_event_id uuid;
  v_subledger_id uuid;
  v_journal_id uuid;
  v_period_id uuid;
  v_period_status text;
  v_effective timestamptz;
  v_amount numeric(20,2);
  v_currency text;
  v_total_debit numeric(20,2);
  v_total_credit numeric(20,2);
  v_line jsonb;
  v_line_count integer := 0;
  v_calc_debit numeric(20,2) := 0;
  v_calc_credit numeric(20,2) := 0;
  v_debit numeric(20,2);
  v_credit numeric(20,2);
begin
  v_entity := nullif(p_event->>'accounting_entity_id','')::uuid;
  if v_entity is null then
    raise exception 'FINANCIAL_EVENT_ACCOUNTING_ENTITY_REQUIRED';
  end if;

  if not exists (
    select 1 from public.accounting_entities
    where id = v_entity and status = 'active'
  ) then
    raise exception 'ACCOUNTING_ENTITY_NOT_ACTIVE';
  end if;

  v_event_key := nullif(p_event->>'id','');
  v_event_type := nullif(p_event->>'type','');
  v_idempotency := lower(nullif(p_event->>'idempotency_key',''));
  v_effective := nullif(p_event->>'effective_date','')::timestamptz;
  v_amount := nullif(p_event->>'amount','')::numeric;
  v_currency := upper(coalesce(nullif(p_event->>'currency',''),'SAR'));

  if v_event_key is null or v_event_type is null then
    raise exception 'FINANCIAL_EVENT_ID_OR_TYPE_REQUIRED';
  end if;
  if v_idempotency is null or v_idempotency !~ '^[0-9a-f]{64}$' then
    raise exception 'FINANCIAL_EVENT_IDEMPOTENCY_KEY_INVALID';
  end if;
  if v_effective is null then
    raise exception 'FINANCIAL_EVENT_EFFECTIVE_DATE_INVALID';
  end if;
  if v_amount is null or v_amount <= 0 then
    raise exception 'FINANCIAL_EVENT_AMOUNT_INVALID';
  end if;
  if v_currency !~ '^[A-Z]{3}$' then
    raise exception 'FINANCIAL_EVENT_CURRENCY_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_entity::text || ':' || v_idempotency, 0));

  select id, event_key
    into v_existing_event, v_existing_event_key
  from public.financial_events
  where accounting_entity_id = v_entity
    and idempotency_key = v_idempotency
  limit 1;

  if v_existing_event is not null then
    if v_existing_event_key <> v_event_key then
      raise exception 'POSTING_IDEMPOTENCY_CONFLICT';
    end if;
    select id into v_existing_journal
    from public.accounting_journal_entries
    where accounting_entity_id = v_entity
      and financial_event_id = v_existing_event
    limit 1;

    return jsonb_build_object(
      'ok', true,
      'state', 'replayed',
      'event_id', v_existing_event,
      'posting_id', v_existing_journal
    );
  end if;

  select id, status
    into v_period_id, v_period_status
  from public.accounting_periods
  where accounting_entity_id = v_entity
    and v_effective::date between starts_on and ends_on
  order by starts_on desc
  limit 1;

  if v_period_id is null then
    raise exception 'ACCOUNTING_OPEN_PERIOD_REQUIRED';
  end if;
  if v_period_status <> 'open' then
    raise exception 'ACCOUNTING_PERIOD_NOT_OPEN';
  end if;

  v_total_debit := nullif(p_posting#>>'{journal,total_debit}','')::numeric;
  v_total_credit := nullif(p_posting#>>'{journal,total_credit}','')::numeric;
  if v_total_debit is null or v_total_credit is null or v_total_debit <= 0 then
    raise exception 'JOURNAL_TOTALS_REQUIRED';
  end if;
  if v_total_debit <> v_total_credit then
    raise exception 'JOURNAL_NOT_BALANCED';
  end if;

  for v_line in
    select value from jsonb_array_elements(coalesce(p_posting#>'{journal,lines}','[]'::jsonb))
  loop
    v_line_count := v_line_count + 1;
    v_debit := coalesce(nullif(v_line->>'debit','')::numeric,0);
    v_credit := coalesce(nullif(v_line->>'credit','')::numeric,0);

    if v_debit < 0 or v_credit < 0 or
       not ((v_debit > 0 and v_credit = 0) or (v_credit > 0 and v_debit = 0)) then
      raise exception 'JOURNAL_LINE_ONE_SIDED_REQUIRED';
    end if;

    v_calc_debit := v_calc_debit + v_debit;
    v_calc_credit := v_calc_credit + v_credit;
  end loop;

  if v_line_count < 2 then
    raise exception 'JOURNAL_LINES_REQUIRED';
  end if;
  if v_calc_debit <> v_calc_credit or
     v_calc_debit <> v_total_debit or
     v_calc_credit <> v_total_credit then
    raise exception 'JOURNAL_LINE_TOTAL_MISMATCH';
  end if;

  insert into public.financial_events(
    accounting_entity_id,event_key,event_type,occurred_at,effective_at,
    amount,currency,source_system,source_record_id,service_code,
    idempotency_key,payload,evidence,status
  ) values (
    v_entity,
    v_event_key,
    v_event_type,
    coalesce(nullif(p_event->>'occurred_at','')::timestamptz,now()),
    v_effective,
    v_amount,
    v_currency,
    nullif(p_event#>>'{source,system}',''),
    nullif(p_event#>>'{source,record_id}',''),
    nullif(p_event->>'service_code',''),
    v_idempotency,
    coalesce(p_event->'payload','{}'::jsonb),
    coalesce(p_event->'evidence','[]'::jsonb),
    'accepted'
  )
  returning id into v_event_id;

  insert into public.accounting_subledger_entries(
    accounting_entity_id,financial_event_id,subledger_code,source_record_id,
    amount,currency,status,metadata
  ) values (
    v_entity,
    v_event_id,
    coalesce(nullif(p_posting#>>'{subledger,code}',''),v_event_type),
    coalesce(nullif(p_posting#>>'{subledger,source_record_id}',''),p_event#>>'{source,record_id}'),
    v_amount,
    v_currency,
    'pending',
    jsonb_build_object('event_key',v_event_key)
  )
  returning id into v_subledger_id;

  insert into public.accounting_journal_entries(
    accounting_entity_id,financial_event_id,period_id,effective_at,currency,
    description,status,total_debit,total_credit,posted_at,metadata
  ) values (
    v_entity,
    v_event_id,
    v_period_id,
    v_effective,
    v_currency,
    coalesce(nullif(p_posting->>'description',''),v_event_type),
    'posted',
    v_total_debit,
    v_total_credit,
    now(),
    jsonb_build_object('event_key',v_event_key,'subledger_entry_id',v_subledger_id)
  )
  returning id into v_journal_id;

  for v_line in
    select value from jsonb_array_elements(p_posting#>'{journal,lines}')
  loop
    insert into public.accounting_journal_lines(
      journal_entry_id,accounting_entity_id,line_no,account_code,account_name,
      debit,credit,dimensions
    ) values (
      v_journal_id,
      v_entity,
      (v_line->>'line_no')::integer,
      nullif(v_line->>'account_code',''),
      coalesce(nullif(v_line->>'account_name',''),v_line->>'account_code'),
      coalesce(nullif(v_line->>'debit','')::numeric,0),
      coalesce(nullif(v_line->>'credit','')::numeric,0),
      coalesce(v_line->'dimensions','{}'::jsonb)
    );
  end loop;

  update public.financial_events
    set status = 'posted'
  where id = v_event_id;

  update public.accounting_subledger_entries
    set status = 'posted'
  where id = v_subledger_id;

  return jsonb_build_object(
    'ok', true,
    'state', 'claimed',
    'event_id', v_event_id,
    'posting_id', v_journal_id,
    'subledger_id', v_subledger_id,
    'period_id', v_period_id
  );
end;
$$;

revoke all on function public.accounting_commit_posting(jsonb,jsonb) from public;
revoke all on function public.accounting_commit_posting(jsonb,jsonb) from anon, authenticated;

commit;
