-- Employee compensation/rights ledger. Values are explicitly entered and require approval.
-- A record is NOT a transfer, statutory entitlement formula or financial posting.
create table public.hr_saas_entitlements (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.hr_saas_workspaces(id) on delete restrict,
 employee_id uuid not null,
 claim_reference text not null check(length(btrim(claim_reference)) between 1 and 80),
 claim_type text not null check(claim_type in ('expense','overtime','bonus','leave_payout','reimbursement','end_of_service','other')),
 description text not null check(length(btrim(description)) between 1 and 500),
 amount numeric(18,2) not null check(amount>=0),
 currency text not null default 'SAR' check(currency ~ '^[A-Z]{3}$'),
 effective_date date not null,
 status text not null default 'draft' check(status in ('draft','submitted','approved','rejected')),
 decision_note text,
 decided_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(workspace_id,id),unique(workspace_id,claim_reference),
 foreign key(workspace_id,employee_id) references public.hr_saas_employees(workspace_id,id) on delete restrict,
 check((status in ('approved','rejected'))=(decided_at is not null))
);
create index hr_saas_entitlements_workspace_idx on public.hr_saas_entitlements(workspace_id,employee_id,effective_date desc);
create function hr_saas_private.entitlement_guard() returns trigger
 language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' then
  if new.status<>'draft' then
   raise exception 'Claim must start as a draft' using errcode='23514';
  end if;
  new.decided_at=null;
 else
  if new.workspace_id<>old.workspace_id or new.employee_id<>old.employee_id or new.claim_reference<>old.claim_reference then
   raise exception 'Claim identity cannot change' using errcode='23514';
  end if;
  if old.status in ('approved','rejected') and new is distinct from old then
   raise exception 'Decided claim cannot be rewritten' using errcode='23514';
  end if;
  if old.status='draft' and new.status not in ('draft','submitted') then
   raise exception 'Claim must be submitted before decision' using errcode='23514';
  end if;
  if old.status='submitted' and new.status not in ('submitted','approved','rejected','draft') then
   raise exception 'Invalid claim transition' using errcode='23514';
  end if;
  if new.status in ('approved','rejected') then
   new.decided_at=coalesce(old.decided_at,now());
  else new.decided_at=null;
  end if;
 end if;
 return new;
end $$;
revoke all on function hr_saas_private.entitlement_guard() from public,anon,authenticated;
create trigger hr_saas_entitlement_guard before insert or update on public.hr_saas_entitlements
 for each row execute function hr_saas_private.entitlement_guard();
alter table public.hr_saas_entitlements enable row level security;
create policy hr_saas_entitlements_select on public.hr_saas_entitlements for select to authenticated using (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())));
create policy hr_saas_entitlements_insert on public.hr_saas_entitlements for insert to authenticated with check (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())));
create policy hr_saas_entitlements_update on public.hr_saas_entitlements for update to authenticated using (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now()))) with check (exists(select 1 from public.hr_saas_workspaces w join public.company_program_entitlements e on e.owner_user_id=w.owner_user_id where w.id=workspace_id and w.owner_user_id=(select auth.uid()) and e.product_code in ('hr','suite') and e.status in ('active','trial') and e.starts_at<=now() and (e.ends_at is null or e.ends_at>now())));
revoke all on public.hr_saas_entitlements from public,anon,authenticated;
grant select,insert,update on public.hr_saas_entitlements to authenticated;
create trigger hr_saas_entitlements_audit after insert or update on public.hr_saas_entitlements
 for each row execute function hr_saas_private.audit_change();
