begin;

-- Reuse the existing dedicated aging workspaces. These services remain
-- request_only because the existing surfaces are user-governed workflows,
-- not automated engines.

do $$
declare
  candidate_count integer;
begin
  select count(*) into candidate_count
  from public.service_catalog s
  join public.service_execution_profiles p
    on p.service_id=s.id and p.is_active=true
  where s.status='published'
    and s.is_active=true
    and p.execution_mode='request_only'
    and s.code in ('accounts_receivable','accounts_payable');

  if candidate_count <> 2 then
    raise exception 'Expected 2 aging workspace routing candidates, found %', candidate_count;
  end if;
end $$;

update public.service_catalog
set
  default_route_ar = case code
    when 'accounts_receivable' then '/client/receivables-aging.html'
    when 'accounts_payable' then '/client/payables-aging.html'
    else default_route_ar
  end,
  default_route_en = case code
    when 'accounts_receivable' then '/en/client/receivables-aging.html'
    when 'accounts_payable' then '/en/client/payables-aging.html'
    else default_route_en
  end,
  metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
    'workspace_route_source','existing_client_aging_workspace',
    'workspace_route_wave','aging_workspaces_2026_10_26'
  ),
  updated_at = now()
where status='published'
  and is_active=true
  and code in ('accounts_receivable','accounts_payable');

commit;
