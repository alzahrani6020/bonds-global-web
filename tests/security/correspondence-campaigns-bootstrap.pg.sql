-- Disposable CI-only database fixture. No production users, secrets or records.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.crm_app_workspaces(id uuid PRIMARY KEY, owner_user_id uuid not null references auth.users(id), name text);
CREATE TABLE public.crm_app_activities(id uuid PRIMARY KEY);
CREATE TABLE public.correspondence_documents(id uuid PRIMARY KEY, company_id uuid, owner_user_id uuid REFERENCES auth.users(id), workspace_context jsonb default '{}'::jsonb,status text);
-- Two separate synthetic users; no shared ownership or real auth identities.
INSERT INTO auth.users(id) VALUES
('11111111-1111-4111-8111-111111111111'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.crm_app_workspaces(id,owner_user_id,name) VALUES
('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Company A'),
('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Company B');
INSERT INTO public.correspondence_documents(id,owner_user_id,workspace_context,status) VALUES
('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111','{"campaign_workspace_id":"22222222-2222-4222-8222-222222222222"}'::jsonb,'issued');
