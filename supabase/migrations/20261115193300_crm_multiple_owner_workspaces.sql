-- Permit an authenticated owner to manage multiple separate CRM workspaces.
-- Existing IDs, records, membership policies, foreign keys and ownership are untouched.
-- The pre-existing owner index remains for efficient workspace listing.
begin;
alter table public.crm_app_workspaces
  drop constraint if exists crm_app_workspaces_owner_user_id_key;
create index if not exists crm_app_workspaces_owner_created_idx
  on public.crm_app_workspaces(owner_user_id,created_at,id);
commit;
