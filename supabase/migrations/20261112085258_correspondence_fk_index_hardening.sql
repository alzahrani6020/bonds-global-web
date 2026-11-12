create index if not exists idx_correspondence_documents_reviewed_by
  on public.correspondence_documents(reviewed_by) where reviewed_by is not null;
create index if not exists idx_correspondence_documents_approved_by
  on public.correspondence_documents(approved_by) where approved_by is not null;
create index if not exists idx_correspondence_documents_issued_by
  on public.correspondence_documents(issued_by) where issued_by is not null;
create index if not exists idx_correspondence_documents_signed_by
  on public.correspondence_documents(signed_by) where signed_by is not null;
create index if not exists idx_correspondence_documents_stamped_by
  on public.correspondence_documents(stamped_by) where stamped_by is not null;
create index if not exists idx_correspondence_documents_created_by
  on public.correspondence_documents(created_by);
create index if not exists idx_correspondence_events_actor
  on public.correspondence_events(actor_user_id) where actor_user_id is not null;
create index if not exists idx_correspondence_tasks_assigned_user
  on public.correspondence_tasks(assigned_user_id) where assigned_user_id is not null;
create index if not exists idx_correspondence_tasks_completed_by
  on public.correspondence_tasks(completed_by) where completed_by is not null;
create index if not exists idx_correspondence_permissions_granted_by
  on public.correspondence_user_permissions(granted_by) where granted_by is not null;
create index if not exists idx_correspondence_versions_created_by
  on public.correspondence_versions(created_by);
