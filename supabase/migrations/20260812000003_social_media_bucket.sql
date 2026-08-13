-- Create a public Supabase Storage bucket for social media uploads.

insert into storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
values (
  'social-media',
  'social-media',
  true,
  false,
  16777216, -- 16 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 16777216,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime'];

-- Allow public read of social-media objects.
-- Wrapped in a DO block because "CREATE POLICY IF NOT EXISTS" requires Postgres 16+.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Social media public read'
  ) then
    create policy "Social media public read"
      on storage.objects
      for select
      to public
      using (bucket_id = 'social-media');
  end if;
end $$;

-- Allow authenticated users to upload (server-side service role bypasses RLS anyway).
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Social media authenticated upload'
  ) then
    create policy "Social media authenticated upload"
      on storage.objects
      for insert
      to authenticated
      with check (bucket_id = 'social-media');
  end if;
end $$;
