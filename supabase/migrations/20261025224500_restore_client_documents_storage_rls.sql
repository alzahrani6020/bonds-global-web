begin;

-- Restore and modernize private client-document Storage ownership policies.
-- Supabase Storage uses owner_id (text) as the authenticated object owner.
-- Keep the bucket private and restrict every allowed operation to the JWT subject.

drop policy if exists client_documents_select on storage.objects;
drop policy if exists client_documents_insert on storage.objects;
drop policy if exists client_documents_delete on storage.objects;

create policy client_documents_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'client-documents'
  and owner_id = (select auth.uid()::text)
);

create policy client_documents_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'client-documents'
  and owner_id = (select auth.uid()::text)
);

create policy client_documents_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'client-documents'
  and owner_id = (select auth.uid()::text)
);

commit;
