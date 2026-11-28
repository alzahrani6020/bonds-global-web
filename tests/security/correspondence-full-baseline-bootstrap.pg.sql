-- Disposable PostgreSQL 17 prerequisite fixture for ORIGINAL correspondence
-- migrations. Never run against staging or production. No real contacts/secrets.
-- This is not a restored production database: public/auth/storage primitives
-- stand in for unrelated service modules only.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.companies (id uuid PRIMARY KEY);
CREATE TABLE public.crm_app_workspaces (
 id uuid PRIMARY KEY,
 owner_user_id uuid NOT NULL REFERENCES auth.users(id),
 name text NOT NULL
);
CREATE TABLE public.crm_app_activities (id uuid PRIMARY KEY);
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (
 id text PRIMARY KEY,
 name text NOT NULL,
 public boolean NOT NULL DEFAULT false,
 file_size_limit bigint,
 allowed_mime_types text[]
);
INSERT INTO auth.users(id) VALUES
('11111111-1111-4111-8111-111111111111'),
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
INSERT INTO public.crm_app_workspaces(id,owner_user_id,name) VALUES
('22222222-2222-4222-8222-222222222222','11111111-1111-4111-8111-111111111111','Acceptance Company A'),
('33333333-3333-4333-8333-333333333333','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','Acceptance Company B');
