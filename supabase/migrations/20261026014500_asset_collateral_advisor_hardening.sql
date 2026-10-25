begin;

-- Advisor hardening for canonical asset registry.
-- Preserve existing ownership semantics while avoiding per-row auth.uid() init plans.

drop policy if exists bonds_assets_user_isolation on public.bonds_assets;

create policy bonds_assets_user_isolation
on public.bonds_assets
for all
to public
using (
  exists (
    select 1
    from public.bonds_projects p
    where p.id = bonds_assets.project_id
      and p.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.bonds_projects p
    where p.id = bonds_assets.project_id
      and p.user_id = (select auth.uid())
  )
);

commit;
