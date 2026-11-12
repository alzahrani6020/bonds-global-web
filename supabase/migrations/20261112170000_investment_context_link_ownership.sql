-- BONDS investment context: link ownership guard.
-- asset_valuations and bonds_investment_artifacts are writable by their owner
-- through RLS (user_id = auth.uid()), but their project/deal/opportunity links
-- were only FK-checked. Lifecycle adapters read these rows by project_id with
-- the service role, so a link to another user's record must be rejected.
-- Additive and idempotent; existing rows are not modified.

create or replace function public.bonds_assert_investment_link_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.project_id is not null
     and not exists (
       select 1 from public.bonds_projects p
       where p.id = new.project_id and p.user_id = new.user_id
     ) then
    raise exception 'PROJECT_NOT_OWNED' using errcode = '42501';
  end if;

  if new.deal_id is not null
     and not exists (
       select 1 from public.bonds_deals d
       where d.id = new.deal_id and d.user_id = new.user_id
     ) then
    raise exception 'DEAL_NOT_OWNED' using errcode = '42501';
  end if;

  if new.opportunity_id is not null
     and not exists (
       select 1 from public.bonds_investment_opportunities o
       where o.id = new.opportunity_id and o.user_id = new.user_id
     ) then
    raise exception 'OPPORTUNITY_NOT_OWNED' using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke all on function public.bonds_assert_investment_link_owner() from public;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'asset_valuations_investment_link_owner') then
    create trigger asset_valuations_investment_link_owner
      before insert or update of project_id, deal_id, opportunity_id, user_id
      on public.asset_valuations
      for each row execute function public.bonds_assert_investment_link_owner();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'bonds_investment_artifacts_link_owner') then
    create trigger bonds_investment_artifacts_link_owner
      before insert or update of project_id, deal_id, opportunity_id, user_id
      on public.bonds_investment_artifacts
      for each row execute function public.bonds_assert_investment_link_owner();
  end if;
end;
$$;
