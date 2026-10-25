begin;
do $$
begin
  if exists (
    select 1 from public.accounting_entities
    where created_by is not null and status='active'
    group by created_by, lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g')), base_currency
    having count(*)>1
  ) then raise exception 'ACCOUNTING_ENTITY_DUPLICATES_MUST_BE_RESOLVED'; end if;
  if exists(select 1 from public.finance_refunds)
     or exists(select 1 from public.finance_reconciliation_items)
     or exists(select 1 from public.finance_collections)
     or exists(select 1 from public.finance_contracts)
     or exists(select 1 from public.finance_revenue_exceptions)
  then raise exception 'FINANCE_ENTITY_BACKFILL_REQUIRED'; end if;
end;
$$;

alter table public.accounting_entities add column if not exists normalized_name text
generated always as (lower(regexp_replace(btrim(name),'[[:space:]]+',' ','g'))) stored;
create unique index if not exists uq_accounting_entities_active_business_identity
on public.accounting_entities(created_by,normalized_name,base_currency)
where status='active' and created_by is not null;

alter table public.finance_refunds add column if not exists accounting_entity_id uuid, add column if not exists source_financial_event_id uuid, add column if not exists financial_event_id uuid, add column if not exists request_key text;
alter table public.finance_reconciliation_items add column if not exists accounting_entity_id uuid;
alter table public.finance_collections add column if not exists accounting_entity_id uuid;
alter table public.finance_contracts add column if not exists accounting_entity_id uuid;
alter table public.finance_revenue_exceptions add column if not exists accounting_entity_id uuid;

alter table public.finance_refunds alter column accounting_entity_id set not null, alter column source_financial_event_id set not null, alter column request_key set not null;
alter table public.finance_reconciliation_items alter column accounting_entity_id set not null;
alter table public.finance_collections alter column accounting_entity_id set not null;
alter table public.finance_contracts alter column accounting_entity_id set not null;
alter table public.finance_revenue_exceptions alter column accounting_entity_id set not null;

alter table public.finance_refunds add constraint finance_refunds_entity_fk foreign key(accounting_entity_id) references public.accounting_entities(id) on delete restrict;
alter table public.finance_refunds add constraint finance_refunds_source_event_fk foreign key(accounting_entity_id,source_financial_event_id) references public.financial_events(accounting_entity_id,id) on delete restrict;
alter table public.finance_refunds add constraint finance_refunds_posted_event_fk foreign key(accounting_entity_id,financial_event_id) references public.financial_events(accounting_entity_id,id) on delete restrict;
alter table public.finance_reconciliation_items add constraint finance_reconciliation_entity_fk foreign key(accounting_entity_id) references public.accounting_entities(id) on delete restrict;
alter table public.finance_collections add constraint finance_collections_entity_fk foreign key(accounting_entity_id) references public.accounting_entities(id) on delete restrict;
alter table public.finance_contracts add constraint finance_contracts_entity_fk foreign key(accounting_entity_id) references public.accounting_entities(id) on delete restrict;
alter table public.finance_revenue_exceptions add constraint finance_revenue_exceptions_entity_fk foreign key(accounting_entity_id) references public.accounting_entities(id) on delete restrict;

alter table public.finance_reconciliation_items drop constraint if exists finance_reconciliation_items_source_type_source_id_key;
create unique index if not exists uq_finance_reconciliation_entity_source on public.finance_reconciliation_items(accounting_entity_id,source_type,source_id);
create unique index if not exists uq_finance_refund_request on public.finance_refunds(accounting_entity_id,requested_by,request_key);
create index if not exists idx_finance_refunds_entity_created on public.finance_refunds(accounting_entity_id,created_at desc);
create index if not exists idx_finance_refunds_source_event on public.finance_refunds(accounting_entity_id,source_financial_event_id);
create index if not exists idx_finance_reconciliation_entity_created on public.finance_reconciliation_items(accounting_entity_id,created_at desc);
create index if not exists idx_finance_collections_entity_due on public.finance_collections(accounting_entity_id,due_date);
create index if not exists idx_finance_contracts_entity_end on public.finance_contracts(accounting_entity_id,end_date);
create index if not exists idx_finance_exceptions_entity_created on public.finance_revenue_exceptions(accounting_entity_id,created_at desc);

