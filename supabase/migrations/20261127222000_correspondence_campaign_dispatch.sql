-- Durable, idempotent and tenant-bound delivery queue. A provider uncertainty is
-- terminal to automatic retries until separately reconciled by an operator.
create unique index if not exists correspondence_campaign_recipients_scope_uidx
 on public.correspondence_campaign_recipients(id,campaign_id,workspace_id);
create table if not exists public.correspondence_campaign_dispatch_jobs (
 id uuid primary key default gen_random_uuid(),
 campaign_id uuid not null,
 workspace_id uuid not null,
 recipient_id uuid not null,
 document_id uuid not null references public.correspondence_documents(id) on delete restrict,
 mailbox_id uuid not null,
 issued_hash text not null check(issued_hash ~ '^[a-f0-9]{64}$'),
 idempotency_key text not null unique check(idempotency_key ~ '^[a-f0-9]{64}$'),
 status text not null default 'ready'
   check(status in ('ready','sending','accepted','unknown','failed','cancelled')),
 attempt_count integer not null default 0 check(attempt_count between 0 and 5),
 claimed_by uuid references auth.users(id) on delete set null,
 claimed_at timestamptz,
 provider_message_id text,
 error_code text,
 accepted_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 foreign key(campaign_id,workspace_id) references public.correspondence_campaigns(id,workspace_id) on delete restrict,
 foreign key(recipient_id,campaign_id,workspace_id) references public.correspondence_campaign_recipients(id,campaign_id,workspace_id) on delete restrict,
 foreign key(mailbox_id,workspace_id) references public.correspondence_mailboxes(id,workspace_id) on delete restrict
);
create unique index if not exists correspondence_campaign_dispatch_jobs_recipient_uidx
 on public.correspondence_campaign_dispatch_jobs(campaign_id,recipient_id);
create unique index if not exists correspondence_campaign_dispatch_jobs_document_uidx
 on public.correspondence_campaign_dispatch_jobs(document_id);
create index if not exists correspondence_campaign_dispatch_jobs_pending_idx
 on public.correspondence_campaign_dispatch_jobs(campaign_id,status,created_at);
alter table public.correspondence_campaign_dispatch_jobs enable row level security;
revoke all on public.correspondence_campaign_dispatch_jobs from public,anon,authenticated;
grant select,insert,update on public.correspondence_campaign_dispatch_jobs to service_role;
