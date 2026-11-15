-- Independent verification events log for official correspondence issues.
-- The public verify endpoint records every successful verification here, while the
-- atomic RPC below removes the previous non-atomic read-then-update counter race.

create table if not exists public.correspondence_verification_events (
  id uuid primary key default gen_random_uuid(),
  issue_id uuid references public.correspondence_issues(id) on delete set null,
  document_id uuid references public.correspondence_documents(id) on delete set null,
  issue_number text,
  actor_user_id uuid,
  result text not null check (result in ('verified','failed')),
  ip_hash text,
  user_agent_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_correspondence_verification_events_issue
  on public.correspondence_verification_events(issue_id, created_at desc);

-- Correspondence tables are service-role only, same as the rest of the register.
alter table public.correspondence_verification_events enable row level security;
revoke all on table public.correspondence_verification_events from anon, authenticated;
grant select, insert on table public.correspondence_verification_events to service_role;

-- Atomic increment-and-return so concurrent verifications cannot lose updates.
create or replace function public.increment_issue_verification_count(p_issue_id uuid)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  new_count bigint;
begin
  update public.correspondence_issues
     set verification_count = verification_count + 1,
         last_verified_at = now()
   where id = p_issue_id
   returning verification_count into new_count;
  return new_count;
end;
$function$;

revoke execute on function public.increment_issue_verification_count(uuid) from public, anon, authenticated;
grant execute on function public.increment_issue_verification_count(uuid) to service_role;
