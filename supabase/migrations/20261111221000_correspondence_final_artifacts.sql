-- Final immutable PDF artifact for governed correspondence.
-- Additive only.

alter table public.correspondence_documents
  add column if not exists artifact_path text,
  add column if not exists artifact_hash text,
  add column if not exists artifact_size_bytes bigint,
  add column if not exists artifact_created_at timestamptz;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'correspondence-artifacts',
  'correspondence-artifacts',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Bucket is server-only. No direct anon/authenticated object policies are created.