create or replace function public.finance_create_refund_request(p_accounting_entity_id uuid,p_source_financial_event_id uuid,p_amount numeric,p_reason text,p_request_key text,p_requested_by uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_source public.financial_events%rowtype; v_refund public.finance_refunds%rowtype; v_reserved numeric(20,2);
begin
  if p_accounting_entity_id is null or p_source_financial_event_id is null or p_requested_by is null then raise exception 'FINANCE_REFUND_REQUIRED_IDENTIFIERS_MISSING'; end if;
  if p_amount is null or p_amount<=0 then raise exception 'FINANCE_REFUND_AMOUNT_INVALID'; end if;
  if nullif(btrim(p_reason),'') is null then raise exception 'FINANCE_REFUND_REASON_REQUIRED'; end if;
  if nullif(btrim(p_request_key),'') is null or length(p_request_key)>128 or p_request_key !~ '^[A-Za-z0-9._:-]+$' then raise exception 'FINANCE_REFUND_REQUEST_KEY_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_accounting_entity_id::text||':'||p_source_financial_event_id::text,0));
  select * into v_refund from public.finance_refunds where accounting_entity_id=p_accounting_entity_id and requested_by=p_requested_by and request_key=p_request_key limit 1;
  if v_refund.id is not null then return jsonb_build_object('ok',true,'state','replayed','refund',to_jsonb(v_refund)); end if;
  select * into v_source from public.financial_events where id=p_source_financial_event_id and accounting_entity_id=p_accounting_entity_id and event_type='payment.received' and status='posted' for update;
  if v_source.id is null then raise exception 'FINANCE_REFUND_POSTED_PAYMENT_REQUIRED'; end if;
  select coalesce(sum(amount),0) into v_reserved from public.finance_refunds where accounting_entity_id=p_accounting_entity_id and source_financial_event_id=p_source_financial_event_id and status in('requested','approved','processing','completed');
  if round(v_reserved+p_amount,2)>round(v_source.amount,2) then raise exception 'FINANCE_REFUND_EXCEEDS_AVAILABLE_AMOUNT'; end if;
  insert into public.finance_refunds(accounting_entity_id,source_financial_event_id,amount,currency,reason,status,requested_by,request_key)
  values(p_accounting_entity_id,p_source_financial_event_id,round(p_amount,2),v_source.currency,left(btrim(p_reason),2000),'requested',p_requested_by,p_request_key)
  returning * into v_refund;
  return jsonb_build_object('ok',true,'state','created','refund',to_jsonb(v_refund));
end; $$;
revoke all on function public.finance_create_refund_request(uuid,uuid,numeric,text,text,uuid) from public,anon,authenticated;
grant execute on function public.finance_create_refund_request(uuid,uuid,numeric,text,text,uuid) to service_role;

create or replace function public.finance_complete_refund(p_refund_id uuid,p_actor_id uuid,p_event jsonb,p_posting jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v_refund public.finance_refunds%rowtype; v_posting jsonb; v_event_id uuid;
begin
  select * into v_refund from public.finance_refunds where id=p_refund_id for update;
  if v_refund.id is null then raise exception 'FINANCE_REFUND_NOT_FOUND'; end if;
  if v_refund.status='completed' and v_refund.financial_event_id is not null then return jsonb_build_object('ok',true,'state','replayed','refund',to_jsonb(v_refund)); end if;
  if v_refund.status<>'processing' then raise exception 'FINANCE_REFUND_NOT_PROCESSING'; end if;
  if v_refund.approved_by is null then raise exception 'FINANCE_REFUND_APPROVAL_REQUIRED'; end if;
  if p_event->>'type'<>'refund.completed'
     or (p_event->>'accounting_entity_id')::uuid<>v_refund.accounting_entity_id
     or p_event#>>'{source,system}'<>'finance_refunds'
     or p_event#>>'{source,record_id}'<>v_refund.id::text
     or round((p_event->>'amount')::numeric,2)<>round(v_refund.amount,2)
     or upper(p_event->>'currency')<>v_refund.currency
  then raise exception 'FINANCE_REFUND_POSTING_MISMATCH'; end if;
  v_posting:=public.accounting_commit_posting(p_event,p_posting);
  v_event_id:=nullif(v_posting->>'event_id','')::uuid;
  if v_event_id is null then raise exception 'FINANCE_REFUND_POSTING_EVENT_REQUIRED'; end if;
  update public.finance_refunds set status='completed',financial_event_id=v_event_id,completed_at=now(),updated_at=now() where id=v_refund.id returning * into v_refund;
  return jsonb_build_object('ok',true,'state',coalesce(v_posting->>'state','claimed'),'refund',to_jsonb(v_refund),'posting',v_posting,'completed_by',p_actor_id);
end; $$;
revoke all on function public.finance_complete_refund(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.finance_complete_refund(uuid,uuid,jsonb,jsonb) to service_role;
commit;
