-- Disposable CI-only database fixture. No production users, secrets or records.
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
END $$;
CREATE SCHEMA auth;
CREATE TABLE auth.users(id uuid PRIMARY KEY);
CREATE TABLE public.companies(id uuid PRIMARY KEY, name text);
CREATE TABLE public.correspondence_documents(id uuid PRIMARY KEY, company_id uuid REFERENCES public.companies(id),status text);
INSERT INTO auth.users(id) VALUES ('11111111-1111-4111-8111-111111111111');
INSERT INTO public.companies(id,name) VALUES
('22222222-2222-4222-8222-222222222222','Company A'),
('33333333-3333-4333-8333-333333333333','Company B');
INSERT INTO public.correspondence_documents(id,company_id,status) VALUES
('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','issued');
