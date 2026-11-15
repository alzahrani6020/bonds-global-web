-- An optional, verified 1:1 bridge to an existing SCC380 tenant.
-- Never auto-derive a Makkin tenant from workspace ID or hostname.
-- No bridge means NO Makkin API access. No SCC380 production changes.
begin;
create table if not exists public.company_program_makkin_links (
  id uuid primary key default gen_random_uuid(),
  workspace_link_id uuid not null unique
    references public.company_program_workspaces(id) on delete restrict,
  makkin_tenant_id text not null unique
    check (length(btrim(makkin_tenant_id)) between 1 and 128),
  state text not null default 'pending'
    check(state in ('pending','verified','suspended')),
  verified_at timestamptz,
  verified_by uuid references auth.users(id) on delete restrict,
  source_snapshot_sha text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check((state='verified' and verified_at is not null and verified_by is not null)
       or state<>'verified')
);
create index if not exists company_program_makkin_links_state_idx
 on public.company_program_makkin_links(state);
alter table public.company_program_makkin_links enable row level security;
revoke all on public.company_program_makkin_links from public, anon, authenticated;
grant select,insert,update on public.company_program_makkin_links to service_role;
-- The link is exclusively service-side. Browser clients must never infer
-- internal tenant IDs or change mappings. Service-role actions must additionally
-- verify a logged operator/approval before switching a mapping to 'verified'.
commit;
