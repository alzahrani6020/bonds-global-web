create table if not exists public.evolution_proposals (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null unique check (fingerprint ~ '^[0-9a-f]{64}$'),
  event_type text not null,
  severity text not null check (severity in ('low','medium','high','critical')),
  status text not null default 'observing' check (status in ('observing','proposed','approved','rejected','superseded')),
  occurrence_count integer not null default 1 check (occurrence_count > 0),
  threshold integer not null check (threshold > 0),
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  execution_authorized boolean not null default false,
  auto_execute boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.evolution_proposals enable row level security;

revoke all on table public.evolution_proposals from public;
revoke all on table public.evolution_proposals from anon;
revoke all on table public.evolution_proposals from authenticated;
grant select, insert, update on table public.evolution_proposals to service_role;

create index if not exists evolution_proposals_status_idx
  on public.evolution_proposals(status, severity, updated_at desc);

create or replace function public.evolution_aggregate_signal(
  p_fingerprint text,
  p_event_type text,
  p_severity text,
  p_threshold integer,
  p_metadata jsonb,
  p_occurred_at timestamptz
)
returns public.evolution_proposals
language plpgsql
security invoker
set search_path = ''
as $$
declare
  saved public.evolution_proposals%rowtype;
begin
  insert into public.evolution_proposals(
    fingerprint,event_type,severity,status,occurrence_count,threshold,
    first_seen_at,last_seen_at,metadata,execution_authorized,auto_execute
  )
  values(
    p_fingerprint,p_event_type,p_severity,
    case when p_threshold <= 1 then 'proposed' else 'observing' end,
    1,p_threshold,p_occurred_at,p_occurred_at,coalesce(p_metadata,'{}'::jsonb),false,false
  )
  on conflict (fingerprint) do update set
    occurrence_count = public.evolution_proposals.occurrence_count + 1,
    threshold = excluded.threshold,
    severity = excluded.severity,
    last_seen_at = greatest(public.evolution_proposals.last_seen_at, excluded.last_seen_at),
    metadata = excluded.metadata,
    status = case
      when public.evolution_proposals.status in ('approved','rejected','superseded')
        then public.evolution_proposals.status
      when public.evolution_proposals.occurrence_count + 1 >= excluded.threshold
        then 'proposed'
      else 'observing'
    end,
    updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

revoke all on function public.evolution_aggregate_signal(text,text,text,integer,jsonb,timestamptz) from public;
revoke all on function public.evolution_aggregate_signal(text,text,text,integer,jsonb,timestamptz) from anon;
revoke all on function public.evolution_aggregate_signal(text,text,text,integer,jsonb,timestamptz) from authenticated;
grant execute on function public.evolution_aggregate_signal(text,text,text,integer,jsonb,timestamptz) to service_role;
